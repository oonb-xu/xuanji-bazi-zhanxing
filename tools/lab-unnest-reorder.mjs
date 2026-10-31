// 实验工作台：在 web-lab/index.html 上做「解嵌套 + 重排」，验证通过才回写线上
// 核心手法：在每个板块边界处插入 </div><div class="card"> 成对标签
//   → div 总数不变（仍平衡），但每个板块被"切"成独立卡片
//   → 只在该位置 depth≥1（确实还有未闭合卡片）时才插，避免产生负深度
import fs from 'node:fs';

const SRC = 'web/index.html';
const LAB = 'web-lab/index.html';
fs.mkdirSync('web-lab', { recursive: true });
let h = fs.readFileSync(SRC, 'utf8');
fs.writeFileSync(LAB, h, 'utf8');
console.log('工作台已建立:', LAB, h.length, '字符');

const SEC_OPEN = '<section class="page" data-page="about">';
const so = h.indexOf(SEC_OPEN);
if (so < 0) { console.error('❌ 无 about'); process.exit(1); }

function sectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const innerStart = so + SEC_OPEN.length;
const closePos = sectionEnd(h, innerStart);

/* 板块锚点（按 id / 文本），目标顺序也用这些 key */
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

/* 每个锚点取其所在「卡片起点」或「锚点自身」作为板块起始 */
function blockStartOf(s, key) {
  const p = s.indexOf(key);
  if (p < 0) return -1;
  const c = s.lastIndexOf('<div class="card', p);
  return (c >= innerStart && c < p) ? c : p;
}

let starts = [];
for (const [name, key] of ANCH) {
  const p = blockStartOf(h, key);
  if (p < 0) { console.error('❌ 找不到锚点:', name, key); process.exit(1); }
  starts.push({ name, pos: p });
}
starts.sort((a, b) => a.pos - b.pos);
console.log('\n=== 板块起始（按位置）===');
starts.forEach((x) => console.log('  ' + x.name.padEnd(11) + ' @' + x.pos));

/* 计算每个起始位置的 div 深度 */
function depthAt(s, from, to) {
  const seg = s.slice(from, to);
  const o = (seg.match(/<div\b/g) || []).length;
  const c = (seg.match(/<\/div>/g) || []).length;
  return o - c;
}
console.log('\n=== 各板块处的 div 深度（>0 说明被外层卡片吞着）===');
const withDepth = starts.map((x) => {
  const d = depthAt(h, innerStart, x.pos);
  console.log('  ' + x.name.padEnd(11) + ' depth=' + d + (d > 0 ? '  ← 需解嵌套' : d < 0 ? '  ⚠️ 负深度!' : '  (顶层)'));
  return { ...x, depth: d };
});
if (withDepth.some((x) => x.depth < 0)) { console.error('❌ 存在负深度，结构异常，中止'); process.exit(1); }

/* ── 解嵌套：从后往前在每个 depth≥1 的板块起点插入 </div><div class="card"> ── */
let work = h;
const inserts = withDepth.filter((x) => x.depth > 0).sort((a, b) => b.pos - a.pos);
for (const x of inserts) {
  const ins = '\n      </div>\n      <div class="card">\n      ';
  work = work.slice(0, x.pos) + ins + work.slice(x.pos);
}
console.log('\n已插入解嵌套断点:', inserts.length, '处（' + inserts.map((x) => x.name).join(',') + '）');

const c = (s, re) => (s.match(re) || []).length;
console.log('解嵌套后 div: ' + c(work, /<div\b/g) + '/' + c(work, /<\/div>/g) + '  section: ' + c(work, /<section\b/g) + '/' + c(work, /<\/section>/g));
if (c(work, /<div\b/g) !== c(work, /<\/div>/g)) { console.error('❌ div 不平衡，中止'); process.exit(1); }

