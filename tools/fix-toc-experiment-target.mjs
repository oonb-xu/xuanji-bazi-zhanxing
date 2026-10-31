// 本页导航：把「实验性板块」项的跳转改为 59.58 假说；原「59.58」项则指向 60 甲子连续性（避免两项重复指向同一锚点）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak15', h, 'utf8');

/* 旧：第 8 项 → sec-59-58「59.58 假说」；第 10 项 → sec-experiment「实验性板块」 */
const OLD8 = '<a href="#sec-59-58" class="toc-i warn"><b>8</b><span>59.58 假说</span><i>历法冻结与漂移</i></a>';
const OLD10 = '<a href="#sec-experiment" class="toc-i"><b>10</b><span>实验性板块</span><i>60 甲子连续性</i></a>';

if (!h.includes(OLD8) || !h.includes(OLD10)) {
  console.error('❌ 未匹配到旧导航项');
  console.error('  第8项存在:', h.includes(OLD8));
  console.error('  第10项存在:', h.includes(OLD10));
  /* 打印实际内容便于修正 */
  const i = h.indexOf('id="about-toc"');
  const s = h.lastIndexOf('<div', i);
  console.log(h.slice(s, s + 1600));
  process.exit(1);
}

/* 互换：8 → 实验性板块(60甲子)；10 → 实验性假说(59.58) */
const NEW8 = '<a href="#sec-experiment" class="toc-i"><b>8</b><span>实验性板块</span><i>60 甲子连续性</i></a>';
const NEW10 = '<a href="#sec-59-58" class="toc-i warn"><b>10</b><span>实验性假说</span><i>59.58 年 · 微分论证</i></a>';

h = h.replace(OLD8, NEW8);
h = h.replace(OLD10, NEW10);
console.log('✅ 已互换：第8项 → 60甲子连续性；第10项 → 59.58 假说');

fs.writeFileSync(P, h, 'utf8');

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['a', /<a\b/g, /<\/a>/g], ['div', /<div\b/g, /<\/div>/g], ['b', /<b\b/g, /<\/b>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(6)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}

/* 取出 TOC 区块，逐项打印 */
const ti = h.indexOf('id="about-toc"');
const ts = h.lastIndexOf('<div', ti);
const re = /<div\b|<\/div>/g; re.lastIndex = ts;
let d = 0, m, te = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { te = m.index + 6; break; } }
const toc = h.slice(ts, te);

console.log('\n=== 导航 11 项 ===');
const items = [...toc.matchAll(/<a href="#([^"]+)"[^>]*><b>(\d+)<\/b><span>([^<]*)<\/span><i>([^<]*)<\/i><\/a>/g)];
for (const it of items) console.log(`  ${String(it[2]).padStart(2)}. #${it[1].padEnd(18)} ${it[3]} ${it[4] ? '· ' + it[4] : ''}`);
console.log('  共 ' + items.length + ' 项');
if (items.length !== 11) bad++;

/* 目标锚点必须都存在 */
let miss = 0;
for (const it of items) {
  if (!h.includes('id="' + it[1] + '"')) { miss++; bad++; console.log('  ❌ 锚点不存在: #' + it[1]); }
}
console.log('  锚点缺失 ' + miss);

/* 关键断言 */
const ok10 = toc.includes('href="#sec-59-58"') && /<b>10<\/b><span>实验性假说/.test(toc);
const ok8 = toc.includes('href="#sec-experiment"') && /<b>8<\/b><span>实验性板块/.test(toc);
console.log(`  ${ok10 ? '✅' : '❌'} 第10项 = 实验性假说 → #sec-59-58`);
console.log(`  ${ok8 ? '✅' : '❌'} 第8项 = 实验性板块 → #sec-experiment`);
if (!ok10 || !ok8) bad++;

/* 每个锚点只出现一次 */
const hrefs = items.map((x) => x[1]);
const dup = hrefs.filter((x, i) => hrefs.indexOf(x) !== i);
console.log('  重复锚点 ' + (dup.length ? '❌ ' + dup.join(',') : '无 ✅'));
if (dup.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
console.log('\n✅ 通过');
