import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const ti = h.indexOf('id="about-toc"');
const re = /<div\b|<\/div>/g; re.lastIndex = ti;
let d = 0, m, end = -1;
const start = h.lastIndexOf('<div', ti);
re.lastIndex = start;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { end = m.index + 6; break; } }
const toc = h.slice(start, end);
const items = [...toc.matchAll(/<a href="#([^"]+)"[^>]*><b>(\d+)<\/b><span>([^<]*)<\/span><i>([^<]*)<\/i><\/a>/g)];
console.log('导航共 ' + items.length + ' 项：');
for (const it of items) console.log('  ' + String(it[2]).padStart(2) + '. #' + it[1].padEnd(18) + ' ' + it[3] + ' · ' + it[4]);

/* 新章节位置与顺序检查 */
const pDev = h.indexOf('id="sec-develop"');
const pCre = h.indexOf('id="sec-credits"');
const pLic = h.indexOf('id="sec-license"');
console.log('\n顺序: sec-develop @' + pDev + ' → sec-credits @' + pCre + ' → sec-license @' + pLic);
console.log('  位置正确: ' + (pDev > 0 && pDev < pCre && pCre < pLic ? '✅' : '❌'));

/* 新章节子标题 */
const seg = h.slice(pDev, pCre);
console.log('\n新章节子标题:');
for (const mm of seg.matchAll(/<h3[^>]*>([\s\S]{0,60}?)<\/h3>/g)) console.log('  · ' + mm[1].replace(/<[^>]+>/g, '').trim());
console.log('  表格数: ' + (seg.match(/<table class="holo-tb"/g) || []).length + '  字数: ' + seg.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length);

/* 矛盾修正核对 */
console.log('\n矛盾修正核对:');
for (const [label, pat] of [['旧·原理上不可推', '原理上不可推'], ['旧·原理不可推', '原理不可推'], ['旧·原理上无法推出', '原理上无法推出'], ['新·也能推但路径不同', '年柱日柱也能推，但路径不同'], ['新·逆星历转一道', '逆星历']]) {
  const n = (h.split(pat).length - 1);
  console.log('  ' + label.padEnd(18) + ' 出现 ' + n + ' 次' + (label.startsWith('旧') ? (n === 0 ? ' ✅已清除' : ' ⚠️仍有残留') : ''));
}
