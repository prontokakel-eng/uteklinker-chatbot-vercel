import { googleJsonClient, sheetValuesClient } from '../lib/google-json.js';
import { previewReviewRetention } from '../lib/review-retention.js';

// Deliberately no --apply, deletion method, public endpoint or automatic schedule.
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--sheet-id' || args[2] !== '--days' || !/^\d+$/u.test(args[3])) {
  console.error('Deletion blocked: manual review and separate approval are required. This tool is read only.');
  console.error('Usage: node scripts/review-retention-preview.mjs --sheet-id ID --days DAYS (read only)');
  process.exitCode = 1;
} else {
  try {
    const days = Number(args[3]);
    if (days < 1 || days > 365) throw Error('Invalid period');
    const auth = googleJsonClient(process.env, ['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const result = await previewReviewRetention({ sheets: sheetValuesClient(process.env, auth), spreadsheetId: args[1], days });
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.error('Retention preview failed. Check the explicit destination, period, schema and read access. No data changed.');
    process.exitCode = 1;
  }
}
