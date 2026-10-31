// 把 about 开标签再前移，包住「关于」页标题
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const SEC_OPEN = '<section class="page" data-page="about">';
const op = h.indexOf(SEC_OPEN);
const TITLE = '<h2 class="page-title">关于';
const tp = h.indexOf(TITLE);
console.log('开标签 @' + op + '  标题 @' + tp);
if (tp < 0) { console.error('❌ 无标题'); process.exit(1); }
if (tp >= op) { console.log('✅ 标题已在 section 内，无需处理'); process.exit(0); }

// 删旧开标签，在标题前插入
let out = h.slice(0, op) + h.slice(op + SEC_OPEN.length);
const tp2 = out.indexOf(TITLE);
out = out.slice(0, tp2) + SEC_OPEN + '\n    ' + out.slice(tp2);

const c = (s, re) => (s.match(re) || []).length;
if (c(out, /<section\b/g) !== c(out, /<\/section>/g) || c(out, /<div\b/g) !== c(out, /<\/div>/g)) {
  console.error('❌ 不平衡，拒绝'); process.exit(1);
}

/* 重算并核对 */
const secs = [];
const re = /<section\b[^>]*>|<\/section>/g;
let m, st = [];
while ((m = re.exec(out))) {
  if (m[0] === '</section>') { const s = st.pop(); if (s) secs.push({ open: s.pos, close: m.index, tag: s.tag }); }
  else st.push({ pos: m.index, tag: m[0] });
}
const about = secs.find((s) => /data-page="about"/.test(s.tag));
const inner = out.slice(about.open, about.close);
console.log('新 about 范围: [' + about.open + ' → ' + about.close + ']');
console.log('inner div: ' + c(inner, /<div\b/g) + '/' + c(inner, /<\/div>/g));
if (c(inner, /<div\b/g) !== c(inner, /<\/div>/g)) { console.error('❌ inner 不平衡'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('✅ 已写入');

/* 完整顺序（h2 + h3 前 20 个） */
console.log('\n=== about 内标题顺序 ===');
const heads = [...inner.matchAll(/<(h2|h3)[^>]*>([^<]{0,36})/g)];
heads.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x[1] + '  ' + x[2].trim()));
