import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const i = h.indexOf('id="about-toc"');
if (i < 0) { console.log('❌ 无 about-toc'); process.exit(0); }
const start = h.lastIndexOf('<div', i);
const re = /<div\b|<\/div>/g; re.lastIndex = start;
let d = 0, m, end = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { end = m.index + 6; break; } }
const toc = h.slice(start, end);
console.log('=== about-toc 全长 ' + toc.length + ' ===');
console.log(toc);
console.log('\n=== TOC 里的跳转目标 ===');
for (const m2 of toc.matchAll(/href="#([^"]+)"/g)) console.log('  #' + m2[1]);
console.log('\n=== 新增 4 块是否有 id ===');
for (const k of ['各体系独有优势', '庙旺的维度差异', '一图四层', '四系统共同骨架']) {
  const p = h.indexOf(k);
  const seg = h.slice(Math.max(0, p - 200), p);
  const idm = [...seg.matchAll(/id="([^"]+)"/g)].map((x) => x[1]);
  console.log('  ' + k.padEnd(10) + ' 前 200 字符内的 id: ' + (idm.length ? idm.slice(-2).join(',') : '(无)'));
}
