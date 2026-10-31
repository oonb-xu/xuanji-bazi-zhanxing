import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
const c = (s, re) => (s.match(re) || []).length;
const b0 = c(h, /<b\b/g), c0 = c(h, /<\/b>/g);
console.log('修前: <b>', b0, '/ </b>', c0);
if (b0 === c0) { console.log('已平衡'); process.exit(0); }

/* 逐 token 求 <b> 深度，找最后一个「0→1 之后再也不回 0」的 <b> */
const re = /<b\b[^>]*>|<\/b>/g;
let depth = 0, m, lastOpen = -1, neverClosed = -1;
const trans = [];
while ((m = re.exec(h))) {
  if (m[0] === '</b>') { depth--; }
  else { if (depth === 0) lastOpen = m.index; depth++; }
  trans.push({ pos: m.index, d: depth, tok: m[0].slice(0, 20) });
}
console.log('最终 <b> 深度:', depth);
if (depth !== 1) { console.error('❌ 深度不是 1，情况更复杂，中止'); process.exit(1); }
neverClosed = lastOpen;
console.log('最后一个未闭合 <b> @' + neverClosed);
console.log('上下文:', JSON.stringify(h.slice(Math.max(0, neverClosed - 120), neverClosed + 160)));

/* 在它之后最近的 </div> 前插入 </b> */
const nextDiv = h.indexOf('</div>', neverClosed);
if (nextDiv < 0) { console.error('❌ 后面没有 </div>'); process.exit(1); }
console.log('插入点（下一个 </div> 前）@' + nextDiv);
console.log('插入点上下文:', JSON.stringify(h.slice(Math.max(0, nextDiv - 100), nextDiv + 40)));

const out = h.slice(0, nextDiv) + '</b>' + h.slice(nextDiv);

/* 校验 */
const b1 = c(out, /<b\b/g), c1 = c(out, /<\/b>/g);
const d1 = c(out, /<div\b/g), d2 = c(out, /<\/div>/g);
const s1 = c(out, /<section\b/g), s2 = c(out, /<\/section>/g);
console.log(`\n修后: <b> ${b1}/${c1}  div ${d1}/${d2}  section ${s1}/${s2}`);
if (b1 !== c1 || d1 !== d2 || s1 !== s2) { console.error('❌ 不平衡，不写盘'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已插入 1 个 </b>（只加了 4 个字符）');

/* 复检其余标签 */
const h2 = fs.readFileSync(P, 'utf8');
for (const [n, re1, re2] of [['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['table', /<table\b/g, /<\/table>/g]]) {
  const a = (h2.match(re1) || []).length, b = (h2.match(re2) || []).length;
  console.log(`  ${n} ${a}/${b} ${a === b ? '✅' : '❌'}`);
}
