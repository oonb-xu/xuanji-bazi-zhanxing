// 验证：仅凭落位推七柱
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import {
  monthZhiFromSunLon, sunLonRangeOfMonthZhi, shiZhiFromHourAngle,
  derivePillarsFromPositions, UNRECOVERABLE_PROOF, UNDERLYING_LOGIC_PROOF, ZHI,
} from '../src/cross/position-to-pillars.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

/* ① 月支恒等：12 个节气点全对 */
console.log('=== 月支恒等（太阳黄经 → 月支）===');
const ANCHORS = [[315, '寅'], [345, '卯'], [15, '辰'], [45, '巳'], [75, '午'], [105, '未'], [135, '申'], [165, '酉'], [195, '戌'], [225, '亥'], [255, '子'], [285, '丑']];
for (const [lon, want] of ANCHORS) {
  const got = monthZhiFromSunLon(lon).zhi;
  console.log(`  ${String(lon).padStart(3)}° → ${got} ${got === want ? '✅' : '❌ 应' + want}`);
}
ok(ANCHORS.every(([lon, w]) => monthZhiFromSunLon(lon).zhi === w), '12 个节气锚点全对');

/* ② 扇区内任意角都落在同一月支 */
console.log('\n=== 扇区内稳定性 ===');
let sectorOk = true;
for (const [lon] of ANCHORS) {
  const base = monthZhiFromSunLon(lon + 0.1).zhi;
  for (const off of [1, 5, 14, 29]) {
    if (monthZhiFromSunLon(lon + off).zhi !== base) sectorOk = false;
  }
}
ok(sectorOk, '同一 30° 扇区内各点月支一致');

/* ③ 反向：月支 → 太阳黄经区间 */
console.log('\n=== 月支 → 太阳黄经区间（反向）===');
for (const z of ['寅', '午', '子']) {
  const r = sunLonRangeOfMonthZhi(z);
  console.log(`  ${z} ← ${r.from}° ~ ${r.to}°`);
}
ok(ZHI.every((z) => sunLonRangeOfMonthZhi(z) !== null), '12 月支都可反查区间');

/* ④ 真实盘：月支可推 */
console.log('\n=== 真实盘实测（8 盘）===');
const cases = [
  ['1990-03-15 12:00', 116.407, 39.904],
  ['1967-06-12 03:30', 121.474, 31.230],
  ['1988-09-17 12:30', 121.474, 31.230],
  ['2001-12-05 20:10', 113.264, 23.129],
  ['1975-07-22 06:45', 87.617, 43.792],
  ['2010-02-14 23:20', 126.642, 45.756],
  ['1955-11-30 15:05', 116.407, 39.904],
  ['2020-05-05 09:00', 121.474, 31.230],
];
let hit = 0;
for (const [at, lng, lat] of cases) {
  const bz = compileBazi({ at, gender: '男', lng, lat, tz: 8 });
  const n = computeNatal({ at, lng, lat, tz: 8 });
  const planets = Array.isArray(n.planets) ? n.planets : Object.entries(n.planets || {}).map(([k, v]) => ({ name: v?.name ?? k, ...v }));
  const sun = planets.find((p) => p.name === '太阳');
  const truth = bz.pillars[1][1];
  const got = monthZhiFromSunLon(sun.lon).zhi;
  const good = got === truth;
  if (good) hit++;
  console.log(`  ${at}  太阳${sun.lon.toFixed(1)}° → 推${got} / 真${truth}  ${good ? '✅' : '❌'}`);
}
ok(hit === cases.length, `8/8 月支全对（实测 ${hit}/8）`);

/* ⑤ 时支：如实标注不可用 */
console.log('\n=== 时支（如实标注）===');
const s1 = shiZhiFromHourAngle(80.18, 313.42);
console.log(`  样例：太阳80.18° ramc313.42° → ${s1.zhi}，准确率标注 ${s1.measuredAccuracy}`);
console.log(`  警告：${s1.caveat}`);
ok(s1.exact === false, '时支标为非严格');
ok(s1.measuredAccuracy < 0.75, '时支准确率如实标注，未虚报可用');
ok(/均时差|EoT/.test(s1.caveat + s1.basis), '时支已注明含 EoT 修正');

/* ⑥ 不可推证明 */
console.log('\n=== 不可推的两根柱 ===');
for (const [k, v] of Object.entries(UNRECOVERABLE_PROOF)) {
  if (typeof v === 'string') continue;
  console.log(`  ${k}：${v.why}`);
  console.log(`    证明：${v.proof.slice(0, 90)}…`);
  console.log(`    需要：${v.needs}`);
}
ok(UNRECOVERABLE_PROOF.年柱.proof.includes('60'), '年柱证明提到 60 不可通约');
ok(UNRECOVERABLE_PROOF.日柱.proof.includes('29.53'), '日柱证明提到月相周期');
ok(UNRECOVERABLE_PROOF.partialNote.includes('信息不存在'), '已区分"精度不够"与"信息不存在"');

/* ⑦ 底层逻辑证明结构 */
console.log('\n=== 底层逻辑证明 ===');
console.log('  ' + UNDERLYING_LOGIC_PROOF.title);
for (const st of UNDERLYING_LOGIC_PROOF.steps) console.log(`  ${st.step}. ${st.claim.slice(0, 60)}…`);
console.log('  结论：' + UNDERLYING_LOGIC_PROOF.conclusion.slice(0, 80) + '…');
ok(UNDERLYING_LOGIC_PROOF.steps.length === 4, '推理四步齐全');
ok(UNDERLYING_LOGIC_PROOF.conclusion.includes('编码类型'), '结论落在"编码类型"');
ok(UNDERLYING_LOGIC_PROOF.practical.includes('四柱'), '给了实际作用层结论');

/* ⑧ derivePillarsFromPositions 汇总 */
console.log('\n=== 汇总 ===');
const n0 = computeNatal({ at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, tz: 8 });
const d = derivePillarsFromPositions(n0);
console.log('  可推：', Object.entries(d.derived).map(([k, v]) => `${k}=${v.value}`).join(' '));
console.log('  不可推：', d.underivable.filter((u) => u.proof).map((u) => u.pillar).join('、'));
console.log('  ' + d.summary.verdict);
ok(d.derived.月支, '汇总里有月支');
ok(d.underivable.filter((u) => u.proof).length === 2, '汇总里恰有 2 根原理不可推');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
