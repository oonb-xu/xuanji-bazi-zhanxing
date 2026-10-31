// 放大下方双环图字号（低风险：只改 font-size 字面量）
import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-font', t, 'utf8');

const RULES = [
  /* 地支环：支 24→27，藏干 11→13 */
  [`font-size="24" font-weight="700" fill="#ffd58a"`, `font-size="27" font-weight="700" fill="#ffd58a"`],
  [`font-size="11" fill="rgba(180,215,240,.78)"`, `font-size="13" fill="rgba(185,220,245,.9)"`],
  /* 宫位环：宫号 15→18 */
  [`font-size="15" font-weight="700" fill="#ffe6a8"`, `font-size="18" font-weight="700" fill="#ffe6a8"`],
  /* 宫位环：地支·领域 11→13 */
  [`font-size="11" fill="rgba(180,215,240,.8)"`, `font-size="13" fill="rgba(190,222,245,.92)"`],
  /* 紫微宫名 11→12.5 */
  [`font-size="11" fill="' + (si === 0 ? '#ff9a8a' : 'rgba(255,213,138,.82)') + '"`, `font-size="12.5" fill="' + (si === 0 ? '#ff9a8a' : 'rgba(255,213,138,.95)') + '"`],
  /* 行星 11→12 */
  [`font-size="11" font-weight="700" fill="' + col + '"`, `font-size="12" font-weight="700" fill="' + col + '"`],
  /* 七柱干支 15→17 */
  [`font-size="15" font-weight="700" fill="#ffe6a8" style="cursor:pointer"`, `font-size="17" font-weight="700" fill="#ffe6a8" style="cursor:pointer"`],
  /* ASC/MC 标注 13→14 / 12→13 */
  [`font-size="13" font-weight="700" fill="#5ef1ff"`, `font-size="14" font-weight="700" fill="#5ef1ff"`],
  [`font-size="12" fill="#ff9a8a"`, `font-size="13" fill="#ff9a8a"`],
];

let n = 0;
for (const [a, b] of RULES) {
  if (t.includes(a)) { t = t.split(a).join(b); n++; }
  else console.log('  ⚠️ 未匹配：' + a.slice(0, 46));
}
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 双环图字号已放大，命中 ' + n + '/' + RULES.length + ' 条规则');
