import { NextResponse } from 'next/server';
import { getDocumentationById, getDocumentationByName, getIndexPage } from '@/app/actions';

// Detail endpoint: fetch_doc_content/:id (id is doc_uid; falls back to legacy title match)
export async function GET(req: Request, context: { params: any }) {
  const paramsObj = context.params && typeof context.params.then === 'function' ? await context.params : context.params;
  const rawId = paramsObj?.id;
  if (!rawId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const id = decodeURIComponent(rawId);
  try {
    const url = new URL(req.url);
  // Query params:
  // start, max_length (legacy single-range)
  // ranges: comma-separated start-end (end exclusive) pairs for multi-range paragraph mode
  const rangesParam = url.searchParams.get('ranges');
  const hasStart = url.searchParams.has('start');
  const hasMaxLength = url.searchParams.has('max_length');
  const startParam = parseInt(url.searchParams.get('start') || '0', 10);
  const maxLengthParam = parseInt(url.searchParams.get('max_length') || '10000', 10);
  const start = isNaN(startParam) || startParam < 0 ? 0 : startParam;
  const maxCap = 50000; // safety cap
  const maxLength = isNaN(maxLengthParam) || maxLengthParam <= 0 ? 10000 : Math.min(maxLengthParam, maxCap);

    let document = await getDocumentationById(id);
    if (!document) {
      document = await getDocumentationByName(id); // legacy title fallback
    }
    if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // If no positional params at all -> index mode
    if (!rangesParam && !hasStart && !hasMaxLength) {
      const idx = document.doc_uid ? await getIndexPage(document.doc_uid) : null;
      if (!idx) return NextResponse.json({ error: 'Index not available' }, { status: 404 });
      // Parse index table (supports legacy fenced code block format)
      const indexPages: Array<{ page: number; start: number; end: number; len: number; title: string }> = [];
      try {
        const lines = idx.content.split(/\n/).map(l => l.replace(/\r/g,'')).filter(l => l.trim().length > 0);
        // Find header line starting with '#'
        const headerIdx = lines.findIndex(l => /^\s*#\s+start/i.test(l));
        if (headerIdx !== -1) {
          for (let i = headerIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/^```/.test(line)) continue; // skip code fences
            const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
            if (m) {
              const page = parseInt(m[1], 10);
              const start = parseInt(m[2], 10);
              const end = parseInt(m[3], 10);
              const len = parseInt(m[4], 10);
              const title = m[5].trim();
              if (!Number.isNaN(page) && !Number.isNaN(start) && !Number.isNaN(end) && !Number.isNaN(len)) {
                indexPages.push({ page, start, end, len, title });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse index table', e);
      }
      return NextResponse.json({
        document: { id: document.id, title: document.title, index: true },
        meta: { mode: 'index', of: document.doc_uid, pages: indexPages }
      });
    }

    const content = document.content || '';
    const words = content.split(/\s+/);
    const totalWords = words.length;

    // Multi-range mode
    if (rangesParam) {
      const rangeParts = rangesParam.split(',').map(s => s.trim()).filter(Boolean);
      const requested: Array<{ start: number; end: number }> = [];
      for (const part of rangeParts) {
        const m = part.match(/^(\d+)-(\d+)$/);
        if (!m) continue;
        const s = parseInt(m[1], 10); const e = parseInt(m[2], 10);
        if (isNaN(s) || isNaN(e) || s < 0 || e <= s) continue;
        if (s >= totalWords) continue;
        requested.push({ start: s, end: Math.min(e, totalWords) });
      }
      if (requested.length === 0) return NextResponse.json({ error: 'No valid ranges' }, { status: 400 });
      // Merge overlapping/adjacent
      requested.sort((a,b)=> a.start - b.start);
      const merged: Array<{ start: number; end: number }> = [];
      for (const r of requested) {
        const last = merged[merged.length -1];
        if (!last || r.start > last.end) merged.push({ ...r });
        else if (r.end > last.end) last.end = r.end;
      }
      // Cap total size
      const totalRequested = merged.reduce((acc,r)=> acc + (r.end - r.start), 0);
      if (totalRequested > maxCap) return NextResponse.json({ error: 'Requested ranges exceed cap' }, { status: 400 });
      // Paragraph mapping
      const paragraphs = content.split(/\n\s*\n/);
      const paraMeta: Array<{ index: number; start: number; end: number; text: string }> = [];
      let cursor = 0;
      for (let i=0;i<paragraphs.length;i++) {
        const p = paragraphs[i];
        const wCount = p.split(/\s+/).filter(Boolean).length;
        const startW = cursor;
        const endW = startW + wCount;
        paraMeta.push({ index: i, start: startW, end: endW, text: p });
        cursor = endW;
      }
      const included = new Set<number>();
      for (const r of merged) {
        for (const pm of paraMeta) {
          if (pm.end <= r.start) continue;
          if (pm.start >= r.end) break;
            included.add(pm.index);
        }
      }
      const selectedParas = paraMeta.filter(p => included.has(p.index));
      const concatenated = selectedParas.map(p => p.text).join('\n\n');
      const totalReturnedWords = selectedParas.reduce((acc,p)=> acc + (p.end - p.start),0);
      return NextResponse.json({
        document: { ...document, content: concatenated },
        meta: {
          mode: 'multi',
          total_words: totalWords,
          requested_ranges: requested,
          merged_ranges: merged,
          paragraphs: selectedParas.map(p => ({ index: p.index, start: p.start, end: p.end })),
          total_returned_words: totalReturnedWords
        }
      });
    }

    // Legacy single range
    if (start >= totalWords) {
      return NextResponse.json({
        document: { ...document, content: '' },
        meta: {
          mode: 'single',
          total_words: totalWords,
          returned_words: 0,
          start,
          max_length: maxLength,
          end: start,
          has_more: false,
        }
      });
    }
    const endExclusive = Math.min(start + maxLength, totalWords);
    const slice = words.slice(start, endExclusive).join(' ');
    const hasMore = endExclusive < totalWords;
    return NextResponse.json({
      document: { ...document, content: slice },
      meta: {
        mode: 'single',
        total_words: totalWords,
        returned_words: endExclusive - start,
        start,
        max_length: maxLength,
        end: endExclusive,
        has_more: hasMore,
        next_start: hasMore ? endExclusive : null,
      }
    });
  } catch (err) {
    console.error('fetch_doc_content error', err);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
