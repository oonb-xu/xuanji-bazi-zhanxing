// ① 修最后一处绝对化表述：「60 甲子是"计数"，星盘里没有编码它的量」
// ② 修结构：把「关于」标题从卡片里拿出来；消掉嵌套的 card>card
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
let changed = [];

/* ══════════ ① 表述修正 ══════════ */
const OLD_CLAIMS = [
  /60\s*甲子是[""']?计数[""']?\s*[，,]\s*星盘里没有编码它的量/g,
  /60\s*甲子是[""']?计数[""']?/g,
];
const NEW_CLAIM = '年柱/日柱是**计数**（「60」本身有天文学近似依据，但它是计数、不是可测的几何量）';
for (const re of OLD_CLAIMS) {
  if (re.test(h)) {
    h = h.replace(re, NEW_CLAIM.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'));
    changed.push('表述「60甲子是计数」');
    break;
  }
}

/* ══════════ ② 把 page-title 从卡片里拿出来 ══════════ */
// 形态：<div class="card">\n <h2 class="page-title">…</h2>\n</div>
const titleWrapped = h.match(/<div class="card">\s*(<h2 class="page-title"[\s\S]*?<\/h2>)\s*<\/div>/);
if (titleWrapped) {
  h = h.replace(titleWrapped[0], titleWrapped[1]);
  changed.push('标题脱离卡片');
}

/* ══════════ ③ 消掉 card > card 嵌套（隐私卡） ══════════ */
// 形态：<div class="card">…<div class="card prose privacy-card">…</div>…</div>
// 若外层卡里只有一个内层卡 + 少量文本，则把外层去掉
const before = h.length;
for (let guard = 0; guard < 3; guard++) {
  const m = h.match(/<div class="card">(\s*<div class="card[^"]*"[^>]*>[\s\S]*?<\/div>\s*)<\/div>/);
  if (!m) break;
  h = h.replace(m[0], m[1].trim());
}
if (h.length !== before) changed.push('消嵌套卡片');

/* ══════════ ④ 安全闸 ══════════ */
const c = (re) => (h.match(re) || []).length;
const d = [c(/<div\b/g), c(/<\/div>/g)];
console.log(`div ${d[0]}/${d[1]} ${d[0] === d[1] ? '✅' : '❌'}`);
if (d[0] !== d[1]) { console.error('❌ 不平衡，拒绝写盘'); process.exit(1); }

fs.writeFileSync(P, h, 'utf8');
console.log('改动:', changed.length ? changed.join(' / ') : '无');

/* ══════════ ⑤ 结构复检 ══════════ */
const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
const seg = h.slice(a0, a1);
const re2 = /<div\b([^>]*)>|<\/div>|<(h2|h3)([^>]*)>([^<]{0,40})/g;
let depth = 0; const stack = []; let m2;
const rows = [];
while ((m2 = re2.exec(seg))) {
  if (m2[0].startsWith('</div>')) { stack.pop(); depth--; }
  else if (m2[0].startsWith('<div')) { depth++; stack.push((m2[1].match(/class="([^"]*)"/) || [, ''])[1]); }
  else if (m2[2]) {
    rows.push({ d: depth, t: (m2[4] || '').trim(), inCard: stack.some((x) => /\bcard\b/.test(x)), nest: stack.filter((x) => /\bcard\b/.test(x)).length });
  }
}
console.log('\n=== 结构复检 ===');
rows.forEach((r) => console.log(`  depth=${r.d} nest=${r.nest} ${r.inCard ? 'card✅' : '裸  '} ${r.t.slice(0, 26)}`));
const bare = rows.filter((r) => r.d === 0 && !r.inCard && r.t && !/关于/.test(r.t));
const overNest = rows.filter((r) => r.nest > 1);
console.log('\n  裸区块:', bare.length, bare.length ? '❌ ' + bare.map((x) => x.t.slice(0, 10)).join(',') : '✅');
console.log('  过度嵌套:', overNest.length, overNest.length ? '❌' : '✅');
console.log('  最终 depth:', depth, depth === 0 ? '✅' : '❌');
process.exit(bare.length || overNest.length || depth !== 0 ? 1 : 0);
