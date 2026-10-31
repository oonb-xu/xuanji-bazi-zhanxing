// ① 3D 盘缩小：R 系数 0.34 → 0.28（腾出直径给外环；盘可滚轮缩放，缩小不吃亏）
// ② 外环层：edge 0.42→0.37、环宽上限 46、恢复紫微名三行
import fs from 'node:fs';

/* ① fusion3d.js */
{
  const P = 'web/fusion3d.js';
  let t = fs.readFileSync(P, 'utf8');
  fs.writeFileSync(P + '.bak-r', t, 'utf8');
  const OLD = 'const R = Math.max(80, Math.min(W, H) * 0.34);';
  const NEW = 'const R = Math.max(80, Math.min(W, H) * 0.28);   // 0.34→0.28：缩小盘面，给外环层留直径（滚轮可缩放）';
  if (!t.includes(OLD)) { console.error('❌ 未匹配 R 系数'); process.exit(1); }
  t = t.replace(OLD, NEW);
  fs.writeFileSync(P, t, 'utf8');
  console.log('✅ fusion3d.js：R 系数 0.34 → 0.28');
}

/* ② fw-ring-overlay.js */
{
  const P = 'web/fw-ring-overlay.js';
  let t = fs.readFileSync(P, 'utf8');
  let n = 0;
  if (t.includes('var base = Math.min(W, H) * 0.34;')) {
    t = t.replace('var base = Math.min(W, H) * 0.34;', 'var base = Math.min(W, H) * 0.28;'); n++;
  }
  if (t.includes('var edge = Math.min(W, H) * 0.42;')) {
    t = t.replace('var edge = Math.min(W, H) * 0.42;', 'var edge = Math.min(W, H) * 0.37;'); n++;
  }
  if (t.includes('var w1 = Math.max(26, Math.min(32, half - edge - 66));')) {
    t = t.replace('var w1 = Math.max(26, Math.min(32, half - edge - 66));',
      'var w1 = Math.max(30, Math.min(46, half - edge - 66));'); n++;
  }
  /* 紫微名回归 */
  if (t.includes('if (false && ming != null) {')) {
    t = t.replace('if (false && ming != null) {   /* ZW-IN-OVERLAY-OFF：环宽不足，紫微名只在下方双环图显示 */',
      'if (ming != null) {   /* 环宽已放到 46px，紫微名恢复显示 */'); n++;
  }
  fs.writeFileSync(P, t, 'utf8');
  console.log('✅ fw-ring-overlay.js：改了 ' + n + ' 处（base 0.28 / edge 0.37 / 环宽≤46 / 紫微名恢复）');
}
