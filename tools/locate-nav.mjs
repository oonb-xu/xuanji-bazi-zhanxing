import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');

/* 找导航 */
const NAVS = [
  ['◉ 圆盘', '◉ 圆盘'],
  ['圆盘', '圆盘'],
  ['class="nav', 'class="nav'],
  ['<nav', '<nav'],
];
console.log('=== 导航候选位置 ===');
for (const [name, k] of NAVS) {
  let p = 0, cnt = 0;
  while ((p = h.indexOf(k, p)) >= 0 && cnt < 5) { console.log(`  ${name} @${p}`); p += k.length; cnt++; }
}

/* 关键结构位置 */
console.log('\n=== 关键结构 ===');
for (const [name, k] of [
  ['<body', '<body'],
  ['stage-hero', 'id="stage-hero"'],
  ['about section', '<section class="page" data-page="about">'],
  ['fusion section', '<section class="page active" data-page="fusion">'],
  ['timeline', 'data-page="timeline"'],
  ['</main', '</main'],
  ['<script', '<script'],
]) {
  const p = h.indexOf(k);
  console.log(`  ${name.padEnd(14)} @${p}`);
}

/* 文件尾部 2200 字符的结构摘要 */
console.log('\n=== 文件尾部 2200 字符 ===');
const tail = h.slice(-2200);
console.log(JSON.stringify(tail.slice(0, 1100)));
console.log('...');
console.log(JSON.stringify(tail.slice(-1100)));

/* 找 nav 元素完整范围 */
const navPos = h.indexOf('◉ 圆盘');
if (navPos > 0) {
  // 往前找 <nav 或 <div class="nav
  const cands = [h.lastIndexOf('<nav', navPos), h.lastIndexOf('<div class="nav', navPos), h.lastIndexOf('<aside', navPos)];
  const start = Math.max(...cands);
  console.log('\n=== 导航元素 ===');
  console.log('  起点候选:', cands.join(', '), '→ 采用', start);
  if (start > 0) {
    // 求配对结束
    const tag = h.slice(start).match(/^<(\w+)/)[1];
    const openRe = new RegExp('<' + tag + '\\b', 'g');
    const closeRe = new RegExp('</' + tag + '>', 'g');
    const toks = [];
    openRe.lastIndex = start; let m;
    while ((m = openRe.exec(h))) { toks.push({ t: 1, i: m.index }); }
    closeRe.lastIndex = start;
    while ((m = closeRe.exec(h))) { toks.push({ t: -1, i: m.index, e: m.index + tag.length + 3 }); }
    toks.sort((a, b) => a.i - b.i);
    let d = 0, end = -1;
    for (const tk of toks) { d += tk.t; if (d === 0) { end = tk.e; break; } }
    console.log('  标签:', tag, ' 范围:', start, '→', end);
    if (end > 0) console.log('  内容预览:', JSON.stringify(h.slice(start, Math.min(end, start + 300))));
  }
}
