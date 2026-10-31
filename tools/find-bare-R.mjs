// 找 fusion3d.js 里「作为值使用但未声明」的 R
// （报错 drawErr: R is not defined）
import fs from 'node:fs';
const src = fs.readFileSync('web/fusion3d.js', 'utf8');
const lines = src.split('\n');

console.log('=== 含裸 R 的可疑行（排除注释/字符串键）===');
lines.forEach((l, i) => {
  if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
  // 去掉字符串字面量再判断
  const stripped = l.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``');
  // 找独立的 R（前后不是字母数字下划线点）
  const re = /(^|[^A-Za-z0-9_$.])R([^A-Za-z0-9_$]|$)/g;
  let m, hit = false;
  while ((m = re.exec(stripped))) { hit = true; break; }
  if (hit) console.log(`${i + 1}: ${l.trim().slice(0, 120)}`);
});

console.log('\n=== 声明检查 ===');
// 看 R 是否在任何地方被声明
const declR = /\b(?:const|let|var|function)\s+R\b/.test(src);
console.log('R 被声明:', declR);
// 常见相似名
for (const n of ['RADIUS', 'R0', 'baseR', 'pr', 'rr', 'R_']) {
  const c = (src.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
  if (c) console.log(`  相近名 ${n}: 出现 ${c} 次，声明 ${new RegExp('\\b(?:const|let|var)\\s+' + n + '\\b').test(src)}`);
}
