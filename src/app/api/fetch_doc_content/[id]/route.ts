import { NextResponse } from 'next/server';
import { getDocumentationById, getDocumentationByName } from '@/app/actions';

// Detail endpoint: fetch_doc_content/:id (id is doc_uid; falls back to legacy title match)
export async function GET(req: Request, context: { params: any }) {
  const paramsObj = context.params && typeof context.params.then === 'function' ? await context.params : context.params;
  const rawId = paramsObj?.id;
  if (!rawId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const id = decodeURIComponent(rawId);
  try {
    const url = new URL(req.url);
    // Query params:
    // start: starting word index (default 0)
    // max_length: maximum number of words to return (default 10000, cap 50000)
    // If max_length omitted, use default. If > cap, clamp.
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
    // Word-based slicing
    const content = document.content || '';
    const words = content.split(/\s+/);
    if (start >= words.length) {
      return NextResponse.json({
        document: { ...document, content: '' },
        meta: {
          total_words: words.length,
          returned_words: 0,
          start,
          max_length: maxLength,
          end: start,
          has_more: false,
        }
      });
    }
    const endExclusive = Math.min(start + maxLength, words.length);
    const slice = words.slice(start, endExclusive).join(' ');
    const hasMore = endExclusive < words.length;
    return NextResponse.json({
      document: { ...document, content: slice },
      meta: {
        total_words: words.length,
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
