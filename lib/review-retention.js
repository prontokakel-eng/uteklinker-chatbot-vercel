import { REVIEW_HEADERS, REVIEW_TAB } from './ai-review-store.js';

// A proposal only. Never reads customer text and has no mutation capability.
export function planReviewRetention({ timestamps, origins, days, now = new Date() }) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw Error('Choose retention days explicitly (1–365)');
  if (!(now instanceof Date) || !Number.isFinite(+now)) throw Error('Invalid current time');
  const cutoff = new Date(+now - days * 86400000).toISOString();
  const result = { dryRun: true, deletionAllowed: false, manualReviewRequired: true,
    workflowStatus: 'awaiting-human-review', days, cutoff, aiRows: 0, candidateRows: [], invalidDateRows: [], futureDateRows: [], otherRows: 0 };
  for (let i = 0; i < Math.max(timestamps.length, origins.length); i++) {
    const timestamp = timestamps[i]?.[0], origin = origins[i]?.[0];
    if (!timestamp && !origin) continue;
    if (origin !== 'ai') { result.otherRows++; continue; }
    result.aiRows++;
    // Our writer stores UTC ISO dates as RAW strings. Unknown formats require review.
    const date = typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(timestamp) ? new Date(timestamp) : new Date(NaN);
    if (!Number.isFinite(+date) || date.toISOString().replace('.000Z','Z') !== timestamp.replace('.000Z','Z')) result.invalidDateRows.push(i + 2);
    else if (+date > +now) result.futureDateRows.push(i + 2);
    else if (date.toISOString() < cutoff) result.candidateRows.push(i + 2);
  }
  return result;
}

export async function previewReviewRetention({ sheets, spreadsheetId, days, now }) {
  if (!spreadsheetId) throw Error('An explicit spreadsheet ID is required');
  const get = range => sheets.spreadsheets.values.get({ spreadsheetId, range: `'${REVIEW_TAB}'!${range}` });
  const header = await get('A1:O1');
  if (JSON.stringify(header.data.values?.[0]) !== JSON.stringify(REVIEW_HEADERS)) throw Error('Review schema mismatch');
  const [timestamps, origins] = await Promise.all([get('A2:A'), get('I2:I')]);
  return planReviewRetention({ timestamps: timestamps.data.values || [], origins: origins.data.values || [], days, now });
}
