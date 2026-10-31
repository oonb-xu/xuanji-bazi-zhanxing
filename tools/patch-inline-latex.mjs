// 给 paper 转换器加「行内 LaTeX 降级」：$t$ → <code>t</code>（无 MathJax 时的退化显示）
import fs from 'node:fs';
const P = 'tools/fix-paper-formula.mjs';
let s = fs.readFileSync(P, 'utf8');

const ANCHOR = "    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')";
const ADD = ANCHOR + "\n    .replace(/\\$([^$\\n]{1,40})\\$/g, '<code>$1</code>')   // 行内 LaTeX 降级";

if (s.includes("行内 LaTeX 降级")) {
  console.log('已加过');
} else if (s.includes(ANCHOR)) {
  s = s.replace(ANCHOR, ADD);
  fs.writeFileSync(P, s, 'utf8');
  console.log('✅ 已加行内 LaTeX 降级');
} else {
  console.error('❌ 未匹配到 inline 的加粗替换行');
  process.exit(1);
}
