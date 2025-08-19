'use server';

/**
 * @fileOverview A flow to summarize MCP subscription data using AI.
 *
 * - summarizeMcpData - A function that summarizes MCP subscription data.
 * - SummarizeMcpDataInput - The input type for the summarizeMcpData function.
 * - SummarizeMcpDataOutput - The return type for the summarizeMcpData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeMcpDataInputSchema = z.object({
  mcpData: z
    .string()
    .describe('The MCP subscription data to be summarized.'),
});
export type SummarizeMcpDataInput = z.infer<typeof SummarizeMcpDataInputSchema>;

const SummarizeMcpDataOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the MCP subscription data.'),
});
export type SummarizeMcpDataOutput = z.infer<typeof SummarizeMcpDataOutputSchema>;

export async function summarizeMcpData(input: SummarizeMcpDataInput): Promise<SummarizeMcpDataOutput> {
  return summarizeMcpDataFlow(input);
}

const getKeyFeatures = ai.defineTool({
  name: 'getKeyFeatures',
  description: 'Identifies and lists the key features or services from the MCP subscription data.',
  inputSchema: z.object({
    mcpData: z
      .string()
      .describe('The MCP subscription data to extract key features from.'),
  }),
  outputSchema: z.array(z.string()).describe('An array of key features from the MCP subscription data.'),
}, async (input) => {
  // Placeholder implementation: Replace with actual logic to extract key features.
  // This example simply splits the data by lines and returns the first 3 lines as key features.
  const features = input.mcpData.split('\n').slice(0, 3);
  return features;
});

const summarizeMcpDataPrompt = ai.definePrompt({
  name: 'summarizeMcpDataPrompt',
  tools: [getKeyFeatures],
  input: {schema: SummarizeMcpDataInputSchema},
  output: {schema: SummarizeMcpDataOutputSchema},
  prompt: `You are an AI assistant helping users understand their MCP subscription data.

  Based on the MCP subscription data provided, identify the key features and services included in the plan.
  Use the getKeyFeatures tool to extract the key features from the data.
  Then, generate a concise summary highlighting these key features and services so the user can quickly understand the value of their subscription.

  MCP Subscription Data:
  {{mcpData}}
  `
});

const summarizeMcpDataFlow = ai.defineFlow(
  {
    name: 'summarizeMcpDataFlow',
    inputSchema: SummarizeMcpDataInputSchema,
    outputSchema: SummarizeMcpDataOutputSchema,
  },
  async input => {
    const {output} = await summarizeMcpDataPrompt(input);
    return output!;
  }
);
