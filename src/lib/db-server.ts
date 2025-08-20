'use server';

import path from 'path';

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
    maxPages INTEGER DEFAULT 5
  )
`);
