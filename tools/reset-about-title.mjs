// 容错：把关于页的 page-title 整块（含内部 span 等）搬到最前
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
let seg = h.slice(a0, a1);

// 定位 <h2 class="page-title"> 并匹配到它的 </h2>
const openRe = /<h2[^>]*class="page-title"[^>]*>/;
const mo = seg.match(openRe);
if (!mo) { console.error('❌ 找不到 page-title 开始标签'); 
  console.log('片段预览:', JSON.stringify(seg.slice(0, 260))); process.exit(1); }
const s = mo.index;
const e = seg.indexOf('</h2>', s);
if (e < 0) { console.error('❌ 找不到 </h2>'); process.exit(1); }
const titleBlock = seg.slice(s, e + 5);
console.log('标题块:', JSON.stringify(titleBlock.slice(0, 120)));

// 判断是不是「关于」
if (!titleBlock.includes('关于')) {
  console.warn('⚠️ 该 page-title 不含「关于」，仍继续（可能是别的页标题被误取）');
}

seg = seg.slice(0, s) + seg.slice(e + 5);
const openTagEnd = seg.indexOf('>') + 1;
seg = seg.slice(0, openTagEnd) + '\n      ' + titleBlock.trim() + '\n      ' + seg.slice(openTagEnd);

h = h.slice(0, a0) + seg + h.slice(a1);
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 标题已复位');

/* 校验 */
const out = fs.readFileSync(P, 'utf8');
const b0 = out.indexOf('data-page="about"');
const order = [
  ['page-title', out.indexOf('class="page-title"', b0)],
  ['这不是拼贴', out.indexOf('这不是拼贴', b0)],
  ['先看这里', out.indexOf('先看这里', b0)],
  ['导航索引', out.indexOf('id="about-toc"', b0)],
];
console.log('\n关于页顺序：');
order.forEach(([n, p], i) => console.log('  ' + (i + 1) + '. ' + n + ' @' + p));
const okOrder = order.every((x, i) => i === 0 || (x[1] > 0 && x[1] > order[i - 1][1]));
const divOk = (out.match(/<div\b/g) || []).length === (out.match(/<\/div>/g) || []).length;
const h2Ok = (out.match(/<h2\b/g) || []).length === (out.match(/<\/h2>/g) || []).length;
console.log('\n  ', okOrder ? '✅' : '❌', '顺序正确');
console.log('  ', divOk ? '✅' : '❌', 'div 平衡');
console.log('  ', h2Ok ? '✅' : '❌', 'h2 平衡');
process.exit(okOrder && divOk && h2Ok ? 0 : 1);
