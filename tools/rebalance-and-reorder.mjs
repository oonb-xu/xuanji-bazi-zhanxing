// 步骤 A：修 about 段内 div 失衡（多一个闭合 @+7956，末尾少一个）
// 步骤 B：顶层子块重排（实验性板块移到底部）
// 全程内存操作，只写盘一次
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const mo = h.match(/<section class="page" data-page="about">/);
if (!mo) { console.error('❌ 无 about section'); process.exit(1); }
const innerStart = mo.index + mo[0].length;

function findSectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const secEnd = findSectionEnd(h, innerStart);
let inner = h.slice(innerStart, secEnd);

/* ── A. 配平 ── */
function divStats(s) {
  return [(s.match(/<div\b/g) || []).length, (s.match(/<\/div>/g) || []).length];
}
let [O, C] = divStats(inner);
console.log('A. 修复前:', O, '/', C);

// A1. 找第一次 depth 归负的位置，删掉那一个 </div>
function firstNegCloser(s) {
  const re = /<div\b|<\/div>/g; let d = 0, m;
  while ((m = re.exec(s))) {
    d += m[0] === '</div>' ? -1 : 1;
    if (d < 0) return m.index;
  }
  return -1;
}
let negPos = firstNegCloser(inner);
if (negPos >= 0) {
  inner = inner.slice(0, negPos) + inner.slice(negPos + 6);
  console.log('   已删除多余 </div> @' + negPos);
}
// A2. 末尾补齐
let [O2, C2] = divStats(inner);
let need = O2 - C2;
if (need > 0) {
  inner = inner.replace(/\s*$/, '') + '\n      ' + '</div>'.repeat(need) + '\n    ';
  console.log('   末尾补了', need, '个 </div>');
}
const [O3, C3] = divStats(inner);
console.log('   修复后:', O3, '/', C3, O3 === C3 ? '✅' : '❌');
if (O3 !== C3) { console.error('❌ 仍不平衡，中止'); process.exit(1); }

/* ── B. 顶层子块重排 ── */
function matchDivEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
function topChunks(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s.startsWith('<div', i)) {
      const e = matchDivEnd(s, i);
      if (e < 0) { console.error('❌ 子块配对失败 @' + i); process.exit(1); }
      out.push(s.slice(i, e)); i = e;
    } else if (s.startsWith('<!--', i)) {
      const e = s.indexOf('-->', i); out.push(s.slice(i, e + 3)); i = e + 3;
    } else {
      let next = s.length;
      for (const k of ['<div', '<!--']) { const p = s.indexOf(k, i + 1); if (p > 0 && p < next) next = p; }
      out.push(s.slice(i, next)); i = next;
    }
  }
  return out;
}
const chunks = topChunks(inner);
console.log('\nB. 顶层子块:', chunks.length);

function tagOf(c) {
  if (/id="about-toc"/.test(c)) return 'toc';
  if (/id="sec-howto"|想要精确度|api-pay-notice|主流 API 怎么拿|Key 怎么用/.test(c)) return 'api';
  if (/这是什么|sec-what-is-this/.test(c)) return 'what';
  if (/id="sec-not-collage"/.test(c)) return 'notCollage';
  if (/privacy-card|隐私承诺/.test(c)) return 'privacy';
  if (/id="sec-method"/.test(c)) return 'method';
  if (/id="sec-conflict"/.test(c)) return 'conflict';
  if (/id="sec-credits"/.test(c)) return 'credits';
  if (/id="sec-59-58"/.test(c)) return 'exp5958';
  if (/id="sec-experiment"/.test(c)) return 'exp60';
  if (/class="page-title"/.test(c)) return 'title';
  return c.trim() ? 'other' : 'blank';
}
const tagged = chunks.map((c) => ({ c, t: tagOf(c) }));
console.log('   分类:');
tagged.forEach((x, i) => console.log('     ' + (i + 1) + '. [' + x.t + '] ' + x.c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 44)));

const ORDER = ['title', 'what', 'api', 'toc', 'notCollage', 'privacy', 'method', 'conflict', 'credits', 'exp5958', 'exp60', 'other', 'blank'];
const buckets = {};
tagged.forEach((x) => { (buckets[x.t] = buckets[x.t] || []).push(x.c); });

const REQ = ['title', 'what', 'api', 'notCollage', 'privacy', 'method', 'conflict', 'credits', 'exp5958', 'exp60'];
const lost = REQ.filter((k) => !buckets[k]);
if (lost.length) { console.error('❌ 缺块:', lost.join(','), '—— 中止'); process.exit(1); }

const newInner = ORDER.flatMap((k) => buckets[k] || []).join('\n\n      ');
const after = topChunks(newInner);
console.log('   重排后子块:', after.length, after.length === chunks.length ? '✅' : '❌');
if (after.length !== chunks.length) { console.error('❌ 块数不守恒，中止'); process.exit(1); }

let out = h.slice(0, innerStart) + '\n\n      ' + newInner + '\n    \n    ' + h.slice(secEnd);

/* ── C. 导航重排 ── */
const tocRe = /<a href="#(sec-[\w-]+)" class="toc-i[^"]*"><b>\d+<\/b>[\s\S]*?<\/a>/g;
const tocItems = [...(buckets.toc && buckets.toc[0] || '').matchAll(tocRe)];
if (tocItems.length) {
  const map = { 'sec-what-is-this': 1, 'sec-howto': 2, 'sec-not-collage': 3, 'sec-method': 4, 'sec-conflict': 5, 'sec-credits': 6, 'sec-59-58': 7, 'sec-experiment': 8 };
  const sorted = [...tocItems].sort((a, b) => (map[a[1]] || 99) - (map[b[1]] || 99));
  let n = 0;
  const rebuilt = sorted.map((m) => m[0].replace(/(<b>)\d+(<\/b>)/, (_, p1, p2) => { n++; return p1 + n + p2; })).join('\n          ');
  out = out.replace(tocItems.map((m) => m[0]).join(''), rebuilt);
  console.log('\nC. 导航重排:', n, '项');
}

/* ── D. 终检 ── */
const c = (s, re) => (s.match(re) || []).length;
const so = c(out, /<section\b/g), sc = c(out, /<\/section>/g);
const dO = c(out, /<div\b/g), dC = c(out, /<\/div>/g);
console.log(`\nD. section ${so}/${sc}  div ${dO}/${dC}  ${so === sc && dO === dC ? '✅' : '❌'}`);
if (so !== sc || dO !== dC) { console.error('❌ 不平衡，中止'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('✅ 已写入（一次）');

const hh = fs.readFileSync(P, 'utf8');
const i2 = hh.indexOf('data-page="about"');
const seg2 = hh.slice(i2, hh.indexOf('<section class="page active"', i2));
console.log('\n=== 新顺序 ===');
[...seg2.matchAll(/<h2[^>]*>([^<]{0,34})/g)].forEach((m, i) => console.log('  ' + (i + 1) + '. ' + m[1].trim()));
