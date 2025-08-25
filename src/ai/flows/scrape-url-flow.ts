'use server';
/**
 * @fileOverview A flow to recursively scrape a website from a starting URL and compile successor pages.
 *
 * - scrapeUrl - The main function to initiate the scraping process.
 * - findSuccessorPages - Finds all successor/child pages in a sequential chain.
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

// Genkit Tool: Find successor pages in a sequential chain
export const findSuccessorPages = ai.defineTool(
  {
    name: 'findSuccessorPages',
    description: 'Scans a webpage to find all successor/child pages in a sequential chain. Looks for links with "next" text patterns or URLs that hint at sequential progression.',
    inputSchema: z.object({
      baseUrl: z.string().url().describe('The base URL of the page to find successors for.'),
      htmlContent: z.string().describe('The full HTML content of the page to parse for successor links.'),
    }),
    outputSchema: z.array(z.string().url().describe('An array of absolute URLs that are successors to the current page.')),
  },
  async ({ baseUrl, htmlContent }) => {
    const $ = cheerio.load(htmlContent);
    const baseOrigin = new URL(baseUrl).origin;
    const successorLinks = new Set<string>();

    const processCandidate = (el: cheerio.Element, reason: string): string | null => {
        const $el = $(el);
        const href = $el.attr('href');
        if (!href || $el.attr('hreflang')) return null;

        try {
            const fullUrl = new URL(href, baseUrl);
            fullUrl.hash = '';
            fullUrl.search = '';
            const normalizedHref = fullUrl.href;
            
            const isSamePage = normalizedHref === baseUrl;
            const isExternal = fullUrl.origin !== baseOrigin;
            const isAsset = /\.(pdf|zip|jpg|png|gif|css|js|ico|svg)$/i.test(fullUrl.pathname);

            if (isSamePage || isExternal || isAsset) return null;

            console.log(`  [+] Found potential successor: ${normalizedHref} (Reason: ${reason})`);
            return normalizedHref;
        } catch (e) {
            return null;
        }
    };

    const highConfidenceSelectors = [
        'a[rel="next"]', 'a.md-footer__link--next',
        'a[class*="next"]', 'a[aria-label*="next" i]',
    ];
    for (const selector of highConfidenceSelectors) {
        $(selector).each((_, el) => {
            const link = processCandidate(el, `selector '${selector}'`);
            if (link) successorLinks.add(link);
        });
    }

    const exactTextPattern = /^next$/i;
    $('a').each((_, el) => {
        const text = $(el).text().trim();
        if (exactTextPattern.test(text)) {
            const link = processCandidate(el, `exact text match '${text}'`);
            if (link) successorLinks.add(link);
        }
    });
    
    if (successorLinks.size === 0) {
        console.log("Primary policy failed. Switching to navigation menu analysis.");
        const navContainers = $('nav, #site-nav, .site-nav, #sidebar, .sidebar');
        const allNavLinks = navContainers.find('a');
        let currentPageFound = false;
        
        allNavLinks.each((_, el) => {
            if (currentPageFound) {
                const link = processCandidate(el, 'next in nav order');
                if (link) {
                    successorLinks.add(link);
                    return false;
                }
            } else {
                try {
                    const href = $(el).attr('href');
                    if (href) {
                        const resolvedUrl = new URL(href, baseUrl);
                        if (resolvedUrl.pathname === new URL(baseUrl).pathname) {
                            currentPageFound = true;
                        }
                    }
                } catch(e) { /* ignore invalid hrefs */ }
            }
        });
    }

    if (successorLinks.size > 0) {
        console.log(`Found ${successorLinks.size} successor(s) for ${baseUrl}.`);
    } else {
        console.log(`No successors found for ${baseUrl}.`);
    }

    return Array.from(successorLinks);
  }
);


// Helper function to fetch and process a single URL
type FetchResult = 
  | { status: 'success'; data: { title: string; content: string; html: string; image?: string } }
  | { status: 'failure'; reason: string };

