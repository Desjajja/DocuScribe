'use server';
/**
 * @fileOverview A flow to scrape a URL, find relevant links, and extract content.
 *
 * - scrapeUrl - The main function to initiate the scraping process.
 * - ScrapeUrlInput - Input type for the scrapeUrl function.
 * - ScrapeUrlOutput - Output type for the scrapeUrl function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as cheerio from 'cheerio';

// Define input and output schemas
const ScrapeUrlInputSchema = z.object({
  startUrl: z.string().url().describe('The initial URL to start scraping from.'),
  maxPages: z.number().int().min(1).max(10).describe('The maximum number of pages to process.'),
  mode: z.enum(['aggregate', 'separate']).describe('Determines whether to aggregate content into one document or create separate documents.'),
});
export type ScrapeUrlInput = z.infer<typeof ScrapeUrlInputSchema>;

const ScrapedPageSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
});
type ScrapedPage = z.infer<typeof ScrapedPageSchema>;

const ScrapeUrlOutputSchema = z.array(ScrapedPageSchema);
export type ScrapeUrlOutput = z.infer<typeof ScrapeUrlOutputSchema>;

// Exported wrapper function
export async function scrapeUrl(input: ScrapeUrlInput): Promise<ScrapeUrlOutput> {
  return scrapeUrlFlow(input);
}

// Genkit Tool: Find relevant links on a page
const findRelevantLinks = ai.defineTool(
  {
    name: 'findRelevantLinks',
    description: 'Analyzes a list of links from a webpage to identify the most relevant ones to scrape next, based on context like "next", "previous", or related topics. It prioritizes documentation-style navigation.',
    inputSchema: z.object({
      baseUrl: z.string().url().describe('The base URL of the page where links were found, for resolving relative paths.'),
      links: z.array(z.object({
        href: z.string().describe('The href attribute of the link.'),
        text: z.string().describe('The anchor text of the link.'),
      })).describe('An array of all anchor tags (<a>) found on the page, with their href and text.'),
    }),
    outputSchema: z.array(z.object({
      url: z.string().url().describe('An absolute URL that is relevant to scrape next.'),
      title: z.string().describe('The title/text of the link.'),
      isSequential: z.boolean().describe('Whether the link is for sequential navigation (e.g., "next", "previous").'),
    })),
  },
  async ({ baseUrl, links }) => {
    // This is a simplified implementation. A real-world scenario could use an LLM call here for more intelligence.
    // For now, it filters, de-duplicates, and resolves links based on keywords.
    const url = new URL(baseUrl);
    const uniqueLinks = new Map<string, {text: string; isSequential: boolean}>();

    for (const link of links) {
      if (!link.href) continue;

      try {
        const fullUrl = new URL(link.href, url.origin).href;
        
        // Filter out irrelevant links
        const lowerLink = link.href.toLowerCase();
        const lowerText = link.text.toLowerCase();
        
        const isSamePage = fullUrl === baseUrl;
        const isAnchor = link.href.startsWith('#');
        const isExternal = !fullUrl.startsWith(url.origin);
        
        if (isSamePage || isAnchor || isExternal) continue;

        const isNavKeyword = /next|prev|guide|docs|tutorial|getting-started|api|reference/.test(lowerLink);
        const isSequentialKeyword = /next|previous|back|forward|continue|continue reading|上一页|下一页/.test(lowerText);
        
        if (isNavKeyword || isSequentialKeyword) {
          if (!uniqueLinks.has(fullUrl)) {
             uniqueLinks.set(fullUrl, { text: link.text.trim() || 'Untitled Link', isSequential: isSequentialKeyword });
          }
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    }

    return Array.from(uniqueLinks.entries()).map(([url, data]) => ({ url, title: data.text, isSequential: data.isSequential }));
  }
);

// Helper function to fetch and parse a single URL
async function fetchAndProcessUrl(url: string): Promise<{ title: string; content: string; links: { href: string; text: string }[] }> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('nav, header, footer, script, style, noscript, svg, [aria-hidden="true"], form, aside').remove();

    const title = $('title').first().text() || $('h1').first().text();
    // Extract text, normalize whitespace, and remove excessive blank lines
    const content = $('body').text().replace(/\s\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    const links = $('a').map((_, el) => ({
      href: $(el).attr('href') || '',
      text: $(el).text() || ''
    })).get();

    return { title, content, links };
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return { title: `Error: ${url}`, content: `Failed to retrieve content for ${url}.`, links: [] };
  }
}

// Main Genkit Flow
const scrapeUrlFlow = ai.defineFlow(
  {
    name: 'scrapeUrlFlow',
    inputSchema: ScrapeUrlInputSchema,
    outputSchema: ScrapeUrlOutputSchema,
  },
  async ({ startUrl, maxPages, mode }) => {
    const visitedUrls = new Set<string>([startUrl]);
    
    console.log(`Starting scrape for: ${startUrl} in ${mode} mode`);
    const { title: startTitle, content: startContent, links: startLinks } = await fetchAndProcessUrl(startUrl);

    let aggregatedContent = startContent;
    const separatePages: ScrapedPage[] = [{ url: startUrl, title: startTitle, content: startContent }];

    const relevantLinks = await findRelevantLinks({ baseUrl: startUrl, links: startLinks });
    
    let pagesProcessed = 1;
    for (const link of relevantLinks) {
      if (pagesProcessed >= maxPages) break;
      if (visitedUrls.has(link.url)) continue;

      visitedUrls.add(link.url);
      pagesProcessed++;
      
      console.log(`Scraping sub-page: ${link.url}`);
      const { title, content } = await fetchAndProcessUrl(link.url);

      if (mode === 'aggregate') {
        if (!link.isSequential) {
           aggregatedContent += `\n\n---\n## Content from: ${link.title}\n---\n\n`;
        } else {
           aggregatedContent += `\n\n---\n\n`;
        }
        aggregatedContent += content;
      } else { // separate mode
        separatePages.push({ url: link.url, title, content });
      }
    }

    if (mode === 'aggregate') {
      return [{
        url: startUrl,
        title: startTitle,
        content: aggregatedContent,
      }];
    }
    
    return separatePages;
  }
);
