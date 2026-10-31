// 只还原「关于页顺序」：把「这是什么组」与「API 组」挪回末尾
// 做法：按三个锚点求卡片起点，切成 4 段后按新顺序拼回（纯位置切片，不做深度解析）
// 安全闸：切片非重叠 + 四段总长守恒 + div/section 平衡，任一不满足则中止不写盘
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const SEC_OPEN = '<section class="page" data-page="about">';
const so = h.indexOf(SEC_OPEN);
if (so < 0) { console.error('❌ 无 about section'); process.exit(1); }
const aboutStart = so;

function sectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const aboutEnd = sectionEnd(h, so + SEC_OPEN.length) + '</section>'.length;  // 含闭标签

/* 三个锚点 → 卡片起点 */
function cardStartOf(html, idStr) {
  const p = html.indexOf(idStr);
  if (p < 0) return -1;
  const c = html.lastIndexOf('<div class="card', p);
  return c >= 0 ? c : p;
}
const pWhat = cardStartOf(h, 'id="sec-what-is-this"');
const pApi = cardStartOf(h, 'id="sec-howto"');
const pNot = cardStartOf(h, 'id="sec-not-collage"');

console.log('锚点:');
console.log('  这是什么卡 @' + pWhat);
console.log('  API 卡      @' + pApi);
console.log('  这不是拼贴卡 @' + pNot);
console.log('  about 范围  [' + aboutStart + ' → ' + aboutEnd + ']');

if (pWhat < 0 || pApi < 0 || pNot < 0) { console.error('❌ 锚点缺失'); process.exit(1); }
if (!(aboutStart <= pWhat && pWhat < pApi && pApi <= pNot && pNot <= aboutEnd)) {
  console.error('❌ 顺序不符合预期（应为 这是什么 < API < 这不是拼贴）—— 中止，不改文件');
  process.exit(1);
}

/* 四段切片 */
const seg1 = h.slice(0, pWhat);            // 含 section 开标签 + 页标题 + 前面的一切
const segWhat = h.slice(pWhat, pApi);      // 这是什么组
const segApi = h.slice(pApi, pNot);        // API 组
const segRest = h.slice(pNot);             // 这不是拼贴 → 文末

/* 校验长度守恒 */
const total = seg1.length + segWhat.length + segApi.length + segRest.length;
if (total !== h.length) { console.error('❌ 切片长度不守恒'); process.exit(1); }
console.log('\n段长度: seg1=' + seg1.length + ' what=' + segWhat.length + ' api=' + segApi.length + ' rest=' + segRest.length);

/* 新顺序：标题 → 其余(这不是拼贴…署名) → API → 这是什么 */
const out = seg1 + segRest + '\n\n      ' + segApi.trim() + '\n\n      ' + segWhat.trim() + '\n';

/* 安全闸 */
const c = (s, re) => (s.match(re) || []).length;
const so2 = c(out, /<section\b/g), sc2 = c(out, /<\/section>/g);
const dO = c(out, /<div\b/g), dC = c(out, /<\/div>/g);
const h2o = c(out, /<h2\b/g), h2c = c(out, /<\/h2>/g);
const h3o = c(out, /<h3\b/g), h3c = c(out, /<\/h3>/g);
console.log(`\nsection ${so2}/${sc2}  div ${dO}/${dC}  h2 ${h2o}/${h2c}  h3 ${h3o}/${h3c}`);
if (so2 !== sc2 || dO !== dC || h2o !== h2c || h3o !== h3c) {
  console.error('❌ 标签不平衡 —— 中止，不写盘');
  process.exit(1);
}

/* 内容不丢失校验 */
const NEED = ['这是什么', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"'];
const lost = NEED.filter((k) => !out.includes(k));
if (lost.length) { console.error('❌ 丢失内容:', lost.join(','), '—— 中止'); process.exit(1); }

fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入（顺序已还原）');

/* 打印新顺序 */
const hh = fs.readFileSync(P, 'utf8');
const a2 = hh.indexOf(SEC_OPEN);
const e2 = sectionEnd(hh, a2 + SEC_OPEN.length);
const inner = hh.slice(a2 + SEC_OPEN.length, e2);
console.log('\n=== 还原后的顺序 ===');
[...inner.matchAll(/<(h2|h3)[^>]*>([^<]{0,34})/g)].forEach((x, i) => {
  console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + '  ' + x[2].trim());
});
