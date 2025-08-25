import * as cheerio from 'cheerio';

// This is sample HTML with real neighboring pages (actual FastAPI docs structure)
const sampleHtml = `
import { findSuccessorPages } from '../src/ai/flows/scrape-url-flow';

// This is sample HTML with real neighboring pages (actual FastAPI docs structure)
const sampleHtml = `<html>
  <body>
    <nav class="docs-nav">
      <a href="https://fastapi.tiangolo.com/">Home</a>
      <a href="https://fastapi.tiangolo.com/features/">Features</a>  
      <a href="https://fastapi.tiangolo.com/tutorial/">Tutorial</a>
      <a href="https://fastapi.tiangolo.com/advanced/">Advanced</a>
    </nav>
    <footer>
      <div class="md-footer__inner">
        <a href="https://fastapi.tiangolo.com/features/" class="md-footer__link md-footer__link--next" aria-label="Next: Features">
          <div class="md-footer__title">
            <span class="md-footer__direction">Next</span>
            <div class="md-ellipsis">Features</div>
          </div>
        </a>
      </div>
    </footer>
  </body>
</html>`;

async function testSuccessorPages() {
  console.log('--- Testing Successor Pages Detection ---');
  
  const baseUrl = 'https://fastapi.tiangolo.com/';
  
  try {
    const successorLinks = await findSuccessorPages.run({
      baseUrl: baseUrl,
      htmlContent: sampleHtml,
    });
    
    console.log('--- Final Result ---');
    console.log(`Found ${successorLinks.length} successor pages:`);
    successorLinks.forEach((link, i) => console.log(`  ${i+1}. ${link}`));
    console.log('--- Test Complete ---');
    
  } catch (error) {
    console.error('--- Test Failed ---');
    console.error(error);
  }
}

// Execute the test function
testSuccessorPages();
`;

