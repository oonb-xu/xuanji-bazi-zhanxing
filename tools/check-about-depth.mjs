import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const c = (re) => (h.match(re) || []).length;
console.log('=== 全文件 ===');
console.log('  section', c(/<section\b/g) + '/' + c(/<\/section>/g));
console.log('  div    ', c(/<div\b/g) + '/' + c(/<\/div>/g));
console.log('  h2     ', c(/<h2\b/g) + '/' + c(/<\/h2>/g));

const mo = h.match(/<section class="page" data-page="about">/);
if (!mo) { console.log('❌ 找不到 about'); process.exit(1); }
const st = mo.index + mo[0].length;
const re = /<section\b|<\/section>/g; re.lastIndex = st;
let d = 1, m, en = -1;
while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) { en = m.index; break; } }
const inner = h.slice(st, en);
console.log('\n=== about inner ===');
console.log('  长度', inner.length);
console.log('  div ', (inner.match(/<div\b/g) || []).length + '/' + (inner.match(/<\/div>/g) || []).length);

const r2 = /<div\b|<\/div>/g;
let dd = 0, mx = 0;
const depthAt = [];
while ((m = r2.exec(inner))) {
  dd += m[0] === '</div>' ? -1 : 1;
  if (dd > mx) mx = dd;
  depthAt.push({ pos: m.index, d: dd, tok: m[0] });
}
console.log('  max depth =', mx);

/* 每个 h2 所在深度 */
console.log('\n=== 各 h2 所在 div 深度 ===');
const h2s = [...inner.matchAll(/<h2[^>]*>([^<]{0,34})/g)];
for (const x of h2s) {
  const before = depthAt.filter((t) => t.pos < x.index);
  const dep = before.length ? before[before.length - 1].d : 0;
  console.log('  depth=' + dep + '  ' + x[1].trim());
}
