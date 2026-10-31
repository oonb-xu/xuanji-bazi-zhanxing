// 用户思路：不"移动"，而是把 inner 按标题切成片段后重新排列再拼回
// 原理：对整体做「分片 + 置换」⇒ 标签总数必然守恒，且切片永远不重叠（按标题位置切，不管 div 嵌套）
import fs from 'node:fs';
const P = 'web/index.html';
const orig = fs.readFileSync(P, 'utf8');
fs.writeFileSync('web/index.html.bak3', orig, 'utf8');
let h = orig;

const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
if (so < 0) { console.error('❌ 无 about'); process.exit(1); }
function secEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const iStart = so + SEC.length;
const iEnd = secEnd(h, iStart);
const inner = h.slice(iStart, iEnd);
console.log('about inner:', inner.length, '字符');

/* 锚点：按标题在 inner 中的位置切段（含 h2 与特定 h3） */
const MARKERS = [
  ['title', '<h2 class="page-title">'],
  ['notCollage', 'id="sec-not-collage"'],
  ['privacy', 'privacy-card'],
  ['method', 'id="sec-method"'],
  ['e5958', 'id="sec-59-58"'],
  ['conflict', 'id="sec-conflict"'],
  ['exp', 'id="sec-experiment"'],
  ['credits', 'id="sec-credits"'],
  ['howto', 'id="sec-howto"'],
  ['apiMain', '主流 API 怎么拿'],
  ['apiKey', 'Key 怎么用'],
  ['what', 'id="sec-what-is-this"'],
];

/* 每个锚点取其「所在行的起点」：往前找最近的 '<' 使其成为一个标签/块的开始 */
function tagStartOf(s, key) {
  let p = s.indexOf(key);
  if (p < 0) return -1;
  // privacy-card 在 div 里 → 取该 div 起点
  const lt = s.lastIndexOf('<', p);
  return lt >= 0 ? lt : p;
}
const marks = MARKERS.map(([n, k]) => ({ name: n, pos: tagStartOf(inner, k) })).filter((x) => x.pos >= 0);
marks.sort((a, b) => a.pos - b.pos);
console.log('\n=== 切段点 ===');
marks.forEach((m) => console.log('  ' + m.name.padEnd(11) + ' @' + m.pos));

/* 若两个锚点位置相同（如 howto 与其前面的精度声明同卡），合并 */
for (let i = 1; i < marks.length; i++) {
  if (marks[i].pos <= marks[i - 1].pos) { console.error('❌ 锚点重叠:', marks[i - 1].name, marks[i].name); process.exit(1); }
}

/* 切段：从第 1 个锚点到末尾 */
const firstMark = marks[0].pos;
const prefix = inner.slice(0, firstMark);      // 标题之前的杂项
const segs = {};
for (let i = 0; i < marks.length; i++) {
  const s = marks[i].pos;
  const e = i + 1 < marks.length ? marks[i + 1].pos : inner.length;
  segs[marks[i].name] = inner.slice(s, e);
}
console.log('\n=== 段长度 ===');
Object.entries(segs).forEach(([k, v]) => console.log('  ' + k.padEnd(11) + v.length));

/* 目标顺序 */
const TARGET = ['title', 'privacy', 'what', 'howto', 'apiMain', 'apiKey',
  'notCollage', 'method', 'e5958', 'conflict', 'exp', 'credits'];
const miss = TARGET.filter((k) => !segs[k]);
if (miss.length) { console.error('❌ 缺段:', miss.join(','), '（实际有:', Object.keys(segs).join(','), '）'); process.exit(1); }
const extra = Object.keys(segs).filter((k) => !TARGET.includes(k));
if (extra.length) console.warn('⚠️ 未放入目标的段:', extra.join(','), '（将被附加到末尾）');

const newInner = prefix + TARGET.map((k) => segs[k]).join('') + extra.map((k) => segs[k]).join('');
const out = h.slice(0, iStart) + newInner + h.slice(iEnd);

/* 校验：置换必然守恒，这里验证确实守恒 + 内容齐全 + 顺序 */
const c = (s, re) => (s.match(re) || []).length;
console.log('\n=== 标签守恒 ===');
let bad = 0;
for (const [n, r1, r2] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['span', /<span\b/g, /<\/span>/g]]) {
  const a = c(orig, r1), b = c(out, r1), a2 = c(orig, r2), b2 = c(out, r2);
  const ok = b === b2 && a === a2;
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} 开 ${a}→${b}  关 ${a2}→${b2}  ${ok ? '✅' : '❌'}`);
}
console.log(`  长度 ${orig.length} → ${out.length}（差 ${out.length - orig.length}，应为 0）`);
if (out.length !== orig.length) bad++;

const so2 = out.indexOf(SEC);
const ie2 = secEnd(out, so2 + SEC.length);
const in2 = out.slice(so2 + SEC.length, ie2);
const ORD = [['隐私', '隐私承诺'], ['这是什么', '这是什么'], ['怎么用', 'id="sec-howto"'],
  ['主流API', '主流 API 怎么拿'], ['Key', 'Key 怎么用'], ['这不是拼贴', '这不是拼贴'],
  ['方法论', 'id="sec-method"'], ['59.58', 'id="sec-59-58"'], ['冲突', 'id="sec-conflict"'],
  ['实验', 'id="sec-experiment"'], ['署名', 'id="sec-credits"']];
let last = -1, ordOk = true;
console.log('\n=== 顺序 ===');
for (const [label, key] of ORD) {
  const p = in2.indexOf(key);
  const ok = p > last;
  if (!ok) ordOk = false;
  console.log(`  ${ok ? '✅' : '❌'} ${label.padEnd(10)} @${p}`);
  last = p;
}
if (!ordOk) bad++;

const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"',
  '隐私承诺', '主流 API', '这是什么', '最后'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('  内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : `✅ ${NEED.length} 项齐全`));
if (lost.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');
console.log('\n=== 新顺序 ===');
[...in2.matchAll(/<(h2|h3)[^>]*>([^<]{0,28})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + ' ' + x[2].trim()));
