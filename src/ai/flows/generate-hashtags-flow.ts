'use server';
/**
 * @fileOverview A flow to generate hashtags from document content.
 *
 * - generateHashtags - Generates hashtags for a given piece of text.
 * - GenerateHashtagsInput - Input type for the generateHashtags function.
 * - GenerateHashtagsOutput - Output type for the generateHashtags function.
 */

import { ai } from '@/ai/genkit';
import { deepSeekChat } from '@/ai/deepseek';
import { z } from 'genkit';

const GenerateHashtagsInputSchema = z.object({
  content: z.string().describe('The document content to generate hashtags from.'),
  url: z.string().url().describe('The source URL of the content.'),
  provider: z.string().optional().describe('Preferred AI provider: gemini | deepseek'),
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
  async ({ url, content, provider }) => {
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
    let aiHashtags: string[] = [];
    const wantGemini = !provider || provider === 'gemini';
    const wantDeepseek = provider === 'deepseek';
    let geminiFailed = false;

    if (wantGemini) {
      try {
        const { output } = await prompt({ content, url });
        aiHashtags = output?.hashtags || [];
      } catch (err) {
        geminiFailed = true;
        console.error('[generateHashtags] Gemini failed:', err);
      }
    }

    if ((wantDeepseek || (geminiFailed && !wantDeepseek)) && aiHashtags.length === 0) {
      try {
        const dsResponse = await deepSeekChat(`Extract up to 2 broad, general topic hashtags (no #, lowercase, JSON array) for this content:\n\n${content.substring(0, 4000)}`);
        const match = dsResponse.match(/\[[^\]]*\]/);
        if (match) {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr)) {
            aiHashtags = arr.filter(x => typeof x === 'string');
          }
        }
        if (aiHashtags.length === 0) {
          aiHashtags = dsResponse.split(/[^a-z0-9]+/i).filter(Boolean).slice(0,2).map(s=>s.toLowerCase());
        }
      } catch (e) {
        console.error('[generateHashtags] DeepSeek failed:', e);
      }
    }

    // If still none, we now return empty per new requirement (no heuristic fill)
    
    if (aiHashtags.length === 0) {
      return { hashtags: [] };
    }
    const finalHashtags = techName ? [techName, ...aiHashtags] : aiHashtags;
    const uniqueHashtags = [...new Set(finalHashtags)].slice(0,3);
    return { hashtags: uniqueHashtags };
  }
);
