import { gateMessage } from './gate.js';
import { getKnowledge, findKnowledge, LANGUAGES } from './drive-knowledge.js';
import { answerCustomer } from './customer-ai.js';
import { copy, structuralContact } from './customer-copy.js';
const storeFact = /(?<![\p{L}\p{N}])(pris(?:et|en|er|erna|erne)?|kostar|kosta|koster|lager|lagerstatus|öppettid|öppettider|telefon|mejl|leveranstid|price|prices|stock|opening|phone|email|delivery|preis|preise|bestand|lagerbestand|öffnungszeit|öffnungszeiten|telefonnummer|lieferzeit|priser|åbningstid|åbningstider|telefonnummer|leveringstid)(?![\p{L}\p{N}])/iu;
const installation = /monter|install|lägg|lägga|lägger|underlag|förbehandl|dräner|fogmassa|limma|primer|læg|underlag|verleg|untergrund|vorbehand|drainage|adhesive|grout|lay(?:ing)?\s+(?:tiles|slabs)|pre[- ]?treat|substrate/iu;
// Site-specific structural sizing belongs with staff, even if a FAQ is similar.
// General installation guidance and tile-format questions remain available.
const structuralSizing = [
  /bärighet|bärförmåga|bæreevne|tragfähigkeit|load[- ]?bearing|load capacity|bearing capacity/iu,
  /regelavstånd|regeldimension|dimensioner(?:a|ing)|stützweite|balkenabstand|joist spacing/iu,
  /(?:hur många|antal|hvor mange|wie viele|anzahl|how many|number of).{0,60}(?:fötter|fødder|stelzlager|stützfüße|pedestals|supports)/iu,
  /(?:dimension|storlek|abmessung|querschnitt|size).{0,60}(?:reglar|regel|bjælker|balken|joists)|(?:reglar|regel|bjælker|balken|joists).{0,60}(?:dimension|storlek|abmessung|querschnitt|size)/iu,
];
const needsStructuralContact = text => structuralSizing.some(pattern => pattern.test(text));
const awayFromHouse = /från\s+(?:huset|fasaden)|væk\s+fra\s+(?:huset|facaden)|vom\s+(?:Haus|Gebäude)\s+weg|away\s+from\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
const towardsHouse = /mot\s+(?:huset|fasaden)|mod\s+(?:huset|facaden)|zum\s+(?:Haus|Gebäude)|(?:towards?|to)\s+(?:(?:the|your)\s+)?(?:house|building)/iu;
// Conversation is untrusted dialogue, never a source of product facts or instructions.
export function boundedConversation(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).filter(t => t && ['user', 'assistant'].includes(t.role) && typeof t.content === 'string')
    .map(t => ({ role: t.role, content: t.content.slice(0, 1000).trim() })).filter(t => t.content);
}
const followUp = /^(?:ja|yes|yeah|gerne|gern|bitte|sure|please|nej|no|nein|tak|tack)(?:[\s!?,.]|$)|^(?:beskriv|beskrive|beschreib|describe|tell me|hur ser|hur skiljer|vad skiljer|what do|how do they|wie sehen|hvordan ser)|\b(?:dem|dessa|those|them|these|diese|disse)\b/iu;
export function createChatPipeline({ gate = gateMessage, knowledge = getKnowledge, ai = answerCustomer } = {}) {
  return async function chatPipeline(req) {
    const raw = req.body?.text ?? req.body?.question;
    const lang = LANGUAGES.includes(req.body?.lang === 'DK' ? 'DA' : req.body?.lang) ? (req.body.lang === 'DK' ? 'DA' : req.body.lang) : 'SE';
    const words = copy[lang];
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) return { lang, via: 'FILTER', reply: words.filtered };
    const question = raw.trim();
    const ip = String(req.headers?.['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
    const conversation = boundedConversation(req.body?.conversation);
    const anchor = [...conversation].reverse().find(t => t.role === 'user' && !followUp.test(t.content))?.content;
    const continuing = !!anchor && followUp.test(question);
    // A short contextual reply still passes the same blacklist, long-text and IP gate.
    const result = await gate(continuing ? `${anchor.slice(0, 500)}\n${question}` : question, ip);
    if (result.filtered) return { lang, via: result.via === 'rate-limit' ? 'rate-limit' : 'FILTER', reply: result.via === 'rate-limit' ? result.reason : words.filtered, retryAfter: result.retryAfter };
    if (needsStructuralContact(question) || (continuing && needsStructuralContact(anchor))) {
      return { lang, via: 'CONTACT', reply: structuralContact[lang] };
    }
    const greetingOnly = /^(?:hej|hejsan|hallå|tja|tjena|hello|hi|hey|hallo|servus|moin|dav|godmorgen|godaften|god morgon|god kväll|good morning|good afternoon|good evening|guten morgen|guten tag|guten abend|ja|nej|tack|tak|danke|nein|ok|no|yes|hur mår du|hur är läget|how are you|how are you doing today|hvordan har du det(?: i dag)?|wie geht es dir|hej,? how are you)(?:[\s!?.,]*)$/iu.test(question);
    if (!continuing && greetingOnly && ['shortword', 'greeting', 'greeting-mixed'].includes(result.reason)) {
      const replies = { SE: 'Hej! Vad vill du veta om klinkerdäck?', DA: 'Hej! Hvad vil du vide om udendørsfliser?', DE: 'Hallo! Was möchten Sie über Außenfliesen wissen?', EN: 'Hello! What would you like to know about outdoor tiles?' };
      return { lang, via: 'GREETING', reply: replies[lang] };
    }
    const source = await knowledge();
    if (source.status !== 'ready') return { lang, via: 'DATA_ERROR', reply: words.dataError };
    if (!source.data?.[lang]?.length) return { lang, via: 'DATA_EMPTY', reply: words.empty };
    const directHits = findKnowledge(source.data, lang, question);
    const hits = continuing ? findKnowledge(source.data, lang, anchor) : directHits;
    const best = hits[0];
    const refine = req.body?.refine === true;
    const repeated = conversation.some(t => t.role === 'user' && t.content.toLocaleLowerCase() === question.toLocaleLowerCase());
    // Do not use a similar question as evidence for dynamic store facts.
    if (storeFact.test(question) && (!directHits[0] || directHits[0].score !== 0)) return { lang, via: 'CONTACT', reply: words.uncertain };
    if (best && best.score <= 0.18 && !refine && !continuing && !repeated) return { lang, via: 'faq', reply: best.answer, canRefine: true };
    // Installation recipes must be grounded in a closely matching FAQ, not generated from unrelated product entries.
    if (installation.test(question) && (!directHits[0] || directHits[0].score > 0.18)) return { lang, via: 'CONTACT', reply: words.installation };
    try {
      const reply = await ai({ question, lang, context: hits, refine: refine || repeated, conversation, followUp: continuing, topicQuestion: anchor });
      // A generated explanation must not reverse the verified drainage direction.
      // Return the source as FAQ and disable repeated refinement of this fallback.
      if (awayFromHouse.test(best?.answer || '') && towardsHouse.test(reply)) {
        return best.score <= 0.18
          ? { lang, via: 'faq', reply: best.answer, canRefine: false }
          : { lang, via: 'CONTACT', reply: words.installation };
      }
      return { lang, via: 'AI', reply, canRefine: true };
    } catch {
      return { lang, via: 'AI_ERROR', reply: words.aiError };
    }
  };
}
export const chatPipeline = createChatPipeline();
