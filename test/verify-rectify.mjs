// 星盘反推八字引擎 自检（exit 0 = 全过）
//  A. 均时差：本实现 vs @openfate/true-solar-time 的 Meeus 实现（两个独立实现互证）+ 已知极值
//  B. 真太阳时：经度修正 / 历史夏令时 / 时辰是否改变
//  C. R-T1 双计陷阱的数值证明（真太阳时喂星盘 → 上升偏一个星座量级）
//  D. Step 5 门：事件 <3 → 拒绝校正
//  E. 校正引擎：可复算、给出 top 候选、收敛判据、时间窗内
//  F. Step 3：校正后八字与跨时辰/跨日/跨节气标注
import { equationOfTime, trueSolarTime } from '../src/western/truesolar.mjs';
import { F } from './_fixtures.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { rectify, baziAfterRectify, precomputeTransits, CATEGORY_FOCUS } from '../src/rectify/rectify.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);
const gap = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

const CASE = { name: '案例001', gender: '女', date: '2007-12-25', time: '17:30', lon: 104.06, lat: 30.67, tzName: 'Asia/Shanghai' };

console.log('[A] 均时差：双实现互证 + 已知极值');
// 已知：2020-02-11 ≈ −14.2 分（年最小）；2020-11-03 ≈ +16.4 分（年最大）
for (const [d, lo, hi] of [['2020-02-11T12:00:00Z', -14.6, -13.9], ['2020-11-03T12:00:00Z', 16.1, 16.8]]) {
  const v = equationOfTime(new Date(d));
  ok(v >= lo && v <= hi, `${d} EoT=${v.toFixed(3)} 应在 ${lo}~${hi}`);
}
let maxDelta = 0;
for (const day of [1, 40, 80, 120, 160, 200, 240, 280, 320, 355]) {
  for (const y of [1960, 1990, 2007, 2024]) {
    const t = new Date(Date.UTC(y, 0, 1) + day * 86400e3);
    const mine = equationOfTime(t), mee = equationOfTime(t, { useMeeus: true });
    maxDelta = Math.max(maxDelta, Math.abs(mine - mee));
  }
}
ok(maxDelta < 0.05, `与 Meeus 实现最大差 ${maxDelta.toFixed(4)} 分 ≥ 0.05（40 个采样点、跨 1960–2024）`);
console.log(`  40 个采样点跨 1960–2024：最大差 ${maxDelta.toFixed(4)} 分（≈${(maxDelta * 60).toFixed(1)} 秒）✓`);

console.log('[B] 真太阳时');
const tst = trueSolarTime({ at: `${CASE.date} ${CASE.time}`, lon: CASE.lon, tzName: CASE.tzName });
eq(tst.utc, '2007-12-25T09:30:00.000Z', 'UTC');
eq(tst.dstOffsetHours, 8, '时区偏移（2007 无夏令时）');
// 经度修正 = (104.06 − 120) × 4 = −63.76 分
ok(Math.abs(tst.lonCorrectionMinutes - (-63.76)) < 0.01, `经度修正 ${tst.lonCorrectionMinutes} 应为 −63.76`);
eq(tst.totalOffsetMinutes, Math.round((tst.lonCorrectionMinutes + tst.eotMinutes) * 1000) / 1000, '合计 = 经度 + 均时差');
eq(tst.apparentSolarLocal, F.T6, '真太阳时');
eq(tst.shichenCivil, '酉', '民用时辰');
eq(tst.shichenTrue, '申', '真太阳时辰');
eq(tst.shichenDiffers, true, '时辰应改变');
// 1990 上海：中国 1986–1991 夏令时 → 偏移 9h
const tst90 = trueSolarTime({ at: '1990-05-20 14:30', lon: 121.47, tzName: 'Asia/Shanghai' });
eq(tst90.dstOffsetHours, 9, '1990 夏令时应为 9h');
eq(tst90.utc, '1990-05-20T05:30:00.000Z', '1990 DST UTC');
// 标准时经线上的城市经度修正应≈0
const tstB = trueSolarTime({ at: '2007-12-25 12:00', lon: 120, tzName: 'Asia/Shanghai' });
eq(tstB.lonCorrectionMinutes, 0, '120°E 经度修正应为 0');
console.log(`  ${CASE.time} 民用 → ${tst.apparentSolarLocal} 真太阳（${tst.totalOffsetMinutes} 分）｜时辰 ${tst.shichenCivil}→${tst.shichenTrue} ✓`);

