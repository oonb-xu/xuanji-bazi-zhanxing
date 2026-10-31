// 纠正：让「实验性板块」这个标签跳到 59.58；「60 甲子连续性」标签跳到 60 甲子板块
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const OLD8 = '<a href="#sec-experiment" class="toc-i"><b>8</b><span>实验性板块</span><i>60 甲子连续性</i></a>';
const OLD10 = '<a href="#sec-59-58" class="toc-i warn"><b>10</b><span>实验性假说</span><i>59.58 年 · 微分论证</i></a>';

if (!h.includes(OLD8) || !h.includes(OLD10)) {
  console.error('❌ 未匹配（当前状态可能已变）');
  const ti = h.indexOf('id="about-toc"');
  const ts = h.lastIndexOf('<div', ti);
  console.log(h.slice(ts, ts + 1500));
  process.exit(1);
}

/* 第 8 项：标签改成「60 甲子连续性」，仍指 60 甲子板块 */
const NEW8 = '<a href="#sec-experiment" class="toc-i"><b>8</b><span>60 甲子连续性</span><i>实验性板块</i></a>';
/* 第 10 项：标签保持「实验性板块」，指向 59.58 假说 */
const NEW10 = '<a href="#sec-59-58" class="toc-i warn"><b>10</b><span>实验性板块</span><i>59.58 年 · 微分论证</i></a>';

h = h.replace(OLD8, NEW8).replace(OLD10, NEW10);
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已改为：第8项「60 甲子连续性」→#sec-experiment；第10项「实验性板块」→#sec-59-58');

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['a', /<a\b/g, /<\/a>/g], ['div', /<div\b/g, /<\/div>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g], ['b', /<b\b/g, /<\/b>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}

const ti = h.indexOf('id="about-toc"');
const ts = h.lastIndexOf('<div', ti);
const re = /<div\b|<\/div>/g; re.lastIndex = ts;
let d = 0, m, te = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { te = m.index + 6; break; } }
const toc = h.slice(ts, te);
const items = [...toc.matchAll(/<a href="#([^"]+)"[^>]*><b>(\d+)<\/b><span>([^<]*)<\/span><i>([^<]*)<\/i><\/a>/g)];

console.log('\n=== 导航 11 项 ===');
for (const it of items) console.log(`  ${String(it[2]).padStart(2)}. #${it[1].padEnd(18)} ${it[3]} · ${it[4]}`);
console.log('  共 ' + items.length + ' 项');
if (items.length !== 11) bad++;

let miss = 0;
for (const it of items) if (!h.includes('id="' + it[1] + '"')) { miss++; bad++; console.log('  ❌ 锚点缺失 #' + it[1]); }
console.log('  锚点缺失 ' + miss);
const hrefs = items.map((x) => x[1]);
const dup = hrefs.filter((x, i) => hrefs.indexOf(x) !== i);
if (dup.length) { bad++; console.log('  ❌ 重复锚点 ' + dup.join(',')); } else console.log('  重复锚点 无 ✅');

const lbl10 = /<b>10<\/b><span>实验性板块<\/span>/.test(toc) && /href="#sec-59-58"[^>]*><b>10<\/b>/.test(toc);
console.log(`  ${lbl10 ? '✅' : '❌'} 「实验性板块」→ #sec-59-58`);
if (!lbl10) bad++;

if (bad) { console.error('\n❌ 校验未过'); process.exit(1); }
console.log('\n✅ 通过');
