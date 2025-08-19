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
  maxPages: z.number().int().min(1).max(10).describe('The maximum number of pages to scrape.'),
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
      links: z.array(z.string()).describe('An array of all anchor tags (<a>) href attributes found on the page.'),
    }),
    outputSchema: z.array(z.string().url()).describe('An array of absolute URLs that are most relevant to scrape next.'),
  },
  async ({ baseUrl, links }) => {
    // This is a simplified implementation. A real-world scenario would use an LLM call here.
    // For now, it filters, de-duplicates, and resolves links.
    const url = new URL(baseUrl);
    const uniqueLinks = [...new Set(links)];

    return uniqueLinks
      .map(link => {
        try {
          // Create a full URL from the href
          return new URL(link, url.origin).href;
        } catch (e) {
          return null;
        }
      })
      .filter((link): link is string => {
        if (!link) return false;
        // Filter out irrelevant links
        const lowerLink = link.toLowerCase();
        const isSamePage = link === baseUrl;
        const isAnchor = link.startsWith('#');
        const isExternal = !link.startsWith(url.origin);
        const isNavKeyword = /next|prev|guide|docs|tutorial|getting-started|api|reference/.test(lowerLink);
        
        return !isSamePage && !isAnchor && !isExternal && isNavKeyword;
      });
  }
);

// Helper function to fetch and parse a single URL
async function fetchAndProcessUrl(url: string): Promise<{ title: string; content: string; links: string[] }> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('nav, header, footer, script, style, noscript, svg, [aria-hidden="true"]').remove();

    const title = $('title').first().text() || $('h1').first().text();
    // Extract text, normalize whitespace, and remove excessive blank lines
    const content = $('body').text().replace(/\s\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    const links = $('a').map((_, el) => $(el).attr('href')).get().filter(Boolean);

    return { title, content, links };
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return { title: `Error: ${url}`, content: 'Failed to retrieve content.', links: [] };
  }
}

// Main Genkit Flow
const scrapeUrlFlow = ai.defineFlow(
  {
    name: 'scrapeUrlFlow',
    inputSchema: ScrapeUrlInputSchema,
    outputSchema: ScrapeUrlOutputSchema,
  },
  async ({ startUrl, maxPages }) => {
    const visitedUrls = new Set<string>();
    const pagesToScrape: string[] = [startUrl];
    const scrapedPages: ScrapedPage[] = [];

    while (scrapedPages.length < maxPages && pagesToScrape.length > 0) {
      const currentUrl = pagesToScrape.shift()!;
      if (visitedUrls.has(currentUrl)) {
        continue;
      }
      visitedUrls.add(currentUrl);

      console.log(`Scraping: ${currentUrl}`);
      const { title, content, links } = await fetchAndProcessUrl(currentUrl);
      
      scrapedPages.push({ url: currentUrl, title, content });

      if (scrapedPages.length >= maxPages) break;

      // Use the tool to find the next links to scrape
      const relevantLinks = await findRelevantLinks({ baseUrl: currentUrl, links });

      // Add new, unvisited links to the queue
      for (const link of relevantLinks) {
        if (!visitedUrls.has(link)) {
          pagesToScrape.push(link);
        }
      }
    }
    return scrapedPages;
  }
);
