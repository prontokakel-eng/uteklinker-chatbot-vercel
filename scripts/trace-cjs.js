// Hookar CJS require
const Module = require('module');
const path = require('node:path');
const orig = Module._load;

const WATCH = [
  'chatPipeline', 'faq-search', 'faq-dialog', 'faq-keywords',
  'blacklist-regex', 'utils-progress', 'utils', 'ai.js', 'policy.js'
];

Module._load = function traced(request, parent, isMain) {
  const hit = WATCH.some(w => request.includes(w));
  if (hit) {
    console.warn('[TRACE-CJS]', request, 'from', parent && parent.filename);
  }
  return orig.apply(this, arguments);
};
