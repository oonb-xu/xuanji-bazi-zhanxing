import fs from 'node:fs';
const t = fs.readFileSync('web/fusion3d.js', 'utf8');
const i = t.indexOf('点击行星 → 详情面板里直接显示十神五组比例');
console.log(t.slice(i - 60, i + 1500));
console.log('\n\n=== 文件末尾 300 字符 ===');
console.log(t.slice(-300));
