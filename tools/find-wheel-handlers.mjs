import fs from 'node:fs';
import path from 'node:path';
const base = 'web';
const files = fs.readdirSync(base).filter((f) => f.endsWith('.js'));
for (const f of files) {
  const t = fs.readFileSync(path.join(base, f), 'utf8');
  const ms = [...t.matchAll(/[\s\S]{0,70}wheel[\s\S]{0,120}/g)];
  if (!ms.length) continue;
  console.log('\n=== ' + f + ' ===');
  for (const m of ms) {
    const s = m[0].replace(/\s+/g, ' ');
    console.log('  ' + s.slice(0, 190));
  }
}
