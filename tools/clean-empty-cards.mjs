// 清掉 about 里内容为空的 card（切段留下的空壳）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
if (so < 0) { console.error('❌ 无 about'); process.exit(1); }
function secEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const iS = so + SEC.length, iE = secEnd(h, iS);
let inner = h.slice(iS, iE);

/* 逐个扫描顶层 <div class="card" ...>…</div>，删掉无文字内容的 */
function divEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
function textOf(s) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '').length;
}

let removed = 0, out = '', i = 0;
while (i < inner.length) {
  const m = inner.slice(i).match(/^<div\s+class="card[^"]*"[^>]*>/);
  if (m) {
    const start = i;
    const end = divEnd(inner, start);
    if (end < 0) { out += inner.slice(i); break; }
    const blk = inner.slice(start, end);
    if (textOf(blk) < 3) { removed++; console.log('  删除空卡 @' + start + ' (' + blk.length + ' 字符)'); }
    else out += blk;
    i = end;
  } else {
    // 非 card：按字符前进到下一个 <div class="card"
    const nx = inner.indexOf('<div class="card', i);
    if (nx < 0) { out += inner.slice(i); break; }
    out += inner.slice(i, nx);
    i = nx;
  }
}
console.log('删除空卡片:', removed);

const nw = h.slice(0, iS) + out + h.slice(iE);

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['li', /<li\b/g, /<\/li>/g]]) {
  const ok = c(nw, o) === c(nw, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(nw, o)}/${c(nw, cl)} ${ok ? '✅' : '❌'}`);
}
// 内容不能丢
const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"', '隐私承诺'];
const lost = NEED.filter((k) => !nw.includes(k));
console.log('  内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : '✅ 齐全'));
if (lost.length) bad++;
// #app 包含
const app = nw.indexOf('<div id="app"');
const at = nw.indexOf('>', app) + 1;
const r2 = /<div\b|<\/div>/g; r2.lastIndex = at;
let dd = 1, mm, appEnd = -1;
while ((mm = r2.exec(nw))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { appEnd = mm.index; break; } }
const okAll = nw.indexOf('data-page="fusion"') < appEnd && nw.indexOf('data-page="synastry"') < appEnd;
console.log('  #app 包含其余页面 ' + (okAll ? '✅' : '❌'));
if (!okAll) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, nw, 'utf8');
console.log('\n✅ 已写入（空卡片已清除）');
