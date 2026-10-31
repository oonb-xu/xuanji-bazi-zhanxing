import fs from 'node:fs';
const P = 'web/style.css';
let c = fs.readFileSync(P, 'utf8');
const OLD = `.dw-svg{ width:100%; max-width:660px; height:auto; display:block; margin:0 auto }`;
const NEW = `.dw-svg{ width:100%; max-width:520px; height:auto; display:block; margin:0 auto }`;
if (!c.includes(OLD)) { console.error('未匹配'); process.exit(1); }
c = c.replace(OLD, NEW);
fs.writeFileSync(P, c, 'utf8');
console.log('✅ 双环 SVG 最大宽度 660 → 520');
