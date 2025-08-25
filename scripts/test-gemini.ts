import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { ai } from '../src/ai/genkit';

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('GEMINI_API_KEY not set in .env.local');
    process.exit(2);
  }
  // Some SDKs expect GOOGLE_API_KEY or similar; mirror it just in case.
  if (!process.env.GOOGLE_API_KEY) {
    (process as any).env.GOOGLE_API_KEY = key;
  }
  try {
    const promptResult = await ai.generate({ prompt: 'Say hello in one short word.' });
    const text = (promptResult as any)?.output ?? JSON.stringify(promptResult);
    console.log('Gemini response:', text);
    if (!text || typeof text !== 'string' || text.length === 0) {
      console.error('Empty response from model');
      process.exit(3);
    }
    console.log('Gemini API test OK');
  } catch (e) {
    console.error('Gemini API test FAILED:', e);
    process.exit(1);
  }
}

main();
