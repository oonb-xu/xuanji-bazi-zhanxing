import fs from 'node:fs';
const P = 'tools/calc-5958-differential.mjs';
let t = fs.readFileSync(P, 'utf8');
const OLD = "out.1984至今偏移_天 = +(tFrom1984 * driftPerYear_years * 365.2422).toFixed(1);";
const NEW = "out['1984至今偏移_天'] = +(tFrom1984 * driftPerYear_years * 365.2422).toFixed(1);";
if (!t.includes(OLD)) { console.error('未匹配'); process.exit(1); }
t = t.replace(OLD, NEW);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 已改用方括号写法');
