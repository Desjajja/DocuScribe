import * as cheerio from 'cheerio';

// Extract the core link detection logic without Genkit wrapper
function extractSuccessorLinks(baseUrl: string, htmlContent: string): string[] {
  const $ = cheerio.load(htmlContent);
  const url = new URL(baseUrl);
  const successorLinks: string[] = [];
  const seen = new Set<string>();

  console.log(`\n=== Finding successors for: ${baseUrl} ===`);

  // Patterns indicating a forward / next / successor navigation action
  const nextPatterns = /下一封|下页|下一页|下一章|后一页|下一张|next\b|newer|continue|more|лог|›|→|»|≫|>>/i;

  // Common navigation / pagination container selectors
  const navSelectors = 'nav, .pagination, .pager, .page-nav, .next-prev, .navigation, .docs-pagination, .toc, #toc, .sidebar, #sidebar, .menu, #menu, .prev-next, .pagenav';

  // Determine scope based on current page structure
  const pathSegments = url.pathname.split('/').filter(Boolean);
  // Use the first 1-2 segments for scope, but be more lenient
  const scopeSegments = pathSegments.slice(0, Math.min(2, pathSegments.length));
  const scopePrefix = scopeSegments.length > 0 ? '/' + scopeSegments.join('/') : '';
  
  console.log(`  Scope analysis: pathSegments=${JSON.stringify(pathSegments)}, scopePrefix="${scopePrefix}"`);

  const normalize = (u: URL) => {
    u.hash = '';
    u.search = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/,'');
    }
    return u;
  };

  const addSuccessorLink = (href: string | undefined, reason: string = '') => {
    if (!href) return;
    try {
      const fullUrl = normalize(new URL(href, baseUrl));
      const isSamePage = fullUrl.href === normalize(new URL(baseUrl)).href;
      const isExternal = fullUrl.origin !== url.origin;
      const isAsset = /\.(pdf|zip|jpg|png|gif|css|js|ico|svg)$/i.test(fullUrl.pathname);
      // More lenient scope checking - only filter if completely different sections
      const outsideScope = scopePrefix && !fullUrl.pathname.startsWith(scopePrefix) && 
                          fullUrl.pathname.split('/').filter(Boolean)[0] !== pathSegments[0];

      console.log(`  Link: ${href} -> ${fullUrl.href} [${reason}]`);
      console.log(`    isSamePage: ${isSamePage}, isExternal: ${isExternal}, isAsset: ${isAsset}, outsideScope: ${outsideScope}`);

      if (isSamePage || isExternal || isAsset || outsideScope) {
        console.log(`    FILTERED OUT`);
        return;
      }

      if (!seen.has(fullUrl.href)) {
        successorLinks.push(fullUrl.href);
        seen.add(fullUrl.href);
        console.log(`    ADDED as successor`);
      } else {
        console.log(`    ALREADY SEEN`);
      }
    } catch (e) {
      console.log(`    INVALID URL: ${href}`);
    }
  };

  // 1. Highest priority: explicit rel="next" (true successor)
  console.log('\n1. Checking for rel="next" links:');
  $('a[rel="next"]').each((_, el) => {
    const href = $(el).attr('href');
    console.log(`  Found rel="next": ${href}`);
    addSuccessorLink(href, 'rel="next"');
  });

  // 2. Text-based successor links (next, continue, more, etc.)
  console.log('\n2. Checking for text-based successor links:');
  $('a').filter((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    return nextPatterns.test(text);
  }).each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    console.log(`  Found text-based successor: "${text}" -> ${href}`);
    addSuccessorLink(href, `text pattern "${text}"`);
  });

  // 3. URL-based sequence detection (e.g., /page/1 -> /page/2)
  console.log('\n3. Checking for URL sequence patterns:');
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    
    try {
      const linkUrl = new URL(href, baseUrl);
      const currentPathMatch = url.pathname.match(/^(.+?)(\d+)(.*)$/);
      const linkPathMatch = linkUrl.pathname.match(/^(.+?)(\d+)(.*)$/);
      
      if (currentPathMatch && linkPathMatch) {
        const [, currentPrefix, currentNum, currentSuffix] = currentPathMatch;
        const [, linkPrefix, linkNum, linkSuffix] = linkPathMatch;
        
        if (currentPrefix === linkPrefix && currentSuffix === linkSuffix) {
          const currentNumber = parseInt(currentNum, 10);
          const linkNumber = parseInt(linkNum, 10);
          
          if (linkNumber === currentNumber + 1) {
            console.log(`  Found URL sequence: ${url.pathname} -> ${linkUrl.pathname}`);
            addSuccessorLink(href, `URL sequence (${currentNumber} -> ${linkNumber})`);
          }
        }
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  });

  // 4. Navigation container analysis
  console.log('\n4. Checking navigation containers:');
  $(navSelectors).each((_, navEl) => {
    const navContainer = $(navEl);
    console.log(`  Analyzing nav container: ${navContainer.prop('tagName')}.${navContainer.attr('class') || ''}`);
    
    // Look for current page indicator in this nav container
    const currentPageLink = navContainer.find('a').filter((_, linkEl) => {
      const linkHref = $(linkEl).attr('href');
      if (!linkHref) return false;
      try {
        const linkUrl = normalize(new URL(linkHref, baseUrl));
        const currentUrl = normalize(new URL(baseUrl));
        return linkUrl.href === currentUrl.href;
      } catch (e) {
        return false;
      }
    }).first();
    
    if (currentPageLink.length > 0) {
      console.log(`  Found current page in nav container`);
      
      // Find next siblings
      currentPageLink.nextAll('a').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        console.log(`  Found next sibling: "${text}" -> ${href}`);
        addSuccessorLink(href, `nav sibling "${text}"`);
      });
      
      // Also check parent containers for next siblings
      const parentItem = currentPageLink.closest('li');
      if (parentItem.length > 0) {
        parentItem.nextAll('li').find('a').each((_, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          console.log(`  Found next parent sibling: "${text}" -> ${href}`);
          addSuccessorLink(href, `nav parent sibling "${text}"`);
        });
      }
    } else {
      console.log(`  Current page not found in nav container`);
    }
  });

  console.log(`\n=== Found ${successorLinks.length} successor links ===`);
  successorLinks.forEach((link, i) => console.log(`  ${i+1}. ${link}`));

  return successorLinks;
}

