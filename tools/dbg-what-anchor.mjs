import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
function secEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const iS = so + SEC.length, iE = secEnd(h, iS);
const inner = h.slice(iS, iE);
const key = 'id="sec-what-is-this"';
let idx = -1, all = [];
while ((idx = inner.indexOf(key, idx + 1)) >= 0) all.push(idx);
console.log('inner 中出现次数:', all.length, '位置:', all.join(','));
const p = all[all.length - 1];
console.log('最后出现处前 120 字符:', JSON.stringify(inner.slice(Math.max(0, p - 120), p + 60)));
/* 模拟 tagStartOf */
const lt = inner.lastIndexOf('<', p);
console.log('lastIndexOf("<")=', lt, ' 该处文本:', JSON.stringify(inner.slice(lt, lt + 90)));
