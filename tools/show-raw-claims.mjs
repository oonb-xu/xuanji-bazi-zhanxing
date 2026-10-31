import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const targets = [
  '而是并排算给你看',
  '把结果',
  '并排摊给你看',
  '不替你下结论',
  '不硬凑成一个数',
  '而是各测各的',
  '不合并只并排',
];
for (const t of targets) {
  let i = -1;
  let n = 0;
  while ((i = h.indexOf(t, i + 1)) >= 0) {
    n++;
    console.log('\n=== 「' + t + '」 #' + n + ' @' + i + ' ===');
    console.log(JSON.stringify(h.slice(Math.max(0, i - 170), i + 170)));
  }
}