async function fetchAndProcessUrl(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        return { status: 'failure', reason: `HTTP ${response.status}` };
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    // Turndown with custom formatting adjustments
    const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    // Unescape underscores so they retain markdown meaning (avoid literal \_)
    const originalEscape = turndownService.escape.bind(turndownService);
    turndownService.escape = (str: string) => {
      // Use original escaping, then unescape underscores & backticks so identifiers remain readable.
      return originalEscape(str)
        .replace(/\\_/g, '_')
        .replace(/\\`/g, '`');
    };
    // Preserve <br> as explicit line breaks (two trailing spaces markdown style)
    turndownService.addRule('lineBreak', {
      filter: 'br',
      replacement: () => '  \n'
    });
    // Preserve pre > code blocks verbatim with fenced blocks
    turndownService.addRule('fencedCodeBlock', {
      filter: (node) => {
        return (
          node.nodeName === 'PRE' &&
          node.firstChild !== null &&
          (node.firstChild as any).nodeName === 'CODE'
        );
      },
      replacement: (_content, node) => {
        const codeNode = (node.firstChild as any);
        const codeText = codeNode.textContent || '';
        // Detect language from class attribute e.g. language-python, lang-js, or highlight-source-python
        const classAttr: string = (codeNode.getAttribute && codeNode.getAttribute('class')) || '';
        let lang = '';
        if (classAttr) {
          const match = classAttr.match(/(?:language|lang|highlight-source)-([a-zA-Z0-9_+-]+)/);
            if (match) lang = match[1].toLowerCase();
        }
        // Preserve tabs & spaces exactly; only normalize non-breaking spaces to regular spaces.
        const normalized = codeText.replace(/\u00A0/g, ' ');
        return `\n\n\`\`\`${lang}\n${normalized}\n\`\`\`\n\n`;
      }
    });
    // Generic <pre> block (without nested <code>) handling — some highlighters emit spans directly under <pre>
    turndownService.addRule('plainPreBlock', {
      filter: (node) => node.nodeName === 'PRE' && !(node.firstChild && (node.firstChild as any).nodeName === 'CODE'),
      replacement: (_content, node) => {
        // Extract raw text preserving whitespace. Using textContent keeps indentation spans.
        const raw = (node as any).textContent || '';
        const classAttr: string = ((node as any).getAttribute && (node as any).getAttribute('class')) || '';
        let lang = '';
        if (classAttr) {
          const match = classAttr.match(/(?:language|lang|highlight-source)-([a-zA-Z0-9_+-]+)/);
          if (match) lang = match[1].toLowerCase();
        }
        const normalized = raw.replace(/\u00A0/g, ' ');
        return `\n\n\`\`\`${lang}\n${normalized}\n\`\`\`\n\n`;
      }
    });
    
    const title = $('title').first().text() || $('h1').first().text() || 'Untitled';
    
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
            } catch (e) { /* Ignore image processing errors */ }
        }
    }
    
    // **IMPROVED LOGIC**: Actively find the main content container first.
    const contentSelectors = [
        '[role="main"]',
        'main',
        '.main-content',
        '#main-content',
        '.body',
        'article',
        '#content',
        '.content',
    ];

    let $content: cheerio.Cheerio | null = null;
    for (const selector of contentSelectors) {
      const el = $(selector);
      if (el.length > 0) {
        $content = el.first();
        break;
      }
    }

    // If no specific container was found, fallback to the whole body.
    if (!$content) {
      $content = $('body');
    }
    
    // Now, remove any nested unwanted elements from within that container.
    const selectorsToRemove = [
      'header', 'footer', 'nav', 'aside', 'script', 'style', '.noprint',
      '.header', '.footer', '.sidebar', '.menu', '.copyright', '.navigation', '.related-links', '.mobile-nav', '.sphinxsidebar',
      '[role="banner"]', '[role="contentinfo"]', '[role="navigation"]', '[aria-hidden="true"]',
    ].join(', ');
    $content.find(selectorsToRemove).remove();
    
    const contentHtml = $content.html();
    if (!contentHtml) {
        return { status: 'failure', reason: 'Main content not found after cleaning' };
    }

    // Convert HTML -> Markdown
    let content = turndownService.turndown(contentHtml);
    content = postProcessMarkdown(content);
    
    return { status: 'success', data: { title, content, html, image: firstImageDataUri }};
  } catch (error: any) {
    return { status: 'failure', reason: error.message };
  }
}

