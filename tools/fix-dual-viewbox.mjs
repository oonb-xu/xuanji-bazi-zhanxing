import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let w = fs.readFileSync(P, 'utf8');
let n = 0;

/* viewBox 放大，容纳七柱外环 */
if (w.includes('viewBox="0 0 640 640"')) {
  w = w.replace('viewBox="0 0 640 640"', 'viewBox="-42 -42 724 724"');
  n++; console.log('✅ viewBox 640 → -42 -42 724 724');
}
/* 七柱半径收紧 */
if (w.includes('var R0 = R1 + 34;')) {
  w = w.replace('var R0 = R1 + 34;', 'var R0 = R1 + 22;');
  n++; console.log('✅ 七柱半径 R1+34 → R1+22');
}
fs.writeFileSync(P, w, 'utf8');
console.log(n ? '已改 ' + n + ' 处' : '未匹配');
