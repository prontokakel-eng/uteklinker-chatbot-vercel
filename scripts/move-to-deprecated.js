// Flyttar filer enligt en plan till /_deprecated och lämnar säkra stubbar.
// Kör: npm run o:prepare  (efter o:scan, o:grep, o:classify)
// Flagga --dry för att bara skriva en todo-lista.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const planArg = args[args.indexOf('--plan') + 1] || 'logs/reports/orphans-plan.json';
const keepTiers = new Set(['O1', 'O2']); // flytta endast O1/O2. O3 = manuellt.

const plan = JSON.parse(fs.readFileSync(planArg, 'utf8'));
const items = plan.items.filter(x => keepTiers.has(x.tier));

const DEPR = '_deprecated';
const root = process.cwd();

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function gitMv(src, dest) {
  try { execSync(`git mv "${src}" "${dest}"`, { stdio: 'inherit' }); }
  catch {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    execSync(`git add "${dest}"`, { stdio: 'inherit' });
    execSync(`git rm --cached "${src}"`, { stdio: 'inherit' });
  }
}

function makeStub(orig, moved) {
  const rel = path.relative(path.dirname(orig), moved).replaceAll('\\', '/');
  const stub = `// [DEPRECATED STUB] This file was moved to ${rel}\n` +
               `console.warn('[DEPRECATED]', import.meta.url, '->', '${rel}');\n` +
               `export * from '${rel}';\n` +
               `export { default } from '${rel}';\n`;
  fs.writeFileSync(orig, stub, 'utf8');
}

function main() {
  const todo = [];
  for (const { file, tier } of items) {
    const src = path.resolve(file);
    if (!fs.existsSync(src)) continue;
    const dst = path.resolve(DEPR, file); // behåll samma struktur under /_deprecated
    todo.push({ src, dst, tier });
  }

  if (isDry) {
    console.log(JSON.stringify(todo, null, 2));
    return;
  }

  ensureDir(DEPR);
  for (const { src, dst } of todo) {
    ensureDir(path.dirname(dst));
    gitMv(src, dst);
    makeStub(src, dst);
  }

  const readme = path.join(DEPR, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme,
`# Deprecated area
Filerna här är flyttade hit enligt logs/reports/orphans-plan.json.
Efter soak-period (t.ex. 7–14 dagar) och uteblivna varningar kan de tas bort.`, 'utf8');
  }

  console.log(`Moved ${todo.length} files to ${DEPR} and left stubs.`);
}

main();
