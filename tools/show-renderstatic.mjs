import fs from 'node:fs';
const t = fs.readFileSync('web/glossary.html', 'utf8');
const i = t.indexOf('function renderStatic');
if (i < 0) { console.log('未找到 renderStatic'); process.exit(0); }
const seg = t.slice(i, i + 900);
console.log('=== renderStatic 前 900 字符 ===');
console.log(seg);
console.log('\n=== 4 个静态卡片的位置 ===');
for (const k of ['各体系独有优势', '庙旺的维度差异', '一图四层', '四系统共同骨架']) {
  console.log('  ' + k.padEnd(10) + ' @' + t.indexOf(k));
}
console.log('\n=== renderStatic 调用处 ===');
for (const m of t.matchAll(/renderStatic\(\)/g)) console.log('  @' + m.index);
