import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const i = h.indexOf('id="sec-59-58"');
if (i < 0) { console.error('❌ 无 sec-59-58'); process.exit(1); }
const s = h.lastIndexOf('<div class="card"', i);
const re = /<div\b|<\/div>/g; re.lastIndex = s;
let d = 0, m, e = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { e = m.index + 6; break; } }
const seg = h.slice(s, e);
console.log('59.58 卡片 [' + s + '→' + e + ']  ' + seg.length + ' 字符');
console.log('\n=== 子标题 ===');
for (const m2 of seg.matchAll(/<h[34][^>]*>([^<]{0,60})/g)) console.log('  ' + m2[1].trim());
console.log('\n=== 结尾 500 字符 ===');
console.log(JSON.stringify(seg.slice(-500)));
