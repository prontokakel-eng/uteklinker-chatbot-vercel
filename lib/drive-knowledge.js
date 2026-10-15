import { Buffer } from 'node:buffer';
import { google } from 'googleapis';
import ExcelJS from 'exceljs';
import Fuse from 'fuse.js';
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
export function normalizeRows(rows, lang) {
  const seen = new Set();
  return rows.flatMap(([q, a, provenance = '']) => {
    const question = text(q), answer = text(a);
    if (!question || !answer) return [];
    const key = question.normalize('NFKC').toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ question, answer, lang, provenance: text(provenance) }];
  });
}
export async function parseWorkbook(buffer) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const data = {};
  for (const lang of LANGUAGES) {
    const sheet = book.getWorksheet(`FAQ_${lang}`);
    if (!sheet) throw new Error(`Missing FAQ_${lang}`);
    const rows = [];
    sheet.eachRow((row, number) => {
      if (number > 1) rows.push([text(row.getCell(1).value), text(row.getCell(2).value), text(row.getCell(3).value)]);
    });
    data[lang] = normalizeRows(rows, lang);
  }
  return data;
}
export async function loadDriveKnowledge(env = process.env) {
  const ids = (env.FAQ_DRIVE_FILE_IDS || env.SHEET_ID_MAIN || env.SHEET_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  const email = env.GCP_CLIENT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = env.GCP_PRIVATE_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!ids.length || !email || !key) throw new Error('Knowledge source is not configured');
  const auth = new google.auth.JWT({ email, key: key.replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });
  const data = Object.fromEntries(LANGUAGES.map(l => [l, []]));
  const versions = [];
  for (const id of ids) {
    const meta = await drive.files.get({ fileId: id, fields: 'id,mimeType,modifiedTime', supportsAllDrives: true }, { timeout: 8000 });
    let incoming;
    if (meta.data.mimeType === XLSX) {
      const response = await drive.files.get({ fileId: id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer', timeout: 10000 });
      incoming = await parseWorkbook(Buffer.from(response.data));
    } else if (meta.data.mimeType === SHEET) {
      const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: id, ranges: LANGUAGES.map(l => `'FAQ_${l}'!A2:C`) }, { timeout: 10000 });
      incoming = Object.fromEntries(LANGUAGES.map((l, i) => [l, normalizeRows(response.data.valueRanges[i].values || [], l)]));
    } else throw new Error('Unsupported knowledge file type');
    for (const lang of LANGUAGES) data[lang].push(...incoming[lang]);
    versions.push({ id, modifiedTime: meta.data.modifiedTime });
  }
  for (const lang of LANGUAGES) data[lang] = normalizeRows(data[lang].map(r => [r.question, r.answer]), lang);
  return { data, versions };
}
export function createKnowledgeCache({ loader = loadDriveKnowledge, now = Date.now, ttlMs = 300000, retryMs = 30000 } = {}) {
  let snapshot, loadedAt = 0, failedAt = null, inFlight;
  return async function getKnowledge() {
    if (snapshot && now() - loadedAt < ttlMs && failedAt === null) return { ...snapshot, status: 'ready', loadedAt };
    if (failedAt !== null && now() - failedAt < retryMs) return { status: 'error', loadedAt };
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
export const getKnowledge = createKnowledgeCache({ ttlMs: Number.isFinite(ttl) ? Math.max(30, ttl) * 1000 : 300000 });
// Only colour-list intents are canonicalized. Keep entity names exact: fuzzy
// similarity between series is not evidence that their product facts are shared.
const colourPatterns = {
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
    if (match) return match[1].replace(/^(?:der serie|die serie|serie|serien) /u, '')
      .replace(/(?:[- ]serien|[- ]serie)$/u, '').trim();
  }
  return null;
}
export function findKnowledge(data, lang, question) {
  const rows = data?.[lang] || [];
  const norm = s => s.normalize('NFKC').toLocaleLowerCase().trim();
  const exact = rows.find(r => norm(r.question) === norm(question));
  if (exact) return [{ ...exact, score: 0 }];
  const entity = colourEntity(question, lang);
  if (entity !== null) {
    const matches = rows.filter(r => colourEntity(r.question, lang) === entity);
    // Conflicting source answers are ambiguous; do not pick one by row order.
    if (!matches.length || new Set(matches.map(r => r.answer)).size !== 1) return [];
    return [{ ...matches[0], score: 0.1 }];
  }
  return new Fuse(rows, { keys: ['question'], includeScore: true, threshold: 0.28, ignoreLocation: true }).search(question, { limit: 4 }).map(r => ({ ...r.item, score: r.score }));
}
