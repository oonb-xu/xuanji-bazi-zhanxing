// 微调：把 about 开标签移到「关于」页标题之前（紧跟 stage-hero 之后）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const SEC_OPEN = '<section class="page" data-page="about">';
const op = h.indexOf(SEC_OPEN);
if (op < 0) { console.error('❌ 找不到开标签'); process.exit(1); }

/* 「关于」页标题位置 */
const TITLE = '<h2 class="page-title">关于';
const tp = h.indexOf(TITLE);
if (tp < 0) { console.error('❌ 找不到页标题'); process.exit(1); }
console.log('开标签 @' + op + '，页标题 @' + tp);
if (tp > op) { console.log('  ℹ️ 标题已在开标签之后'); }

/* stage-hero 的结束位置 */
const heroEnd = h.indexOf('</section>') + '</section>'.length;
console.log('stage-hero 结束 @' + heroEnd);

/* 目标插入点：stage-hero 之后、标题之前（取标题处） */
const insertAt = Math.min(tp, op);

/* 删除旧开标签 */
let out = h.slice(0, op) + h.slice(op + SEC_OPEN.length);
/* 在目标处插入 */
const ia = out.indexOf(TITLE);
const ia2 = ia >= 0 ? ia : Math.min(insertAt, out.length);
out = out.slice(0, ia2) + SEC_OPEN + '\n    ' + out.slice(ia2);

console.log('已把开标签移到 @' + ia2);

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
if (c(out, /<section\b/g) !== c(out, /<\/section>/g) || c(out, /<div\b/g) !== c(out, /<\/div>/g)) {
  console.error('❌ 不平衡，拒绝'); process.exit(1);
}

/* 重算 about 范围并核对全部内容 */
const secs = [];
const re = /<section\b[^>]*>|<\/section>/g;
let m, st = [];
while ((m = re.exec(out))) {
  if (m[0] === '</section>') { const s = st.pop(); if (s) secs.push({ open: s.pos, close: m.index, tag: s.tag }); }
  else st.push({ pos: m.index, tag: m[0] });
}
const about = secs.find((s) => /data-page="about"/.test(s.tag));
const inner = out.slice(about.open, about.close);
console.log('\nabout 范围: [' + about.open + ' → ' + about.close + ']，inner ' + inner.length + ' 字符');
console.log('inner div: ' + c(inner, /<div\b/g) + '/' + c(inner, /<\/div>/g));

const MARKS = [['这是什么', '这是什么'], ['精度声明', '想要精确度'], ['API', 'id="sec-howto"'],
  ['这不是拼贴', 'id="sec-not-collage"'], ['导航', 'id="about-toc"'], ['方法论', 'id="sec-method"'],
  ['59.58', 'id="sec-59-58"'], ['冲突', 'id="sec-conflict"'], ['实验', 'id="sec-experiment"'], ['署名', 'id="sec-credits"']];
console.log('\n=== 内容归属 ===');
let bad = 0;
for (const [n, k] of MARKS) {
  const p = out.indexOf(k);
  const ok = p >= about.open && p <= about.close;
  if (!ok) { bad++; console.log('  ❌ ' + n + ' @' + p); }
  else console.log('  ✅ ' + n.padEnd(10) + ' @' + p);
}
if (bad || c(inner, /<div\b/g) !== c(inner, /<\/div>/g)) { console.error('\n❌ 仍有问题，拒绝写盘'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');
console.log('\n=== 最终顺序 ===');
[...inner.matchAll(/<h2[^>]*>([^<]{0,36})/g)].forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x[1].trim()));
