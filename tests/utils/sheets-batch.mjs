// /tests/utils/sheets-batch.mjs
// CHANGE: Test-only shim to buffer or disable Google Sheets writes during torture runs.
import * as url from 'node:url';
import path from 'node:path';

let enabled = false;
let buffer = [];
let orig = {};

export async function enableBatching({ mode = 'buffer' } = {}) {
  if (enabled) return;
  enabled = true;

  const modPath = url.pathToFileURL(path.resolve(process.cwd(), './lib/faq-sheets.js')).href;
  let sheets;
  try { sheets = await import(modPath); }
  catch { return; } // If module not present, silently no-op

  // Save original if present
  orig.queue = sheets.queue || sheets.enqueue || sheets.appendRows;
  orig.flush = sheets.flush || sheets.commit || sheets.flushQueue;

  const wrapQueue = (...args) => {
    if (mode === 'off') return { ok: true, mocked: true };
    buffer.push(args);
    return { ok: true, buffered: buffer.length };
  };

  if (orig.queue) sheets.queue = wrapQueue;
  if (sheets.enqueue) sheets.enqueue = wrapQueue;
  if (sheets.appendRows) sheets.appendRows = wrapQueue;

  const wrapFlush = async () => {
    if (mode === 'off') return { ok: true, skipped: true };
    const items = buffer.splice(0, buffer.length);
    if (!items.length) return { ok: true, empty: true };
    if (orig.flush) {
      try { return await orig.flush(items); }
      catch (e) { return { ok: false, error: String(e), items: items.length }; }
    }
    return { ok: true, noop: true, items: items.length };
  };

  globalThis.__SHEETS_BATCH__ = { flush: wrapFlush, mode };
}
