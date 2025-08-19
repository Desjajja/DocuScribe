import { config } from 'dotenv';
config({ path: '.env.local' });

import '@/ai/flows/summarize-mcp-data.ts';
import '@/ai/flows/scrape-url-flow.ts';
