import fs from 'node:fs';
const FIX = [
  ['docs/35-对应关系的置信度体系.md', '**【样例A 北京 1990-03-15 12:00】', '**【样例A 合成盘 · 某市 1990-03-15 12:00】'],
];
let n = 0;
for (const [f, a, b] of FIX) {
  if (!fs.existsSync(f)) continue;
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(a)) { console.log('⚠️ 未匹配 ' + f); continue; }
  t = t.split(a).join(b);
  fs.writeFileSync(f, t, 'utf8');
  n++;
}
console.log('✅ 修正 ' + n + ' 处');
