import fs from 'node:fs';
const t = fs.readFileSync('web/app.js', 'utf8');
console.log('app.js 大小', t.length);

for (const key of ['rectify', 'contribute', 'data-go', 'data-page', 'showPage', 'switchPage', 'setPage']) {
  const idx = [];
  let i = -1;
  while ((i = t.indexOf(key, i + 1)) >= 0) idx.push(i);
  console.log('\n=== ' + key + ' (' + idx.length + ' 次) ===');
  for (const p of idx.slice(0, 4)) {
    console.log('  @' + p + '  ' + JSON.stringify(t.slice(Math.max(0, p - 120), p + 150).replace(/\s+/g, ' ')));
  }
}
