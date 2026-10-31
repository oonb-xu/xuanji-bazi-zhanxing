// 修 JDN 公式：格列高利需 +2 修正；JDN 取整用 floor(JD + 0.5)
import fs from 'node:fs';

const P = 'tools/experiment-jiazi-continuity.mjs';
let s = fs.readFileSync(P, 'utf8');

const OLD_START = s.indexOf('function jdn(');
const OLD_END = s.indexOf('console.log(\'══════ 0. JDN 算法自检');
if (OLD_START < 0 || OLD_END < 0) { console.error('❌ 定位失败'); process.exit(1); }

const NEW_FN = `function jdn(y, m, d, julian = true) {
  // 天文纪年：1 BC = 0, 113 BC = -112
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  // 儒略历无世纪修正；格列高利历 B = 2 - A + floor(A/4)
  const B = julian ? 0 : (2 - A + Math.floor(A / 4));
  const jd = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
  return Math.floor(jd + 0.5);   // JDN 是"正午起算"的整数
}

`;

s = s.slice(0, OLD_START) + NEW_FN + s.slice(OLD_END);
fs.writeFileSync(P, s, 'utf8');
console.log('✅ JDN 公式已修（格列 +2 修正、floor(JD+0.5) 取整）');
