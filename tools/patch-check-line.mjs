// 精确修掉校验数组里那行多括号
import fs from 'node:fs';
const P = 'tools/fix-pillars-and-hud.mjs';
let s = fs.readFileSync(P, 'utf8');

// 找到含「HUD 有透干高亮」的整行并替换
const lines = s.split('\n');
let hit = -1;
lines.forEach((l, i) => { if (l.includes('HUD 有透干高亮')) hit = i; });
if (hit < 0) { console.error('❌ 未找到该行'); process.exit(1); }

console.log('原行:', lines[hit]);
lines[hit] = "  ['HUD 有透干高亮', h2.includes(' tou')],";
console.log('新行:', lines[hit]);

s = lines.join('\n');
fs.writeFileSync(P, s, 'utf8');
console.log('✅ 已替换');
