import OpenAI from 'openai';
let client;
export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI is not configured');
  client ||= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...(process.env.OPENAI_PROJECT_ID ? { project: process.env.OPENAI_PROJECT_ID } : {}), timeout: 12000, maxRetries: 0 });
  return client;
}
