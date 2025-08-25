import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getDeepSeekClient() {
  if (client) return client;
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  client = new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
  });
  return client;
}

export async function deepSeekChat(prompt: string): Promise<string> {
  const c = getDeepSeekClient();
  const res = await c.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a concise assistant that returns only JSON array of lowercase hashtag-like tokens.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  });
  return res.choices?.[0]?.message?.content || '';
}
