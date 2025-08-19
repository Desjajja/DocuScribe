'use server';
/**
 * @fileOverview A flow to generate hashtags from document content.
 *
 * - generateHashtags - Generates hashtags for a given piece of text.
 * - GenerateHashtagsInput - Input type for the generateHashtags function.
 * - GenerateHashtagsOutput - Output type for the generateHashtags function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateHashtagsInputSchema = z.object({
  content: z.string().describe('The document content to generate hashtags from.'),
  url: z.string().url().describe('The source URL of the content.'),
});
export type GenerateHashtagsInput = z.infer<typeof GenerateHashtagsInputSchema>;

const GenerateHashtagsOutputSchema = z.object({
  hashtags: z.array(z.string()).describe('An array of generated hashtags (without the # symbol).'),
});
export type GenerateHashtagsOutput = z.infer<typeof GenerateHashtagsOutputSchema>;

export async function generateHashtags(input: GenerateHashtagsInput): Promise<GenerateHashtagsOutput> {
  return generateHashtagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateHashtagsPrompt',
  input: { schema: GenerateHashtagsInputSchema },
  output: { schema: z.object({ hashtags: z.array(z.string()) }) },
  prompt: `You are an expert in summarizing and tagging content.
  Analyze the following document content and generate a list of 1-2 relevant, broader category hashtags.
  The hashtags should be concise, relevant to the main topics, and should not include the '#' symbol.
  For example, if the content is about React Hooks, a good output would be: ["frontend", "javascript"]. Do not include the primary technology name.

  Document Content:
  {{{content}}}
  `,
});

const generateHashtagsFlow = ai.defineFlow(
  {
    name: 'generateHashtagsFlow',
    inputSchema: GenerateHashtagsInputSchema,
    outputSchema: GenerateHashtagsOutputSchema,
  },
  async ({ url, content }) => {
    // Extract the technology name from the URL
    let techName = '';
    try {
      const path = new URL(url).pathname;
      // Find the most likely name from the path segments
      const segments = path.split('/').filter(s => s);
      if (segments.length > 0) {
        techName = segments[segments.length - 1].toLowerCase();
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    const { output } = await prompt({ content, url });
    const aiHashtags = output?.hashtags || [];
    
    // Ensure the tech name is the first hashtag, if found
    const finalHashtags = techName ? [techName, ...aiHashtags] : aiHashtags;
    
    // Remove duplicates and limit to 3
    const uniqueHashtags = [...new Set(finalHashtags)];
    return { hashtags: uniqueHashtags.slice(0, 3) };
  }
);
