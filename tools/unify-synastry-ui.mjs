// ④ 合盘界面与融合盘统一：① 标签统一为「出生时间」 ② 补上同样的「数据贡献」勾选块
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak13', h, 'utf8');

let changed = 0;

/* ① 标签统一：合盘的 <label>时间< → 出生时间 */
for (const n of ['a_at', 'b_at']) {
  const old = '<label>时间<input type="datetime-local" name="' + n + '"';
  const neu = '<label>出生时间<input type="datetime-local" name="' + n + '"';
  if (h.includes(old)) { h = h.replace(old, neu); changed++; console.log('✅ 标签统一：' + n); }
  else console.log('— 无需改：' + n);
}

/* ② 把融合盘的「数据贡献」块复制到合盘表单末尾 */
const OPT_START = '<div class="opt-row opt-contribute">';
const optIdx = h.indexOf(OPT_START, h.indexOf('id="f-fusion"'));
if (optIdx < 0) { console.error('❌ 找不到融合盘的贡献块'); process.exit(1); }
/* 取到该块的结束 */
const re = /<div\b|<\/div>/g; re.lastIndex = optIdx;
let d = 0, m, optEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { optEnd = m.index + 6; break; } }
const optBlock = h.slice(optIdx, optEnd);
console.log('  贡献块长度 ' + optBlock.length);

const synIdx = h.indexOf('id="f-synastry"');
const synFormEnd = h.indexOf('</form>', synIdx);
if (h.slice(synIdx, synFormEnd).includes('opt-contribute')) {
  console.log('— 合盘已有贡献块');
} else {
  const indented = optBlock.replace(/\n/g, '\n  ');
  h = h.slice(0, synFormEnd) + '  ' + indented + '\n    ' + h.slice(synFormEnd);
  changed++;
  console.log('✅ 合盘已补「数据贡献」块');
}

fs.writeFileSync(P, h, 'utf8');
console.log('index.html', h.length, '字节');

/* ③ 校验 */
const c = (s, rex) => (s.match(rex) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['form', /<form\b/g, /<\/form>/g],
  ['label', /<label\b/g, /<\/label>/g], ['input', /<input\b/g, /\/?>/g],
  ['section', /<section\b/g, /<\/section>/g]]) {
  if (n === 'input') continue;
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(8)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}
const chk = [
  ['合盘标签已改为出生时间', (h.match(/<label>出生时间<input type="datetime-local" name="[ab]_at"/g) || []).length === 2],
  ['两表单都有贡献块', (h.match(/opt-contribute/g) || []).length === 2],
];
for (const [n, ok] of chk) { if (!ok) bad++; console.log(`  ${ok ? '✅' : '❌'} ${n}`); }
if (bad) { console.error('\n❌ 校验未过'); process.exit(1); }
console.log('\n✅ 通过，改动 ' + changed + ' 处');
