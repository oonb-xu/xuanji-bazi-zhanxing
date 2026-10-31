// 检查所有锚点是否真的落在 h2 上；缺的补上。然后报告 h2 列表。
import fs from 'node:fs';
let h = fs.readFileSync('web/index.html', 'utf8');

const IDS = ['sec-privacy', 'sec-not-collage', 'sec-method', 'sec-conflict', 'sec-experiment', 'sec-credits', 'sec-howto'];
console.log('=== 锚点检查 ===');
let missing = [];
for (const id of IDS) {
  const ok = h.indexOf('id="' + id + '"') >= 0;
  console.log((ok ? '✅' : '❌'), id);
  if (!ok) missing.push(id);
}

// 补漏：sec-privacy 应落在「隐私承诺」标题上
if (missing.includes('sec-privacy')) {
  const cands = ['<h2>隐私承诺', '<h2>隐私', '<h2>本站只收集'];
  for (const c of cands) {
    if (h.indexOf(c) >= 0) {
      h = h.replace(c, '<h2 id="sec-privacy">' + c.slice(4));
      console.log('  → 已补 sec-privacy 到:', c);
      break;
    }
  }
}
fs.writeFileSync('web/index.html', h, 'utf8');

console.log('\n=== 现有 h2 ===');
const list = Array.from(h.matchAll(/<h2([^>]*)>([^<]{0,22})/g)).map((m) => (m[1].trim() ? '(' + m[1].trim() + ') ' : '') + m[2]);
list.forEach((s, i) => console.log(' ', i + 1, s));

console.log('\n=== 最终锚点状态 ===');
let bad = 0;
for (const id of IDS) {
  const ok = h.indexOf('id="' + id + '"') >= 0;
  if (!ok) bad++;
  console.log((ok ? '✅' : '❌'), id);
}
process.exit(bad ? 1 : 0);
