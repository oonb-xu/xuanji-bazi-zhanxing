// 修：排盘后自动进入全屏融合盘 ⇒ 盖住结果界面 / 挡住导航 / 行星面板飘到右上角
// 改为：不再自动全屏，融合盘就在页面里显示；需要全屏点融合盘上的「全屏」按钮
import fs from 'node:fs';
const P = 'web/app.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-fwfull', t, 'utf8');

const OLD = `    // ★ 排盘成功后自动进入全屏融合盘
    try { setTimeout(function () { window.__fwFullscreen && window.__fwFullscreen(json.data); }, 380); } catch (e) {}`;

if (!t.includes(OLD)) {
  /* 宽松匹配再试一次 */
  const m = t.match(/\n\s*\/\/\s*★\s*排盘成功后自动进入全屏融合盘[\s\S]{0,220}?catch \(e\) \{\}/);
  if (!m) { console.error('❌ 未匹配到自动全屏代码'); process.exit(1); }
  console.log('  宽松匹配成功，长度 ' + m[0].length);
  t = t.replace(m[0], '\n    // 修复：不再自动进全屏（全屏层 position:fixed 会盖住结果界面与导航）。需要全屏请点融合盘上的全屏按钮。');
} else {
  t = t.replace(OLD, '    // 修复：不再自动进全屏（全屏层 position:fixed 会盖住结果界面与导航）。需要全屏请点融合盘上的全屏按钮。');
}
console.log('✅ 已移除「排盘后自动全屏」');

fs.writeFileSync(P, t, 'utf8');
console.log('app.js', t.length, '字节');

/* 校验 */
const still = /__fwFullscreen\s*&&\s*window\.__fwFullscreen\s*\(/.test(t);
console.log('  仍在自动调用全屏: ' + (still ? '❌ 是' : '✅ 否'));
if (still) process.exit(1);
