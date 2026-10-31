// 把误插进 #fusion-wheel-host 内部的两张卡移到它外面（作为融合页 section 的兄弟）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak17', h, 'utf8');

function divBlockAt(s, id) {
  const i = s.indexOf('id="' + id + '"');
  if (i < 0) return null;
  const start = s.lastIndexOf('<div', i);
  const re = /<div\b|<\/div>/g; re.lastIndex = start;
  let d = 0, m, end = -1;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { end = m.index + 6; break; } }
  return end > 0 ? { start, end, html: s.slice(start, end) } : null;
}

const A = divBlockAt(h, 'dual-wheel-card');
const B = divBlockAt(h, 'zhi-cang-legend');
if (!A || !B) { console.error('❌ 找不到两张卡', !!A, !!B); process.exit(1); }
console.log('dual-wheel-card [' + A.start + '→' + A.end + ']  ' + A.html.length);
console.log('zhi-cang-legend [' + B.start + '→' + B.end + ']  ' + B.html.length);

/* 按位置从后往前删 */
const blocks = [A, B].sort((x, y) => y.start - x.start);
for (const b of blocks) h = h.slice(0, b.start) + h.slice(b.end);

/* 找 #fusion-wheel-host 这个 section 的结束 */
const wi = h.indexOf('id="fusion-wheel-host"');
if (wi < 0) { console.error('❌ 找不到 fusion-wheel-host'); process.exit(1); }
const wStart = h.lastIndexOf('<section', wi);
const re2 = /<section\b|<\/section>/g; re2.lastIndex = wStart;
let d2 = 0, m2, wEnd = -1;
while ((m2 = re2.exec(h))) { d2 += m2[0] === '</section>' ? -1 : 1; if (d2 === 0 && m2[0] === '</section>') { wEnd = m2.index + '</section>'.length; break; } }
if (wEnd < 0) { console.error('❌ fusion-wheel-host 未闭合'); process.exit(1); }
console.log('fusion-wheel-host 结束 @' + wEnd);

/* 插到它后面（顺序：先双环，再藏干/宫位对照） */
const INS = '\n\n      ' + A.html.trim() + '\n\n      ' + B.html.trim() + '\n';
h = h.slice(0, wEnd) + INS + h.slice(wEnd);

fs.writeFileSync(P, h, 'utf8');
console.log('✅ 两张卡已移到 fusion-wheel-host 之外');

/* 校验：两卡的起止必须都在 fw-card 之外 */
const wi2 = h.indexOf('id="fusion-wheel-host"');
const ws2 = h.lastIndexOf('<section', wi2);
const r3 = /<section\b|<\/section>/g; r3.lastIndex = ws2;
let d3 = 0, m3, we2 = -1;
while ((m3 = r3.exec(h))) { d3 += m3[0] === '</section>' ? -1 : 1; if (d3 === 0 && m3[0] === '</section>') { we2 = m3.index + 10; break; } }
const pA = h.indexOf('id="dual-wheel-card"');
const pB = h.indexOf('id="zhi-cang-legend"');
console.log('  校验：fw-card 结束 @' + we2 + '；双环卡 @' + pA + '；藏干卡 @' + pB);
const ok = pA > we2 && pB > we2;
console.log('  ' + (ok ? '✅ 两卡都在 3D 盘卡之外' : '❌ 仍在内部'));

const c = (s, re) => (s.match(re) || []).length;
let bad = ok ? 0 : 1;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g]]) {
  const good = c(h, o) === c(h, cl);
  if (!good) bad++;
  console.log(`  ${n} ${c(h, o)}/${c(h, cl)} ${good ? '✅' : '❌'}`);
}
process.exit(bad ? 1 : 0);
