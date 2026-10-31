import fs from 'node:fs';
const P = 'tools/add-usage-and-pages.mjs';
let t = fs.readFileSync(P, 'utf8');

/* 把未转义的 ${d// /_} 改成 \${d// /_} */
const before = t;
t = t.split('"out-${d// /_}.md"').join('"out-\\${d// /_}.md"');

if (t === before) {
  console.log('⚠️ 未匹配。含 d// 的行：');
  t.split('\n').forEach((l, i) => {
    if (l.includes('d//')) console.log('  ' + (i + 1) + ': ' + JSON.stringify(l.trim()));
  });
  process.exit(1);
}
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 已转义模板插值');
