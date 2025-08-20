import { createStdioMcpServer, McpProvider, Context, Document } from '@modal-protocol/core';
import { findRelevantDocument, FindRelevantDocumentInput } from '@/ai/flows/find-relevant-document-flow';
import * as fs from 'fs/promises';
import * as path from 'path';

type LibraryDocument = {
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

const docuscribeProvider: McpProvider = {
  name: 'docuscribe-provider',
  async getContext(options) {
    const { query } = options;
    if (!query || query.trim() === '') {
      return null;
    }

    try {
      const filePath = path.join(process.cwd(), 'scrapedDocuments.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const documents: LibraryDocument[] = JSON.parse(fileContent);

      if (!documents || documents.length === 0) {
        return {
          content: 'Your document library is empty. Please scrape some websites first.',
        };
      }

      const flowInput: FindRelevantDocumentInput = {
        query,
        documents: documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            hashtags: doc.hashtags
        }))
      };

      const result = await findRelevantDocument(flowInput);
      
      if (result && result.bestMatch) {
         const matchedDoc = documents.find(d => d.id === result.bestMatch!.id);
         if (matchedDoc) {
            const context: Context = {
              content: `## ${matchedDoc.title}\n\n${matchedDoc.content}`,
              documents: [
                {
                  uri: matchedDoc.url,
                  content: matchedDoc.content,
                  metadata: {
                    title: matchedDoc.title
                  }
                },
              ],
            };
            return context;
         }
      }
      
      return {
          content: `No relevant document found in your library for the query: "${query}"`
      };

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          content: 'Document library file not found. Please add or update documents in the web UI to create it.',
        };
      }
      console.error('Error in getContext:', error);
      return {
        content: `An error occurred while searching your library: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

const server = createStdioMcpServer({
  providers: [docuscribeProvider],
});

server.listen();
