// 清掉数据与关于页里裸露的 Markdown ** 强调标记（HTML 不会渲染它，只显示星号）
import fs from 'node:fs';

function stripStars(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1');
}

/* ① glossary-data.json */
const JP = 'web/glossary-data.json';
const j = JSON.parse(fs.readFileSync(JP, 'utf8'));
let n = 0;
for (const e of j.entries) {
  for (const k of ['plain', 'note', 'term', 'as']) {
    if (typeof e[k] === 'string' && e[k].includes('**')) { e[k] = stripStars(e[k]); n++; }
  }
}
fs.writeFileSync(JP, JSON.stringify(j, null, 1), 'utf8');
console.log('glossary-data.json 清理字段:', n);

/* ② index.html（4 个搬进来的板块里有 **） */
const HP = 'web/index.html';
let h = fs.readFileSync(HP, 'utf8');
const before = (h.match(/\*\*/g) || []).length;
h = stripStars(h);
const after = (h.match(/\*\*/g) || []).length;
fs.writeFileSync(HP, h, 'utf8');
console.log(`index.html 中 ** 数量: ${before} → ${after}`);
