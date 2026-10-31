import fs from 'node:fs';
const P = 'tools/bigcycle-v2.mjs';
let t = fs.readFileSync(P, 'utf8');
/* 3 次会合 = 3 个间隔，不是 2 个 */
t = t.replace(
  "for (let i = 0; i + 2 < conj.length; i++) tri.push({ y: conj[i].t.getUTCFullYear(), span: (conj[i + 2].t - conj[i].t) / YEAR });",
  "for (let i = 0; i + 3 < conj.length; i++) tri.push({ y: conj[i].t.getUTCFullYear(), span: (conj[i + 3].t - conj[i].t) / YEAR });"
);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 已修：3 次会合 = conj[i+3] − conj[i]');