// Post-process markdown to normalize spacing/newlines & undo unwanted escapes
function postProcessMarkdown(md: string): string {
  // Split by fenced code blocks to avoid altering indentation or spacing inside them
  const segments = md.split(/(```[\s\S]*?```)/g);
  return segments.map(seg => {
    if (seg.startsWith('```')) {
      // Within fenced code blocks, remove any markdown escape backslashes before non-formatting chars
      return seg.replace(/\\(_|\*|`)/g, '$1');
    }
    return seg
      // Normalize non‑breaking spaces
      .replace(/\u00A0/g, ' ')
      // Collapse 3+ blank lines into at most 2
      .replace(/\n{3,}/g, '\n\n')
      // Trim trailing spaces on lines (except two spaces used for <br>)
      .replace(/(^|[^ ]) {3,}$/gm, (m) => m.trimEnd())
      // Ensure a blank line before fenced code blocks (improves rendering)
      .replace(/([^\n])\n```/g, '$1\n\n```')
      // Remove stray backslash before underscores
      .replace(/\\_/g, '_');
  }).join('');
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
    const attemptedUrls = new Set<string>();
    const urlQueue: string[] = [startUrl];
    const results: Omit<ScrapedPage, 'image'>[] = [];
    let coverImage: string | undefined;
    
    const failures: { url: string, reason: string }[] = [];
    const startTime = Date.now();
    console.log(`Starting scrape at: ${startUrl}`);

    while (urlQueue.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlQueue.shift();
      if (!currentUrl || attemptedUrls.has(currentUrl)) {
        continue;
      }

      attemptedUrls.add(currentUrl);
      const result = await fetchAndProcessUrl(currentUrl);

      if (result.status === 'success') {
        visitedUrls.add(currentUrl);
        console.log(`[${visitedUrls.size}] ✅ Retrieved: ${currentUrl}`);

        const { title, content, html, image } = result.data;
        if (!coverImage && image) coverImage = image;
        if (content) results.push({ url: currentUrl, title, content });

        if (visitedUrls.size < maxPages) {
          const successorLinks = await findSuccessorPages({ baseUrl: currentUrl, htmlContent: html });
          for (const link of successorLinks) {
            if (!attemptedUrls.has(link) && !urlQueue.includes(link)) {
              urlQueue.push(link);
            }
          }
        }
      } else {
        console.log(`[x] ❌ Failed: ${currentUrl} (${result.reason})`);
        failures.push({ url: currentUrl, reason: result.reason });
      }
    }

    // --- Final Summary ---
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n--- Scraping Summary ---');
    console.log(`Completed in ${duration} seconds.`);
    console.log(`✅ Success: ${results.length}`);
    console.log(`❌ Failed:  ${failures.length}`);
    if (failures.length > 0) {
        console.log('\nFailed URLs:');
        failures.forEach(f => console.log(`  - ${f.url} (${f.reason})`));
    }
    console.log('------------------------\n');
    
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
        
        const lastPathSegment = pathSegments[pathSegments.length - 1];
        if (lastPathSegment && !/^(docs|documentation|index|home)$/i.test(lastPathSegment)) {
            documentationTitle = lastPathSegment;
        } 
        else if (hostSegments.length > 1) {
            documentationTitle = hostSegments[hostSegments.length - 2];
        }
        else if (pathSegments.length > 0) {
          documentationTitle = pathSegments[0];
        }
        else {
            documentationTitle = hostSegments.join(' ');
        }
      } catch (e) { /* Use default title on parsing error */ }
    }
    
    return [{
      url: startUrl,
      title: documentationTitle,
      content: aggregatedContent,
      image: coverImage,
    }];
  }
);