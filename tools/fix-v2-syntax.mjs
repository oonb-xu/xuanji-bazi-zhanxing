// 修掉 verify-jiazi-v2.mjs 里那行错语法
import fs from 'node:fs';
const P = 'tools/verify-jiazi-v2.mjs';
let s = fs.readFileSync(P, 'utf8');
const BAD = 'console.log(`  6×60=360 天 vs 回归年 `)` .length);\n';
if (s.includes(BAD)) {
  s = s.replace(BAD, '');
  fs.writeFileSync(P, s, 'utf8');
  console.log('✅ 已删掉错行');
} else {
  // 兜底：正则删掉任何含 "回归年 `)` " 的行
  const lines = s.split('\n').filter((l) => !/回归年 `\)/.test(l));
  fs.writeFileSync(P, lines.join('\n'), 'utf8');
  console.log('✅ 已用兜底删除');
}
