import fs from 'node:fs';
const P = 'tools/add-5958-differential.mjs';
let t = fs.readFileSync(P, 'utf8');
const OLD = "'15.01', '141.8', '8510', '0.705'";
const NEW = "'15.01', '141.8', '8,510', '0.705'";
if (!t.includes(OLD)) { console.error('未匹配'); process.exit(1); }
t = t.replace(OLD, NEW);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 校验项已修正（8510 → 8,510）');
