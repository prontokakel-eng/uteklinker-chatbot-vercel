// Run manually with a PRIVATE reviewed case file. Never runs in public CI.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { approvedFact } from '../lib/knowledge-policy.js';
import { createAiReviewDraft } from '../lib/ai-review.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const [inputPath, outputPath] = process.argv.slice(2);
const outsideRepo = p => {
  if (!p || !path.isAbsolute(p)) return false;
  const relative = path.relative(root, path.resolve(p));
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
};
if (!outsideRepo(inputPath) || !outsideRepo(outputPath) || !process.env.OPENAI_API_KEY || !process.env.OPENAI_PROJECT_ID) {
  console.error('Provide absolute private paths outside the repository, OPENAI_API_KEY and verified OPENAI_PROJECT_ID. No model requests made.');
  process.exit(1);
}
// Resolve symlinks too: private source material/reports must not land in the repo.
const resolvedInput = await fs.realpath(inputPath);
const resolvedOutputDir = await fs.realpath(path.dirname(outputPath));
if (!outsideRepo(resolvedInput) || !outsideRepo(resolvedOutputDir)) throw Error('Private paths required');
const cases = JSON.parse(await fs.readFile(resolvedInput, 'utf8'));
if (!Array.isArray(cases) || !cases.length || cases.length > 8) throw Error('Expected 1–8 privately reviewed cases');
for (const c of cases) {
  if (!['SE','DA','DE','EN'].includes(c.lang) || !c.id || typeof c.question !== 'string'
    || !Array.isArray(c.rows) || !c.rows.length || !c.rows.every(r => approvedFact(r))
    || !Array.isArray(c.expectedSourceIds) || !c.expectedSourceIds.length
    || !Array.isArray(c.required) || !Array.isArray(c.forbidden)) throw Error('Incomplete reviewed case');
}
// Suppress customer text in local operational logs before loading the real pipeline.
process.env.PRIVACY_SAFE_LOGS = 'true';
process.env.NODE_ENV = 'production';
const { createChatPipeline } = await import('../lib/chatPipeline.js');
const { answerCustomer } = await import('../lib/customer-ai.js');
const { getOpenAIClient } = await import('../lib/openai-client.js');
const liveClient = getOpenAIClient();
const results = [];
for (const c of cases) {
  let calls = 0, modelResponse;
  const client = { responses: { create: async (...args) => {
    calls++;
    const response = await liveClient.responses.create(...args);
    modelResponse = { id: response.id, model: response.model, usage: response.usage };
    return response;
  } } };
  const chat = createChatPipeline({ knowledge: async () => ({ status: 'ready', data: { [c.lang]: c.rows } }),
    ai: async args => answerCustomer({ ...args, client }),
  });
  const result = await chat({ body: { text: c.question, lang: c.lang, refine: true, conversation: c.conversation || [] }, headers: { 'x-forwarded-for': '192.0.2.200' } });
  const sourceIds = (result.evidence || []).map(e => e.sourceId);
  results.push({ id: c.id, lang: c.lang, question: c.question, result, modelResponse,
    checks: { actualModelCall: calls === 1 && !!modelResponse?.id && !!modelResponse?.model && result.via === 'AI',
      expectedSources: c.expectedSourceIds.every(id => sourceIds.includes(id)) && sourceIds.every(id => c.expectedSourceIds.includes(id)),
      required: c.required.every(s => result.reply.includes(s)), forbidden: c.forbidden.every(s => !result.reply.includes(s)) },
    draft: result.via === 'AI' ? createAiReviewDraft({ lang: c.lang, question: c.question,
      answer: result.reply, sourceReferences: result.evidence || [],
      model: modelResponse?.model || null, responseId: modelResponse?.id || null,
      testedAt: new Date().toISOString() }) : null,
    reviewStatus: 'pending-human-fact-review', reviewer: null,
  });
}
await fs.writeFile(path.join(resolvedOutputDir, path.basename(outputPath)), JSON.stringify({
  testedAt: new Date().toISOString(), model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  productionApproved: false, results,
}, null, 2), { flag: 'wx', mode: 0o600 });
const passed = results.filter(r => Object.values(r.checks).every(Boolean)).length;
console.log(`${passed}/${results.length} automated checks passed. All answers still require human fact review. Private report written.`);
if (passed !== results.length) process.exitCode = 1;
