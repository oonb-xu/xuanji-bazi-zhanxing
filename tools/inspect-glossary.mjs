import fs from 'node:fs';
const t = fs.readFileSync('web/glossary.html', 'utf8');
console.log('文件大小', t.length);
console.log('\n=== 静态 card 外壳（前80字符）===');
for (const m of t.matchAll(/<div class="card">[\s\S]{0,80}/g)) {
  console.log('  ' + m[0].replace(/\s+/g, ' ').slice(0, 95));
}
console.log('\n=== getElementById 调用 ===');
for (const m of t.matchAll(/getElementById\('([a-zA-Z]+)'\)/g)) console.log('  #' + m[1] + ' @' + m.index);
console.log('\n=== 渲染函数 ===');
for (const m of t.matchAll(/function (render[A-Za-z]*)/g)) console.log('  ' + m[1]);
console.log('\n=== DATA 赋值处 ===');
for (const m of t.matchAll(/.{0,60}DATA\s*=\s*.{0,60}/g)) console.log('  ' + m[0].replace(/\s+/g, ' '));