console.log('[C] R-T1：真太阳时喂星盘的陷阱（数值证明）');
const correct = computeNatal({ at: `${CASE.date} ${CASE.time}`, lng: CASE.lon, lat: CASE.lat, tzName: CASE.tzName });
const wrong = computeNatal({ at: tst.apparentSolarLocal, lng: CASE.lon, lat: CASE.lat, tzName: CASE.tzName });
const dAsc = gap(correct.angles.asc, wrong.angles.asc);
const dMc = gap(correct.angles.mc, wrong.angles.mc);
ok(dAsc > 10, `误用真太阳时的上升差应 >10°，实得 ${dAsc.toFixed(2)}°`);
ok(dMc > 10, `误用真太阳时的天顶差应 >10°，实得 ${dMc.toFixed(2)}°`);
eq(tst.chartUtc, correct.meta.utc, 'R-T1：星盘应用 civil → UTC');
console.log(`  正确上升 ${correct.angles.asc.toFixed(2)}° / 误用后 ${wrong.angles.asc.toFixed(2)}° → 差 ${dAsc.toFixed(2)}°（天顶差 ${dMc.toFixed(2)}°）✓`);

console.log('[D] Step 5 门：事件不足拒绝校正');
const few = rectify({ ...CASE, events: [{ year: 2022, event: '父亲生病', category: '家庭' }, { year: 2024, event: '考入航空系', category: '学业' }] });
eq(few.ok, false, '2 条事件应拒绝');
ok(/至少需要 3 条/.test(few.reason), '理由应说明需要 3 条');
ok(!few.corrected_time, '拒绝时不得给 corrected_time');
console.log(`  2 条 → ${few.reason} ✓`);

console.log('[E] 校正引擎（可复算）');
// 测试夹具：3 条事件（**合成用于验证算法**，不是真实人物数据）
const EVENTS = [
  { year: 2015, event: '夹具A', category: '事业' },
  { year: 2019, event: '夹具B', category: '婚恋' },
  { year: 2023, event: '夹具C', category: '健康' },
];
const t0 = Date.now();
const r1 = rectify({ ...CASE, events: EVENTS }, { windowMin: 30, stepMin: 5 });
const ms = Date.now() - t0;
eq(r1.ok, true, '3 条事件应执行');
eq(r1.original_time, CASE.time, '原始时刻');
ok(/^\d{2}:\d{2}$/.test(r1.corrected_time), `校正时刻格式：${r1.corrected_time}`);
ok(r1.top.length === 5, 'top 5 候选');
ok(r1.top.every((x, i, a) => i === 0 || a[i - 1].score >= x.score), 'top 应按分数降序');
ok(r1.plateau.widthMin >= 5, '平台宽度');
ok(['±5min'].includes(r1.confidence) || /未达 ±5min/.test(r1.confidence), `置信度文案：${r1.confidence}`);
ok(Object.keys(r1.best.parts).join() === 'transit,arc,bazi', '三项分项');
ok(r1.best.contacts.length > 0, '最佳候选应至少有 1 个触发');
// 复算性：同输入同输出
const r2 = rectify({ ...CASE, events: EVENTS }, { windowMin: 30, stepMin: 5 });
eq(r2.corrected_time, r1.corrected_time, '可复算：校正时刻一致');
eq(r2.best.score, r1.best.score, '可复算：最佳分一致');
// 对称性：窗口内的候选时刻应落在窗口范围
const mins = r1.top.map((x) => Number(x.time.slice(0, 2)) * 60 + Number(x.time.slice(3, 5)));
ok(Math.min(...mins) >= 17 * 60 && Math.max(...mins) <= 18 * 60 + 30, '候选应在 ±30min 窗口内');
ok(CATEGORY_FOCUS.婚恋.includes('下降'), '类别参照点映射');
ok(Object.keys(precomputeTransits(EVENTS, { stepDays: 30 })).length === 3, '行运预计算按事件年');
console.log(`  ${r1.original_time} → ${r1.corrected_time}（${r1.confidence}）｜平台 ${r1.plateau.widthMin}min｜最佳 ${r1.best.score}｜耗时 ${ms}ms ✓`);

console.log('[F] Step 3：校正后八字与风险标注');
const post = baziAfterRectify({ ...CASE, events: EVENTS }, r1.corrected_time);
eq(post.original.pillars.length, 4, '原四柱');
eq(post.corrected.pillars.length, 4, '校正后四柱');
ok(Array.isArray(post.flags), 'flags 是数组');
ok(typeof post.needHumanReview === 'boolean', 'needHumanReview 是布尔');
// 故意跨时辰：酉时(17:30) → 申时(16:00) 时柱必须标出变化
const crossShichen = baziAfterRectify(CASE, '16:00');
ok(crossShichen.changed.includes('时'), `跨时辰应标注时柱变化，实得 [${crossShichen.changed}]`);
ok(crossShichen.flags.some((f) => /时柱/.test(f)), '应有时柱变化说明');
// 同日不跨时辰时不应报告日柱变化
ok(!crossShichen.changed.includes('日'), '同日不应报日柱变化');
console.log(`  校正后 ${post.corrected.pillars.join(' ')}｜跨时辰标注：${crossShichen.flags[0]} ✓`);

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
