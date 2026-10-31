import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
function secEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const iS = so + SEC.length, iE = secEnd(h, iS);
const inner = h.slice(iS, iE);

function divEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
function preview(s) {
  const t = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.slice(0, 46);
}

console.log('=== about 顶层卡片（按页面顺序）===');
let i = 0, n = 0;
while (i < inner.length) {
  const m = inner.slice(i).match(/^<div\s+class="card[^"]*"[^>]*>/);
  if (m) {
    const st = i, en = divEnd(inner, st);
    if (en < 0) break;
    const blk = inner.slice(st, en);
    const idm = m[0].match(/\bid="([^"]+)"/);
    n++;
    console.log(`${String(n).padStart(2)}. [${st}→${en}] ${idm ? '#' + idm[1] : '(无id)'}  「${preview(blk)}」`);
    i = en;
  } else {
    const nx = inner.indexOf('<div class="card', i);
    if (nx < 0) break;
    const gap = inner.slice(i, nx).trim();
    if (gap) console.log(`    (空隙 ${gap.length} 字符: ${preview(gap)})`);
    i = nx;
  }
}
/* 关键串定位 */
for (const k of ['想要精确度', 'id="sec-howto"', 'id="sec-credits"', '开源项目与数据来源', '怎么用 · 需要接 API 吗']) {
  const p = inner.indexOf(k);
  console.log(`  ${k.padEnd(26)} @${p}`);
}
