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
  aiDescription?: string; // one-time 30-word summary generated from first 1000 tokens
  content: string;
  hashtags: string[];
  lastUpdated: string;
  schedule: Schedule;
  maxPages: number;
};
