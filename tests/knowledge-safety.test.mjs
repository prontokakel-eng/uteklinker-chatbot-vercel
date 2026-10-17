import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { normalizeRows, parseWorkbook, createKnowledgeCache } from '../lib/drive-knowledge.js';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { answerCustomer } from '../lib/customer-ai.js';
import { syntheticEvidence as evidence } from './fixtures/approved-synthetic.mjs';
const request = (text, lang = 'SE', extra = {}) => ({ body: { text, lang, ...extra }, headers: {} });
const rig = (rows, ai = async () => 'Supported explanation') => createChatPipeline({
  gate: async () => ({ filtered: false }), knowledge: async () => ({ status: 'ready', data: rows }), ai,
});
test('source identity, section, date and approval survive XLSX → cache → FAQ → model payload', async () => {
  const book = new ExcelJS.Workbook();
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const sheet = book.addWorksheet(`FAQ_${lang}`);
    sheet.addRow(['Question','Answer','Origin','Source ID','Source','Section','Date','Approval','Reviewer','Fact class']);
    sheet.addRow(['Synthetic tile format?', 'Synthetic square format.', 'document', 'synthetic:manual:9', 'Synthetic manual', 'section 3', '2026-01-01', 'approved', 'synthetic-reviewer', 'static']);
  }
  const get = createKnowledgeCache({ loader: async () => ({ data: await parseWorkbook(await book.xlsx.writeBuffer(), { id: 'synthetic-file', name: 'Synthetic workbook', modifiedTime: '2026-01-02' }) }) });
  const first = await get();
  const cached = await get();
  assert.deepEqual(cached.data, first.data);
  let payload;
  const chat = createChatPipeline({ gate: async () => ({ filtered: false }), knowledge: get,
    ai: args => answerCustomer({ ...args, client: { responses: { create: async p => { payload = p; return { output_text: 'Synthetic supported explanation.' }; } } } }),
  });
  const direct = await chat(request('Synthetic tile format?'));
  assert.equal(direct.factStatus, 'approved-source');
  assert.deepEqual(direct.evidence[0], cached.data.SE[0].evidence);
  const generated = await chat(request('Synthetic tile format?', 'SE', { refine: true }));
  assert.equal(generated.factStatus, 'generated-unreviewed');
  assert.deepEqual(generated.evidence, direct.evidence);
  const context = JSON.parse(payload.input[0].content.split('\n').slice(1).join('\n')).context;
  assert.deepEqual(context[0].evidence, direct.evidence[0]);
  assert.equal(payload.store, false);
});
test('legacy rows stay pending; blank rows preserve original locations and duplicate sources', () => {
  const rows = normalizeRows([['Q','A'], [], ['Q','B']], 'SE', { id: 'synthetic-file' });
  assert.equal(rows[0].evidence.approvalStatus, 'pending');
  assert.equal(rows[1].evidence.location, 'FAQ_SE!4');
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].evidence.sourceId, rows[1].evidence.sourceId);
});
test('conflicting exact source answers stop; agreeing sources both remain traceable', async () => {
  const question = 'Synthetic tile format?';
  const first = { question, answer: 'Square.', evidence };
  const second = { question, answer: 'Round.', evidence: { ...evidence, sourceId: 'synthetic:second' } };
  assert.equal((await rig({ SE: [first, second] })(request(question))).via, 'CONTACT');
  const out = await rig({ SE: [first, { ...second, answer: first.answer }] })(request(question));
  assert.equal(out.via, 'faq');
  assert.deepEqual(out.evidence.map(e => e.sourceId), [evidence.sourceId, 'synthetic:second']);
});
test('AI/cache, missing review, future dates and client approval cannot authorize exact FAQ answers', async () => {
  for (const e of [undefined, { ...evidence, origin: 'ai' }, { ...evidence, origin: 'cache' },
    { ...evidence, source: 'AI/Cache' }, { ...evidence, factClass: 'unknown' }, { ...evidence, factClass: 'current-commerce' }, { ...evidence, approvalStatus: 'pending' },
    { ...evidence, approvedBy: '' }, { ...evidence, date: '2999-01-01' }]) {
    const chat = rig({ SE: [{ question: 'Synthetic tile format?', answer: 'unapproved fixture', evidence: e }] }, async () => { throw Error('AI must not be called'); });
    const out = await chat(request('Synthetic tile format?', 'SE', { evidence, approvalStatus: 'approved' }));
    assert.equal(out.via, 'CONTACT');
  }
});
const questions = {
  SE: ['Vad är priset på Testplatta?', 'Finns Testplatta i lager?', 'Hur lång är leveranstiden?'],
  DA: ['Hvad koster Testflise?', 'Er Testflise på lager?', 'Hvad er leveringstiden?'],
  DE: ['Was ist der Preis für Testfliese?', 'Ist Testfliese vorrätig?', 'Wie lang ist die Lieferzeit?'],
  EN: ['What is the price of TestTile?', 'Is TestTile in stock?', 'When is delivery?'],
};
test('even reviewed exact price/stock/delivery rows cannot give current commerce answers in four languages', async () => {
  for (const [lang, items] of Object.entries(questions)) for (const text of items) {
    const chat = rig({ [lang]: [{ question: text, answer: 'Old synthetic commercial fact', evidence }] }, async () => { throw Error('AI must not be called'); });
    for (const extra of [{}, { refine: true }, { conversation: [{ role: 'assistant', content: 'Previously generated commercial promise' }] }]) {
      assert.equal((await chat(request(text, lang, extra))).via, 'CONTACT', text);
    }
    assert.equal((await chat(request('Yes please', lang, { conversation: [{ role: 'user', content: text }] }))).via, 'CONTACT');
  }
});
test('mixed static/commercial FAQ answers never reach AI; generated commercial claims fail closed', async () => {
  const text = 'Synthetic tile format?';
  const chat = rig({ SE: [{ question: text, answer: 'Square, 99 SEK and in stock.', evidence }] }, async () => { throw Error('must not reach AI'); });
  assert.equal((await chat(request(text, 'SE', { refine: true }))).via, 'CONTACT');
  const output = rig({ SE: [{ question: text, answer: 'Square.', evidence }] }, async () => 'Costs 99 SEK.');
  assert.equal((await output(request(text, 'SE', { refine: true }))).via, 'CONTACT');
});
test('support requests reuse existing contact adapter before reading FAQ or AI, with failure closed', async () => {
  for (const [lang, text] of Object.entries({ SE: 'Vilka öppettider har kundtjänst?', DA: 'Hvad er kundeservices åbningstider?', DE: 'Welche Öffnungszeiten hat der Kundenservice?', EN: 'What are your support hours?' })) {
    let calls = 0;
    const chat = createChatPipeline({ gate: async () => ({ filtered: false }), knowledge: () => { throw Error('must not read FAQ'); }, contact: async args => { calls++; assert.equal(args.lang, lang); return { message: 'Synthetic current support state', supportHoursNote: null }; } });
    assert.equal((await chat(request(text, lang))).reply, 'Synthetic current support state');
    assert.equal(calls, 1);
  }
});