/* ── 重排：重新求锚点位置后按目标顺序切片 ── */
const so2 = work.indexOf(SEC_OPEN);
const innerStart2 = so2 + SEC_OPEN.length;
const closePos2 = sectionEnd(work, innerStart2);

const starts2 = ANCH.map(([name, key]) => {
  let p = work.indexOf(key, innerStart2);
  if (p < 0) return null;
  const cs = work.lastIndexOf('<div class="card', p);
  return { name, pos: (cs > innerStart2 && cs < p) ? cs : p };
}).filter(Boolean).sort((a, b) => a.pos - b.pos);

console.log('\n=== 解嵌套后板块起始 ===');
starts2.forEach((x) => console.log('  ' + x.name.padEnd(11) + ' @' + x.pos));

/* 切片 */
const segs = {};
const prefix = work.slice(innerStart2, starts2[0].pos);
for (let i = 0; i < starts2.length; i++) {
  const end = i + 1 < starts2.length ? starts2[i + 1].pos : closePos2;
  segs[starts2[i].name] = work.slice(starts2[i].pos, end);
}
const suffix = '';

const TARGET = ['privacy', 'what', 'api', 'notCollage', 'method', 'e5958', 'conflict', 'exp', 'credits'];
const miss = TARGET.filter((k) => !segs[k]);
if (miss.length) { console.error('❌ 缺板块:', miss.join(','), '—— 中止'); process.exit(1); }

const newInner = prefix + TARGET.map((k) => segs[k]).join('') + suffix;
const out = work.slice(0, innerStart2) + newInner + work.slice(closePos2);

/* ── 全量校验 ── */
console.log('\n=== 校验 ===');
let bad = 0;
for (const [n, re1, re2] of [
  ['section', /<section\b/g, /<\/section>/g], ['div', /<div\b/g, /<\/div>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g],
]) {
  const ok = c(out, re1) === c(out, re2);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(8)} ${c(out, re1)}/${c(out, re2)} ${ok ? '✅' : '❌'}`);
}
const so3 = out.indexOf(SEC_OPEN);
const cp3 = sectionEnd(out, so3 + SEC_OPEN.length);
const in3 = out.slice(so3 + SEC_OPEN.length, cp3);
const io = c(in3, /<div\b/g), ic = c(in3, /<\/div>/g);
console.log(`  about 内 div ${io}/${ic} ${io === ic ? '✅' : '❌'}`);
if (io !== ic) bad++;

/* 顺序校验 */
const ORD = [['隐私', '隐私承诺'], ['这是什么', 'id="sec-what-is-this"'], ['怎么用', 'id="sec-howto"'],
  ['这不是拼贴', 'id="sec-not-collage"'], ['方法论', 'id="sec-method"'], ['59.58', 'id="sec-59-58"'],
  ['冲突', 'id="sec-conflict"'], ['实验', 'id="sec-experiment"'], ['署名', 'id="sec-credits"']];
let last = -1, ordOk = true;
console.log('\n=== 顺序 ===');
for (const [label, key] of ORD) {
  const p = in3.indexOf(key);
  const ok = p > last;
  if (!ok) ordOk = false;
  console.log(`  ${ok ? '✅' : '❌'} ${label.padEnd(10)} @${p}`);
  last = p;
}
if (!ordOk) bad++;

/* 内容齐全 */
const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"', '隐私承诺', '主流 API'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('  内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : '✅ 12 项齐全'));
if (lost.length) bad++;

console.log(`  长度 ${h.length} → ${out.length}（差 ${out.length - h.length}）`);

if (bad) { console.error('\n❌ 校验未过，不写工作台文件'); process.exit(1); }

fs.writeFileSync(LAB, out, 'utf8');
console.log('\n✅ 工作台已写入', LAB);
console.log('\n=== 工作台新顺序 ===');
[...in3.matchAll(/<(h2|h3)[^>]*>([^<]{0,30})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + ' ' + x[2].trim()));
