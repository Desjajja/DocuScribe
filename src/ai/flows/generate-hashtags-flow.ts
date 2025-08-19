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
  output: { schema: GenerateHashtagsOutputSchema },
  prompt: `You are an expert in summarizing and tagging content.
  Analyze the following document content and generate a list of 2-3 relevant hashtags.
  The first hashtag should be the primary technology or topic. The subsequent hashtags should be broader categories or fields.
  The hashtags should be concise, relevant to the main topics, and should not include the '#' symbol.
  For example, if the content is about React Hooks, a good output would be: ["react", "frontend", "javascript"].

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
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
