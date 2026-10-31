import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
const re = /<section\b|<\/section>/g; re.lastIndex = so + SEC.length;
let d = 1, m, iE = -1;
while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) { iE = m.index; break; } }
const inner = h.slice(so + SEC.length, iE);

/* 按块打印纯文本 */
const lines = inner.replace(/<[^>]*>/g, '\n').replace(/&nbsp;/g, ' ').split('\n').map((s) => s.trim()).filter(Boolean);
const keys = ['并排', '摊给你看', '不替你下结论', '三种老办法', '不合并', '各测各的', '不硬凑成一个数'];
const seen = new Set();
lines.forEach((s, i) => {
  if (keys.some((k) => s.includes(k))) {
    const ctx = [lines[i - 1], s, lines[i + 1]].filter(Boolean).join(' ⟶ ');
    console.log('\n[' + i + '] ' + s);
    console.log('    前: ' + (lines[i - 1] || '—'));
    console.log('    后: ' + (lines[i + 1] || '—'));
  }
});
