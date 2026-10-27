import {mergeCuratedFaq} from './curated-faq.js';
import {editorialRevisionsEnabled} from './dialogue-config.js';
import {createSnapshotLoader} from './knowledge-snapshot.js';
import {timeStage,latencyMeta} from './latency.js';
import { warrantyMaterial } from './warranty-policy.js';
import { Buffer } from 'node:buffer';
import Fuse from 'fuse.js';
import { restoreLegacyReview } from './legacy-faq-review.js';
import { applyPreviewFaqRevisions } from './preview-faq-revisions.js';
export const LANGUAGES = ['SE', 'DA', 'DE', 'EN'];
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const text = value => {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('result' in value) return text(value.result);
    if (value.richText) return value.richText.map(v => v.text).join('');
    return value.text || '';
  }
  return String(value).trim().replace(/\\n/g, '\n');
};
// A/B question/answer; C origin; D source ID; E source name; F section;
// G source date (ISO); H approval status; I reviewer; J fact class; K reviewed content hash. Missing approval stays pending.
export function normalizeRows(rows, lang, file = {}) {
  return rows.flatMap((cells, index) => {
    const [q, a, origin, id, source, section, date, status, reviewer, factClass, reviewedHash] = cells;
    const question = text(q), answer = text(a);
    if (!question || !answer) return [];
    const row = cells.rowNumber || index + 2;
    return [restoreLegacyReview({ question, answer, lang, provenance: text(origin), evidence: {
      sourceId: text(id) || (file.id ? `${file.id}:FAQ_${lang}:${row}` : ''),
      source: text(source) || file.name || '',
      location: text(section) || `FAQ_${lang}!${row}`,
      date: text(date), reviewedContentHash: text(reviewedHash), approvalStatus: text(status).toLowerCase() || 'pending',
      approvedBy: text(reviewer), factClass: text(factClass).toLowerCase() || 'unknown', origin: text(origin).toLowerCase() || 'document',
      fileId: file.id || '', row, modifiedTime: file.modifiedTime || null,
    } })];
  });
}
export async function parseWorkbook(buffer, file = {}) {
  const {default:ExcelJS}=await import('exceljs');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const data = {};
  for (const lang of LANGUAGES) {
    const sheet = book.getWorksheet(`FAQ_${lang}`);
    if (!sheet) throw new Error(`Missing FAQ_${lang}`);
    const rows = [];
    sheet.eachRow((row, number) => {
      if (number > 1) {
        const cells = Array.from({ length: 11 }, (_, i) => text(row.getCell(i + 1).value));
        cells.rowNumber = number;
        rows.push(cells);
      }
    });
    data[lang] = normalizeRows(rows, lang, file);
  }
  return data;
}
export async function loadDriveKnowledge(env = process.env) {
  const {google}=await import('googleapis');
  const ids = (env.FAQ_DRIVE_FILE_IDS || env.SHEET_ID_MAIN || env.SHEET_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  const email = env.GCP_CLIENT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = env.GCP_PRIVATE_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!ids.length || !email || !key) throw new Error('Knowledge source is not configured');
  const auth = new google.auth.JWT({ email, key: key.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });
  // Independent editorial reads overlap Drive download/workbook parsing.
  // One batch reads both editorial collections; neither imports AI_REVIEW.
  const editorial=editorialRevisionsEnabled(env) ? (async()=>{
    try {
      const spreadsheetId=env.SHEET_ID_MAIN || env.SHEET_ID;
      if(!spreadsheetId)throw Error('No editorial destination');
      const response=await timeStage('faq_editorial_read',()=>sheets.spreadsheets.values.batchGet({spreadsheetId,
        ranges:["'FAQ_SE_PREVIEW'!A2:L20","'FAQ_SE_CURATED'!A2:O500"]},{timeout:5000}));
      const revisions=(response.data.valueRanges?.[0]?.values || []).flatMap((cells,i)=>{
        const entry=[...cells];entry.rowNumber=i+2;
        return normalizeRows([entry],'SE',{id:spreadsheetId,name:'FAQ editorial revisions'})
          .map(row=>({...row,evidence:{...row.evidence,replacesReviewedContentHash:text(cells[11])}}));
      });
      const curated=(response.data.valueRanges?.[1]?.values || []).flatMap((cells,i)=>{
        const entry=[...cells];entry.rowNumber=i+2;
        return normalizeRows([entry],'SE',{id:spreadsheetId,name:'FAQ editorial collection'});
      });
      return {revisions,curated};
    }catch{console.warn(JSON.stringify({event:'faq-editorial-unavailable'}));return {revisions:[],curated:[]};}
  })() : null;
  const data = Object.fromEntries(LANGUAGES.map(l => [l, []]));
  const versions = [];
  for (const id of ids) {
    const meta = await timeStage('drive_metadata',()=>drive.files.get({ fileId: id, fields: 'id,name,mimeType,modifiedTime', supportsAllDrives: true }, { timeout: 8000 }));
    let incoming;
    if (meta.data.mimeType === XLSX) {
      const response = await timeStage('drive_download',()=>drive.files.get({ fileId: id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer', timeout: 10000 }));
      incoming = await timeStage('faq_parse',()=>parseWorkbook(Buffer.from(response.data), meta.data));
    } else if (meta.data.mimeType === SHEET) {
      const response = await timeStage('faq_sheet_read',()=>sheets.spreadsheets.values.batchGet({ spreadsheetId: id, ranges: LANGUAGES.map(l => `'FAQ_${l}'!A2:K`) }, { timeout: 10000 }));
      incoming = Object.fromEntries(LANGUAGES.map((l, i) => [l, normalizeRows(response.data.valueRanges[i].values || [], l, meta.data)]));
    } else throw new Error('Unsupported knowledge file type');
    for (const lang of LANGUAGES) data[lang].push(...incoming[lang]);
    versions.push({ id, modifiedTime: meta.data.modifiedTime });
  }
  if(editorial) {
    const {revisions,curated}=await editorial;
    return {data:mergeCuratedFaq(applyPreviewFaqRevisions(data,revisions),curated),versions};
  }
  return { data, versions };
}
export function createKnowledgeCache({ loader = loadDriveKnowledge, now = Date.now, ttlMs = 300000, retryMs = 30000 } = {}) {
  let snapshot, loadedAt = 0, failedAt = null, inFlight;
  return async function getKnowledge() {
    if (snapshot && now() - loadedAt < ttlMs && (!snapshot.expiresAt || now()<snapshot.expiresAt) && failedAt === null){latencyMeta({knowledgeCache:'memory',knowledgeAgeMs:now()-(snapshot.sourceLoadedAt || loadedAt),knowledgeStorage:snapshot.storage || 'google'});return { ...snapshot, status: 'ready', loadedAt };}
    if (failedAt !== null && now() - failedAt < retryMs) return { status: 'error', loadedAt };
    latencyMeta({knowledgeCache:inFlight?'coalesced':'refresh',knowledgeStorage:'google'});
    if (!inFlight) inFlight = Promise.resolve().then(loader).then(next => {
        snapshot = next; loadedAt = now(); failedAt = null;
        return { ...snapshot, status: 'ready', loadedAt };
      }).catch(() => {
        failedAt = now();
        return { status: 'error', loadedAt };
      }).finally(() => { inFlight = null; });
    return inFlight;
  };
}
const ttl = Number(process.env.FAQ_CACHE_TTL_SECONDS || 300);
const ttlMs=Number.isFinite(ttl) ? Math.min(300,Math.max(30,ttl))*1000 : 300000;
export const getKnowledge = createKnowledgeCache({loader:createSnapshotLoader({loader:()=>loadDriveKnowledge(),ttlMs}),ttlMs});
// Only colour-list intents are canonicalized. Keep entity names exact: fuzzy
// similarity between series is not evidence that their product facts are shared.
const colourPatterns = {
  EN: [
    /^what colou?rs (?:are available in|are in|does) (.+?)(?: (?:have|come in))?$/u,
    /^what colou?rs is (.+?) available in$/u,
    /^(.+?) colou?rs$/u,
  ],
  SE: [
    /^vilka färger (?:finns i|finns det i|finns tillgängliga i|har) (.+)$/u,
    /^i vilka färger finns (.+)$/u,
    /^(.+?) färger$/u,
  ],
  DA: [
    /^hvilke farver (?:er tilgængelige i|findes i|findes der i|har|fås i) (.+)$/u,
    /^(.+?) farver$/u,
  ],
  DE: [
    /^welche farben (?:sind in der|sind in|gibt es in der|gibt es in|hat) (.+?)(?: (?:erhältlich|verfügbar))?$/u,
    /^in welchen farben (?:gibt es|ist) (.+?)(?: (?:erhältlich|verfügbar))?$/u,
    /^(.+?) farben$/u,
  ],
};
function colourEntity(question, lang) {
  const normalized = question.normalize('NFKC').toLocaleLowerCase()
    .replace(/[‐‑–—]/gu, '-').replace(/\s+/gu, ' ').trim().replace(/[?!]+$/u, '').trim();
  for (const pattern of colourPatterns[lang] || []) {
    const match = normalized.match(pattern);
    if (match) return match[1].replace(/^(?:der serie|die serie|serie|serien|the) /u, '')
      .replace(/(?:[- ]serien|[- ]serie|[- ]series)$/u, '').trim();
  }
  return null;
}
export function knowledgeAmbiguous(data, lang, question) {
  const norm = s => s.normalize('NFKC').toLocaleLowerCase().trim();
  const rows = (data?.[lang] || []).filter(r => !['superseded', 'retired', 'rejected'].includes(r.evidence?.approvalStatus) && !warrantyMaterial(r.question + ' ' + r.answer));
  const exact = rows.filter(r => norm(r.question) === norm(question));
  const entity = colourEntity(question, lang);
  const matches = exact.length ? exact : entity !== null ? rows.filter(r => colourEntity(r.question, lang) === entity) : [];
  return new Set(matches.map(r => r.answer)).size > 1;
}
export function findKnowledge(data, lang, question) {
  const rows = (data?.[lang] || []).filter(r => !['superseded', 'retired', 'rejected'].includes(r.evidence?.approvalStatus) && !warrantyMaterial(r.question + ' ' + r.answer));
  const norm = s => s.normalize('NFKC').toLocaleLowerCase().trim();
  const exact = rows.filter(r => norm(r.question) === norm(question));
  if (exact.length) return new Set(exact.map(r => r.answer)).size === 1 ? exact.map(r => ({ ...r, score: 0 })) : [];
  const entity = colourEntity(question, lang);
  if (entity !== null) {
    const matches = rows.filter(r => colourEntity(r.question, lang) === entity);
    // Conflicting source answers are ambiguous; do not pick one by row order.
    if (!matches.length || new Set(matches.map(r => r.answer)).size !== 1) return [];
    return matches.map(r => ({ ...r, score: 0.1 }));
  }
  const options = { includeScore: true, threshold: 0.28, ignoreLocation: true };
  const hits = new Fuse(rows, { ...options, keys: ['question'] }).search(question, { limit: 4 }).map(r => ({ ...r.item, score: r.score }));
  // Match reordered words without discarding spelling or product/number tokens.
  const words = value => value.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (words(question).length >= 3) {
    const sorted = value => words(value).sort().join(' ');
    const oneEdit = (a, b) => {
      if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
      let i=0,j=0,edits=0;
      while(i<a.length && j<b.length) {
        if(a[i]===b[j]) {i++;j++;continue;}
        if(++edits>1) return false;
        if(a.length>=b.length)i++;
        if(b.length>=a.length)j++;
      }
      return edits+(a.length-i)+(b.length-j)<=1;
    };
    const sameWords = candidate => {
      const remaining=words(candidate), missing=[];
      for(const word of words(question)) {const at=remaining.indexOf(word);if(at>=0)remaining.splice(at,1);else missing.push(word);}
      if(missing.length!==remaining.length) return false;
      for(const word of missing) {const at=remaining.findIndex(other=>oneEdit(word,other));if(at<0)return false;remaining.splice(at,1);}
      return true;
    };
    const reordered = new Fuse(rows.map(row => ({ row, sorted: sorted(row.question) })), { ...options, threshold:0.12, ignoreFieldNorm:true, keys: ['sorted'] })
      .search(sorted(question), { limit: 4 }).filter(r=>sameWords(r.item.row.question)).map(r => ({ ...r.item.row, score: r.score }));
    for (const hit of reordered) {
      const prior = hits.find(r => r.evidence.sourceId === hit.evidence.sourceId && r.question === hit.question);
      if (prior && prior.score > 0.18) prior.score = Math.min(prior.score, hit.score);
      else if (prior) continue;
      else hits.push(hit);
    }
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, 4);
}

export function directKnowledgeHit(hits, question) {
  const best = hits[0];
  if (!best || best.score > 0.18) return null;
  const numbers = value => (value.match(/\d+(?:[.,]\d+)?/gu) || []).sort().join('|');
  if (numbers(question) !== numbers(best.question)) return null;
  const negative = value => /\b(?:inte|ej|utan|ikke|uden|nicht|kein\w*|ohne|not|no|without)\b/iu.test(value);
  if (negative(question) !== negative(best.question)) return null;
  // Similar but disagreeing answers require interpretation, not an arbitrary FAQ.
  if (hits.some(hit => hit.answer !== best.answer && hit.score - best.score < 0.04)) return null;
  return best;
}
