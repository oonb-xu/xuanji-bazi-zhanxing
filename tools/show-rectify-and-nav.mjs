import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/style.css', 'utf8');

console.log('=== .page 相关 CSS ===');
for (const m of css.matchAll(/[^{}\n]*\.page[^{}]*\{[^}]*\}/g)) {
  console.log('  ' + m[0].replace(/\s+/g, ' ').slice(0, 140));
}

console.log('\n=== 矫正 section 原文 ===');
const i = h.indexOf('data-page="rectify"');
const s = h.lastIndexOf('<section', i);
const re = /<section\b|<\/section>/g; re.lastIndex = s;
let d = 0, m, e = -1;
while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0 && m[0] === '</section>') { e = m.index + 10; break; } }
console.log(h.slice(s, Math.min(e, s + 1400)));

console.log('\n=== 导航 tabbar 原文 ===');
const tb = h.indexOf('<nav class="tabbar"');
console.log(h.slice(tb, tb + 1400));
