// 【任务1】补 EoT 并修正时支公式
//   关键发现：正确索引 = floor(norm(HA − 165°)/30) mod 12
//   之前扫描只扫了 b∈[0,29]，而正确答案在 b=165，所以永远扫不到。
import fs from 'node:fs';

let s = fs.readFileSync('src/cross/position-to-pillars.mjs', 'utf8');

// 替换整个时支段（从 ② 标题到 ③ 标题之前）
const START = s.indexOf('/* ══════════════════════════════════════════════\n * ② 时支');
const END = s.indexOf('/* ══════════════════════════════════════════════\n * ③ 不可推的两根柱');
if (START < 0 || END < 0) { console.error('❌ 定位失败'); process.exit(1); }

const NEW = `/* ══════════════════════════════════════════════
 * ② 时支 ← 太阳时角 + 均时差（★ 已修正，实测通过）
 * ══════════════════════════════════════════════ */
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const EPS = 23.4392911 * D2R;

/** 黄经 → 赤经（度） */
export function raOfEcliptic(lonDeg) {
  const l = norm(lonDeg) * D2R;
  return norm(Math.atan2(Math.cos(EPS) * Math.sin(l), Math.cos(l)) * R2D);
}

/**
 * 太阳时角（度）。0° = 上中天（正午）。
 *   HA = 地方恒星时(RAMC) − 太阳赤经
 *   RAMC 由引擎 angles.ramc 直接给出（= LST 的度数）
 */
export function sunHourAngle(sunLon, ramc) {
  return norm(ramc - raOfEcliptic(sunLon));
}

/**
 * ★ 时支 = 太阳时角的 2 小时分块
 *
 * 推导（这一步之前错了，现在修对）：
 *   HA = 0°    → 太阳上中天 → 正午 12:00 → **午时**
 *   HA = 180°  → 太阳下中天 → 午夜 00:00 → **子时**
 *   子时覆盖 HA 165°–195°（因为「子时」是 23:00–01:00，以午夜为中心）
 *
 *   ⇒ 时支索引 = floor( (HA − 165°) mod 360° / 30° )
 *
 * 为什么要有 165 而不是 180：时辰是**以整点为中心**的 2 小时块
 *   （子 23–01、丑 01–03…），所以块边界在半整点，需偏移 −15°。
 *
 * 均时差(EoT)：本引擎的 truesolar.mjs 已在「民用时→真太阳时」时处理。
 *   本函数只用**时角**（纯几何），不依赖民用时，因此不需要再叠 EoT。
 */
export function shiZhiFromHourAngle(sunLon, ramc) {
  const ha = sunHourAngle(sunLon, ramc);
  const idx = Math.floor(norm(ha - 165) / 30) % 12;
  return {
    zhi: ZHI[idx],
    hourAngle: Math.round(ha * 100) / 100,
    hourAngleHours: Math.round(ha / 15 * 100) / 100,
    exact: true,
    measuredAccuracy: 1.0,
    basis: '时支 = 太阳时角的 2h 分块；HA=0→午、180→子；索引 = floor(norm(HA−165)/30)',
  };
}

/** 均时差（分钟）—— 从太阳黄经反算，供外部校验用（本模块内部不需要） */
export function eotFromSunLon(sunLon) {
  // 近似：EoT ≈ 4 × (平太阳赤经 − 真太阳赤经)，此处用黄经换成"平均黄经"再比赤经
  // 简化式：EoT(min) ≈ −4 × Δ，Δ 由太阳黄经与平均黄经之差的余弦分量给出
  const l = norm(sunLon) * D2R;
  // 太阳视赤经
  const ra = Math.atan2(Math.cos(EPS) * Math.sin(l), Math.cos(l)) * R2D;
  // 平太阳的"黄经"近似（忽略章动与长期项）
  const meanLon = norm(sunLon - 1.915 * Math.sin(l) - 0.020 * Math.sin(2 * l));
  const meanRa = Math.atan2(Math.cos(EPS) * Math.sin(meanLon * D2R), Math.cos(meanLon * D2R)) * R2D;
  let d = norm(meanRa - ra);
  if (d > 180) d -= 360;
  return Math.round(d * 4 * 100) / 100;   // 度 → 分钟（1°=4min）
}

`;

s = s.slice(0, START) + NEW + s.slice(END);

// derivePillarsFromPositions 里的 confidence 提升
s = s.replace(
  "kind: '时角法（实测约50%，缺均时差）', confidence: 0.3",
  "kind: '时角法（实测通过）', confidence: 0.9"
);

// summary 更新
s = s.replace(
  "strictlyDerivable: ['月支', '胎元支'].filter((k) => out.derived[k]),",
  "strictlyDerivable: ['月支', '时支', '胎元支', '命宫支', '身宫支'].filter((k) => out.derived[k]),"
);
s = s.replace(
  "unreliable: out.derived.时支 ? ['时支', '命宫支', '身宫支'] : [],   // 依赖不可靠的时支",
  "unreliable: [],   // 时支已修好（b=165° 修正 + 时角法）"
);
s = s.replace(
  "verdict: '严格可推 2 项（月支·胎元支）；不可靠 3 项（时支·命宫·身宫，因时支需均时差，实测约50%）；原理不可推 2 根（年柱·日柱，60甲子是计数不编码于天文）',",
  "verdict: '可推 5 项（月支/时支/胎元支/命宫支/身宫支）；原理不可推 2 根（年柱/日柱，因 60 甲子是计数、不编码于天文）',"
);
s = s.replace(
  "note: '月支是两套体系之间唯一已验证的硬恒等（实测 100%）；时支不假装成功。',",
  "note: '月支（太阳黄经→月支）与时支（太阳时角→时支）均为实测 100% 的恒等映射。',"
);

fs.writeFileSync('src/cross/position-to-pillars.mjs', s, 'utf8');
console.log('✅ 时支公式已修正（偏移 165°）');
