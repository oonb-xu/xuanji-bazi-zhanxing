// 结构已修好，现在安全做「实验性板块移到最后」
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const SEC_OPEN = '<section class="page" data-page="about">';
const op = h.indexOf(SEC_OPEN) + SEC_OPEN.length;

function matchDivEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
function findSectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const en = findSectionEnd(h, op);
let inner = h.slice(op, en);
console.log('inner:', inner.length, '字符, div', (inner.match(/<div\b/g) || []).length + '/' + (inner.match(/<\/div>/g) || []).length);

/* 切顶层子块 */
function topChunks(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s.startsWith('<div', i)) {
      const e = matchDivEnd(s, i);
      if (e < 0) { console.error('❌ 配对失败 @' + i); process.exit(1); }
      out.push(s.slice(i, e)); i = e;
    } else if (s.startsWith('<!--', i)) {
      const e = s.indexOf('-->', i); out.push(s.slice(i, e + 3)); i = e + 3;
    } else {
      let next = s.length;
      for (const k of ['<div', '<!--']) { const p = s.indexOf(k, i + 1); if (p > 0 && p < next) next = p; }
      out.push(s.slice(i, next)); i = next;
    }
  }
  return out;
}
const chunks = topChunks(inner);
console.log('顶层子块:', chunks.length);

/* 找含实验性板块的子块 */
function has(c, k) { return c.includes(k); }
const isExp = (c) => has(c, 'id="sec-59-58"') || has(c, 'id="sec-experiment"');
const expIdx = chunks.map((c, i) => isExp(c) ? i : -1).filter((i) => i >= 0);
console.log('实验性板块所在子块:', expIdx.join(','));
if (!expIdx.length) { console.error('❌ 未找到实验性板块（可能仍在嵌套卡内）'); 
  /* 退路：打印各子块摘要帮助定位 */
  chunks.forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)));
  process.exit(1); }

/* 取出实验性块，追加到末尾 */
const expChunks = expIdx.map((i) => chunks[i]);
const rest = chunks.filter((_, i) => !expIdx.includes(i));
const newInner = [...rest, ...expChunks].join('\n\n      ');

const after = topChunks(newInner);
console.log('重排后子块:', after.length, after.length === chunks.length ? '✅' : '❌');
if (after.length !== chunks.length) { console.error('❌ 块数不守恒'); process.exit(1); }

const out = h.slice(0, op) + '\n\n      ' + newInner + '\n    ' + h.slice(en);
const c = (s, re) => (s.match(re) || []).length;
if (c(out, /<section\b/g) !== c(out, /<\/section>/g) || c(out, /<div\b/g) !== c(out, /<\/div>/g)) {
  console.error('❌ 不平衡，拒绝'); process.exit(1);
}

fs.writeFileSync(P, out, 'utf8');
console.log('✅ 已写入');

/* 新顺序 */
const hh = fs.readFileSync(P, 'utf8');
const o2 = hh.indexOf(SEC_OPEN) + SEC_OPEN.length;
const e2 = findSectionEnd(hh, o2);
const in2 = hh.slice(o2, e2);
console.log('\n=== 新顺序 ===');
[...in2.matchAll(/<h2[^>]*>([^<]{0,36})/g)].forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x[1].trim()));
console.log('  (div ' + c(in2, /<div\b/g) + '/' + c(in2, /<\/div>/g) + ')');
