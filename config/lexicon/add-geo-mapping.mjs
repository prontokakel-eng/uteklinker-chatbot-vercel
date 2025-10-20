import { readFile, writeFile } from 'node:fs/promises';

async function up(file, mapping) {
  const raw = await readFile(file, 'utf8');
  const j = JSON.parse(raw);
  j.geoMapping = { ...(j.geoMapping||{}), ...mapping };
  await writeFile(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('OK', file, '→', Object.keys(j.geoMapping));
}

await up('./config/lexicon/DE_FULL_LOOKUP.json', { DE:true, AT:true, CH:true });
await up('./config/lexicon/SE_FULL_LOOKUP.json', { SE:true });
await up('./config/lexicon/DA_FULL_LOOKUP.json', { DK:true });
await up('./config/lexicon/EN_FULL_LOOKUP.json', { GB:true, US:true, AU:true, CA:true, IE:true, NZ:true });
