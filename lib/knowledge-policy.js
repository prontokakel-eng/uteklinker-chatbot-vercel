import { reviewedContentMatches } from './reviewed-content.js';
// Approval belongs to a reviewed source, never to retrieval/cache/model output.
export function approvedFact(row, now = Date.now()) {
  const e = row?.evidence;
  const date = Date.parse(e?.date);
  return !!e && reviewedContentMatches(row) && ['faq', 'manual', 'document'].includes(e.origin)
    && e.factClass === 'static' && e.approvalStatus === 'approved' && Number.isFinite(date) && date <= now
    && ['sourceId', 'source', 'location', 'approvedBy'].every(k => typeof e[k] === 'string' && e[k].trim())
    && !/\b(?:ai|cache|generated|model)\b/iu.test(`${row.provenance || ''} ${e.source} ${e.sourceId}`);
}

// Document review/mtime/exact matching does not establish current commerce data.
// A future authoritative live-commerce adapter needs its own freshness contract.
export const commercialFact = /(?<![\p{L}\p{N}])(?:pris\p{L}*|kost\p{L}*|lager\p{L}*|leverans\p{L}*|levering\p{L}*|price\p{L}*|cost\p{L}*|stock|in[- ]stock|availability|available now|delivery|shipping|dispatch|preis\p{L}*|bestand|liefer\p{L}*|versand\p{L}*|vorrätig|verfügbar|sold out|kronor|kroner|euros?|dollars?|slutsåld|udsolgt|ausverkauft|erbjudande\p{L}*|tilbud\p{L}*|offer\p{L}*|angebot\p{L}*)(?![\p{L}\p{N}])|(?:\d[\d., ]*\s*(?:kr\b|sek\b|dkk\b|eur\b|€|\$))|(?:[€$]\s*\d)/iu;
export const commerceTiming = /(?:när|hvornår|wann|when).{0,50}(?:får|kommer|ankommer|bekomme|erhalte|kommt|ankommt|arrive|receive|dispatch)|(?:hur många|hvor mange|how many|wie viele).{0,50}(?:kvar|left|remaining|verfügbar)/iu;
export const supportQuestion = /öppettid|åbningstid|öffnungszeit|opening\s*(?:hours|times)|support\s*hours|kundtjänst|kundeservice|kundenservice|customer\s*(?:service|support)|(?:är|har|er|ist|seid|are|is).{0,30}(?:öppet|öppen|åben|offen|open)/iu;
export const sourceEvidence = rows => rows.map(r => ({ ...r.evidence }));
