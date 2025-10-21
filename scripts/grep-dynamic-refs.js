// Söker dynamiska laddningar och “kända basnamn” som kan smita från bundlers.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PATTERN = [
  'import\\(',
  'require\\(',
  'chatPipeline',
  'faq-search',
  'faq-dialog',
  'blacklist-regex',
  'utils-progress',
  'policy',
  '\\bai\\.js\\b'
].join('|');

try {
  const out = execSync(`git grep -nE "${PATTERN}"`, { encoding: 'utf8' });
  const reportDir = path.join('logs', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'dynamic-refs.txt'), out);
  console.log('Wrote logs/reports/dynamic-refs.txt');
} catch (e) {
  // git grep returnerar exit code 1 om inget hittas; det är OK.
  const reportDir = path.join('logs', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'dynamic-refs.txt'), '');
  console.log('No dynamic refs found. Wrote empty logs/reports/dynamic-refs.txt');
}
