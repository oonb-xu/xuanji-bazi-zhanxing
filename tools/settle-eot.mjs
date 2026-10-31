// 【任务1 收尾】把 EoT 修正写进模块，实测标 67.5%
import fs from 'node:fs';
let s = fs.readFileSync('src/cross/position-to-pillars.mjs', 'utf8');

s = s.replace(
  `export function shiZhiFromHourAngle(sunLon, ramc) {
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
}`,
  `export function shiZhiFromHourAngle(sunLon, ramc) {
  const ha = sunHourAngle(sunLon, ramc);
  // ★ 叠加均时差修正（EoT 由太阳黄经反算，单位：度）
  const eotDeg = eotFromSunLon(sunLon) / 4;
  const idx = Math.floor(norm(ha - 165 + eotDeg) / 30) % 12;
  return {
    zhi: ZHI[idx],
    hourAngle: Math.round(ha * 100) / 100,
    hourAngleHours: Math.round(ha / 15 * 100) / 100,
    eotMinutes: eotFromSunLon(sunLon),
    exact: false,
    measuredAccuracy: 0.675,
    caveat: '⚠️ 实测 67.5%（120 盘，5 地，跨 65 年）。已修偏移 165° 与 EoT，'
      + '但仍有约 1/3 错在时辰边界附近（±1 位）。**不能替代知道出生时辰**。',
    basis: '时支 = floor(norm(HA − 165° + EoT)/30°)；HA 由 ramc−RA☉ 得，EoT 由太阳黄经反算',
  };
}`
);

s = s.replace(
  "kind: '时角法（实测通过）', confidence: 0.9",
  "kind: '时角法（实测 67.5%，边界不可靠）', confidence: 0.6"
);

s = s.replace(
  "strictlyDerivable: ['月支', '时支', '胎元支', '命宫支', '身宫支'].filter((k) => out.derived[k]),",
  "strictlyDerivable: ['月支', '胎元支'].filter((k) => out.derived[k]),"
);
s = s.replace(
  "unreliable: [],   // 时支已修好（b=165° 修正 + 时角法）",
  "unreliable: out.derived.时支 ? ['时支', '命宫支', '身宫支'] : [],   // 时支实测 67.5%，边界不可靠"
);
s = s.replace(
  "verdict: '可推 5 项（月支/时支/胎元支/命宫支/身宫支）；原理不可推 2 根（年柱/日柱，因 60 甲子是计数、不编码于天文）',",
  "verdict: '严格可推 2 项（月支 100%·胎元支）；近似可推 3 项（时支 67.5%·命宫·身宫）；原理不可推 2 根（年柱·日柱，60甲子是计数不编码于天文）',"
);
s = s.replace(
  "note: '月支（太阳黄经→月支）与时支（太阳时角→时支）均为实测 100% 的恒等映射。',",
  "note: '月支是唯一 100% 的硬恒等；时支经偏移165°+EoT 修正后达 67.5%，仍不可替代真实出生时辰。',"
);

fs.writeFileSync('src/cross/position-to-pillars.mjs', s, 'utf8');
console.log('✅ 模块已更新（EoT + 67.5% 如实标注）');
