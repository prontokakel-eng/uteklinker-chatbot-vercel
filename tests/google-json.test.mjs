import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetValuesClient} from '../lib/google-json.js';
test('lightweight Sheets client preserves RAW append, range encoding, timeouts and disabled retries',async()=>{
 const calls=[],auth={request:async args=>{calls.push(args);return {data:{values:[]}};}};
 const client=sheetValuesClient({},auth).spreadsheets.values;
 await client.get({spreadsheetId:'synthetic',range:"'AI_REVIEW'!A1:O1"},{timeout:3500});
 await client.append({spreadsheetId:'synthetic',range:"'AI_REVIEW'!A:O",valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[['=not a formula']]}},{timeout:3500});
 assert.equal(calls[0].method,'GET');assert.match(calls[0].url,/AI_REVIEW.*A1%3AO1/);
 assert.equal(calls[1].method,'POST');assert.match(calls[1].url,/:append$/);
 assert.equal(calls[1].params.valueInputOption,'RAW');assert.equal(calls[1].retry,false);
 assert.deepEqual(calls[1].data.values,[['=not a formula']]);
});
