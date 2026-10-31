import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');

function sectionRange(page) {
  const key = 'data-page="' + page + '"';
  const i = h.indexOf(key);
  const s = h.lastIndexOf('<section', i);
  const re = /<section\b|<\/section>/g; re.lastIndex = s;
  let d = 0, m, e = -1;
  while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0 && m[0] === '</section>') { e = m.index + 10; break; } }
  return [s, e];
}

for (const page of ['fusion', 'synastry']) {
  const [s, e] = sectionRange(page);
  const seg = h.slice(s, e);
  // 找 form 的结束
  const fi = seg.indexOf('<form');
  const fe = seg.indexOf('</form>', fi);
  console.log('\n=== ' + page + ' form 结尾 380 字符 ===');
  console.log(JSON.stringify(seg.slice(Math.max(0, fe - 380), fe + 20)));
  console.log('--- 表单开头 200 字符 ---');
  console.log(JSON.stringify(seg.slice(fi, fi + 200)));
}

console.log('\n=== 导航（tabbar 全文）===');
const tb = h.indexOf('<nav class="tabbar"');
const tbe = h.indexOf('</nav>', tb);
console.log(h.slice(tb, tbe + 6));
