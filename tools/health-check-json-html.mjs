import fs from 'node:fs';

/* ① glossary-data.json 完整性 */
try {
  const j = JSON.parse(fs.readFileSync('web/glossary-data.json', 'utf8'));
  console.log('glossary-data.json: ✅ 合法 JSON');
  console.log('  count 字段 =', j.count, '｜实际 entries =', j.entries.length,
    j.count === j.entries.length ? '✅ 一致' : '❌ 不一致');
  console.log('  advantages =', Array.isArray(j.advantages) ? '✅ 数组 ' + j.advantages.length + ' 项' : '❌ ' + typeof j.advantages);
  const sys = {};
  for (const e of j.entries) sys[e.system] = (sys[e.system] || 0) + 1;
  console.log('  按体系:', Object.entries(sys).map(([k, v]) => k + '=' + v).join('  '));
  console.log('  文件大小:', (fs.statSync('web/glossary-data.json').size / 1024).toFixed(1), 'KB');
} catch (e) {
  console.log('glossary-data.json: ❌ 解析失败 —', e.message);
}

/* ② index.html 完整性 */
const h = fs.readFileSync('web/index.html', 'utf8');
const c = (s, r) => (s.match(r) || []).length;
console.log('\nindex.html:', h.length, '字节');
const KEYS = ['d5958-limit', 'd5958-diff', 'd5958-jiazi-day', 'd5958-chaochen', 'd5958-phenology', 'd5958-when'];
const found = KEYS.filter((k) => h.includes('id="' + k + '"'));
console.log('  59.58 新增段落:', found.length + '/' + KEYS.length, found.length === KEYS.length ? '✅' : '❌ 缺 ' + KEYS.filter((k) => !found.includes(k)).join(','));
const pairs = [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g],
  ['td', /<td\b/g, /<\/td>/g], ['th', /<th\b/g, /<\/th>/g],
  ['p', /<p\b/g, /<\/p>/g], ['b', /<b\b/g, /<\/b>/g], ['code', /<code\b/g, /<\/code>/g]];
console.log('  标签平衡:');
let bad = 0;
for (const [n, o, cl] of pairs) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  if (!ok) console.log(`    ❌ ${n} ${c(h, o)}/${c(h, cl)}`);
}
console.log(bad === 0 ? '    全部平衡 ✅' : `    ${bad} 类不平衡 ❌`);

/* ③ 所有脚本文件语法 */
import { execFileSync } from 'node:child_process';
console.log('\n脚本语法检查:');
let synBad = 0;
for (const f of fs.readdirSync('web').filter((x) => x.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', 'web/' + f], { stdio: 'pipe' }); }
  catch (e) { synBad++; console.log('  ❌ ' + f); }
}
console.log(synBad === 0 ? '  全部通过 ✅' : `  ${synBad} 个失败 ❌`);
