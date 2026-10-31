// 去掉 INVITE 模板字符串里的反引号（它们把模板提前截断）
import fs from 'node:fs';
const P = 'tools/add-plain-intro-optin.mjs';
let s = fs.readFileSync(P, 'utf8');
const before = (s.match(/`/g) || []).length;
// 只替换这些代码片段的反引号
s = s.split('`tools/`').join('tools/');
s = s.split('`src/cross/`').join('src/cross/');
s = s.split('`src/bazi/`').join('src/bazi/');
const after = (s.match(/`/g) || []).length;
fs.writeFileSync(P, s, 'utf8');
console.log(`反引号 ${before} → ${after}（模板字符串本身需保留成对的）`);
