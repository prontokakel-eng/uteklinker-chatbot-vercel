import {timeStage} from './latency.js';
import { google } from 'googleapis';

export const REVIEW_TAB = 'AI_REVIEW';
export const REVIEW_HEADERS = ['Tidpunkt', 'Språk', 'Kundfråga', 'AI-svar', 'Status', 'Modell', 'Svar-ID',
  'Källreferenser', 'Ursprung', 'Granskad av', 'Granskningsdatum', 'Korrigerat svar', 'Verifierad källa', 'Förfrågnings-ID', 'Miljö'];

export function reviewText(value) {
  return String(value || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[e-post borttagen]')
    .replace(/\+?\d[\d ()-]{5,}\d/gu, '[nummer borttaget]');
}

export function createReviewStore({ env = process.env, sheets, now = () => new Date().toISOString() } = {}) {
  let checked = false;
  return async function saveAiReview({ question, result, reqId }) {
    // Only server-generated AI answers enter review. FAQ, fallback and client
    // approval fields cannot write or promote anything to the knowledge tabs.
    if (result?.via !== 'AI') return { status: 'not-applicable' };
    const spreadsheetId = env.AI_REVIEW_SHEET_ID || env.SHEET_ID_MAIN || env.SHEET_ID;
    if (!spreadsheetId) throw new Error('Review destination not configured');
    if (!sheets) {
      const email = env.GCP_CLIENT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const key = env.GCP_PRIVATE_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!email || !key) throw new Error('Review credentials not configured');
      const auth = new google.auth.JWT({ email, key: key.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
      sheets = google.sheets({ version: 'v4', auth });
    }
    if (!checked) {
      const header = await timeStage('review_sheet_header',()=>sheets.spreadsheets.values.get({ spreadsheetId, range: `'${REVIEW_TAB}'!A1:O1` }, { timeout: 3500 }));
      if (JSON.stringify(header.data.values?.[0]) !== JSON.stringify(REVIEW_HEADERS)) throw new Error('Review schema mismatch');
      checked = true;
    }
    const trace = [...(result.modelDiagnostics || [])].reverse().find(r => r.phase!=='review' && (r.model || r.responseId)) || {};
    const refs = (result.evidence || []).map(e => ({sourceId:e.sourceId,source:e.source,location:e.location,date:e.date}));
    const values = [[now(), result.lang, reviewText(question).slice(0,2000), reviewText(result.reply).slice(0,20000),
      'Ej granskat', trace.model || env.OPENAI_MODEL || '', trace.responseId || '', JSON.stringify(refs), 'ai', '', '', '', '', reqId, env.VERCEL_ENV || 'development']];
    const response = await timeStage('review_sheet_append',()=>sheets.spreadsheets.values.append({ spreadsheetId, range: `'${REVIEW_TAB}'!A:O`,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values } }, { timeout: 3500 }));
    return { status: 'saved', updatedRange: response.data.updates?.updatedRange };
  };
}
export const saveAiReview = createReviewStore();
