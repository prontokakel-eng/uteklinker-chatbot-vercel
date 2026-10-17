import { warrantyMaterial } from '../lib/warranty-policy.js';
import { syntheticEvidence } from './fixtures/approved-synthetic.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Fuse from 'fuse.js';
import { findKnowledge, parseWorkbook } from '../lib/drive-knowledge.js';
import { createChatPipeline } from '../lib/chatPipeline.js';

// Questions from the repository's language benchmark, not a live Drive snapshot.
// Answers are deliberately synthetic: these tests verify retrieval, not colours.
const benchmark = JSON.parse(await fs.readFile(new URL('./fixtures/faq-lang-benchmark-2025-10-07.json', import.meta.url)));
const data = Object.fromEntries(['SE', 'DA', 'DE'].map(lang => [lang, benchmark
  .filter(r => r.expected === lang).map(r => ({ question: r.input, evidence:syntheticEvidence,answer: `Fixture ${lang}: ${r.input}`, lang }))]));
const source = {
  SE: 'Vilka färger finns i serien Lava?',
  DA: 'Hvilke farver er tilgængelige i Lava-serien?',
  DE: 'Welche Farben sind in der Lava-Serie erhältlich?',
};
const variants = {
  SE: ['Vilka färger finns i Lava?', 'Vilka färger har Lava?', 'Lava färger?', 'Vilka färger finns det i Lava-serien?', 'I vilka färger finns Lava?', 'Vilka färger finns tillgängliga i serien Lava?', '  VILKA  färger har serien Lava?! '],
  DA: ['Hvilke farver har Lava?', 'Hvilke farver findes i Lava?', 'Lava farver?', 'Hvilke farver fås i Lava-serien?', '  HVILKE  farver har Lava‑serien?! '],
  DE: ['Welche Farben hat Lava?', 'In welchen Farben gibt es Lava?', 'Lava Farben?', 'Welche Farben gibt es in der Lava-Serie?', '  WELCHE  Farben hat die Serie Lava?! '],
};
const shortQuestion = (lang, entity) => ({ SE: `Vilka färger har ${entity}?`, DA: `Hvilke farver har ${entity}?`, DE: `Welche Farben hat ${entity}?` })[lang];
for (const lang of ['SE', 'DA', 'DE']) {
  test(`${lang}: natural colour paraphrases select the correct row among all benchmark questions`, () => {
    const row = data[lang].find(r => r.question === source[lang]);
    assert.ok(row);
    for (const q of variants[lang]) {
      const hits = findKnowledge(data, lang, q);
      assert.equal(hits.length, 1, q);
      assert.equal(hits[0].question, row.question, q);
      assert.equal(hits[0].answer, row.answer, q);
      assert.ok(hits[0].score > 0 && hits[0].score <= 0.18, q);
    }
  });
  test(`${lang}: shortened questions preserve each colour-series identity across the benchmark`, () => {
    let checked = 0;
    for (const row of data[lang]) {
      const match = row.question.match(lang === 'SE'
        ? /^Vilka färger finns i serien (.+)\?$/u
        : lang === 'DA'
        ? /^Hvilke farver er tilgængelige i (.+)-serien\?$/u
        : /^Welche Farben sind in der (.+)-Serie (?:erhältlich|verfügbar)\?$/u);
      if (!match) continue;
      const q = shortQuestion(lang, match[1]);
      assert.equal(findKnowledge(data, lang, q)[0]?.question, row.question, q);
      checked++;
    }
    assert.ok(checked >= 20, `Expected a representative catalogue, got ${checked}`);
  });
  test(`${lang}: non-warranty exact benchmark questions keep their answers; warranty rows are excluded`, () => {
    for (const row of data[lang]) {
      if (warrantyMaterial(row.question + ' ' + row.answer)) { assert.deepEqual(findKnowledge(data, lang, row.question), []); continue; }
      const [hit] = findKnowledge(data, lang, row.question);
      assert.equal(hit.question, row.question);
      assert.equal(hit.answer, row.answer);
      assert.equal(hit.score, 0);
    }
  });
  test(`${lang}: unknown, near-spelled, multiple and modified series cannot borrow another answer`, () => {
    for (const entity of ['Lavo', 'Lava Pro', 'Unknown', 'Lava 60x60', 'Lava och Albero', 'Lava og Albero', 'Lava und Albero']) {
      const q = shortQuestion(lang, entity);
      assert.deepEqual(findKnowledge(data, lang, q), [], q);
    }
    assert.deepEqual(findKnowledge({ [lang === 'DA' ? 'DE' : 'DA']: data[lang] }, lang, variants[lang][0]), []);
  });
  test(`${lang}: conflicting colour source rows do not become an arbitrary direct answer`, () => {
    const rows = [
      { question: source[lang], evidence:syntheticEvidence,answer: 'first' },
      { question: variants[lang][1], evidence:syntheticEvidence,answer: 'conflicting' },
    ];
    assert.deepEqual(findKnowledge({ [lang]: rows }, lang, variants[lang][0]), []);
    assert.equal(findKnowledge({ [lang]: rows }, lang, source[lang])[0].answer, 'first');
  });
  test(`${lang}: pipeline answers paraphrases from FAQ and continues refinement with server facts`, async () => {
    let calls = 0, captured;
    const chat = createChatPipeline({ knowledge: async () => ({ status: 'ready', data }),
      ai: async input => { calls++; captured = input; return 'refinement'; } });
    const q = variants[lang][0];
    const request = (text, extra = {}) => ({ body: { text, lang, ...extra }, headers: { 'x-forwarded-for': ({SE:'192.0.2.203',DA:'192.0.2.201',DE:'192.0.2.202'})[lang] } });
    const answer = await chat(request(q));
    assert.equal(answer.via, 'faq');
    assert.equal(answer.reply, data[lang].find(r => r.question === source[lang]).answer);
    assert.equal(calls, 0);
    const conversation = [{ role: 'user', content: q }, { role: 'assistant', content: answer.reply }];
    assert.equal((await chat(request(q, { refine: true, conversation, faqAnswer: 'invented' }))).via, 'AI');
    assert.equal(captured.context[0].answer, answer.reply);
    assert.equal(captured.refine, true);
    const yes = ({SE:'Ja gärna',DA:'Ja tak',DE:'Ja bitte'})[lang];
    assert.equal((await chat(request(yes, { conversation }))).via, 'AI');
    assert.equal(captured.context[0].answer, answer.reply);
    assert.equal(captured.followUp, true);
    for (const text of lang === 'SE'
      ? ['Vad är priset på Lava?', 'Hur lägger jag Lava på gräs?']
      : lang === 'DA'
      ? ['Hvad er jeres priser på Lava?', 'Hvordan lægger jeg Lava på græs?']
      : ['Was ist der Preis von Lava?', 'Wie verlege ich Lava auf Rasen?']) {
      const before = calls;
      assert.equal((await chat(request(text))).via, 'CONTACT', text);
      assert.equal(calls, before);
    }
  });
}
test('EN fuzzy retrieval and SE/DA/DE non-colour questions retain original Fuse logic', () => {
  for (const [lang, question, query] of [
    ['SE', 'Vilka format finns i Lava?', 'Vilka format finns i Lava'],
    ['EN', 'What formats are available in Lava?', 'What formats are available in Lava'],
    ['DA', 'Hvilke formater findes i Lava?', 'Hvilke formater findes i Lava'],
    ['DE', 'Welche Formate gibt es in Lava?', 'Welche Formate gibt es in Lava'],
  ]) {
    const rows = [{ question, evidence:syntheticEvidence,answer: 'fixture' }];
    const expected = new Fuse(rows, { keys: ['question'], includeScore: true, threshold: 0.28, ignoreLocation: true })
      .search(query, { limit: 4 }).map(r => ({ ...r.item, score: r.score }));
    assert.deepEqual(findKnowledge({ [lang]: rows }, lang, query), expected);
  }
});

test('SE: short colour questions retrieve the correct answer from the four-language workbook', {skip:!process.env.TEST_FAQ_FILE}, async () => {
  const workbook = await parseWorkbook(await fs.readFile(process.env.TEST_FAQ_FILE));
  const row = workbook.SE.find(r => r.question === source.SE);
  assert.ok(row);
  for (const query of variants.SE) {
    const [hit] = findKnowledge(workbook, 'SE', query);
    assert.equal(hit?.question, row.question, query);
    assert.equal(hit?.answer, row.answer, query);
    assert.ok(hit.score <= 0.18, query);
  }
});
