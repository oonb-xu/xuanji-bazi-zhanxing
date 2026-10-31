// 修关于页叙述矛盾：本系统的定位是「融合」，不能说成「各算一遍并排摆」
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak8', h, 'utf8');

const EDITS = [
  // ① 这是什么：并排 → 先找底层对应再融合
  {
    why: '① 这是什么：改为「先找底层对应、融成同一张盘」',
    from: '三种方法各有一套说法，这里不打架，而是并排算给你看。',
    to: '三种方法各有一套说法，这里不打架：<strong>先找到它们底层的对应，融成同一张盘</strong>，再用白话摊给你看。能对应上的地方就是融合；确实对不上的地方才并排列出、不硬凑。'
  },
  // ② 一句话：核心口号
  {
    why: '② 一句话：从「各算一遍并排摆」改为「融成一个模型」',
    from: '你把出生时间地点填进去，它用三种老办法各算一遍，把结果<strong>并排摊给你看</strong>。它不替你下结论——下结论的是你。',
    to: '你把出生时间地点填进去，它<strong>先把三套体系翻译到同一个坐标上、融成一个模型</strong>，再用白话摊给你看。它不替你下结论——下结论的是你。'
  },
  // ③ 局限说明：说明「不硬凑」只针对对不上的部分
  {
    why: '③ 八字/星盘术语差异：明确「能对应的已融合」',
    from: '八字讲"木火土金水"，星盘讲"火土风水"，<strong>是两套完全不同的说法</strong>，所以只并排给你看，不硬凑成一个数。',
    to: '八字讲"木火土金水"，星盘讲"火土风水"，<strong>字面是两套完全不同的说法</strong>——能对应的部分本系统已经对齐融合了，只有对不上的地方才并排列出，不硬凑成一个数。'
  },
  // ④ 两轴：说明正因为不同轴才能拼进同一张盘
  {
    why: '④ 心理/物质两轴：补一句「正因不同轴才能拼进同一张盘」',
    from: '所以它们给出相反结论时<b>不是矛盾</b>，而是各测各的。',
    to: '所以它们给出相反结论时<b>不是矛盾</b>，而是各测各的层面——<b>正因为不在同一根轴上，才拼得进同一张盘</b>。'
  },
  // ⑤ 流派差异的处置措辞
  {
    why: '⑤ 冲突分类：把「不合并只并排」改成「并列呈现，不合并成一个数」',
    from: '<b class="gold">流派差异</b>（不合并只并排）',
    to: '<b class="gold">流派差异</b>（并列呈现，不合并成一个数）'
  },
  // ⑥ 两轴并排措辞
  {
    why: '⑥ 两轴冲突行：措辞统一',
    from: '两轴<b>不合并只并排</b>，输出「物质有靠，但心里不安」',
    to: '两轴各算各的、并列输出「物质有靠，但心里不安」'
  },
];

let ok = 0, fail = [];
for (const e of EDITS) {
  const cnt = h.split(e.from).length - 1;
  if (cnt === 1) { h = h.replace(e.from, e.to); ok++; console.log('✅ ' + e.why); }
  else { fail.push(e.why + '（命中 ' + cnt + ' 次）'); console.log('❌ ' + e.why + ' —— 命中 ' + cnt + ' 次'); }
}

if (fail.length) {
  console.error('\n❌ 有 ' + fail.length + ' 处未成功，不写盘');
  process.exit(1);
}

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['p', /<p\b/g, /<\/p>/g], ['strong', /<strong>/g, /<\/strong>/g], ['b', /<b\b/g, /<\/b>/g],
  ['ul', /<ul\b/g, /<\/ul>/g], ['li', /<li\b/g, /<\/li>/g], ['table', /<table\b/g, /<\/table>/g]]) {
  const good = c(h, o) === c(h, cl);
  if (!good) bad++;
  console.log(`  ${n.padEnd(7)} ${c(h, o)}/${c(h, cl)} ${good ? '✅' : '❌'}`);
}
/* 融合表述必须出现，且旧的并排口号必须消失 */
const mustHave = ['融成同一张盘', '融成一个模型', '拼得进同一张盘'];
const gone = mustHave.filter((k) => !h.includes(k));
console.log('  新融合表述 ' + (gone.length ? '❌ 缺 ' + gone.join(',') : '✅ 3 处已就位'));
if (gone.length) bad++;
const mustNot = ['而是并排算给你看', '并排摊给你看', '所以只并排给你看', '不合并只并排'];
const left = mustNot.filter((k) => h.includes(k));
console.log('  旧并排口号 ' + (left.length ? '❌ 残留 ' + left.join(',') : '✅ 已全部改写'));
if (left.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, h, 'utf8');
console.log('\n✅ 已写入（' + ok + ' 处叙述已改）');
