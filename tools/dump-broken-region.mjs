// 精确 dump 损坏区间，为修复做准备
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const s = h.indexOf('<section class="page active"');
const e = h.indexOf('data-page="fusion">') + 'data-page="fusion">'.length;
console.log('损坏区间:', s, '→', e, `(${e - s} 字符)`);
console.log('\n=== 区间全文（分段打印）===');
const region = h.slice(s, e);
// 按 </div> 与 <h 分块打印，便于看清顺序
const parts = region.split(/(?=<\/div>|<h2|<h3|<div class="card|data-page=)/);
let n = 0;
for (const p of parts) {
  if (!p.trim()) continue;
  n++;
  if (n > 40) { console.log('  …（其余 ' + (parts.length - 40) + ' 段省略）'); break; }
  console.log(`  [${n}] ${JSON.stringify(p.slice(0, 150))}`);
}
console.log('\n区间前后各 200 字符:');
console.log('  前:', JSON.stringify(h.slice(Math.max(0, s - 200), s)));
console.log('  后:', JSON.stringify(h.slice(e, e + 200)));
