// 从 dist 恢复 → 用正确切片重做顺序还原
// 正确切法：segRest 必须只到 about 的 </section>，文档其余部分单独保留在最后
import fs from 'node:fs';
const P = 'web/index.html';
const GOOD = 'dist/web/index.html';

if (!fs.existsSync(GOOD)) { console.error('❌ 无 dist 备份'); process.exit(1); }
let h = fs.readFileSync(GOOD, 'utf8');
console.log('从 dist 恢复:', h.length, '字符');
fs.writeFileSync(P, h, 'utf8');

const SEC_OPEN = '<section class="page" data-page="about">';
const so = h.indexOf(SEC_OPEN);
if (so < 0) { console.error('❌ 无 about'); process.exit(1); }

function sectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const closePos = sectionEnd(h, so + SEC_OPEN.length);   // </section> 起点
const afterSection = closePos + '</section>'.length;    // about 结束后的位置
console.log('about 范围 [' + so + ' → ' + afterSection + ']');

function cardStartOf(html, idStr) {
  const p = html.indexOf(idStr);
  if (p < 0) return -1;
  const c = html.lastIndexOf('<div class="card', p);
  return c >= 0 ? c : p;
}
const pWhat = cardStartOf(h, 'id="sec-what-is-this"');
const pApi = cardStartOf(h, 'id="sec-howto"');
const pNot = cardStartOf(h, 'id="sec-not-collage"');
console.log('这是什么 @' + pWhat + '  API @' + pApi + '  这不是拼贴 @' + pNot);

if (!(so <= pWhat && pWhat < pApi && pApi <= pNot && pNot < closePos)) {
  console.error('❌ 锚点顺序异常，中止'); process.exit(1);
}

/* 五段切片 */
const s1 = h.slice(0, pWhat);                 // 文档头 + section 开标签 + 页标题
const sWhat = h.slice(pWhat, pApi);           // 这是什么组
const sApi = h.slice(pApi, pNot);             // API 组
const sRest = h.slice(pNot, closePos);        // 这不是拼贴 … 开源署名（不含 </section>）
const sAfter = h.slice(closePos);             // 从 </section> 开始的整个文档尾

const sum = s1.length + sWhat.length + sApi.length + sRest.length + sAfter.length;
if (sum !== h.length) { console.error('❌ 长度不守恒'); process.exit(1); }
console.log('段: s1=' + s1.length + ' what=' + sWhat.length + ' api=' + sApi.length + ' rest=' + sRest.length + ' tail=' + sAfter.length);

/* 新顺序：标题 → (这不是拼贴…署名) → API → 这是什么 → </section></main>… */
const out = s1 + sRest + '\n\n      ' + sApi.trim() + '\n\n      ' + sWhat.trim() + '\n    ' + sAfter;

const c = (s, re) => (s.match(re) || []).length;
const chk = [
  ['section', c(out, /<section\b/g), c(out, /<\/section>/g)],
  ['div', c(out, /<div\b/g), c(out, /<\/div>/g)],
  ['h2', c(out, /<h2\b/g), c(out, /<\/h2>/g)],
  ['h3', c(out, /<h3\b/g), c(out, /<\/h3>/g)],
];
let bad = 0;
console.log('\n=== 标签校验 ===');
for (const [n, o, cl] of chk) { if (o !== cl) bad++; console.log(`  ${n} ${o}/${cl} ${o === cl ? '✅' : '❌'}`); }

/* 内容不丢 + 必须在 about 段内 */
const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"'];
const lost = NEED.filter((k) => !out.includes(k));
if (lost.length) { bad++; console.log('  ❌ 丢失:', lost.join(',')); }

/* 新 section 范围，确认全部内容都在里面 */
const so2 = out.indexOf(SEC_OPEN);
const ce2 = sectionEnd(out, so2 + SEC_OPEN.length);
const in2 = out.slice(so2 + SEC_OPEN.length, ce2);
const outside = NEED.filter((k) => { const p = out.indexOf(k); return p < so2 || p > ce2; });
if (outside.length) { bad++; console.log('  ❌ 在 section 外:', outside.join(',')); }
else console.log('  ✅ 全部内容在 about section 内');
console.log('  about 内 div: ' + c(in2, /<div\b/g) + '/' + c(in2, /<\/div>/g));
if (c(in2, /<div\b/g) !== c(in2, /<\/div>/g)) bad++;

if (bad) { console.error('\n❌ 校验未过 —— 不写盘'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入');

console.log('\n=== 还原后的顺序 ===');
[...in2.matchAll(/<(h2|h3)[^>]*>([^<]{0,34})/g)].forEach((x, i) => {
  console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + '  ' + x[2].trim());
});
