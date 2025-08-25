// This file defines the shared types for the database entities.
// It is safe to import from client components.

export type Schedule = 'none' | 'daily' | 'weekly' | 'monthly';

export type Document = {
  id: number;
  doc_uid?: string; // stable external id
  title: string;
  url: string;
  image: string;
  aiHint: string;
  content: string;
  hashtags: string[];
  lastUpdated: string;
  schedule: Schedule;
  maxPages: number;
};
