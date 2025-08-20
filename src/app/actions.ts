'use server';

import * as fs from 'fs/promises';
import * as path from 'path';

type Document = {
  id: number;
  title: string;
  url: string;
  image: string;
  aiHint: string;
  content: string;
  hashtags: string[];
  lastUpdated: string;
  schedule: 'none' | 'daily' | 'weekly' | 'monthly';
  maxPages: number;
};

export async function saveDocuments(documents: Document[]) {
  try {
    const filePath = path.join(process.cwd(), 'scrapedDocuments.json');
    await fs.writeFile(filePath, JSON.stringify(documents, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save documents:', error);
    // Depending on requirements, you might want to throw the error
    // to let the client know the save operation failed.
    throw new Error('Failed to save documents to the server.');
  }
}
