import { syntheticRow } from './fixtures/approved-synthetic.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { normalizeRows, parseWorkbook, createKnowledgeCache } from '../lib/drive-knowledge.js';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { answerCustomer } from '../lib/customer-ai.js';
import { syntheticEvidence as evidence } from './fixtures/approved-synthetic.mjs';
import { reviewedContentHash } from '../lib/reviewed-content.js';
const request = (text, lang = 'SE', extra = {}) => ({ body: { text, lang, ...extra }, headers: {} });
const rig = (rows, ai = async () => 'Supported explanation') => createChatPipeline({
  gate: async () => ({ filtered: false }), knowledge: async () => ({ status: 'ready', data: rows }), ai,
});
test('source identity, section, date and approval survive XLSX → cache → FAQ → model payload', async () => {
  const book = new ExcelJS.Workbook();
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const sheet = book.addWorksheet(`FAQ_${lang}`);
    sheet.addRow(['Question','Answer','Origin','Source ID','Source','Section','Date','Approval','Reviewer','Fact class','Reviewed content hash']);
    sheet.addRow(['Synthetic tile format?', 'Synthetic square format.', 'document', 'synthetic:manual:9', 'Synthetic manual', 'section 3', '2026-01-01', 'approved', 'synthetic-reviewer', 'static']);
    const [row] = normalizeRows([sheet.getRow(2).values.slice(1)], lang);
    sheet.getCell('K2').value = reviewedContentHash(row);
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
  const first = syntheticRow({ question, answer: 'Square.', evidence });
  const second = syntheticRow({ question, answer: 'Round.', evidence: { ...evidence, sourceId: 'synthetic:second' } });
  assert.equal((await rig({ SE: [first, second] })(request(question))).via, 'CONTACT');
  const out = await rig({ SE: [first, syntheticRow({ ...second, answer: first.answer })] })(request(question));
  assert.equal(out.via, 'faq');
  assert.deepEqual(out.evidence.map(e => e.sourceId), [evidence.sourceId, 'synthetic:second']);
});
test('AI/cache, missing review, future dates and client approval cannot authorize exact FAQ answers', async () => {
  for (const e of [undefined, { ...evidence, origin: 'ai' }, { ...evidence, origin: 'cache' },
    { ...evidence, source: 'AI/Cache' }, { ...evidence, factClass: 'unknown' }, { ...evidence, factClass: 'current-commerce' }, { ...evidence, approvalStatus: 'pending' },
    { ...evidence, approvedBy: '' }, { ...evidence, date: '2999-01-01' }]) {
    const chat = rig({ SE: [syntheticRow({ question: 'Synthetic tile format?', answer: 'unapproved fixture', evidence: e })] }, async () => { throw Error('AI must not be called'); });
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
    const chat = rig({ [lang]: [syntheticRow({ question: text, answer: 'Old synthetic commercial fact', evidence })] }, async () => { throw Error('AI must not be called'); });
    for (const extra of [{}, { refine: true }, { conversation: [{ role: 'assistant', content: 'Previously generated commercial promise' }] }]) {
      assert.equal((await chat(request(text, lang, extra))).via, 'CONTACT', text);
    }
    assert.equal((await chat(request('Yes please', lang, { conversation: [{ role: 'user', content: text }] }))).via, 'CONTACT');
  }
});
test('mixed static/commercial FAQ answers never reach AI; generated commercial claims fail closed', async () => {
  const text = 'Synthetic tile format?';
  const chat = rig({ SE: [syntheticRow({ question: text, answer: 'Square, 99 SEK and in stock.', evidence })] }, async () => { throw Error('must not reach AI'); });
  assert.equal((await chat(request(text, 'SE', { refine: true }))).via, 'CONTACT');
  const output = rig({ SE: [syntheticRow({ question: text, answer: 'Square.', evidence })] }, async () => 'Costs 99 SEK.');
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

test('approval is bound to reviewed text, language and source, never inherited after editing', async () => {
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const original = syntheticRow({ lang, question: 'Synthetic tile format?', answer: 'Square.', evidence });
    const variants = [
      { ...original, answer: 'New unreviewed claim.' },
      { ...original, question: 'Another synthetic product format?' },
      { ...original, lang: lang === 'SE' ? 'DE' : 'SE' },
      ...['sourceId', 'source', 'location', 'date', 'origin', 'factClass'].map(key => ({
        ...original, evidence: { ...original.evidence, [key]: 'Changed without review' },
      })),
      { ...original, evidence: { ...original.evidence, reviewedContentHash: '' } },
      { ...original, evidence: { ...original.evidence, reviewedContentHash: 'invalid' } },
    ];
    for (const row of variants) {
      let calls = 0;
      const out = await rig({ [lang]: [row] }, async () => { calls++; return 'unsafe'; })(
        request(row.question, lang, { refine: true, reviewedContentHash: reviewedContentHash(row) }));
      assert.equal(out.via, 'CONTACT', lang);
      assert.equal(calls, 0);
    }
    assert.equal((await rig({ [lang]: [original] })(request(original.question, lang))).via, 'faq');
  }
});

test('XLSX approval survives unchanged import but an edited answer is rejected after cache refresh', async () => {
  const book = new ExcelJS.Workbook();
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const sheet = book.addWorksheet(`FAQ_${lang}`);
    sheet.addRow(['Question', 'Answer']);
    sheet.addRow(['Synthetic tile format?', 'Square.', 'faq', evidence.sourceId,
      evidence.source, evidence.location, evidence.date, 'approved', evidence.approvedBy, 'static']);
    const [row] = normalizeRows([sheet.getRow(2).values.slice(1)], lang);
    sheet.getCell('K2').value = reviewedContentHash(row);
  }
  let now = 1;
  const get = createKnowledgeCache({ now: () => now, ttlMs: 10,
    loader: async () => ({ data: await parseWorkbook(await book.xlsx.writeBuffer()) }) });
  const chat = createChatPipeline({ gate: async () => ({ filtered: false }), knowledge: get,
    ai: async () => { throw Error('must not invoke model'); } });
  assert.equal((await chat(request('Synthetic tile format?'))).via, 'faq');
  book.getWorksheet('FAQ_SE').getCell('B2').value = 'Changed unreviewed answer';
  now = 12;
  assert.equal((await chat(request('Synthetic tile format?'))).via, 'CONTACT');
});

