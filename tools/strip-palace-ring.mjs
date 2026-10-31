// 外环层只保留「地支+藏干」外圈与 ASC/MC（宫位/紫微环因垂直空间不足会压住 3D 盘面，改为只在下方双环图显示）
import fs from 'node:fs';
const P = 'web/fw-ring-overlay.js';
let t = fs.readFileSync(P, 'utf8');
if (t.includes('STRIP-PALACE')) { console.log('已处理'); process.exit(0); }

/* 宫位环整段改成条件关闭 */
const OLD = `    /* 宫位 + 紫微环 */
    for (var h = 0; h < 12; h++) {`;
const NEW = `    /* 宫位 + 紫微环 —— STRIP-PALACE：垂直空间不足，会压住 3D 盘面，此处不画（下方双环图已完整显示） */
    var SHOW_PALACE = false;
    for (var h = 0; SHOW_PALACE && h < 12; h++) {`;
if (!t.includes(OLD)) { console.error('❌ 未匹配宫位环'); process.exit(1); }
t = t.replace(OLD, NEW);

/* 地支环往外挪，留出呼吸空间 */
t = t.replace('var rMid = base + 26;', 'var rMid = base + 30;');
t = t.replace('var rOut = base + 62;', 'var rOut = base + 66;');

fs.writeFileSync(P, t, 'utf8');
console.log('✅ 宫位环已关闭（SHOW_PALACE=false），地支环外移 4px');
