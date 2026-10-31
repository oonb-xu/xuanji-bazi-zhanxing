import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');

/* 所有 section 的起止范围 */
const secs = [];
const re = /<section\b[^>]*>|<\/section>/g;
let m, stack = [];
while ((m = re.exec(h))) {
  if (m[0] === '</section>') {
    const s = stack.pop();
    if (s) secs.push({ open: s.pos, close: m.index, tag: s.tag });
  } else {
    stack.push({ pos: m.index, tag: m[0] });
  }
}
secs.sort((a, b) => a.open - b.open);
console.log('=== section 范围 ===');
secs.forEach((s, i) => {
  const name = (s.tag.match(/data-page="([^"]*)"/) || [, s.tag.slice(0, 40)])[1];
  console.log(`  ${i + 1}. ${name}  [${s.open} → ${s.close}]`);
});

/* 关键标记归属 */
const MARKS = [
  ['这是什么', '这是什么'],
  ['精度声明', '想要精确度'],
  ['API 说明', 'id="sec-howto"'],
  ['这不是拼贴', 'id="sec-not-collage"'],
  ['隐私承诺', '隐私承诺'],
  ['方法论', 'id="sec-method"'],
  ['59.58', 'id="sec-59-58"'],
  ['体系冲突', 'id="sec-conflict"'],
  ['实验性板块', 'id="sec-experiment"'],
  ['开源署名', 'id="sec-credits"'],
  ['导航索引', 'id="about-toc"'],
];
console.log('\n=== 关键内容归属 ===');
for (const [name, key] of MARKS) {
  const p = h.indexOf(key);
  if (p < 0) { console.log('  ❌ ' + name + ' 不存在'); continue; }
  const owner = secs.find((s) => p >= s.open && p <= s.close);
  const ownerName = owner ? (owner.tag.match(/data-page="([^"]*)"/) || [, owner.tag.slice(0, 36)])[1] : '(不在任何 section 内!)';
  console.log('  ' + name.padEnd(12) + ' @' + String(p).padStart(6) + '  →  ' + ownerName);
}

/* 未被任何 section 覆盖的片段 */
console.log('\n=== 不在任何 section 内的区域 ===');
let covered = new Array(h.length).fill(false);
secs.forEach((s) => { for (let i = s.open; i < s.close; i++) covered[i] = true; });
let i = 0, gaps = [];
while (i < h.length) {
  if (!covered[i]) { let j = i; while (j < h.length && !covered[j]) j++; if (j - i > 200) gaps.push([i, j]); i = j; }
  else i++;
}
gaps.forEach(([a, b]) => {
  const t = h.slice(a, b).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`  [${a}→${b}] ${b - a} 字符: ${t.slice(0, 90)}`);
});