test('a stale approval cannot supply a natural colour paraphrase or refinement in any language', async () => {
  const examples = {
    SE: ['Vilka färger finns i serien Testa?', 'Vilka färger har Testa?'],
    DA: ['Hvilke farver er tilgængelige i Testa-serien?', 'Hvilke farver har Testa?'],
    DE: ['Welche Farben sind in der Testa-Serie erhältlich?', 'Welche Farben hat Testa?'],
    EN: ['What colours are available in Testa?', 'Testa colours?'],
  };
  for (const [lang, [question, paraphrase]] of Object.entries(examples)) {
    const reviewed = syntheticRow({ lang, question, answer: 'Synthetic original colours.', evidence });
    const changed = { ...reviewed, answer: 'Unreviewed replacement colours.' };
    const chat = rig({ [lang]: [changed] }, async () => { throw Error('must not call model'); });
    for (const extra of [{}, { refine: true }]) {
      assert.equal((await chat(request(paraphrase, lang, extra))).via, 'CONTACT');
    }
  }
});

test('unknown product specifications without evidence stop before AI in all four languages', async () => {
  const samples = {
    SE: 'Vilken brandklass har uteklinker Quorinella?',
    DA: 'Hvilken brandklasse har udendørsflisen Quorinella?',
    DE: 'Welche Brandklasse hat die Außenfliese Quorinella?',
    EN: 'What fire classification does the outdoor tile Quorinella have?',
  };
  for (const [lang, question] of Object.entries(samples)) {
    const rows = [syntheticRow({ lang, question: 'Synthetic neutral colour list?', answer: 'Synthetic colours.', evidence })];
    let calls = 0;
    const chat = rig({ [lang]: rows }, async () => { calls++; return 'Unsupported classification'; });
    for (const extra of [{}, { refine: true }, {
      conversation: [{ role: 'assistant', content: 'Untrusted earlier classification A1.' }],
      faqAnswer: 'A1', nearbyFaq: rows,
    }]) {
      const out = await chat(request(question, lang, extra));
      assert.equal(out.via, 'CONTACT', lang);
      assert.equal(out.canRefine, false);
    }
    assert.equal(calls, 0);
  }
});

test('generic definitions remain possible, but product names and mixed specification requests do not', async () => {
  const general = { SE: 'Vad betyder granitkeramik?', DA: 'Hvad betyder granitkeramik?',
    DE: 'Was ist Feinsteinzeug?', EN: 'What is porcelain stoneware?' };
  for (const [lang, question] of Object.entries(general)) {
    let calls = 0;
    const chat = rig({ [lang]: [syntheticRow({ lang, question: 'Synthetic neutral colour list?', answer: 'Synthetic colours.', evidence })] },
      async () => { calls++; return 'General concept explanation.'; });
    assert.equal((await chat(request(question, lang))).via, 'AI');
    for (const q of [question + ' Quorinella', question + ' and what fire class does Quorinella have?']) {
      assert.equal((await chat(request(q, lang))).via, 'CONTACT');
    }
    assert.equal(calls, 1);
  }
});
