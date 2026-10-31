// 把「这是什么」那一块整体搬到关于页最前面
// 安全做法：用 div 标签配对求块边界，不做字符串切片猜测
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

/** 从 pos 处的 <div 开始，返回其匹配 </div> 的结束下标（不含） */
function matchDiv(html, pos) {
  const open = /<div\b/g;
  const close = /<\/div>/g;
  let depth = 0, i = pos;
  // 用交替扫描：先找所有开始/结束标签，按位置排序走一遍
  const toks = [];
  open.lastIndex = pos;
  let m;
  while ((m = open.exec(html))) toks.push({ t: 1, i: m.index, e: m.index + 4 });
  close.lastIndex = pos;
  while ((m = close.exec(html))) toks.push({ t: -1, i: m.index, e: m.index + 6 });
  toks.sort((a, b) => a.i - b.i);
  for (const tk of toks) {
    depth += tk.t;
    if (depth === 0) return tk.e;
  }
  return -1;
}

/* ① 列出关于页的 h2，定位目标 */
const aboutStart = h.indexOf('data-page="about"');
const aboutEnd = h.indexOf('data-page="fusion"', aboutStart);
const seg = h.slice(aboutStart, aboutEnd > 0 ? aboutEnd : aboutStart + 60000);
const hs = [...seg.matchAll(/<h2([^>]*)>([^<]{0,40})/g)].map((m) => ({ attr: m[1].trim(), text: m[2] }));
console.log('关于页 h2（按出现顺序）:');
hs.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + (x.attr || '(无属性)') + ' ' + x.text));

/* ② 决定搬哪一块：优先含「这是什么」，否则用「这不是拼贴」 */
let targetText = null;
if (h.includes('这是什么')) {
  const m = seg.match(/<h2[^>]*>([^<]*这是什么[^<]*)/);
  if (m) targetText = m[1];
}
if (!targetText) {
  const cand = hs.find((x) => /这不是拼贴|这是什么|关于本站|本站是/.test(x.text));
  if (cand) targetText = cand.text;
}
console.log('\n目标块:', targetText || '(未找到)');
if (!targetText) process.exit(1);

/* ③ 求块边界并搬走 */
const h2Idx = h.indexOf('>'.slice(0, 0) + targetText);
const h2Pos = h.lastIndexOf('<h2', h.indexOf(targetText));
if (h2Pos < 0) { console.error('❌ 定位 h2 失败'); process.exit(1); }

// 找包含这个 h2 的外层 <div class="card"
let cardPos = h.lastIndexOf('<div class="card', h2Pos);
let blockStart, blockEnd;
if (cardPos >= 0 && h2Pos - cardPos < 400) {
  blockStart = cardPos;
  blockEnd = matchDiv(h, cardPos);
} else {
  // h2 不在 card 内：以 h2 起、到下一个 h2 前为止
  blockStart = h2Pos;
  const nextH2 = h.indexOf('<h2', h2Pos + 10);
  blockEnd = nextH2 > 0 ? nextH2 : h.length;
}
console.log('块范围:', blockStart, '→', blockEnd, `(${blockEnd - blockStart} 字符)`);

let block = h.slice(blockStart, blockEnd);
// 去掉前导的 <h2 class="page-title"> 之类误伤？这里只做基本校验
if (!block.includes(targetText)) { console.error('❌ 块内容不含目标标题'); process.exit(1); }

h = h.slice(0, blockStart) + h.slice(blockEnd);

/* ④ 插到关于页最前（在 sec-plain-start 之前；若无则插在 about 的 page-title 之后） */
const plainIdx = h.indexOf('id="sec-plain-start"');
let insertAt;
if (plainIdx > 0) {
  insertAt = h.lastIndexOf('<div class="card"', plainIdx);
  if (insertAt < 0) insertAt = plainIdx;
} else {
  const a2 = h.indexOf('data-page="about"');
  const t2 = h.indexOf('class="page-title"', a2);
  insertAt = t2 > 0 ? h.indexOf('</h2>', t2) + 5 : a2;
}
h = h.slice(0, insertAt) + '\n      ' + block.trim() + '\n      ' + h.slice(insertAt);

fs.writeFileSync(P, h, 'utf8');
console.log('\n✅ 已搬到关于页最前');

/* ⑤ 校验：标签平衡 + 顺序 + 只出现一次 */
const out = fs.readFileSync(P, 'utf8');
const divOk = (out.match(/<div\b/g) || []).length === (out.match(/<\/div>/g) || []).length;
const cnt = (out.split(targetText).length - 1);
const posTarget = out.indexOf(targetText);
const posPlain = out.indexOf('id="sec-plain-start"');
const posToc = out.indexOf('id="about-toc"');
console.log('\n校验：');
console.log(' ', divOk ? '✅' : '❌', 'div 平衡');
console.log(' ', cnt === 1 ? '✅' : '❌', `目标标题出现 ${cnt} 次（应为 1）`);
console.log(' ', posTarget > 0 && posTarget < posPlain ? '✅' : '❌', '在「先看这里」之前');
console.log(' ', posTarget > 0 && posTarget < posToc ? '✅' : '❌', '在导航索引之前');
process.exit(divOk && cnt === 1 && posTarget < posPlain ? 0 : 1);
