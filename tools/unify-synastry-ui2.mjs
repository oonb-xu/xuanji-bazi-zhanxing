// ④ 合盘界面与融合盘统一：① 标签统一「出生时间」 ② 补同样的「数据贡献」勾选
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak13', h, 'utf8');

/* ① 标签统一 */
for (const n of ['a_at', 'b_at']) {
  const old = '<label>时间<input type="datetime-local" name="' + n + '"';
  const neu = '<label>出生时间<input type="datetime-local" name="' + n + '"';
  if (h.includes(old)) { h = h.replace(old, neu); console.log('✅ 标签统一：' + n); }
  else console.log('— 无需改：' + n);
}

/* ② 找融合盘里 name="contribute" 的外层 <label ...>…</label> */
const fi = h.indexOf('id="f-fusion"');
const fe = h.indexOf('</form>', fi);
const fusForm = h.slice(fi, fe);
const ci = fusForm.indexOf('name="contribute"');
if (ci < 0) { console.error('❌ 融合表单里没有 name="contribute"'); process.exit(1); }
const absCi = fi + ci;
/* 往前找最近的 <label */
const labStart = h.lastIndexOf('<label', absCi);
const labEnd = h.indexOf('</label>', absCi) + '</label>'.length;
const optBlock = h.slice(labStart, labEnd);
console.log('  找到贡献块：' + labStart + '→' + labEnd + '（' + optBlock.length + ' 字符）');
console.log('  开头: ' + JSON.stringify(optBlock.slice(0, 90)));
/* 往回带一个包裹 div（如果有） */
let wrapStart = labStart;
const beforeLab = h.slice(Math.max(0, labStart - 200), labStart);
if (beforeLab.includes('<div')) {
  const li = beforeLab.lastIndexOf('<div');
  const cand = labStart - (beforeLab.length - li);
  /* 只在 div 紧跟 label 时采用 */
  if (h.slice(cand + 4).trimStart().startsWith('<label') === false) {
    // 保守：不包裹
  } else wrapStart = cand;
}
const blockToCopy = h.slice(wrapStart, labEnd);

/* 合盘表单尾部插入 */
const si = h.indexOf('id="f-synastry"');
const se = h.indexOf('</form>', si);
if (h.slice(si, se).includes('name="contribute"')) {
  console.log('— 合盘已有贡献块');
} else {
  h = h.slice(0, se) + '  ' + blockToCopy.replace(/\n/g, '\n  ') + '\n    ' + h.slice(se);
  console.log('✅ 合盘已补「数据贡献」块');
}

fs.writeFileSync(P, h, 'utf8');
console.log('index.html', h.length, '字节');

/* ③ 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['form', /<form\b/g, /<\/form>/g],
  ['label', /<label\b/g, /<\/label>/g], ['section', /<section\b/g, /<\/section>/g],
  ['span', /<span\b/g, /<\/span>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(8)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}
for (const [n, ok] of [
  ['合盘两处标签已改', (h.match(/<label>出生时间<input type="datetime-local" name="[ab]_at"/g) || []).length === 2],
  ['两表单都有 contribute', c(h, /name="contribute"/g) === 2],
]) { if (!ok) bad++; console.log(`  ${ok ? '✅' : '❌'} ${n}`); }
if (bad) { console.error('\n❌ 校验未过'); process.exit(1); }
console.log('\n✅ 通过');
