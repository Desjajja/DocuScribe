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
