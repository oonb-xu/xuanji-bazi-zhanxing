// 修 fusion3d.js：spreadLongitudes 里 R 未声明（报错 drawErr: R is not defined）
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

const FROM = `function spreadLongitudes(items) {
  const out = new Map();
  if (!items.length) return out;
  // 角度 → 该处每度对应多少屏幕像素（用于把像素间距换算成角度）
  const pxPerDeg = Math.max(0.8, (2 * Math.PI * R * PLANET_RING_R) / 360 * (R / Math.max(80, R)) );`;

const TO = `function spreadLongitudes(items) {
  const out = new Map();
  if (!items.length) return out;
  // ★ 基准半径（像素）：与行星尺寸上限同源（见 pr0 的 clamp），此前漏声明导致 drawErr: R is not defined
  const R = Math.max(80, Math.min(W, H) * 0.34);
  // 角度 → 该处每度对应多少屏幕像素（用于把像素间距换算成角度）
  const pxPerDeg = Math.max(0.8, (2 * Math.PI * R * PLANET_RING_R) / 360);`;

if (s.includes('const R = Math.max(80, Math.min(W, H) * 0.34);')) {
  console.log('已修过');
} else if (s.includes(FROM)) {
  s = s.replace(FROM, TO);
  fs.writeFileSync('web/fusion3d.js', s, 'utf8');
  console.log('✅ R 已在 spreadLongitudes 内声明');
} else {
  console.error('❌ 未精确匹配，改用逐行替换');
  // 退路：只把 R 的定义插进去，保留原公式
  s = s.replace(
    "  // 角度 → 该处每度对应多少屏幕像素（用于把像素间距换算成角度）\n  const pxPerDeg",
    "  // ★ 基准半径（像素），此前漏声明导致 R is not defined\n  const R = Math.max(80, Math.min(W, H) * 0.34);\n  // 角度 → 该处每度对应多少屏幕像素（用于把像素间距换算成角度）\n  const pxPerDeg"
  );
  fs.writeFileSync('web/fusion3d.js', s, 'utf8');
  console.log(s.includes('const R = Math.max(80') ? '✅ 已用退路插入' : '❌ 仍失败');
}

/* 校验：R 必须在使用之前声明，且不再有未声明的裸 R */
const after = fs.readFileSync('web/fusion3d.js', 'utf8');
const lines = after.split('\n');
let ok = true;
lines.forEach((l, i) => {
  if (/^\s*(\/\/|\*)/.test(l)) return;
  const stripped = l.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``');
  if (/(^|[^A-Za-z0-9_$.])R([^A-Za-z0-9_$]|$)/.test(stripped)) {
    console.log(`  R 出现在 L${i + 1}: ${l.trim().slice(0, 80)}`);
  }
});
const iDecl = after.indexOf('const R = Math.max(80');
const iUse = after.indexOf('2 * Math.PI * R');
console.log('\n校验：');
console.log(' ', iDecl >= 0 ? '✅' : '❌', 'R 已声明');
console.log(' ', iDecl > 0 && iDecl < iUse ? '✅' : '❌', '声明在使用之前');
