// Node ESM loader – loggar resolve/load för intressanta moduler
const WATCH = [
  'chatPipeline', 'faq-search', 'faq-dialog', 'faq-keywords',
  'blacklist-regex', 'utils-progress', 'utils.js', 'ai.js', 'policy.js'
];

export async function resolve(specifier, context, next) {
  const res = await next(specifier, context);
  if (WATCH.some(w => specifier.includes(w))) {
    console.warn('[TRACE-ESM:resolve]', specifier, '->', res.url);
  }
  return res;
}

export async function load(url, context, next) {
  if (WATCH.some(w => url.includes(w))) {
    console.warn('[TRACE-ESM:load]', url);
  }
  return next(url, context);
}