// Recreate the logic from findRelevantLinks to test it standalone
function testFindRelevantLinks(baseUrl: string, htmlContent: string, maxPages: number = 5): string[] {
  const $ = cheerio.load(htmlContent);
  const url = new URL(baseUrl);
  
  // We'll build an ordered list first (to keep priority), then de-dupe preserving order.
  const orderedLinks: string[] = [];
  const seen = new Set<string>();

  // Patterns indicating a forward / next navigation action.
  const nextPatterns = /下一封|下页|下一页|下一章|后一页|下一张|next\b|newer|лог|›|→|»|≫|>>/i;

  // Common navigation / pagination container selectors
  const navSelectors = 'nav, .pagination, .pager, .page-nav, .next-prev, .navigation, .docs-pagination, .toc, #toc, .sidebar, #sidebar, .menu, #menu, .prev-next, .pagenav';

  // Determine a shallow root path scope (first 1-2 segments) to avoid wandering to unrelated sections
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const scopeSegments = pathSegments.slice(0, Math.min(2, pathSegments.length));
  const scopePrefix = '/' + scopeSegments.join('/');

  const normalize = (u: URL) => {
    // Remove query & trailing slash for comparison
    u.hash = '';
    u.search = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/,'');
    }
    return u;
  };

  const addLink = (href: string | undefined, priority = false) => {
    if (!href) return;
    try {
      // Use baseUrl (full) not origin so relative path resolution respects current directory depth
      const fullUrl = normalize(new URL(href, baseUrl));

      const isSamePage = fullUrl.href === normalize(new URL(baseUrl)).href;
      const isExternal = fullUrl.origin !== url.origin;
      const isAsset = /\.(pdf|zip|jpg|png|gif|css|js|ico|svg)$/i.test(fullUrl.pathname);
      const outsideScope = scopeSegments.length > 0 && !fullUrl.pathname.startsWith(scopePrefix);

      console.log(`  Link: ${href} -> ${fullUrl.href}`);
      console.log(`    isSamePage: ${isSamePage}, isExternal: ${isExternal}, isAsset: ${isAsset}, outsideScope: ${outsideScope}`);

      if (isSamePage || isExternal || isAsset || outsideScope) return;

      if (!seen.has(fullUrl.href)) {
        if (priority) {
          orderedLinks.unshift(fullUrl.href); // highest priority to front
        } else {
          orderedLinks.push(fullUrl.href);
        }
        seen.add(fullUrl.href);
      }
    } catch (e) {
      console.log(`  Invalid URL: ${href}`);
    }
  };

  // 1. Highest priority: explicit rel="next"
  console.log('\n1. Checking for rel="next" links:');
  $('a[rel="next"]').each((_, el) => {
    const href = $(el).attr('href');
    console.log(`  Found rel="next": ${href}`);
    addLink(href, true);
  });

  // 2. Text-based next links and their container siblings
  console.log('\n2. Checking for text-based next links and neighboring pages:');
  const nextTextLinks = $('a').filter((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    const matches = nextPatterns.test(text);
    console.log(`  Checking text: "${text}" -> matches: ${matches}`);
    return matches;
  });

  console.log(`Found ${nextTextLinks.length} text-based next links`);

  // Capture siblings within closest list OR nav container - collect ALL neighboring pages
  let handledContainer = false;
  nextTextLinks.each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    console.log(`  Processing next link: ${href}`);
    
    const container = $el.closest('ul, ol, ' + navSelectors.replace(/,/g, ', '));
    if (container.length && !handledContainer) {
      console.log(`    Found in container: ${container.prop('tagName')}`);
      console.log(`    Collecting ALL neighboring pages from container...`);
      
      // Add ALL anchors in container (neighboring pages sequence)
      const containerLinks: string[] = [];
      container.find('a').each((_, a) => {
        const containerHref = $(a).attr('href');
        const containerText = $(a).text().trim();
        console.log(`      Container link: "${containerText}" -> ${containerHref}`);
        if (containerHref) {
          containerLinks.push(containerHref);
          addLink(containerHref, true); // All neighboring pages get priority
        }
      });
      console.log(`    Added ${containerLinks.length} neighboring pages from container`);
      handledContainer = true;
    } else {
      console.log(`    No container found or already handled - adding individual next link`);
      addLink($el.attr('href'), true);
    }
  });

  // 2b. Also look for pagination patterns (prev/next with numbered pages)
  console.log('\n2b. Looking for pagination sequences:');
  const paginationContainers = $(navSelectors + ', .pagination, .page-numbers, .pager');
  paginationContainers.each((_, container) => {
    const $container = $(container);
    const allLinks: { text: string; href: string; isNumeric: boolean; num?: number }[] = [];
    
    $container.find('a').each((_, a) => {
      const text = $(a).text().trim();
      const href = $(a).attr('href');
      if (href) {
        const isNumeric = /^\d+$/.test(text);
        const num = isNumeric ? parseInt(text, 10) : undefined;
        allLinks.push({ text, href, isNumeric, num });
      }
    });
    
    if (allLinks.length > 1) {
      console.log(`  Found pagination container with ${allLinks.length} links:`);
      
      // Sort numeric links by their number
      const numericLinks = allLinks.filter(l => l.isNumeric && l.num).sort((a, b) => a.num! - b.num!);
      const nonNumericLinks = allLinks.filter(l => !l.isNumeric);
      
      // Add all numbered pages in sequence
      numericLinks.forEach(link => {
        console.log(`    Adding page ${link.num}: ${link.href}`);
        addLink(link.href, true);
      });
      
      // Add prev/next/other navigation links
      nonNumericLinks.forEach(link => {
        console.log(`    Adding nav link "${link.text}": ${link.href}`);
        addLink(link.href, true);
      });
    }
  });

  // 3. Numeric pagination detection inside nav containers if no next detected container
  console.log('\n3. Checking for numeric pagination:');
  if (!handledContainer) {
    $(navSelectors).each((_, navEl) => {
      const numericLinks: { num: number; href: string }[] = [];
      $(navEl).find('a').each((_, a) => {
        const text = $(a).text().trim();
          if (/^\d+$/.test(text)) {
            const href = $(a).attr('href');
            if (href) numericLinks.push({ num: parseInt(text, 10), href });
          }
      });
      if (numericLinks.length > 1) {
        console.log(`  Found ${numericLinks.length} numeric links in nav`);
        numericLinks.sort((a,b) => a.num - b.num);
        numericLinks.forEach(l => addLink(l.href));
      }
    });
  }

  // 4. As a fallback, collect on-site anchors (in document order) respecting filters
  console.log('\n4. Fallback: collecting all on-site links:');
  $('a').each((_, el) => addLink($(el).attr('href')));

  // Limit results to maxPages
  const limitedLinks = orderedLinks.slice(0, maxPages);
  console.log(`\nLimited to ${maxPages} pages: ${limitedLinks.length} links returned`);

  return limitedLinks;
}

async function testLinkScraping() {
  console.log('--- Running Link Scraping Test ---');
  
  const baseUrl = 'https://fastapi.tiangolo.com/#interactive-api-docs-upgrade';
  
  // Debug: Let's see what text the cheerio selector finds
  const $ = cheerio.load(sampleHtml);
  console.log('\n--- Debug: All anchor tags ---');
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    const classes = $(el).attr('class');
    console.log(`Text: "${text}", Href: "${href}", Classes: "${classes}"`);
  });
  
  console.log('\n--- Running findRelevantLinks logic ---');
  const foundLinks = testFindRelevantLinks(baseUrl, sampleHtml, 20); // Test with max 3 pages
  
  console.log('\n--- Found Links ---');
  console.log(foundLinks);
  console.log('\n--- Test Complete ---');
}

// Execute the test function
testLinkScraping();