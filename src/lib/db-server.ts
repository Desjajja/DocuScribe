
import path from 'path';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';

// Use require for better-sqlite3 to ensure it's treated as a commonjs module
const Database = require('better-sqlite3');

// Define the path to the database file
const dbPath = path.resolve(process.cwd(), 'docuscribe.db');

// Initialize the database connection
export const db = new Database(dbPath);

// Create the documents table if it doesn't exist
// This query runs only once when the server starts
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    image TEXT,
    aiHint TEXT,
    content TEXT,
    hashtags TEXT,
    lastUpdated TEXT NOT NULL,
    schedule TEXT DEFAULT 'none',
    maxPages INTEGER DEFAULT 5,
    doc_uid TEXT UNIQUE
  )
`);

// Helper to generate a short (9 char) lowercase alphanumeric id
// NanoID generator (9 chars, lowercase alphanumeric)
const nano = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 9);
function generateUniqueShortId(dbInstance: any): string {
  while (true) {
    const id = nano();
    const existing = dbInstance.prepare('SELECT 1 FROM documents WHERE doc_uid = ?').get(id);
    if (!existing) return id;
  }
}

// Lightweight migration: ensure doc_uid column exists & populated (short ids 8-10 chars; we use 9)
try {
  const columns: Array<{ name: string }> = db.prepare(`PRAGMA table_info(documents)`).all();
  const hasDocUid = columns.some(c => c.name === 'doc_uid');
  if (!hasDocUid) {
    db.exec(`ALTER TABLE documents ADD COLUMN doc_uid TEXT UNIQUE`);
  }
  // Populate any NULL / empty / too-long legacy (UUID length > 12) doc_uid values with short ids
  const rowsToFix: Array<{ id: number }> = db.prepare(`SELECT id FROM documents WHERE doc_uid IS NULL OR doc_uid = '' OR LENGTH(doc_uid) > 12`).all();
  if (rowsToFix.length > 0) {
    const updateStmt = db.prepare(`UPDATE documents SET doc_uid = ? WHERE id = ?`);
    const tx = db.transaction((batch: Array<{ id: number }>) => {
      for (const r of batch) {
        const shortId = generateUniqueShortId(db);
        updateStmt.run(shortId, r.id);
      }
    });
    tx(rowsToFix);
  }
  // Ensure index
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_doc_uid ON documents(doc_uid)`);
} catch (e) {
  console.error('doc_uid migration failed (non-fatal):', e);
}
