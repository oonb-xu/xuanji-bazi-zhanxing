// 终极修复：about 的 <section> 开/闭标签位置放错了
// 开标签在「这是什么」卡片中间，闭标签在 API 区之后 —— 导致 18763 字符关于内容裸在 body 里
// 修法：开标签前移到「这是什么」卡之前，闭标签后移到 fusion section 之前
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const SEC_OPEN = '<section class="page" data-page="about">';
const op = h.indexOf(SEC_OPEN);
if (op < 0) { console.error('❌ 找不到 about 开标签'); process.exit(1); }

/* 找「这是什么」卡片起点 */
const WHAT = '<div class="card" id="sec-what-is-this"';
const wp = h.indexOf(WHAT);
if (wp < 0) { console.error('❌ 找不到 sec-what-is-this 卡片'); process.exit(1); }
console.log('about 开标签 @' + op + '，这是什么卡 @' + wp);
if (wp > op) console.log('  ⚠️ 卡片在开标签之后，无需前移');
else console.log('  需要把开标签前移到卡片之前');

/* 找 about 的闭标签（第一个 </section> 在 op 之后） */
const cp = h.indexOf('</section>', op);
if (cp < 0) { console.error('❌ 找不到 about 闭标签'); process.exit(1); }
console.log('about 闭标签 @' + cp);

/* 找 fusion section 起点（真正的边界） */
const FUSION = '<section class="page active" data-page="fusion">';
const fp = h.indexOf(FUSION);
if (fp < 0) { console.error('❌ 找不到 fusion section'); process.exit(1); }
console.log('fusion section @' + fp);

/* 确认闭标签在 fusion 之前，中间就是漏出的内容 */
console.log('漏出内容长度:', fp - cp, '字符');

/* ── 执行搬移（从后往前操作，避免偏移） ── */
// ① 在 fusion 前插入 </section>
let out = h.slice(0, fp) + '  </section>\n\n    ' + h.slice(fp);
// ② 删除原来的 </section>（位置在 cp，仍有效因为 fp > cp）
out = out.slice(0, cp) + out.slice(cp + '</section>'.length);
// ③ 删除原开标签，前插到卡片之前
const op2 = out.indexOf(SEC_OPEN);
const wp2 = out.indexOf(WHAT);
out = out.slice(0, op2) + out.slice(op2 + SEC_OPEN.length);
const wp3 = out.indexOf(WHAT);
out = out.slice(0, wp3) + SEC_OPEN + '\n\n      ' + out.slice(wp3);

console.log('\n已搬移开/闭标签');

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
const so = c(out, /<section\b/g), sc = c(out, /<\/section>/g);
const dO = c(out, /<div\b/g), dC = c(out, /<\/div>/g);
const h2o = c(out, /<h2\b/g), h2c = c(out, /<\/h2>/g);
console.log(`section ${so}/${sc}  div ${dO}/${dC}  h2 ${h2o}/${h2c}`);
if (so !== sc || dO !== dC || h2o !== h2c) { console.error('❌ 不平衡，拒绝写盘'); process.exit(1); }

/* 重新算 about 范围，确认所有内容都在里面 */
const secs = [];
const re = /<section\b[^>]*>|<\/section>/g;
let m, st = [];
while ((m = re.exec(out))) {
  if (m[0] === '</section>') { const s = st.pop(); if (s) secs.push({ open: s.pos, close: m.index, tag: s.tag }); }
  else st.push({ pos: m.index, tag: m[0] });
}
const about = secs.find((s) => /data-page="about"/.test(s.tag));
console.log('\n新 about 范围: [' + about.open + ' → ' + about.close + ']');

const MARKS = [['这是什么', 'id="sec-what-is-this"'], ['精度声明', '想要精确度'], ['API', 'id="sec-howto"'],
  ['这不是拼贴', 'id="sec-not-collage"'], ['导航', 'id="about-toc"'], ['方法论', 'id="sec-method"'],
  ['59.58', 'id="sec-59-58"'], ['冲突', 'id="sec-conflict"'], ['实验', 'id="sec-experiment"'], ['署名', 'id="sec-credits"']];
console.log('\n=== 内容归属 ===');
let bad = 0;
for (const [n, k] of MARKS) {
  const p = out.indexOf(k);
  const ok = p >= about.open && p <= about.close;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + n.padEnd(10) + ' @' + p);
}

/* 确认 about 内 div 平衡 */
const inner = out.slice(about.open, about.close);
const io = c(inner, /<div\b/g), ic = c(inner, /<\/div>/g);
console.log('\nabout inner div:', io + '/' + ic, io === ic ? '✅' : '❌');
if (bad || io !== ic) { console.error('❌ 仍有问题，拒绝写盘'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');

/* 最终顺序 */
const hh = fs.readFileSync(P, 'utf8');
const a2 = hh.match(/<section class="page" data-page="about">/);
const st2 = a2.index + a2[0].length;
const r2 = /<section\b|<\/section>/g; r2.lastIndex = st2;
let d2 = 1, mm, en2 = -1;
while ((mm = r2.exec(hh))) { d2 += mm[0] === '</section>' ? -1 : 1; if (d2 === 0) { en2 = mm.index; break; } }
const seg = hh.slice(st2, en2);
console.log('\n=== 最终顺序 ===');
[...seg.matchAll(/<h2[^>]*>([^<]{0,34})/g)].forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x[1].trim()));
