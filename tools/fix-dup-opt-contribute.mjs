import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const c = (s, re) => (s.match(re) || []).length;
const before = c(h, /id="opt-contribute"/g);
if (before !== 2) { console.log('— 重复 id 数量为 ' + before + '，无需处理'); process.exit(0); }

/* 第二个及之后的 id 去掉（保留融合盘里的第一个） */
let n = 0;
h = h.replace(/id="opt-contribute"/g, () => { n++; return n === 1 ? 'id="opt-contribute"' : 'data-dup="opt-contribute-2"'; });
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已修复重复 id：opt-contribute 保留 1 个，第二个改为 data-dup');
console.log('  校验：id="opt-contribute" 出现 ' + c(h, /id="opt-contribute"/g) + ' 次（应为 1）');
