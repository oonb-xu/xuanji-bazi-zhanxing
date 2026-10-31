import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const i = h.indexOf('id="sec-adv"');
if (i < 0) { console.error('❌ 无 sec-adv'); process.exit(1); }
const cardStart = h.lastIndexOf('<div class="card"', i);
const re = /<div\b|<\/div>/g; re.lastIndex = cardStart;
let d = 0, m, cardEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { cardEnd = m.index + 6; break; } }
const seg = h.slice(cardStart, cardEnd);
console.log('sec-adv 卡片 [' + cardStart + '→' + cardEnd + ']  ' + seg.length + ' 字符');
console.log('\n=== 子标题 ===');
for (const m2 of seg.matchAll(/<h[2-4][^>]*>([\s\S]{0,80}?)<\/h[2-4]>/g)) console.log('  ' + m2[1].replace(/<[^>]+>/g, '').trim());
console.log('\n=== 前 400 字符 ===');
console.log(seg.slice(0, 400).replace(/\s+/g, ' '));
console.log('\n=== 各体系出现次数 ===');
for (const k of ['七政四余', '古典占星', '八字', '紫微']) console.log('  ' + k + ': ' + (seg.split(k).length - 1));

/* 关于页最后一个卡片 */
const aboutI = h.indexOf('data-page="about"');
const aboutRe = /<div\b|<\/div>/g;
let ai = aboutI, dd = 0, mm, aboutEnd = -1;
const secStart = h.lastIndexOf('<section', aboutI);
aboutRe.lastIndex = secStart;
dd = 0;
while ((mm = aboutRe.exec(h))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0 && mm[0] === '</div>') { aboutEnd = mm.index; break; } }
console.log('\n=== 关于页 section ===');
console.log('  起 ' + secStart + ' 止(首个 div 深度归零) ' + aboutEnd);
console.log('  尾部 300 字符: ' + JSON.stringify(h.slice(aboutEnd - 300, aboutEnd + 40)));
