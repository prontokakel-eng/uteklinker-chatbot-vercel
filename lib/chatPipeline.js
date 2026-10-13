import { gateMessage } from './gate.js';
import { getKnowledge, findKnowledge, LANGUAGES } from './drive-knowledge.js';
import { answerCustomer } from './customer-ai.js';
import { copy } from './customer-copy.js';
const storeFact = /(?<![\p{L}\p{N}])(pris(?:et|er|erna)?|kostar|kosta|lager|lagerstatus|öppettid|öppettider|telefon|mejl|leveranstid|price|prices|stock|opening|phone|email|delivery|preis|preise|bestand|lagerbestand|öffnungszeit|öffnungszeiten|telefonnummer|lieferzeit|priser|åbningstid|åbningstider|telefonnummer|leveringstid)(?![\p{L}\p{N}])/iu;
const installation = /monter|install|lägg|lägga|lägger|underlag|förbehandl|dräner|fogmassa|limma|primer|læg|underlag|verleg|untergrund|vorbehand|drainage|adhesive|grout|lay(?:ing)?\s+(?:tiles|slabs)|pre[- ]?treat|substrate/iu;
export function createChatPipeline({ gate = gateMessage, knowledge = getKnowledge, ai = answerCustomer } = {}) {
  return async function chatPipeline(req) {
    const raw = req.body?.text ?? req.body?.question;
    const lang = LANGUAGES.includes(req.body?.lang === 'DK' ? 'DA' : req.body?.lang) ? (req.body.lang === 'DK' ? 'DA' : req.body.lang) : 'SE';
    const words = copy[lang];
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) return { lang, via: 'FILTER', reply: words.filtered };
    const question = raw.trim();
    const ip = String(req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
    const result = await gate(question, ip);
    if (result.filtered) return { lang, via: result.via === 'rate-limit' ? 'rate-limit' : 'FILTER', reply: result.via === 'rate-limit' ? result.reason : words.filtered, retryAfter: result.retryAfter };
    const greetingOnly = /^(?:hej|hejsan|hallå|tja|tjena|hello|hi|hey|hallo|servus|moin|dav|godmorgen|godaften|god morgon|god kväll|good morning|good afternoon|good evening|guten morgen|guten tag|guten abend|ja|nej|tack|tak|danke|nein|ok|no|yes|hur mår du|hur är läget|how are you|how are you doing today|hvordan har du det(?: i dag)?|wie geht es dir|hej,? how are you)(?:[\s!?.,]*)$/iu.test(question);
    if (greetingOnly && ['shortword', 'greeting', 'greeting-mixed'].includes(result.reason)) {
      const replies = { SE: 'Hej! Vad vill du veta om klinkerdäck?', DA: 'Hej! Hvad vil du vide om udendørsfliser?', DE: 'Hallo! Was möchten Sie über Außenfliesen wissen?', EN: 'Hello! What would you like to know about outdoor tiles?' };
      return { lang, via: 'GREETING', reply: replies[lang] };
    }
    const source = await knowledge();
    if (source.status !== 'ready') return { lang, via: 'DATA_ERROR', reply: words.dataError };
    if (!source.data?.[lang]?.length) return { lang, via: 'DATA_EMPTY', reply: words.empty };
    const hits = findKnowledge(source.data, lang, question);
    const best = hits[0];
    const refine = req.body?.refine === true;
    if (best && best.score <= 0.18 && !refine) return { lang, via: 'faq', reply: best.answer, canRefine: true };
    // Do not use a similar question as evidence for dynamic store facts.
    if (storeFact.test(question) && (!best || best.score !== 0)) return { lang, via: 'CONTACT', reply: words.uncertain };
    // Installation recipes must be grounded in a closely matching FAQ, not generated from unrelated product entries.
    if (installation.test(question) && (!best || best.score > 0.18)) return { lang, via: 'CONTACT', reply: words.installation };
    try {
      const reply = await ai({ question, lang, context: hits, refine });
      return { lang, via: 'AI', reply, canRefine: true };
    } catch {
      return { lang, via: 'AI_ERROR', reply: words.aiError };
    }
  };
}
export const chatPipeline = createChatPipeline();
