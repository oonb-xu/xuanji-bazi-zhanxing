// 关于页重排：一次完成、只写盘一次
// 方法：把 section 内「顶层子块」切出来 → 按标签分类 → 重排 → 拼回
// 关键安全点：块边界用 div 配对求，绝不用 indexOf(属性串) 当边界
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

/* ① 求 about section 的完整范围（用真实标签 + 配对） */
const SEC_OPEN_RE = /<section class="page" data-page="about">/;
const mo = h.match(SEC_OPEN_RE);
if (!mo) { console.error('❌ 找不到 about section 开标签'); process.exit(1); }
const secStart = mo.index;
const innerStart = secStart + mo[0].length;

function matchDivEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}
function matchSectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;   // 已在 section 内
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const secEnd = matchSectionEnd(h, innerStart);   // 指向 </section> 的起始
if (secEnd < 0) { console.error('❌ 求 about section 结束失败'); process.exit(1); }
const inner = h.slice(innerStart, secEnd);
console.log('about inner 长度:', inner.length);

/* ② 切顶层子块 */
function topChunks(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s.startsWith('<div', i)) {
      const e = matchDivEnd(s, i);
      if (e < 0) { console.error('❌ 子块 div 配对失败 @' + i); process.exit(1); }
      out.push(s.slice(i, e)); i = e;
    } else if (s.startsWith('<!--', i)) {
      const e = s.indexOf('-->', i); out.push(s.slice(i, e + 3)); i = e + 3;
    } else {
      // 裸 h2 / h3 / 文本：收到下一个 <div 或 <!--
      let next = s.length;
      for (const k of ['<div', '<!--']) { const p = s.indexOf(k, i + 1); if (p > 0 && p < next) next = p; }
      out.push(s.slice(i, next)); i = next;
    }
  }
  return out;
}

const chunks = topChunks(inner);
console.log('顶层子块数:', chunks.length);

/* ③ 分类 */
function tag(c) {
  if (/id="sec-howto"|想要精确度|id="api-pay-notice"|主流 API 怎么拿|Key 怎么用/.test(c)) return 'api';
  if (/id="about-toc"/.test(c)) return 'toc';
  if (/这是什么|sec-what-is-this/.test(c)) return 'what';
  if (/id="sec-not-collage"/.test(c)) return 'notCollage';
  if (/privacy-card|隐私承诺/.test(c)) return 'privacy';
  if (/id="sec-method"/.test(c)) return 'method';
  if (/id="sec-conflict"/.test(c)) return 'conflict';
  if (/id="sec-credits"/.test(c)) return 'credits';
  if (/id="sec-59-58"/.test(c)) return 'exp5958';
  if (/id="sec-experiment"/.test(c)) return 'exp60';
  if (/class="page-title"/.test(c)) return 'title';
  if (!c.trim()) return 'blank';
  return 'other';
}
const tagged = chunks.map((c) => ({ c, t: tag(c) }));
console.log('\n子块分类:');
tagged.forEach((x, i) => console.log('  ' + (i + 1) + '. [' + x.t + '] ' + x.c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 46)));

/* ④ 目标顺序 */
const ORDER = ['title', 'what', 'api', 'toc', 'notCollage', 'privacy', 'method', 'conflict', 'credits', 'exp5958', 'exp60', 'other', 'blank'];
const buckets = {};
tagged.forEach((x) => { (buckets[x.t] = buckets[x.t] || []).push(x.c); });

const missing = ORDER.filter((k) => k !== 'blank' && !buckets[k]).filter((k) => k !== 'other');
if (missing.length) console.log('\n⚠️ 缺这些块:', missing.join(', '));

const rebuiltInner = ORDER.flatMap((k) => buckets[k] || []).join('\n\n      ');

/* ⑤ 安全闸：块数必须守恒 */
const newChunks = topChunks(rebuiltInner);
console.log('\n重排后子块数:', newChunks.length, newChunks.length === chunks.length ? '✅' : '❌');
const needBlocks = ['title', 'what', 'api', 'notCollage', 'privacy', 'method', 'conflict', 'credits', 'exp5958', 'exp60'];
const lost = needBlocks.filter((k) => (buckets[k] || []).length === 0);
if (lost.length) { console.error('❌ 丢失块:', lost.join(','), '—— 拒绝写盘'); process.exit(1); }
if (newChunks.length !== chunks.length) { console.error('❌ 块数不守恒，拒绝写盘'); process.exit(1); }

let out = h.slice(0, innerStart) + '\n\n      ' + rebuiltInner + '\n    ' + h.slice(secEnd);

/* ⑥ 重排导航索引顺序（按目标顺序重编号） */
const tocRe = /<a href="#(sec-[\w-]+)" class="toc-i[^"]*"><b>\d+<\/b>[\s\S]*?<\/a>/g;
const tocItems = [...(buckets.toc && buckets.toc[0] || '').matchAll(tocRe)];
if (tocItems.length) {
  const map = { 'sec-what-is-this': 1, 'sec-howto': 2, 'sec-not-collage': 3, 'sec-method': 4, 'sec-conflict': 5, 'sec-credits': 6, 'sec-59-58': 7, 'sec-experiment': 8 };
  const sorted = [...tocItems].sort((a, b) => (map[a[1]] || 99) - (map[b[1]] || 99));
  let n = 0;
  const rebuiltToc = sorted.map((m) => m[0].replace(/(<b>)\d+(<\/b>)/, (_, p1, p2) => { n++; return p1 + n + p2; })).join('\n          ');
  out = out.replace(tocItems.map((m) => m[0]).join(''), rebuiltToc);
  console.log('导航已重排（' + n + ' 项）');
}

/* ⑦ 最终校验 */
const c = (s, re) => (s.match(re) || []).length;
const so = c(out, /<section\b/g), sc = c(out, /<\/section>/g);
const dO = c(out, /<div\b/g), dC = c(out, /<\/div>/g);
const h2o = c(out, /<h2\b/g), h2c = c(out, /<\/h2>/g);
console.log(`\nsection ${so}/${sc}  div ${dO}/${dC}  h2 ${h2o}/${h2c}`);
if (so !== sc || dO !== dC || h2o !== h2c) { console.error('❌ 标签不平衡，拒绝写盘'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入（只写了一次）');

/* ⑧ 输出新顺序 */
const hh = fs.readFileSync(P, 'utf8');
const i2 = hh.indexOf('data-page="about"');
const seg2 = hh.slice(i2, hh.indexOf('data-page="fusion"', i2));
console.log('\n=== 新顺序 ===');
[...seg2.matchAll(/<h2[^>]*>([^<]{0,32})/g)].forEach((m, i) => console.log('  ' + (i + 1) + '. ' + m[1].trim()));
