'use server';

import { db } from '@/lib/db-server';
import type { Document, Schedule } from '@/lib/db';


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

export async function addDocument(doc: Omit<Document, 'id'>): Promise<number> {
  const { title, url, image, aiHint, content, hashtags, lastUpdated, schedule, maxPages } = doc;
  const stmt = db.prepare(`
    INSERT INTO documents (title, url, image, aiHint, content, hashtags, lastUpdated, schedule, maxPages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    maxPages
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
export async function listDocumentations(limit = 100, offset = 0): Promise<Array<{ name: string; hashtags: string[] }>> {
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const safeOffset = Math.max(offset, 0);
  const rows = db.prepare('SELECT title, hashtags FROM documents LIMIT ? OFFSET ?').all(safeLimit, safeOffset) as any[];
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const name = r.title || '';
    let tags: string[] = [];
    try { tags = JSON.parse(r.hashtags || '[]'); } catch { /* ignore */ }
    if (!map.has(name)) map.set(name, new Set());
    for (const t of tags) map.get(name)!.add(t);
  }
  return Array.from(map.entries()).map(([name, set]) => ({ name, hashtags: Array.from(set) }));
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
