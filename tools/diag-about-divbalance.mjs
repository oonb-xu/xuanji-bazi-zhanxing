// 诊断 about inner 的 div 平衡与失配点
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const mo = h.match(/<section class="page" data-page="about">/);
const innerStart = mo.index + mo[0].length;

const re = /<section\b|<\/section>/g; re.lastIndex = innerStart;
let d = 1, m, secEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) { secEnd = m.index; break; } }
const inner = h.slice(innerStart, secEnd);

const o = (inner.match(/<div\b/g) || []).length;
const c = (inner.match(/<\/div>/g) || []).length;
console.log('about inner: <div ' + o + ' / </div> ' + c + '  ' + (o === c ? '✅' : '❌ 差 ' + (o - c)));

/* 逐 token 走，找第一次归负的位置 */
const re2 = /<div\b|<\/div>/g;
let depth = 0, mm, firstNeg = -1;
while ((mm = re2.exec(inner))) {
  depth += mm[0] === '</div>' ? -1 : 1;
  if (depth < 0 && firstNeg < 0) firstNeg = mm.index;
}
console.log('末尾 depth:', depth, ' 首次为负位置:', firstNeg);

if (firstNeg >= 0) {
  console.log('\n首次为负处上下文:');
  console.log(JSON.stringify(inner.slice(Math.max(0, firstNeg - 260), firstNeg + 120)));
}

/* 打印 inner 里所有顶层 <div class="card" 与 </div> 的分布（前 60 个） */
console.log('\n=== 前 30 个边界 token ===');
const re3 = /<div\b[^>]*>|<\/div>/g;
let n = 0, d2 = 0;
while ((mm = re3.exec(inner)) && n < 30) {
  d2 += mm[0] === '</div>' ? -1 : 1;
  n++;
  console.log(`  [${n}] depth=${d2} @${mm.index} ${mm[0].slice(0, 60)}`);
}
