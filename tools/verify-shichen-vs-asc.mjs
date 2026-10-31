// 验证 §2.3 推论：时辰格（太阳时，120 分）与上升星座格（恒星时，119.7 分）的错位速率
//
// 推论：每过一天，两把尺子错开 (24 − 23.9345) h ≈ 3.93 分钟；
//       一年累积 3.93 × 365.25 ≈ 1435 分 ≈ 23.9 h ≈ 一个完整周期。
//
// 检验方式（不需要真人数据）：固定地点与真太阳时刻，跨一年采样，
// 看「时柱序号 − 上升星座序号」(mod 12) 是否随时间近似线性递增。
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const LNG = 116.407, LAT = 39.904, TZ = 8;

// 每天采样一次，时刻固定为当地 12:00（民用时，八字侧引擎内部换算真太阳时）
const start = new Date('2025-01-01T12:00:00+08:00');
const rows = [];
for (let d = 0; d < 366; d += 1) {
  const t = new Date(start.getTime() + d * 86400000);
  const at = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} 12:00`;
  let bz, ch;
  try { bz = compileBazi({ at, gender: '男' }); } catch { continue; }
  try { ch = computeNatal({ at, lng: LNG, lat: LAT, tz: TZ }); } catch { continue; }
  const shiZhi = bz.pillars[3][1];
  const ascSign = ch.planets?.['上升']?.sign;
  const zi = ZHI.indexOf(shiZhi);
  const si = SIGNS.indexOf(ascSign);
  if (zi < 0 || si < 0) continue;
  rows.push({ d, at, zi, si, diff: ((zi - si) % 12 + 12) % 12 });
}

// 线性拟合 diff ~ a + b*d（注意 diff 是模 12 的，需先展开）
let un = [rows[0].diff];
for (let i = 1; i < rows.length; i++) {
  let v = rows[i].diff;
  const prev = un[i - 1];
  // 展开：选择与上一个最接近的同余值
  while (v - prev > 6) v -= 12;
  while (prev - v > 6) v += 12;
  un.push(v);
}
const n = rows.length;
const sx = rows.reduce((a, r) => a + r.d, 0);
const sy = un.reduce((a, v) => a + v, 0);
const sxx = rows.reduce((a, r) => a + r.d * r.d, 0);
const sxy = rows.reduce((a, r, i) => a + r.d * un[i], 0);
const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
const a = (sy - b * sx) / n;
let ssRes = 0, ssTot = 0;
const mean = sy / n;
for (let i = 0; i < n; i++) { const p = a + b * rows[i].d; ssRes += (un[i] - p) ** 2; ssTot += (un[i] - mean) ** 2; }
const r2 = 1 - ssRes / ssTot;

console.log('=== 时柱序号 − 上升星座序号（mod 12）随日期的漂移 ===');
console.log('  样本天数:', n);
console.log('  斜率 b =', b.toFixed(6), '格/天');
console.log('  截距 a =', a.toFixed(4));
console.log('  R²     =', r2.toFixed(4));
console.log('  一年累积 =', (b * 365.25).toFixed(4), '格  （理论 ≈ −1 或 +1，即一个完整周期）');
console.log('');
console.log('  理论预期斜率 = ±12 / 365.25 =', (12 / 365.25).toFixed(6), '格/天');
console.log('  实测/理论 =', (Math.abs(b) / (12 / 365.25)).toFixed(3));
console.log('');
const head = rows.slice(0, 3).map((r) => `${r.at} 时${ZHI[r.zi]} 升${SIGNS[r.si]} diff=${r.diff}`);
const tail = rows.slice(-3).map((r) => `${r.at} 时${ZHI[r.zi]} 升${SIGNS[r.si]} diff=${r.diff}`);
console.log('  头:', head.join(' | '));
console.log('  尾:', tail.join(' | '));
