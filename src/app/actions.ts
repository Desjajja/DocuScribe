'use server';

import { db } from '@/lib/db-server';
import type { Document, Schedule } from '@/lib/db';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';


export async function getDocuments(): Promise<Document[]> {
  const stmt = db.prepare('SELECT * FROM documents ORDER BY lastUpdated DESC');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    ...row,
    hashtags: JSON.parse(row.hashtags || '[]'),
  }));
}

export async function getDocumentByUrl(url: string): Promise<Document | null> {
    const stmt = db.prepare('SELECT * FROM documents WHERE url = ?');
    const row = stmt.get(url) as any;
    if (!row) return null;
    return {
        ...row,
        hashtags: JSON.parse(row.hashtags || '[]'),
    };
}

const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 9);
function genUniqueShortId(): string {
  while (true) {
    const id = nano();
    const existing = db.prepare('SELECT 1 FROM documents WHERE doc_uid = ?').get(id);
    if (!existing) return id;
  }
}

export async function addDocument(doc: Omit<Document, 'id' | 'doc_uid'>): Promise<number> {
  const { title, url, image, aiHint, content, hashtags, lastUpdated, schedule, maxPages } = doc;
  const docUid = genUniqueShortId();
  const stmt = db.prepare(`
    INSERT INTO documents (title, url, image, aiHint, content, hashtags, lastUpdated, schedule, maxPages, doc_uid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    title,
    url,
    image,
    aiHint,
    content,
    JSON.stringify(hashtags),
    lastUpdated,
    schedule,
    maxPages,
    docUid
  );
  return result.lastInsertRowid as number;
}

export async function updateDocument(doc: Document): Promise<void> {
  const { id, title, url, image, aiHint, content, hashtags, lastUpdated, schedule, maxPages } = doc;
  const stmt = db.prepare(`
    UPDATE documents
    SET title = ?, url = ?, image = ?, aiHint = ?, content = ?, hashtags = ?, lastUpdated = ?, schedule = ?, maxPages = ?
    WHERE id = ?
  `);
  stmt.run(
    title,
    url,
    image,
    aiHint,
    content,
    JSON.stringify(hashtags),
    lastUpdated,
    schedule,
    maxPages,
    id
  );
}

export async function deleteDocument(id: number): Promise<void> {
  const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
  stmt.run(id);
}

export async function updateDocumentSchedule(id: number, schedule: Schedule, maxPages?: number): Promise<void> {
    if (maxPages !== undefined) {
        const stmt = db.prepare('UPDATE documents SET schedule = ?, maxPages = ? WHERE id = ?');
        stmt.run(schedule, maxPages, id);
    } else {
        const stmt = db.prepare('UPDATE documents SET schedule = ? WHERE id = ?');
        stmt.run(schedule, id);
    }
}

// List unique documentation names (document titles) with aggregated, deduplicated hashtags
export async function listDocumentations(limit = 100, offset = 0): Promise<Array<{ id: string; name: string; hashtags: string[] }>> {
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const safeOffset = Math.max(offset, 0);
  // Order by lastUpdated so we pick the most recent entry per title when collapsing duplicates.
  const rows = db.prepare('SELECT doc_uid, title, hashtags FROM documents ORDER BY lastUpdated DESC LIMIT ? OFFSET ?').all(safeLimit, safeOffset) as any[];
  const map = new Map<string, { id: string; tags: Set<string> }>();
  for (const r of rows) {
    const title = r.title || '';
    let tags: string[] = [];
    try { tags = JSON.parse(r.hashtags || '[]'); } catch { /* ignore */ }
    if (!map.has(title)) {
      map.set(title, { id: r.doc_uid, tags: new Set() });
    }
    const entry = map.get(title)!;
    for (const t of tags) entry.tags.add(t);
  }
  return Array.from(map.entries()).map(([name, { id, tags }]) => ({ id, name, hashtags: Array.from(tags) }));
}

// New: list-all-docs endpoint backend (id-based)
export async function listAllDocs(limit = 100, offset = 0): Promise<Array<{ id: string; name: string; hashtags: string[] }>> {
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const safeOffset = Math.max(offset, 0);
  const rows = db.prepare('SELECT doc_uid, title, hashtags FROM documents ORDER BY lastUpdated DESC LIMIT ? OFFSET ?').all(safeLimit, safeOffset) as any[];
  return rows.map(r => {
    let tags: string[] = [];
    try { tags = JSON.parse(r.hashtags || '[]'); } catch { /* ignore */ }
    return { id: r.doc_uid, name: r.title, hashtags: tags };
  });
}

// Fetch a single document by exact documentation name (title)
export async function getDocumentationByName(name: string): Promise<Document | null> {
  if (!name || !name.trim()) return null;
  // Case-insensitive exact match using COLLATE NOCASE
  const stmt = db.prepare('SELECT * FROM documents WHERE title = ? COLLATE NOCASE LIMIT 1');
  const row = stmt.get(name) as any;
  if (!row) return null;
  // Omit image from returned payload per API change request
  const { image, hashtags, ...rest } = row;
  return {
    ...rest,
    hashtags: (() => { try { return JSON.parse(hashtags || '[]'); } catch { return []; } })()
  } as Document;
}

// New: fetch document by stable doc_uid
export async function getDocumentationById(id: string): Promise<Document | null> {
  if (!id) return null;
  const stmt = db.prepare('SELECT * FROM documents WHERE doc_uid = ? LIMIT 1');
  const row = stmt.get(id) as any;
  if (!row) return null;
  const { image, hashtags, ...rest } = row;
  return {
    ...rest,
    hashtags: (() => { try { return JSON.parse(hashtags || '[]'); } catch { return []; } })()
  } as Document;
}
