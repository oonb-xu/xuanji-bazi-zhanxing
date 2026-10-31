// 标签已平衡 → 在文件里按锚点切片重排（可靠且持久）
// 目标：关于 → 隐私 → 这是什么 → API组(怎么用/精度/主流/Key) → 这不是拼贴 → 方法论 → 59.58 → 冲突 → 实验 → 开源署名
import fs from 'node:fs';
const P = 'web/index.html';
const orig = fs.readFileSync(P, 'utf8');
fs.writeFileSync('web/index.html.bak2', orig, 'utf8');
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
function divEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
const innerStart = so + SEC.length;
const closePos = secEnd(h, innerStart);

/* 锚点 → 卡片起点 */
const ANCH = [
  ['privacy', 'privacy-card'],
  ['what', 'id="sec-what-is-this"'],
  ['api', 'id="sec-howto"'],
  ['notCollage', 'id="sec-not-collage"'],
  ['method', 'id="sec-method"'],
  ['e5958', 'id="sec-59-58"'],
  ['conflict', 'id="sec-conflict"'],
  ['exp', 'id="sec-experiment"'],
  ['credits', 'id="sec-credits"'],
];
const blocks = [];
for (const [name, key] of ANCH) {
  const p = h.indexOf(key);
  if (p < 0) { console.error('❌ 缺锚点', name); process.exit(1); }
  let cs = h.lastIndexOf('<div class="card', p);
  if (cs < innerStart || cs > p) cs = p;
  const ce = divEnd(h, cs);
  if (ce < 0) { console.error('❌ 卡片未闭合', name); process.exit(1); }
  blocks.push({ name, cs, ce });
}
blocks.sort((a, b) => a.cs - b.cs);
console.log('=== 块位置 ===');
blocks.forEach((b) => console.log('  ' + b.name.padEnd(11) + ' [' + b.cs + '→' + b.ce + '] ' + (b.ce - b.cs)));

/* 重叠检查 */
for (let i = 1; i < blocks.length; i++) {
  if (blocks[i].cs < blocks[i - 1].ce) {
    console.error('❌ 重叠:', blocks[i - 1].name, '↔', blocks[i].name);
    process.exit(1);
  }
}

/* 重组：前缀(关于标题) + 目标顺序块（中间保留原间隙） */
const TARGET = ['privacy', 'what', 'api', 'notCollage', 'method', 'e5958', 'conflict', 'exp', 'credits'];
const byName = {};
blocks.forEach((b) => { byName[b.name] = b; });
const miss = TARGET.filter((k) => !byName[k]);
if (miss.length) { console.error('❌ 缺块', miss.join(',')); process.exit(1); }

const prefix = h.slice(innerStart, blocks[0].cs);
const parts = TARGET.map((k) => h.slice(byName[k].cs, byName[k].ce));
const suffix = h.slice(blocks[blocks.length - 1].ce, closePos);
const newInner = prefix + parts.join('\n\n      ') + suffix;
const out = h.slice(0, innerStart) + newInner + h.slice(closePos);

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
console.log('\n=== 校验 ===');
let bad = 0;
for (const [n, r1, r2] of [['section', /<section\b/g, /<\/section>/g], ['div', /<div\b/g, /<\/div>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['strong', /<strong>/g, /<\/strong>/g], ['table', /<table\b/g, /<\/table>/g],
  ['tr', /<tr\b/g, /<\/tr>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g]]) {
  const ok = c(out, r1) === c(out, r2);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(out, r1)}/${c(out, r2)} ${ok ? '✅' : '❌'}`);
}
const so2 = out.indexOf(SEC);
const cp2 = secEnd(out, so2 + SEC.length);
const in2 = out.slice(so2 + SEC.length, cp2);
const io = c(in2, /<div\b/g), ic = c(in2, /<\/div>/g);
console.log(`  about内 div ${io}/${ic} ${io === ic ? '✅' : '❌'}`);
if (io !== ic) bad++;

const ORD = [['隐私', '隐私承诺'], ['这是什么', 'id="sec-what-is-this"'], ['怎么用', 'id="sec-howto"'],
  ['主流API', '主流 API 怎么拿'], ['Key', 'Key 怎么用'], ['这不是拼贴', 'id="sec-not-collage"'],
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
console.log(`  长度 ${orig.length} → ${out.length}（差 ${out.length - orig.length}）`);

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');
console.log('\n=== 新顺序 ===');
[...in2.matchAll(/<(h2|h3)[^>]*>([^<]{0,28})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + ' ' + x[2].trim()));
