import fs from 'node:fs';
const P = 'tools/make-dist.mjs';
let t = fs.readFileSync(P, 'utf8');
const OLD = "for (const f of ['LICENSE', 'README.md']) {";
const NEW = "for (const f of ['LICENSE']) {";
if (!t.includes(OLD)) { console.log('— 已是只复制 LICENSE'); process.exit(0); }
t = t.replace(OLD, NEW);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 只复制 LICENSE（去掉 README，避免隐私扫描噪声）');
