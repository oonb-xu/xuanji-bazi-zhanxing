// 把「本页导航」(#about-toc) 提到关于页最前面（紧跟「关于」标题卡之后）
import fs from 'node:fs';
const P = 'web/index.html';
const h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak6', h, 'utf8');

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

/* 定位 TOC 卡片 */
const tocPos = h.indexOf('<div class="card" id="about-toc"', iS);
if (tocPos < 0 || tocPos > iE) { console.error('❌ 找不到 about-toc 卡片'); process.exit(1); }
const tocEnd = divEnd(h, tocPos);
if (tocEnd < 0 || tocEnd > iE) { console.error('❌ TOC 卡片未闭合'); process.exit(1); }
const tocHtml = h.slice(tocPos, tocEnd);
console.log('TOC 卡片 [' + tocPos + '→' + tocEnd + '] ' + tocHtml.length + ' 字符');
console.log('预览:', JSON.stringify(tocHtml.replace(/\s+/g, ' ').slice(0, 120)));

/* 删除原位置 */
let out = h.slice(0, tocPos) + h.slice(tocEnd);

/* 找「关于」标题卡片结束位置，插在其后 */
const iS2 = out.indexOf(SEC) + SEC.length;
const firstCard = out.indexOf('<div class="card"', iS2);
if (firstCard < 0) { console.error('❌ 找不到首卡'); process.exit(1); }
const firstEnd = divEnd(out, firstCard);
console.log('首卡（关于标题）[' + firstCard + '→' + firstEnd + ']');
out = out.slice(0, firstEnd) + '\n\n      ' + tocHtml + out.slice(firstEnd);

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['li', /<li\b/g, /<\/li>/g], ['p', /<p\b/g, /<\/p>/g]]) {
  const ok = c(out, o) === c(out, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(out, o)}/${c(out, cl)} ${ok ? '✅' : '❌'}`);
}
const s3 = out.indexOf(SEC), e3 = secEnd(out, s3 + SEC.length);
const in3 = out.slice(s3 + SEC.length, e3);
const pToc = in3.indexOf('id="about-toc"'), pPriv = in3.indexOf('隐私承诺'), pWhat = in3.indexOf('id="sec-what-is-this"');
console.log('\n=== 位置 ===');
console.log(`  TOC @${pToc}  隐私 @${pPriv}  这是什么 @${pWhat}`);
const okPos = pToc >= 0 && pToc < pPriv && pPriv < pWhat;
if (!okPos) bad++;
console.log(`  ${okPos ? '✅' : '❌'} TOC 在最前（在隐私承诺之前）`);
console.log('  TOC 出现次数: ' + c(in3, /id="about-toc"/g) + '（应为 1）');
if (c(in3, /id="about-toc"/g) !== 1) bad++;
const tocItems = c(in3, /class="toc-i"/g);
console.log('  TOC 条目数: ' + tocItems);

const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"',
  '隐私承诺', '主流 API', 'tyme4ts', '最后', '本页导航'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('  内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : `✅ ${NEED.length} 项齐全`));
if (lost.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入（本页导航已提到最前）');
