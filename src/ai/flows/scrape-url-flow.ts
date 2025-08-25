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
import { replaceDocumentPages } from '@/app/actions';
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
  aiDescription: z.string().optional(), // optional short summary
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

    // Build individual page sections
    const pageSections = results.map(page => ({
      title: page.title,
      url: page.url,
      section: `## ${page.title}\n\nURL: ${page.url}\n\n${page.content}`,
    }));

    const separator = '\n\n---\n\n';
    // Pre-compute word spans including separator contribution (separator adds one token '---')
    let cumulativeWords = 0;
    const sepWordCost = 1; // '---' token
    const spans: Array<{ title: string; start: number; end: number }> = [];
    pageSections.forEach((p, idx) => {
      const wordCount = p.section.split(/\s+/).filter(Boolean).length;
      const start = cumulativeWords + (idx * sepWordCost); // account previous separators
      const end = start + wordCount;
      spans.push({ title: p.title, start, end });
      cumulativeWords += wordCount;
    });

    const indexLines = (() => {
      return spans.map((s, i) => {
        const len = s.end - s.start;
        return `${String(i+1).padStart(2,' ')}  ${String(s.start).padStart(6,' ')}  ${String(s.end).padStart(6,' ')}  ${String(len).padStart(6,' ')}  ${s.title}`;
      });
    })();
    const indexHeader = ' #   start     end     len  title';
  const indexSection = `## Index\n\nThe table below maps documentation page titles to word spans (start inclusive, end exclusive) for use with the fetch_doc_content API (start & max_length = end-start).\n\n\`\`\`\n${indexHeader}\n${indexLines.join('\n')}\n\`\`\``;
  const pagesContent = pageSections.map(p => p.section).join(separator);
  const aggregatedContent = pagesContent; // DO NOT prepend index; stored separately as page 0
    
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
    
  // Skip AI description on updates (existingTitle indicates an update flow)
  const aiDescription = existingTitle ? undefined : await generateFastDescription({ aggregatedContent, resultsCount: results.length, startUrl });

    const docRecord = {
      url: startUrl,
      title: documentationTitle,
      content: aggregatedContent,
      image: coverImage,
      aiDescription,
    } as any;

    // After caller inserts/updates main document, they must call replaceDocumentPages with stable doc_uid.
    // We cannot do that here because doc_uid is generated upon insert. So we return index + pages metadata
    // so the caller can persist pages after main doc creation/update.
    (docRecord as any).__indexPage = indexSection;
    (docRecord as any).__pages = pageSections.map(p => p.section);

    return [docRecord];
  }
);

// --- Fast AI Description Generation Utilities ---
interface GenerateDescParams { aggregatedContent: string; resultsCount: number; startUrl: string; }

async function generateFastDescription({ aggregatedContent, resultsCount, startUrl }: GenerateDescParams): Promise<string | undefined> {
  try {
    // 1. Sanitize & trim snippet aggressively (remove code fences & code heavy blocks)
    let snippet = aggregatedContent
      .replace(/```[\s\S]*?```/g, ' ')          // strip fenced code
      .replace(/<code[\s\S]*?<\/code>/gi, ' ') // strip inline html code blocks if any
      .replace(/\s+/g, ' ')                     // collapse whitespace
      .trim();
    // Limit snippet chars (approx tokens): 2500 chars (~600 tokens) to avoid long generation
    const MAX_CHARS = 2500;
    if (snippet.length > MAX_CHARS) snippet = snippet.slice(0, MAX_CHARS);

    if (!snippet) return undefined;

    // 2. Attempt lightweight AI prompt with timeout (3.5s)
    const TIMEOUT_MS = 3500;
    const promptFn = await getOrInitDescriptionPrompt();
    let timedOut = false;
    const timeoutPromise = new Promise<{ summary?: string }>(resolve => setTimeout(() => { timedOut = true; resolve({}); }, TIMEOUT_MS));
    const aiPromise = promptFn({ snippet }).catch(err => { console.warn('[aiDescription] prompt error:', err); return { output: { summary: '' } }; });
    const raced: any = await Promise.race([aiPromise, timeoutPromise]);
    if (!timedOut && raced?.output?.summary) {
      let summary = raced.output.summary.trim().replace(/\s+/g, ' ');
      summary = summary.split(/\s+/).slice(0, 30).join(' ');
      console.log('[aiDescription] Generated summary (', summary.length, 'chars )');
      return summary;
    }
    if (timedOut) console.warn('[aiDescription] Timed out after', TIMEOUT_MS, 'ms; using heuristic fallback.');
    // 3. Heuristic fallback
    return heuristicDescription(snippet, resultsCount, startUrl);
  } catch (e) {
    console.warn('[aiDescription] failed; fallback heuristic used:', e);
    return heuristicDescription(aggregatedContent.slice(0, 800), resultsCount, startUrl);
  }
}

function heuristicDescription(snippet: string, resultsCount: number, startUrl: string): string {
  // Guess primary language
  const lower = snippet.toLowerCase();
  let lang = 'multi-language';
  if (/\b(async def|import\s+asyncio|def\s+\w+\()/i.test(snippet)) lang = 'python';
  else if (/\b(function|const\s+\w+\s*=|import\s+.*from\s+'|=>)/i.test(snippet)) lang = 'javascript';
  else if (/package\s+main|fmt\./.test(snippet)) lang = 'go';
  else if (/fn\s+\w+\s*\(|cargo|crate::/.test(lower)) lang = 'rust';
  else if (/public\s+class|System\.out\.println/.test(snippet)) lang = 'java';
  else if (/#include\s+<|int\s+main\s*\(/.test(snippet)) lang = 'c/c++';
  // Weight guess
  const weight = resultsCount > 12 || snippet.length > 1800 ? 'feature-rich' : resultsCount > 5 ? 'moderate' : 'lightweight';
  // Name guess from URL path
  let nameGuess = '';
  try {
    const u = new URL(startUrl);
    const segs = u.pathname.split('/').filter(Boolean);
    nameGuess = segs[segs.length - 1] || u.hostname.split('.').slice(-2, -1)[0];
  } catch {}
  const base = `${nameGuess || 'library'}: ${weight} ${lang} docs`; // ~5-6 words
  // Add a short purpose fragment from snippet first sentence
  const sentence = snippet.split('. ')[0].replace(/[#*_`]/g,'').trim().split(/\s+/).slice(0, 18).join(' ');
  const combined = `${base}. ${sentence}`.split(/\s+/).slice(0, 30).join(' ');
  return combined;
}

async function getOrInitDescriptionPrompt() {
  if (!(globalThis as any).__docDescriptionPrompt) {
    (globalThis as any).__docDescriptionPrompt = ai.definePrompt({
      name: 'docDescriptionPromptV2',
      input: { schema: z.object({ snippet: z.string() }) },
      output: { schema: z.object({ summary: z.string() }) },
      prompt: `Summarize the documentation snippet in ONE sentence under 30 words: purpose, perceived weight (lightweight/moderate/feature-rich), and primary language(s). Output ONLY the sentence.\n\nSnippet (truncated):\n{{{snippet}}}`,
    });
  }
  return (globalThis as any).__docDescriptionPrompt as (arg: { snippet: string }) => Promise<{ output: { summary: string } }>;
}