// 精确修复：把被切开的 fusion section 标签还原
// 现状：...关于内容...<section class="page active"  [关于内容继续]  data-page="fusion">...
// 目标：...关于内容...</section>  <section class="page active" data-page="fusion">...
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const BROKEN_OPEN = '<section class="page active"';
const TAIL = 'data-page="fusion">';

const bp = h.indexOf(BROKEN_OPEN);
const tp = h.indexOf(TAIL);
if (bp < 0 || tp < 0) { console.error('❌ 未找到损坏标记'); process.exit(1); }
if (tp < bp) { console.error('❌ 位置异常（tail 在 open 之前）'); process.exit(1); }
console.log('损坏开标签 @' + bp + '，属性尾巴 @' + tp);

/* ① 删掉提前出现的开标签（连同其后空白） */
let h2text = h.slice(0, bp) + h.slice(bp + BROKEN_OPEN.length).replace(/^\s*/, '\n      ');
console.log('已删除提前的 <section class="page active"');

/* ② 在属性尾巴前补上 </section> 与正确的开标签 */
const tp2 = h2text.indexOf(TAIL);
if (tp2 < 0) { console.error('❌ 删除后找不到尾巴'); process.exit(1); }
const REPAIR = '</section>\n\n    <!-- 融合 -->\n    <section class="page active" ' + TAIL;
h2text = h2text.slice(0, tp2) + REPAIR + h2text.slice(tp2 + TAIL.length);
console.log('已在尾巴前补上 </section> 与正确开标签');

/* ③ 检查是否多了一个 </section>（原来的） */
const c = (s, re) => (s.match(re) || []).length;
console.log('\n=== 修复后计数 ===');
const o = c(h2text, /<section\b/g), cl = c(h2text, /<\/section>/g);
console.log(`  section ${o}/${cl} ${o === cl ? '✅' : '❌'}`);
const dO = c(h2text, /<div\b/g), dC = c(h2text, /<\/div>/g);
console.log(`  div     ${dO}/${dC} ${dO === dC ? '✅' : '❌'}`);

/* ④ 列出所有 section 标签，检查是否都规整 */
console.log('\n=== 所有 section 开标签 ===');
[...h2text.matchAll(/<section\b[^>]*>/g)].forEach((m, i) => console.log('  ' + (i + 1) + '. ' + m[0]));

/* ⑤ 确认没有裸露的 data-page 文本 */
const leakRe = /(?:^|>)\s*(data-page="[^"]*">)/g;
const leaks = [...h2text.matchAll(leakRe)].filter((m) => !m[0].includes('<section'));
console.log('\n裸露 data-page 文本:', leaks.length, leaks.length ? '❌' : '✅');
leaks.slice(0, 3).forEach((m) => console.log('   ' + JSON.stringify(m[0].slice(-40))));

if (o !== cl || dO !== dC) { console.error('\n❌ 计数不平衡，拒绝写盘'); process.exit(1); }

fs.writeFileSync(P, h2text, 'utf8');
console.log('\n✅ 已写入');
