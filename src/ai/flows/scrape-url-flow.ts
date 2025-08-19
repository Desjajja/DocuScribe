'use server';
/**
 * @fileOverview A flow to recursively scrape a website from a starting URL and compile the content.
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
  maxPages: z.number().int().min(1).max(50).describe('The maximum number of pages to crawl.'),
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

// Genkit Tool: Find and filter links on a page
const findRelevantLinks = ai.defineTool(
  {
    name: 'findRelevantLinks',
    description: 'Scans a webpage\'s HTML to find all on-site links, filtering out duplicates, anchors, and external URLs.',
    inputSchema: z.object({
      baseUrl: z.string().url().describe('The base URL of the page where links were found, for resolving relative paths and ensuring links are on-site.'),
      htmlContent: z.string().describe('The full HTML content of the page to parse for links.'),
    }),
    outputSchema: z.array(z.string().url().describe('An array of absolute URLs found on the page that are valid for further scraping.')),
  },
  async ({ baseUrl, htmlContent }) => {
    const $ = cheerio.load(htmlContent);
    const url = new URL(baseUrl);
    const uniqueLinks = new Set<string>();

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const fullUrl = new URL(href, url.origin);
        fullUrl.hash = ''; // Remove fragment identifiers

        // Filter out irrelevant links
        const isSamePage = fullUrl.href === baseUrl;
        const isExternal = fullUrl.origin !== url.origin;
        const isAsset = /\.(pdf|zip|jpg|png|gif|css|js)$/i.test(fullUrl.pathname);
        
        if (isSamePage || isExternal || isAsset) return;

        uniqueLinks.add(fullUrl.href);
      } catch (e) {
        // Ignore invalid URLs
      }
    });

    return Array.from(uniqueLinks);
  }
);

// Helper function to fetch and parse a single URL
async function fetchAndProcessUrl(url: string): Promise<{ title: string; content: string; html: string }> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('nav, header, footer, script, style, noscript, svg, [aria-hidden="true"], form, aside').remove();

    const title = $('title').first().text() || $('h1').first().text() || 'Untitled';
    // Extract text, normalize whitespace, and remove excessive blank lines
    const content = $('body').text().replace(/\s\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    
    return { title, content, html };
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return { title: `Error: ${url}`, content: `Failed to retrieve content for ${url}.`, html: '' };
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
    const urlQueue: string[] = [startUrl];
    const results: ScrapedPage[] = [];

    while (urlQueue.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlQueue.shift();
      if (!currentUrl || visitedUrls.has(currentUrl)) {
        continue;
      }

      console.log(`Scraping page (${visitedUrls.size + 1}/${maxPages}): ${currentUrl}`);
      visitedUrls.add(currentUrl);

      const { title, content, html } = await fetchAndProcessUrl(currentUrl);
      if (content) {
        results.push({ url: currentUrl, title, content });
      }

      if (html && visitedUrls.size < maxPages) {
        const foundLinks = await findRelevantLinks({ baseUrl: currentUrl, htmlContent: html });
        for (const link of foundLinks) {
          if (!visitedUrls.has(link) && !urlQueue.includes(link)) {
            urlQueue.push(link);
          }
        }
      }
    }

    if (results.length === 0) return [];

    const aggregatedContent = results
      .map(page => `## ${page.title}\n\nURL: ${page.url}\n\n${page.content}`)
      .join('\n\n---\n\n');
    
    let compilationTitle = 'Documentation Compilation';
    try {
      const path = new URL(startUrl).pathname;
      const segments = path.split('/').filter(s => s);
      if (segments.length > 0) {
        compilationTitle = segments[segments.length - 1];
      }
    } catch (e) {
      // Use default title on parsing error
    }
    
    // Always return a single, aggregated document
    return [{
      url: startUrl,
      title: compilationTitle,
      content: aggregatedContent,
    }];
  }
);
