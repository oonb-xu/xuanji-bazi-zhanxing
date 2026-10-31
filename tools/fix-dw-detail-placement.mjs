// 把 #dw-detail 正确插到 #dual-wheel-host 之后（深度配对，避免插入其内部被 innerHTML 冲掉）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak20', h, 'utf8');

/* 先删掉可能存在的错误位置版本 */
const re0 = /<div id="dw-detail"[\s\S]*?<\/div>\s*/g;
const had = h.match(re0);
if (had) { h = h.replace(re0, ''); console.log('已移除旧位置 dw-detail ×' + had.length); }

/* 深度配对找 #dual-wheel-host 的闭合 */
const i = h.indexOf('id="dual-wheel-host"');
if (i < 0) { console.error('❌ 找不到 host'); process.exit(1); }
const start = h.lastIndexOf('<div', i);
const re = /<div\b|<\/div>/g; re.lastIndex = start;
let d = 0, m, end = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { end = m.index + 6; break; } }
if (end < 0) { console.error('❌ host 未闭合'); process.exit(1); }
console.log('dual-wheel-host [' + start + '→' + end + ']');

const BOX = '\n        <div id="dw-detail" class="dw-detail"><div class="note">点图上的任意词语（地支 / 藏干 / 宫位 / 紫微宫名 / 行星 / ASC / 七柱）看详情。</div></div>';
h = h.slice(0, end) + BOX + h.slice(end);
fs.writeFileSync(P, h, 'utf8');
console.log('✅ #dw-detail 已插到 host 之后');

/* 校验 */
const i2 = h.indexOf('id="dual-wheel-host"');
const s2 = h.lastIndexOf('<div', i2);
const r2 = /<div\b|<\/div>/g; r2.lastIndex = s2;
let d2 = 0, m2, e2 = -1;
while ((m2 = r2.exec(h))) { d2 += m2[0] === '</div>' ? -1 : 1; if (d2 === 0 && m2[0] === '</div>') { e2 = m2.index + 6; break; } }
const pDetail = h.indexOf('id="dw-detail"');
console.log('  host 结束 @' + e2 + '；dw-detail @' + pDetail + ' → ' + (pDetail > e2 ? '✅ 在外' : '❌ 仍在内'));

const c = (s, re3) => (s.match(re3) || []).length;
let bad = pDetail > e2 ? 0 : 1;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
console.log(bad ? '❌' : '✅ 标签平衡');
process.exit(bad ? 1 : 0);
