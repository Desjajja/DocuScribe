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
import TurndownService from 'turndown';

// Define input and output schemas
const ScrapeUrlInputSchema = z.object({
  startUrl: z.string().url().describe('The initial URL to start scraping from.'),
  maxPages: z.number().int().min(1).max(50).describe('The maximum number of pages to crawl.'),
  existingTitle: z.string().optional().describe('The existing title of the document, if it is being updated.'),
});
export type ScrapeUrlInput = z.infer<typeof ScrapeUrlInputSchema>;

const ScrapedPageSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  image: z.string().optional(),
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
    description: 'Scans a webpage\'s HTML to find all on-site links. If a "next" link is found in a list, it prioritizes links from that same list.',
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
    
    const nextPatterns = /下一封|下页|下一页|下一章|后一页|下一张|next|more|newer|лог|›|→|»|≫|>>/i;
    
    // Function to process and add a valid link
    const addLink = (href: string | undefined) => {
        if (!href) return;
        try {
            const fullUrl = new URL(href, url.origin);
            fullUrl.hash = ''; // Remove fragment identifiers

            const isSamePage = fullUrl.href === baseUrl;
            const isExternal = fullUrl.origin !== url.origin;
            const isAsset = /\.(pdf|zip|jpg|png|gif|css|js)$/i.test(fullUrl.pathname);
            
            if (isSamePage || isExternal || isAsset) return;

            uniqueLinks.add(fullUrl.href);
        } catch (e) {
            // Ignore invalid URLs
        }
    };

    // Try to find a 'next' link and its neighbors first
    const nextLink = $('a').filter((_, el) => nextPatterns.test($(el).text()));
    
    if (nextLink.length > 0) {
        const parentList = nextLink.closest('ul, ol');
        if (parentList.length > 0) {
            // Found a 'next' link inside a list, prioritize all links in this list
            parentList.find('a').each((_, el) => {
                addLink($(el).attr('href'));
            });
            return Array.from(uniqueLinks);
        }
    }

    // Fallback: If no 'next' link in a list is found, get all links
    $('a').each((_, el) => {
        addLink($(el).attr('href'));
    });
    
    return Array.from(uniqueLinks);
  }
);

// Helper function to fetch and process a single URL
async function fetchAndProcessUrl(url: string): Promise<{ title: string; content: string; html: string; image?: string } | null> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        console.warn(`Skipping ${url}: Failed to fetch with status ${response.status}`);
        return null; // Return null to indicate failure
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Initialize Turndown service to convert HTML to Markdown
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
    });
    
    // Remove non-content elements before processing
    $('nav, header, footer, script, style, noscript, svg, [aria-hidden="true"], form, aside').remove();

    const title = $('title').first().text() || $('h1').first().text() || 'Untitled';
    
    // Find the first image, download it, and convert to data URI
    let firstImageDataUri: string | undefined;
    const firstImg = $('img').first();
    if (firstImg.length > 0) {
        const src = firstImg.attr('src');
        if (src) {
            try {
                const imageUrl = new URL(src, url).href;
                const imageResponse = await fetch(imageUrl);
                if (imageResponse.ok) {
                    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                    const buffer = await imageResponse.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    firstImageDataUri = `data:${contentType};base64,${base64}`;
                }
            } catch (e) {
                console.error(`Failed to process image from ${src}:`, e);
                // Ignore invalid image URLs or download failures
            }
        }
    }
    
    // Select the main content area, falling back to the body
    let contentHtml = $('main').html() || $('article').html() || $('body').html();

    if (!contentHtml) {
        return null;
    }

    // Convert the selected HTML to Markdown to preserve formatting
    const content = turndownService.turndown(contentHtml);
    
    return { title, content, html, image: firstImageDataUri };
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    return null;
  }
}

// Main Genkit Flow
const scrapeUrlFlow = ai.defineFlow(
  {
    name: 'scrapeUrlFlow',
    inputSchema: ScrapeUrlInputSchema,
    outputSchema: ScrapeUrlOutputSchema,
  },
  async ({ startUrl, maxPages, existingTitle }) => {
    const visitedUrls = new Set<string>();
    // Track URLs we've already attempted (success or failure) so we don't retry them
    const attemptedUrls = new Set<string>();
    const urlQueue: string[] = [startUrl];
    const results: Omit<ScrapedPage, 'image'>[] = [];
    let coverImage: string | undefined;

    while (urlQueue.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlQueue.shift();
      if (!currentUrl || attemptedUrls.has(currentUrl) || visitedUrls.has(currentUrl)) {
        continue;
      }

      // Mark as attempted to avoid retrying the same URL repeatedly
      attemptedUrls.add(currentUrl);

      const pageData = await fetchAndProcessUrl(currentUrl);

      // If fetch failed, don't count this attempt toward maxPages; continue to next queued URL
      if (!pageData) {
        continue;
      }
      
      const { title, content, html, image } = pageData;

  // Now mark as visited (successful fetch)
  visitedUrls.add(currentUrl);
  // Human-friendly progress: show parsing document current/total (matches terminal selection format)
  console.log(`Parsing document (${visitedUrls.size}/${maxPages}): ${currentUrl}`);
      
      // Set the cover image from the very first successfully scraped page
      if (!coverImage && image) {
          coverImage = image;
      }

      if (content) {
        results.push({ url: currentUrl, title, content });
      }

      if (html && visitedUrls.size < maxPages) {
        const foundLinks = await findRelevantLinks({ baseUrl: currentUrl, htmlContent: html });
        for (const link of foundLinks) {
          if (!visitedUrls.has(link) && !attemptedUrls.has(link) && !urlQueue.includes(link)) {
            urlQueue.push(link);
          }
        }
      }
    }

    if (results.length === 0) return [];

    const aggregatedContent = results
      .map(page => `## ${page.title}\n\nURL: ${page.url}\n\n${page.content}`)
      .join('\n\n---\n\n');
    
    let documentationTitle = 'Documentation';
    if (existingTitle) {
      documentationTitle = existingTitle;
    } else {
      try {
        const url = new URL(startUrl);
        const pathSegments = url.pathname.split('/').filter(s => s);
        const hostSegments = url.hostname.split('.').filter(s => s !== 'www');
        
        // Prefer the last path segment if it's not a generic name
        const lastPathSegment = pathSegments[pathSegments.length - 1];
        if (lastPathSegment && !/^(docs|documentation|index|home)$/i.test(lastPathSegment)) {
            documentationTitle = lastPathSegment;
        } 
        // Fallback to the second to last host segment (e.g., 'react' from 'react.dev')
        else if (hostSegments.length > 1) {
            documentationTitle = hostSegments[hostSegments.length - 2];
        }
         // Further fallback to the first significant path segment
        else if (pathSegments.length > 0) {
          documentationTitle = pathSegments[0];
        }
        else {
            documentationTitle = hostSegments.join(' ');
        }
      } catch (e) {
        // Use default title on parsing error
      }
    }
    
    // Always return a single, aggregated documentation object composed of pages
    return [{
      url: startUrl,
      title: documentationTitle,
      content: aggregatedContent,
      image: coverImage,
    }];
  }
);
