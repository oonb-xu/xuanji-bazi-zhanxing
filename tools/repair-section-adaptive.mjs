// 自适应修复：先看 about 与 fusion 之间是否已有 </section>，再决定加不加
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const ABOUT_OPEN = 'data-page="about">';
const BROKEN = '<section class="page active"';
const TAIL = 'data-page="fusion">';

const ap = h.indexOf(ABOUT_OPEN);
const bp = h.indexOf(BROKEN);
const tp = h.indexOf(TAIL);
if (ap < 0 || bp < 0 || tp < 0) { console.error('❌ 标记找不到'); process.exit(1); }

// about 开标签之后、损坏开标签之前的 </section> 数量
const between = h.slice(ap, bp);
const closesBetween = (between.match(/<\/section>/g) || []).length;
console.log('about 开标签 → 损坏开标签 之间的 </section>:', closesBetween);

// 损坏开标签 → fusion 尾巴之间的 </section>
const mid = h.slice(bp, tp);
const closesMid = (mid.match(/<\/section>/g) || []).length;
console.log('损坏开标签 → fusion 尾巴 之间的 </section>:', closesMid);

/* 判定：about 是否已闭合 */
const aboutAlreadyClosed = closesBetween > 0;
console.log('about 已闭合?', aboutAlreadyClosed ? '是' : '否');

/* ① 删掉损坏开标签 */
let out = h.slice(0, bp) + h.slice(bp + BROKEN.length).replace(/^\s*/, '\n      ');

/* ② 在尾巴前重建 */
const tp2 = out.indexOf(TAIL);
if (tp2 < 0) { console.error('❌ 删除后找不到尾巴'); process.exit(1); }
const NEW_OPEN = '<section class="page active" ' + TAIL;
const REPAIR = aboutAlreadyClosed
  ? '\n\n    <!-- 融合 -->\n    ' + NEW_OPEN
  : '</section>\n\n    <!-- 融合 -->\n    ' + NEW_OPEN;
out = out.slice(0, tp2) + REPAIR + out.slice(tp2 + TAIL.length);
console.log('已重建 fusion 开标签（' + (aboutAlreadyClosed ? '不加 </section>' : '补 </section>') + '）');

/* ③ 若仍多，则在 fusion 之前找一个多余 </section> 删掉 */
const c = (s, re) => (s.match(re) || []).length;
let so = c(out, /<section\b/g), sc = c(out, /<\/section>/g);
console.log(`\nsection ${so}/${sc}`);
if (sc > so) {
  // 找 `</section>` 紧跟空行或下一个 <section 前的重复
  const dup = out.match(/<\/section>(\s*)<\/section>/);
  if (dup) { out = out.replace(/<\/section>(\s*)<\/section>/, '</section>$1'); console.log('已合并重复 </section>'); }
  so = c(out, /<section\b/g); sc = c(out, /<\/section>/g);
  console.log(`合并后 section ${so}/${sc}`);
}

/* ④ 安全闸 */
const dO = c(out, /<div\b/g), dC = c(out, /<\/div>/g);
console.log(`div ${dO}/${dC} ${dO === dC ? '✅' : '❌'}`);
if (so !== sc || dO !== dC) { console.error('\n❌ 仍不平衡，拒绝写盘'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');

/* ⑤ 最终结构验证 */
const hh = fs.readFileSync(P, 'utf8');
console.log('\n=== 最终 section 结构 ===');
const reS = /<section\b[^>]*>|<\/section>/g;
let m, depth = 0, i = 0;
while ((m = reS.exec(hh))) {
  if (m[0] === '</section>') { depth--; console.log('  '.repeat(Math.max(0, depth)) + '  └ </section>  →depth=' + depth); }
  else { console.log('  '.repeat(Math.max(0, depth)) + '  ├ ' + m[0].slice(0, 70)); depth++; }
  i++;
}
console.log('\n最终 section depth:', depth, depth === 0 ? '✅' : '❌');

/* ⑥ 裸露属性检查 */
const leak = [...hh.matchAll(/(?:^|>)\s*(data-page="[^"]*">)/g)].length;
console.log('裸露 data-page:', leak, leak === 0 ? '✅' : '❌');
process.exit(depth === 0 && leak === 0 ? 0 : 1);
