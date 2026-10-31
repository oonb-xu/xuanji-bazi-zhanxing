// ① 把 .tg/.sys/.layers 三个类从查表页内联样式搬进 web/style.css
// ② 把 4 个板块（各体系独有优势/庙旺的维度差异/一图四层/四系统共同骨架）插入关于页「方法论」与「59.58」之间
import fs from 'node:fs';

/* ── ① CSS ── */
const g = fs.readFileSync('web/glossary.html', 'utf8');
const styleM = g.match(/<style>([\s\S]*?)<\/style>/);
if (!styleM) { console.error('❌ 查表页无内联样式'); process.exit(1); }
const gcss = styleM[1];

function grabRule(css, sel) {
  // 匹配 .sel { ... } 或 .sel{...}（允许前置逗号组合选择器）
  const re = new RegExp('(^|\\n)\\s*([^{}\\n]*\\b' + sel + '\\b[^{}]*)\\{([^}]*)\\}', 'm');
  const m = css.match(re);
  return m ? m[0].trim() : null;
}
const needed = ['.tg', '.sys', '.layers'];
const rules = [];
for (const sel of needed) {
  const r = grabRule(gcss, sel.replace('.', ''));
  if (r) rules.push(r); else console.warn('⚠️ 未取到规则', sel);
}
console.log('取到 CSS 规则:', rules.length, '条');
rules.forEach((r) => console.log('  ' + r.replace(/\s+/g, ' ').slice(0, 110)));

let scss = fs.readFileSync('web/style.css', 'utf8');
let added = 0;
const block = '\n\n/* ── 从查表页迁入：紫微/占星体系分组标签与分层列表 ── */\n' + rules.join('\n') + '\n';
if (!scss.includes('.layers')) { scss += block; added = rules.length; }
fs.writeFileSync('web/style.css', scss, 'utf8');
console.log('style.css 已更新，新增', added, '条规则，大小', scss.length);

/* ── ② 插入 4 板块 ── */
const dump = JSON.parse(fs.readFileSync('tools/_dump.json', 'utf8'));
const order = ['各体系独有优势', '庙旺的维度差异', '一图四层', '四系统共同骨架'];
const blocks = order.map((k) => {
  if (!dump.blocks?.[k]) { console.error('❌ 缺板块:', k); process.exit(1); }
  return dump.blocks[k];
});
console.log('\n待插入 4 板块，共', blocks.join('').length, '字符');

const P = 'web/index.html';
const h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak7', h, 'utf8');

const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
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
const iS = so + SEC.length, iE = secEnd(h, iS);

/* 找「方法论」卡片 */
const mPos = h.indexOf('id="sec-method"', iS);
if (mPos < 0) { console.error('❌ 找不到方法论'); process.exit(1); }
const mCard = h.lastIndexOf('<div class="card"', mPos);
const mEnd = divEnd(h, mCard);
console.log('方法论卡片 [' + mCard + '→' + mEnd + ']');

/* 找「59.58」卡片（作为插入点后的下一块，用于校验顺序） */
const ePos = h.indexOf('id="sec-59-58"', iS);
const eCard = h.lastIndexOf('<div class="card"', ePos);
console.log('59.58 卡片 @' + eCard);
if (!(mEnd <= eCard)) { console.error('❌ 方法论与59.58位置异常'); process.exit(1); }

const ins = '\n\n      ' + blocks.join('\n\n      ') + '\n';
const out = h.slice(0, mEnd) + ins + h.slice(mEnd);

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['strong', /<strong>/g, /<\/strong>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g],
  ['th', /<th\b/g, /<\/th>/g], ['ul', /<ul\b/g, /<\/ul>/g], ['li', /<li\b/g, /<\/li>/g], ['p', /<p\b/g, /<\/p>/g]]) {
  const ok = c(out, o) === c(out, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(out, o)}/${c(out, cl)} ${ok ? '✅' : '❌'}`);
}

/* 位置校验：方法论 < 各体系独有优势 < 庙旺 < 一图四层 < 四系统共同骨架 < 59.58 */
const s2 = out.indexOf(SEC), e2 = secEnd(out, s2 + SEC.length);
const in2 = out.slice(s2 + SEC.length, e2);
const seq = ['id="sec-method"', '各体系独有优势', '庙旺的维度差异', '一图四层', '四系统共同骨架', 'id="sec-59-58"'];
let last = -1, ordOk = true;
console.log('\n=== 顺序 ===');
for (const k of seq) {
  const p = in2.indexOf(k);
  const ok = p > last;
  if (!ok) ordOk = false;
  console.log(`  ${ok ? '✅' : '❌'} ${k.padEnd(22)} @${p}`);
  last = p;
}
if (!ordOk) bad++;

/* #app 包含 */
const app = out.indexOf('<div id="app"');
const at = out.indexOf('>', app) + 1;
const r2 = /<div\b|<\/div>/g; r2.lastIndex = at;
let dd = 1, mm, appEnd = -1;
while ((mm = r2.exec(out))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { appEnd = mm.index; break; } }
const okAll = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => { const p = out.indexOf('data-page="' + k + '"'); return p > app && p < appEnd; });
console.log('\n  #app 包含其余页面 ' + (okAll ? '✅' : '❌'));
if (!okAll) bad++;

/* 旧内容不许丢 */
const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'id="sec-credits"', 'id="sec-conflict"',
  'id="sec-experiment"', '隐私承诺', '主流 API', 'tyme4ts', '最后'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('  原有内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : '✅ 齐全'));
if (lost.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入 index.html（4 板块已插入方法论与59.58之间）');
console.log('\n=== 关于页 h2 顺序 ===');
[...in2.matchAll(/<h2[^>]*>([^<]{0,26})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1].trim()));
