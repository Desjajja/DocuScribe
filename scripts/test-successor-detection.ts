import { findSuccessorPages } from '../src/ai/flows/scrape-url-flow';

// Test the successor page detection logic
async function testSuccessorDetection() {
  console.log('Starting successor page detection test...\n');

  // Sample HTML with next page link (similar to FastAPI docs)
  const sampleHtml = [
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

  const currentUrl = 'https://fastapi.tiangolo.com/';
  
  console.log(`Testing successor detection for: ${currentUrl}`);
  console.log('Calling findSuccessorPages tool...\n');
  
  try {
    // Call the Genkit tool with correct input format
    const successors = await findSuccessorPages({
      baseUrl: currentUrl,
      htmlContent: sampleHtml
    });
    
    console.log('\nSuccessor pages found:');
    if (successors && successors.length > 0) {
      successors.forEach((url: string, index: number) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    } else {
      console.log('  No successor pages found');
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during successor detection:', error);
  }
}

// Run the test
testSuccessorDetection().catch(console.error);
