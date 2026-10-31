// ① 开源署名：正文 + 标题合并，整体移到最底端
// ② 「怎么用·需要接API吗」 与 「想要精确度…」 互换位置
import fs from 'node:fs';
const P = 'web/index.html';
const h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak5', h, 'utf8');

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

/* 收集顶层 card 与它们之间的空隙 */
const cards = [], gaps = [];
{
  let i = 0, prevEnd = 0;
  while (i < inner.length) {
    const m = inner.slice(i).match(/^<div\s+class="card[^"]*"[^>]*>/);
    if (m) {
      const st = i, en = divEnd(inner, st);
      if (en < 0) break;
      gaps.push(inner.slice(prevEnd, st));
      cards.push({ st, en, html: inner.slice(st, en) });
      prevEnd = en; i = en;
    } else {
      const nx = inner.indexOf('<div class="card', i);
      if (nx < 0) { gaps.push(inner.slice(prevEnd)); break; }
      i = nx;
    }
  }
}
console.log('cards:', cards.length, ' gaps:', gaps.length);

/* 识别 */
const idx = (kw) => cards.findIndex((c) => c.html.includes(kw));
const iTitle = 0;
const iPrivacy = idx('privacy-card') >= 0 ? idx('privacy-card') : idx('隐私承诺');
const iWhat = idx('id="sec-what-is-this"');
const iHowto = idx('id="sec-howto"');
const iCreditsTitle = idx('id="sec-credits"');
const iMain = idx('主流 API 怎么拿');
const iKey = idx('Key 怎么用');
const iNot = idx('id="sec-not-collage"');
const iMethod = idx('id="sec-method"');
const i5958 = idx('id="sec-59-58"');
const iConflict = idx('id="sec-conflict"');
const iExp = idx('id="sec-experiment"');

/* 开源正文 = 含「复用了开源实现」且不是 credits 标题卡 */
const iCreditsBody = cards.findIndex((c, k) => k !== iCreditsTitle && /复用了开源实现|Apache-2\.0|tyme4ts/.test(c.html));
console.log({ iTitle, iPrivacy, iWhat, iHowto, iCreditsTitle, iCreditsBody, iMain, iKey, iNot, iMethod, i5958, iConflict, iExp });
if ([iTitle, iPrivacy, iWhat, iHowto, iMain, iKey, iNot, iMethod, i5958, iConflict, iExp].some((x) => x < 0)) {
  console.error('❌ 有卡片未识别，中止'); process.exit(1);
}
if (iCreditsTitle < 0 || iCreditsBody < 0) { console.error('❌ 开源署名标题或正文未识别'); process.exit(1); }

/* 精度声明：在哪个空隙里 */
const gapIdx = gaps.findIndex((g) => g.includes('想要精确度'));
console.log('精度声明在空隙 #' + gapIdx + '（' + (gaps[gapIdx] || '').trim().length + ' 字符）');
if (gapIdx < 0) { console.error('❌ 找不到精度声明'); process.exit(1); }
const chengDu = gaps[gapIdx].trim();

/* 合并开源署名：标题卡内塞入正文 */
const titleCard = cards[iCreditsTitle].html;
const bodyCard = cards[iCreditsBody].html;
const bodyInner = bodyCard.replace(/^<div\s+class="card[^"]*"[^>]*>/, '').replace(/<\/div>\s*$/, '');
const mergedCredits = titleCard.replace(/<\/div>\s*$/, '\n        ' + bodyInner.trim() + '\n      </div>');

/* 目标顺序 */
const ORDER = [iTitle, iPrivacy, iWhat, iHowto, iMain, iKey, iNot, iMethod, i5958, iConflict, iExp];
const SEP = '\n\n      ';
let newInner = '\n      ' + cards[iTitle].html;                    // 第一张前不加分隔
for (const k of ORDER.slice(1)) newInner += SEP + cards[k].html;
/* 精度声明插在 怎么用 之后、主流API 之前 */
const parts = newInner.split(SEP);
const posHowto = parts.findIndex((p) => p.includes('id="sec-howto"'));
parts.splice(posHowto + 1, 0, '<div class="card">\n        ' + chengDu + '\n      </div>');
newInner = parts.join(SEP);
newInner += SEP + mergedCredits;
newInner += '\n\n    ';

const out = h.slice(0, iS) + newInner + h.slice(iE);

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['strong', /<strong>/g, /<\/strong>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g],
  ['th', /<th\b/g, /<\/th>/g], ['li', /<li\b/g, /<\/li>/g], ['p', /<p\b/g, /<\/p>/g]]) {
  const ok = c(out, o) === c(out, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(out, o)}/${c(out, cl)} ${ok ? '✅' : '❌'}`);
}

const s2 = out.indexOf(SEC), e2 = secEnd(out, s2 + SEC.length);
const in2 = out.slice(s2 + SEC.length, e2);
const pos = (kw) => in2.indexOf(kw);
console.log('\n=== 顺序校验 ===');
const iHow = pos('id="sec-howto"'), iCheng = pos('想要精确度'), iCred = pos('id="sec-credits"'), iMain2 = pos('主流 API 怎么拿');
const checks = [
  ['怎么用 < 精度声明', iHow < iCheng && iCheng < iMain2],
  ['开源署名在最后（其后无其它 h2）', (() => { const after = in2.slice(iCred); return !/<h2[^>]*>/.test(after.replace(/^[\s\S]*?<h2[^>]*id="sec-credits"[\s\S]*?<\/h2>/, '')); })()],
  ['开源正文已并入credits卡', (() => { const seg = in2.slice(iCred); return seg.includes('复用了开源实现'); })()],
];
for (const [n, ok] of checks) { if (!ok) bad++; console.log(`  ${ok ? '✅' : '❌'} ${n}`); }

const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"',
  '隐私承诺', '主流 API', 'tyme4ts', 'VedAstro', '最后'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('  内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : `✅ ${NEED.length} 项齐全`));
if (lost.length) bad++;

const app = out.indexOf('<div id="app"');
const at = out.indexOf('>', app) + 1;
const r2 = /<div\b|<\/div>/g; r2.lastIndex = at;
let dd = 1, mm, appEnd = -1;
while ((mm = r2.exec(out))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { appEnd = mm.index; break; } }
const okAll = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => { const p = out.indexOf('data-page="' + k + '"'); return p > app && p < appEnd; });
console.log('  #app 包含其余页面 ' + (okAll ? '✅' : '❌'));
if (!okAll) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');
console.log('\n=== 新顺序 ===');
[...in2.matchAll(/<(h2|h3)[^>]*>([^<]{0,26})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + ' ' + x[2].trim()));
