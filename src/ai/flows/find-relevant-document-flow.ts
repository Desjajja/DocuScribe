'use server';
/**
 * @fileOverview A flow to find the most relevant document from a library based on a query.
 * It prioritizes hashtag matching and falls back to AI-powered content matching.
 *
 * - findRelevantDocument - The main function to find the best document match.
 * - FindRelevantDocumentInput - Input type for the findRelevantDocument function.
 * - FindRelevantDocumentOutput - Output type for the findRelevantDocument function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Simplified Document schema for the flow input
const DocumentSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  hashtags: z.array(z.string()),
});

const FindRelevantDocumentInputSchema = z.object({
  query: z.string().describe('The user\'s search query.'),
  documents: z.array(DocumentSchema).describe('The list of documents to search through.'),
});
export type FindRelevantDocumentInput = z.infer<typeof FindRelevantDocumentInputSchema>;

const FindRelevantDocumentOutputSchema = z.object({
  bestMatch: DocumentSchema.nullable().describe('The most relevant document, or null if no good match is found.'),
});
export type FindRelevantDocumentOutput = z.infer<typeof FindRelevantDocumentOutputSchema>;

export async function findRelevantDocument(input: FindRelevantDocumentInput): Promise<FindRelevantDocumentOutput> {
  return findRelevantDocumentFlow(input);
}

const contentMatchingPrompt = ai.definePrompt({
    name: 'contentMatchingPrompt',
    input: { schema: z.object({ query: z.string(), documents: z.array(DocumentSchema) }) },
    output: { schema: z.object({ bestMatchId: z.number().nullable() }) },
    prompt: `You are an intelligent search assistant. Your task is to find the single best document that answers the user's query from the provided list.

    User Query: "{{query}}"

    Analyze the content of the following documents and determine which one is the most relevant to the query. Respond with the ID of the best matching document. If no document is a good match, respond with null.

    Documents:
    {{#each documents}}
    ---
    ID: {{id}}
    Title: {{title}}
    Content: {{content}}
    ---
    {{/each}}
    `,
});


const findRelevantDocumentFlow = ai.defineFlow(
  {
    name: 'findRelevantDocumentFlow',
    inputSchema: FindRelevantDocumentInputSchema,
    outputSchema: FindRelevantDocumentOutputSchema,
  },
  async ({ query, documents }) => {
    // Stage 1: Hashtag Matching
    const lowerCaseQuery = query.toLowerCase();
    for (const doc of documents) {
      if (doc.hashtags.some(tag => tag.toLowerCase() === lowerCaseQuery)) {
        return { bestMatch: doc };
      }
    }

    // Stage 2: AI Content Matching
    if (documents.length > 0) {
        const { output } = await contentMatchingPrompt({ query, documents });
        if (output && output.bestMatchId !== null) {
            const matchedDoc = documents.find(d => d.id === output.bestMatchId);
            return { bestMatch: matchedDoc || null };
        }
    }

    return { bestMatch: null };
  }
);
