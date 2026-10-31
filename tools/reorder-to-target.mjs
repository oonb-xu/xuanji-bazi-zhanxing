// 关于页重排到用户指定顺序（一次完成，带备份与自动回滚）
// 目标：关于 → 隐私声明 → 这是什么 → 怎么用API(+精度声明/主流/Key) → 这不是拼贴 → 方法论 → 实验性模块(59.58/冲突/实验) → 开源项目引用
import fs from 'node:fs';
const P = 'web/index.html';
const BAK = 'web/index.html.before-reorder';

const orig = fs.readFileSync(P, 'utf8');
fs.writeFileSync(BAK, orig, 'utf8');
console.log('已备份 →', BAK, orig.length, '字符');
let h = orig;

const SEC_OPEN = '<section class="page" data-page="about">';
const so = h.indexOf(SEC_OPEN);
if (so < 0) { console.error('❌ 无 about'); process.exit(1); }

function sectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const closePos = sectionEnd(h, so + SEC_OPEN.length);
const innerStart = so + SEC_OPEN.length;

function matchDivEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
function cardStartOf(s, idStr) {
  const p = s.indexOf(idStr);
  if (p < 0) return -1;
  const c = s.lastIndexOf('<div class="card', p);
  return c >= 0 ? c : -1;
}

/* 锚点（按 id 唯一识别） */
const ANCH = [
  ['privacy', null],                       // 隐私卡用 class 找
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
for (const [name, idStr] of ANCH) {
  let cs;
  if (name === 'privacy') {
    const p = h.indexOf('privacy-card');
    if (p < 0) { console.error('❌ 找不到隐私卡'); process.exit(1); }
    cs = h.lastIndexOf('<div class="card', p);
  } else {
    cs = cardStartOf(h, idStr);
  }
  if (cs < 0 || cs < innerStart || cs > closePos) { console.error('❌ 锚点不在 about 内:', name, cs); process.exit(1); }
  const ce = matchDivEnd(h, cs);
  if (ce < 0 || ce > closePos) { console.error('❌ 求块结束失败:', name, ce); process.exit(1); }
  blocks.push({ name, cs, ce, html: h.slice(cs, ce) });
}
blocks.sort((a, b) => a.cs - b.cs);
console.log('\n=== 当前块（按位置）===');
blocks.forEach((b) => console.log('  ' + b.name.padEnd(11) + ' [' + b.cs + '→' + b.ce + '] ' + (b.ce - b.cs) + ' 字符'));

/* 重叠检查 */
for (let i = 1; i < blocks.length; i++) {
  if (blocks[i].cs < blocks[i - 1].ce) {
    console.error('❌ 块重叠:', blocks[i - 1].name, '↔', blocks[i].name, '—— 中止');
    process.exit(1);
  }
}

/* 目标顺序 */
const TARGET = ['privacy', 'what', 'api', 'notCollage', 'method', 'e5958', 'conflict', 'exp', 'credits'];
const byName = {};
blocks.forEach((b) => { byName[b.name] = b; });
const missing = TARGET.filter((k) => !byName[k]);
if (missing.length) { console.error('❌ 缺块:', missing.join(','), '—— 中止'); process.exit(1); }

/* 重组：前缀(关于标题…) + 目标块 + 块之间的空隙也保留(按原序拼接空隙) */
const gaps = [];
for (let i = 0; i < blocks.length; i++) {
  const prevEnd = i === 0 ? innerStart : blocks[i - 1].ce;
  gaps.push(h.slice(prevEnd, blocks[i].cs));
}
const suffixStart = blocks[blocks.length - 1].ce;

let newInner = '';
for (let i = 0; i < TARGET.length; i++) {
  newInner += (i === 0 ? (h.slice(innerStart, blocks[0].cs)) : gaps[i] || '\n\n      ');
  newInner += byName[TARGET[i]].html;
}
newInner += h.slice(suffixStart, closePos);

const out = h.slice(0, innerStart) + newInner + h.slice(closePos);

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
let bad = [];
console.log('\n=== 校验 ===');
const chk = [['section', /<section\b/g, /<\/section>/g], ['div', /<div\b/g, /<\/div>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['table', /<table\b/g, /<\/table>/g]];
for (const [n, o, cl] of chk) {
  const ok = c(out, o) === c(out, cl);
  if (!ok) bad.push(n);
  console.log(`  ${n} ${c(out, o)}/${c(out, cl)} ${ok ? '✅' : '❌'}`);
}
/* 顺序校验 */
const so2 = out.indexOf(SEC_OPEN);
const cp2 = sectionEnd(out, so2 + SEC_OPEN.length);
const in2 = out.slice(so2 + SEC_OPEN.length, cp2);
const ORDER_KEYS = [
  ['隐私承诺', '隐私承诺'],
  ['这是什么', 'id="sec-what-is-this"'],
  ['怎么用·API', 'id="sec-howto"'],
  ['这不是拼贴', 'id="sec-not-collage"'],
  ['方法论', 'id="sec-method"'],
  ['59.58', 'id="sec-59-58"'],
  ['体系冲突', 'id="sec-conflict"'],
  ['实验性板块', 'id="sec-experiment"'],
  ['开源署名', 'id="sec-credits"'],
];
let last = -1, orderOk = true;
console.log('\n=== 顺序 ===');
for (const [label, key] of ORDER_KEYS) {
  const p = in2.indexOf(key);
  const ok = p > last;
  if (!ok) orderOk = false;
  console.log(`  ${ok ? '✅' : '❌'} ${label.padEnd(10)} @${p}`);
  last = p;
}
if (!orderOk) bad.push('顺序');
/* 内容与 div 平衡 */
const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"', '隐私承诺'];
const lost = NEED.filter((k) => !out.includes(k));
if (lost.length) { bad.push('内容'); console.log('  ❌ 丢失:', lost.join(',')); }
else console.log('  ✅ 内容齐全（11 项）');
const io = c(in2, /<div\b/g), ic = c(in2, /<\/div>/g);
console.log(`  about 内 div ${io}/${ic} ${io === ic ? '✅' : '❌'}`);
if (io !== ic) bad.push('inner-div');

/* 长度守恒 */
console.log(`  长度 ${orig.length} → ${out.length}（差 ${out.length - orig.length}）`);

if (bad.length) {
  console.error('\n❌ 校验未过:', bad.join(','), '—— 不写盘（原文件未动）');
  process.exit(1);
}

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');
console.log('\n=== 新顺序 ===');
[...in2.matchAll(/<(h2|h3)[^>]*>([^<]{0,30})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + ' ' + x[2].trim()));