// Test the successor page detection logic
async function testSuccessorDetection() {
  console.log('Starting successor page detection test...\n');

  // Test Case 1: FastAPI docs with next link
  console.log('=== TEST CASE 1: FastAPI docs with next link ===');
  const fastApiHtml = [
    '<html>',
    '  <body>',
    '    <nav class="docs-nav">',
    '      <a href="https://fastapi.tiangolo.com/">Home</a>',
    '      <a href="https://fastapi.tiangolo.com/features/">Features</a>',  
    '      <a href="https://fastapi.tiangolo.com/tutorial/">Tutorial</a>',
    '      <a href="https://fastapi.tiangolo.com/advanced/">Advanced</a>',
    '    </nav>',
    '    <footer>',
    '      <div class="md-footer__inner">',
    '        <a href="https://fastapi.tiangolo.com/features/" class="md-footer__link md-footer__link--next" aria-label="Next: Features">',
    '          <div class="md-footer__title">',
    '            <span class="md-footer__direction">Next</span>',
    '            <div class="md-ellipsis">Features</div>',
    '          </div>',
    '        </a>',
    '      </div>',
    '    </footer>',
    '  </body>',
    '</html>'
  ].join('\n');

  const successors1 = extractSuccessorLinks('https://fastapi.tiangolo.com/', fastApiHtml);
  
  // Test Case 2: Sequential numbering
  console.log('\n\n=== TEST CASE 2: Sequential numbering ===');
  const sequentialHtml = [
    '<html>',
    '  <body>',
    '    <div class="content">',
    '      <h1>Page 1 Content</h1>',
    '      <p>This is page 1</p>',
    '      <nav class="pagination">',
    '        <a href="/tutorial/page/2">Page 2</a>',
    '        <a href="/tutorial/page/3">Page 3</a>',
    '      </nav>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const successors2 = extractSuccessorLinks('https://example.com/tutorial/page/1', sequentialHtml);
  
  // Test Case 3: Navigation with current page
  console.log('\n\n=== TEST CASE 3: Navigation with current page ===');
  const navHtml = [
    '<html>',
    '  <body>',
    '    <aside class="sidebar">',
    '      <nav>',
    '        <ul>',
    '          <li><a href="/docs/intro">Introduction</a></li>',
    '          <li><a href="/docs/quickstart" class="current">Quick Start</a></li>',
    '          <li><a href="/docs/installation">Installation</a></li>',
    '          <li><a href="/docs/configuration">Configuration</a></li>',
    '        </ul>',
    '      </nav>',
    '    </aside>',
    '  </body>',
    '</html>'
  ].join('\n');

  const successors3 = extractSuccessorLinks('https://example.com/docs/quickstart', navHtml);

  console.log('\n\n=== SUMMARY ===');
  console.log(`Test 1 (FastAPI): Found ${successors1.length} successors`);
  console.log(`Test 2 (Sequential): Found ${successors2.length} successors`);
  console.log(`Test 3 (Navigation): Found ${successors3.length} successors`);
}

// Run the test
testSuccessorDetection().catch(console.error);
