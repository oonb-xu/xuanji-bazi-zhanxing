// 定位真正损坏处：section 标签被切断、标签被当文字渲染
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');

const c = (re) => (h.match(re) || []).length;
console.log('=== 标签计数 ===');
for (const [n, o, cl] of [
  ['div', /<div\b/g, /<\/div>/g],
  ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g],
  ['h3', /<h3\b/g, /<\/h3>/g],
  ['table', /<table\b/g, /<\/table>/g],
  ['tr', /<tr\b/g, /<\/tr>/g],
  ['td', /<td\b/g, /<\/td>/g],
  ['span', /<span\b/g, /<\/span>/g],
  ['b', /<b\b/g, /<\/b>/g],
  ['strong', /<strong>/g, /<\/strong>/g],
  ['p', /<p\b/g, /<\/p>/g],
]) console.log(`  ${n.padEnd(8)} ${String(c(o)).padStart(4)}/${String(c(cl)).padStart(4)} ${c(o) === c(cl) ? '✅' : '❌'}`);

/* 找异常：出现 "xxxx">  这种文字化属性 */
console.log('\n=== 疑似文字化标签（属性后跟 > 且前面没有 <） ===');
const susp = [];
const re = /([a-zA-Z-]+="[^"]*">)/g;
let m;
while ((m = re.exec(h))) {
  const before = h[m.index - 1];
  if (before !== '<' && before !== '/' && before !== ' ') {
    susp.push({ pos: m.index, txt: h.slice(Math.max(0, m.index - 60), m.index + 40) });
  }
}
console.log('  可疑处:', susp.length);
susp.slice(0, 6).forEach((s) => console.log('   @' + s.pos + ': ' + JSON.stringify(s.txt)));

/* 找 <section 数量与 data-page */
console.log('\n=== section / data-page ===');
const secs = [...h.matchAll(/<section\b[^>]*>/g)].map((x) => x[0].slice(0, 90));
secs.forEach((s, i) => console.log('  ' + (i + 1) + '. ' + s));
console.log('  </section> 数:', (h.match(/<\/section>/g) || []).length);

/* 关键：找 "与数据来源" 附近 */
const k = h.indexOf('与数据来源');
if (k > 0) {
  console.log('\n=== 「与数据来源」附近原始 HTML ===');
  console.log(JSON.stringify(h.slice(Math.max(0, k - 400), k + 200)));
}
