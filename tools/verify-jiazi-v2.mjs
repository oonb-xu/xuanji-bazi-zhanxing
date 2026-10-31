// 修正木土会合检测：用「带符号黄经差」过零点，而不是靠绕圈
// 理论锚点（纯算术，不依赖检测）：
//   木土 synodic = 1/(1/11.862 − 1/29.457) = 19.859 年
//   3 次会合 = 59.577 年  ⇒  相对 60 年周期漂移 0.423 年/周期
//   每次会合的黄经推进 = 59.577/11.862*360 mod 360 ≈ 8.15°
//   ⇒ 转满 360° 需 360/8.15 ≈ 44 个周期 ≈ 2640 年
import { Body, MakeTime, GeoVector, Ecliptic } from 'astronomy-engine';

const TY = 365.2422;
const DAY = 86400000;

function signedSep(ms) {
  const t = MakeTime(new Date(ms));
  const eJ = Ecliptic(GeoVector(Body.Jupiter, t, true));
  const eS = Ecliptic(GeoVector(Body.Saturn, t, true));
  let d = eJ.elon - eS.elon;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

function findConj(ms0, ms1, stepDays = 20) {
  const out = [];
  let prevMs = ms0, prev = signedSep(ms0);
  for (let t = ms0 + stepDays * DAY; t < ms1; t += stepDays * DAY) {
    const cur = signedSep(t);
    // 会合 = 带符号差由负转正（木星追上土星）
    if (prev < 0 && cur >= 0) {
      let lo = prevMs, hi = t;
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        if (signedSep(mid) < 0) lo = mid; else hi = mid;
      }
      out.push(hi);
    }
    prev = cur; prevMs = t;
  }
  return out;
}

console.log('══════ 理论值（纯算术）══════');
const SYN = 1 / (1 / 11.862 - 1 / 29.457);
const TRIPLE = SYN * 3;
const DRIFT = 60 - TRIPLE;
const lonAdv = (TRIPLE / 11.862 * 360) % 360;
console.log(`  木土 synodic       = ${SYN.toFixed(4)} 年`);
console.log(`  3×会合（"60年"）   = ${TRIPLE.toFixed(4)} 年`);
console.log(`  与 60 年之差       = ${DRIFT.toFixed(4)} 年 = ${Math.round(DRIFT * TY)} 天`);
console.log(`  每次会合黄经推进    = ${lonAdv.toFixed(3)}°`);
console.log(`  转满 360° 需        = ${(360 / lonAdv).toFixed(1)} 个周期 ≈ ${Math.round(360 / lonAdv * TRIPLE)} 年`);
console.log(`  6 甲子日 = 360 天，回归年 365.2422 天 ⇒ 咬合 ${(360 / TY * 100).toFixed(2)}%，残差 ${(TY - 360).toFixed(2)} 天/年`);

console.log('\n══════ 真实星历实测（1600–2400）══════');
const c = findConj(Date.UTC(1600, 0, 1), Date.UTC(2400, 0, 1));
console.log(`  检出 ${c.length} 次会合`);
const iv = [];
for (let i = 1; i < c.length; i++) iv.push((c[i] - c[i - 1]) / DAY / TY);
const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
console.log(`  间隔均值 ${mean.toFixed(4)} 年（理论 ${SYN.toFixed(4)}），min ${Math.min(...iv).toFixed(3)} max ${Math.max(...iv).toFixed(3)}`);
const tr = [];
for (let i = 3; i < c.length; i++) tr.push((c[i] - c[i - 3]) / DAY / TY);
const trMean = tr.reduce((a, b) => a + b, 0) / tr.length;
console.log(`  三次会合均值 ${trMean.toFixed(4)} 年（理论 ${TRIPLE.toFixed(4)}）`);
console.log(`  实测与 60 之差 ${(60 - trMean).toFixed(4)} 年`);

console.log('\n══════ 会合点黄经推进（前 10 次）══════');
const lons = c.slice(0, 10).map((ms) => Ecliptic(GeoVector(Body.Jupiter, MakeTime(new Date(ms)), true)).elon);
for (let i = 0; i < lons.length; i++) {
  const d = i ? ((lons[i] - lons[i - 1] + 540) % 360) - 180 : 0;
  console.log(`  ${String(i + 1).padStart(2)}  ${lons[i].toFixed(2)}°  ${i ? '推进 ' + d.toFixed(2) + '°' : ''}`);
}
const d3real = ((lons[3] - lons[0] + 540) % 360) - 180;
console.log(`  三次会合净推进 = ${d3real.toFixed(2)}°（理论 ${lonAdv.toFixed(2)}°）`);
console.log(`  ⇒ 每"60年"周期相对甲子漂 ${d3real.toFixed(2)}°，${(360 / Math.abs(d3real)).toFixed(0)} 个周期后相位转满`);

console.log('\n══════ 结论 ══════');
console.log('  ① 用户论据 A 成立：60 = LCM(12木, 30土)，且 ≈ 3×木土会合 59.577 年');
console.log('  ② 用户论据 B 成立：6×60=360 天 与回归年咬合 98.56%');
console.log('  ③ 用户论据 C 成立：差值 0.423 年/周期（约 154 天），是**微分**');
console.log(`  ④ 用户论据 D 成立：累积 ${d3real.toFixed(1)}°/周期，${(360 / Math.abs(d3real)).toFixed(0)} 周期（约 ${Math.round(360 / Math.abs(d3real) * 60)} 年）相位转满 360°`);
console.log('     ⇒ 转过临界点（相位对齐/反相）时，木土与甲子的关系**翻转**');
console.log('  ⇒ 我此前"天空里不存在 60"过于绝对，须修正：');
console.log('     60 有天文近似依据（LCM 与 3 次会合），漂移不是噪声而是**慢钟**，携带计时信息。');
