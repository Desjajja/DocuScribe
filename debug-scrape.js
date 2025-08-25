import { scrapeUrl } from './src/ai/flows/scrape-url-flow.js';

(async () => {
  const result = await scrapeUrl({
    startUrl: 'https://https://fastapi.tiangolo.com/',
    maxPages: 5,
  });
  console.log(result);
})();