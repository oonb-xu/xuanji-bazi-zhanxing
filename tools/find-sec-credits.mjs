import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
for (const id of ['sec-credits', 'sec-license', 'sec-develop']) {
  const i = h.indexOf('id="' + id + '"');
  console.log('\n[' + id + '] @' + i);
  if (i < 0) continue;
  console.log('  前 160: ' + JSON.stringify(h.slice(Math.max(0, i - 160), i)));
  console.log('  后 120: ' + JSON.stringify(h.slice(i, i + 120)));
}
/* 找「开源与数据」这个标题的实际标签 */
const k = h.indexOf('开源与数据');
console.log('\n「开源与数据」首次出现 @' + k);
console.log('  上下文: ' + JSON.stringify(h.slice(Math.max(0, k - 220), k + 160)));
