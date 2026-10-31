// 回滚 index.html 到 bak19（dw-detail 插入之前的干净状态），再正确插入 dw-detail
import fs from 'node:fs';
const P = 'web/index.html';
const BAK = 'web/index.html.bak19';

let h = fs.readFileSync(BAK, 'utf8');
console.log('从 bak19 恢复，' + h.length + ' 字节');

const c = (s, r) => (s.match(r) || []).length;
console.log('  恢复后 div ' + c(h, /<div\b/g) + '/' + c(h, /<\/div>/g) + '  section ' + c(h, /<section\b/g) + '/' + c(h, /<\/section>/g));

/* 深度配对找 #dual-wheel-host 的闭合 */
const i = h.indexOf('id="dual-wheel-host"');
if (i < 0) { console.error('❌ 找不到 host'); process.exit(1); }
const start = h.lastIndexOf('<div', i);
const re = /<div\b|<\/div>/g; re.lastIndex = start;
let d = 0, m, end = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { end = m.index + 6; break; } }

const BOX = '\n        <div id="dw-detail" class="dw-detail"><div class="note">点图上的任意词语（地支 / 藏干 / 宫位 / 紫微宫名 / 行星 / ASC / 七柱）看详情。</div></div>';
h = h.slice(0, end) + BOX + h.slice(end);

/* ── 全面校验 ── */
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['script', /<script\b/g, /<\/script>/g], ['table', /<table\b/g, /<\/table>/g], ['p', /<p\b/g, /<\/p>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
/* 全程无负深度 */
let dd = 0, mm;
const r2 = /<div\b|<\/div>/g;
let neg = false;
while ((mm = r2.exec(h))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd < 0) { neg = true; break; } }
if (neg) { bad++; console.log('  ❌ 出现负深度'); }

/* #app 包住其余页面 */
const app = h.indexOf('<div id="app"');
const at = h.indexOf('>', app) + 1;
const r3 = /<div\b|<\/div>/g; r3.lastIndex = at;
let d3 = 1, m3, appEnd = -1;
while ((m3 = r3.exec(h))) { d3 += m3[0] === '</div>' ? -1 : 1; if (d3 === 0) { appEnd = m3.index; break; } }
const allIn = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => {
  const p = h.indexOf('data-page="' + k + '"');
  return p > app && p < appEnd;
});
if (!allIn) { bad++; console.log('  ❌ #app 未包住其余页面'); }

/* dw-detail 必须在 host 之外 */
const pi = h.indexOf('id="dual-wheel-host"');
const ps = h.lastIndexOf('<div', pi);
const r4 = /<div\b|<\/div>/g; r4.lastIndex = ps;
let d4 = 0, m4, pe = -1;
while ((m4 = r4.exec(h))) { d4 += m4[0] === '</div>' ? -1 : 1; if (d4 === 0 && m4[0] === '</div>') { pe = m4.index + 6; break; } }
const pd = h.indexOf('id="dw-detail"');
if (!(pd > pe)) { bad++; console.log('  ❌ dw-detail 在 host 内部'); }

console.log('  #app 包住其余页面: ' + (allIn ? '✅' : '❌') + '；dw-detail 在 host 外: ' + (pd > pe ? '✅' : '❌'));
console.log(bad ? '\n❌ 未通过，不写盘' : '\n✅ 全部通过');
if (bad) process.exit(1);
fs.writeFileSync(P, h, 'utf8');
console.log('已写入，' + h.length + ' 字节');
