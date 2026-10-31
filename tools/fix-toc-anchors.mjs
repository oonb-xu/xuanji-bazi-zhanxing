// 修「各体系独有优势」等 4 块的导航：① 给 4 张卡补 id ② 本页导航补 4 项并重新编号 ③ 清掉残留空行
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak10', h, 'utf8');

/* ── ① 给 4 张卡补锚点 id ── */
const BLOCKS = [
  ['各体系独有优势', 'sec-adv'],
  ['庙旺的维度差异', 'sec-coupling'],
  ['一图四层', 'sec-fusion-layers'],
  ['四系统共同骨架', 'sec-skeleton'],
];
let idAdded = 0;
for (const [title, id] of BLOCKS) {
  if (h.includes('id="' + id + '"')) { console.log('— 已有 id', id); continue; }
  const p = h.indexOf(title);
  if (p < 0) { console.error('❌ 找不到块:', title); process.exit(1); }
  const cs = h.lastIndexOf('<div class="card">', p);
  if (cs < 0) { console.error('❌ 找不到卡片起点:', title); process.exit(1); }
  h = h.slice(0, cs) + '<div class="card" id="' + id + '">' + h.slice(cs + '<div class="card">'.length);
  idAdded++;
  console.log('✅ 加 id:', id, '←', title);
}
console.log('共加 id', idAdded, '个');

/* ── ② 重写本页导航 ── */
const TOC_ITEMS = [
  ['sec-not-collage', '1', '', '这不是拼贴', '底层逻辑对应'],
  ['sec-howto', '2', '', '怎么用 · API', '什么时候需要'],
  ['sec-method', '3', '', '融合路径论文', '完整论证'],
  ['sec-adv', '4', '', '各体系独有优势', '结构上做不到的'],
  ['sec-coupling', '5', '', '庙旺的维度差异', '耦合 vs 分离'],
  ['sec-fusion-layers', '6', '', '一图四层', '各取所长'],
  ['sec-skeleton', '7', '', '四系统共同骨架', '五层功能对照'],
  ['sec-59-58', '8', ' warn', '59.58 假说', '历法冻结与漂移'],
  ['sec-conflict', '9', ' warn', '体系冲突', '做不到、对不上'],
  ['sec-experiment', '10', '', '实验性板块', '60 甲子连续性'],
  ['sec-credits', '11', '', '开源与数据', '逐条署名'],
];

const ti = h.indexOf('id="about-toc"');
if (ti < 0) { console.error('❌ 无 about-toc'); process.exit(1); }
const tocStart = h.lastIndexOf('<div', ti);
const re = /<div\b|<\/div>/g; re.lastIndex = tocStart;
let d = 0, m, tocEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { tocEnd = m.index + 6; break; } }
const oldToc = h.slice(tocStart, tocEnd);

const gridHtml = TOC_ITEMS
  .map(([id, num, cls, label, sub]) => `          <a href="#${id}" class="toc-i${cls}"><b>${num}</b><span>${label}</span><i>${sub}</i></a>`)
  .join('\n');

const newToc = `<div class="card" id="about-toc" style="margin-bottom:18px">
        <div class="note" style="font-size:13px;line-height:1.95;margin-bottom:10px">
          <b style="color:#5ef1ff">本页导航</b>　<span class="mut2">按「先定位 → 再看证据 → 最后看做不到的地方」排列</span>
        </div>
        <div class="toc-grid">
${gridHtml}
        </div>
      </div>`;

h = h.slice(0, tocStart) + newToc + h.slice(tocEnd);
console.log('\n✅ 本页导航已重写：', TOC_ITEMS.length, '项（原 7 项）');

/* ── ③ 校验 ── */
const c = (s, rx) => (s.match(rx) || []).length;
let bad = 0;
console.log('\n=== 标签校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['a', /<a\b/g, /<\/a>/g],
  ['b', /<b\b/g, /<\/b>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g],
  ['section', /<section\b/g, /<\/section>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}

/* 每个 href 必须能找到对应 id */
console.log('\n=== 导航目标是否都存在 ===');
const ti2 = h.indexOf('id="about-toc"');
const toc2s = h.lastIndexOf('<div', ti2);
const re2 = /<div\b|<\/div>/g; re2.lastIndex = toc2s;
let d2 = 0, m2, toc2e = -1;
while ((m2 = re2.exec(h))) { d2 += m2[0] === '</div>' ? -1 : 1; if (d2 === 0 && m2[0] === '</div>') { toc2e = m2.index + 6; break; } }
const tocNow = h.slice(toc2s, toc2e);
const hrefs = [...tocNow.matchAll(/href="#([^"]+)"/g)].map((x) => x[1]);
let miss = 0;
for (const id of hrefs) {
  const exists = h.includes('id="' + id + '"');
  if (!exists) { miss++; bad++; }
  console.log(`  ${exists ? '✅' : '❌'} #${id}`);
}
console.log('  共', hrefs.length, '项，缺失', miss);

/* 空白残留检查 */
const blankLines = (tocNow.match(/^\s{8,}$/gm) || []).length;
console.log('\n  导航内空行残留: ' + blankLines + (blankLines === 0 ? ' ✅' : ' ❌'));
if (blankLines > 0) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, h, 'utf8');
console.log('\n✅ 已写入');
