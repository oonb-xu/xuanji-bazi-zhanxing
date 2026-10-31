// 外环层宫位环只留「宫号 + 地支」两行（紫微名留在下方双环图），避免 26px 环宽里挤三行
import fs from 'node:fs';
const P = 'web/fw-ring-overlay.js';
let t = fs.readFileSync(P, 'utf8');
if (t.includes('ZW-IN-OVERLAY-OFF')) { console.log('已处理'); process.exit(0); }
const OLD = `      if (ming != null) {
        var seq = ((zhiStart(ming) - c0) % 360 + 360) % 360;`;
const NEW = `      if (false && ming != null) {   /* ZW-IN-OVERLAY-OFF：环宽不足，紫微名只在下方双环图显示 */
        var seq = ((zhiStart(ming) - c0) % 360 + 360) % 360;`;
if (!t.includes(OLD)) { console.error('❌ 未匹配紫微段'); process.exit(1); }
t = t.replace(OLD, NEW);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 外环层已隐藏紫微名（避免挤三行）');
