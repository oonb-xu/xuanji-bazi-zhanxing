// VedAstro 管线自检（exit 0 = 全过）
//  A. StdTime 解析：**时差解析 bug 的回归钉**（首版正则少一个捕获组，整点时差全读成 0）
//  B. 数据集健全性：|时差|≤14、1900 年前应≈地方平太阳时（LMT 交叉校验）
//  C. 真太阳时（R-T2）：偏移、时辰变化、跨日
//  D. 筛选：≥4 不和谐相位、n 条、按加权分降序
//  E. 融合：星盘+八字+标签三块齐备
//  F. 挖掘：可复算、最小支持度、负结果不崩
//  G. 本地库：筛选案例已全部写入
import { existsSync } from 'node:fs';
import { parseStdTime, loadVedastro, VEDASTRO_CSV } from '../src/vedastro/adapter.mjs';
import { loadLabels, fuse, selectCharts, chartFeatures, baziFeatures, loadTrainingDb, sampleFused, selectFromFused } from '../src/vedastro/pipeline.mjs';
import { mine, twoProportionP } from '../src/vedastro/mine.mjs';
import { dualInfer, astroSignal, baziSignal, compareSignals } from '../src/cross/dual-signal.mjs';
import { baziClock } from '../src/western/truesolar.mjs';
import { loadSamples } from '../src/cross/sample.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] StdTime 解析（时差 bug 回归）');
eq(parseStdTime('19:55 26/06/1954 +01:00').offsetHours, 1, '整点时差 +01:00');
eq(parseStdTime('15:00 23/06/1876 +00:18').offsetHours, 0.3, 'LMT 零头 +00:18 = 0.3h');
eq(parseStdTime('16:00 23/05/1760 -04:56').offsetHours, -4.933, '负 LMT -04:56');
eq(parseStdTime('10:00 01/01/2000 +5:30').offsetHours, 5.5, '半时区 +5:30');
eq(parseStdTime('10:00 01/01/2000 -05:00').offsetHours, -5, '整点负时差 -05:00（首版会读成 0）');
eq(parseStdTime('10:00 01/01/2000 +14:30'), null, '|时差|>14 应拒绝');
eq(parseStdTime('乱码'), null, '不可解析应返回 null');
eq(parseStdTime('19:55 26/06/1954 +01:00').date, '1954-06-26', '日期');
eq(parseStdTime('19:55 26/06/1954 +01:00').time, '19:55', '时刻');
console.log('  含整点/负整点/LMT/半时区/越界 9 项 ✓');

if (!existsSync(VEDASTRO_CSV)) {
  console.log('\n[!] 未找到 VedAstro 数据，B–G 组跳过（先下载 PersonList-15k.csv）');
  console.log(fails === 0 ? '\nRESULT: PASS (partial)' : `\nRESULT: FAIL (${fails})`);
  process.exit(fails === 0 ? 0 : 1);
}

console.log('[B] 数据集健全性');
const { records, bad, total } = loadVedastro();
ok(records.length > 15000, `可解析条数 ${records.length}`);
ok(bad.length / total < 0.02, `坏行率 ${(bad.length / total * 100).toFixed(2)}%`);
ok(records.every((r) => Math.abs(r.offsetHours) <= 14), '存在 |时差|>14 的记录');
// 1900 年前基本无标准时，时差应接近地方平太阳时 lon/15
const old = records.filter((r) => Number(r.date.slice(0, 4)) < 1900);
const near = old.filter((r) => Math.abs(r.offsetHours - r.lon / 15) < 1.5).length;
ok(near / old.length > 0.7, `1900 年前 LMT 吻合率 ${(near / old.length * 100).toFixed(1)}% 过低`);
const labels = loadLabels();
ok(labels.size > 15000, `标签条数 ${labels.size}`);
console.log(`  ${records.length} 条可解析｜坏行 ${bad.length}｜1900 年前 LMT 吻合 ${(near / old.length * 100).toFixed(1)}% ✓`);

console.log('[C] 真太阳时（R-T2）');
const c1 = baziClock({ date: '2007-12-25', time: '17:30', lon: 104.06, tz: 8 });
eq(c1.usedTrueSolar, true, '应有真太阳时');
eq(c1.shichenCivil, '酉', '民用时辰');
eq(c1.shichenTrue, '申', '真太阳时辰');
eq(c1.shichenDiffers, true, '时辰应变化');
ok(c1.offsetMinutes < -60, `成都偏移 ${c1.offsetMinutes} 应 < -60 分`);
const c2 = baziClock({ date: '1952-08-13', time: '00:40', lon: -118.24, tz: -7 });   // 洛杉矶，跨日
eq(c2.dayShift, true, '洛杉矶 00:40 真太阳时应跨到前一日');
const c3 = baziClock({ date: '2007-12-25', time: '17:30', lon: null, tz: 8 });
eq(c3.usedTrueSolar, false, '缺经度应退回民用时');
ok(/缺经度/.test(c3.reason), '应说明退回原因');
console.log(`  成都 17:30→${c1.at.slice(11)}（酉→申）｜洛杉矶 00:40 跨日 ✓｜缺经度退回并告警 ✓`);

console.log('[D] 筛选');
const { selected, pool } = selectCharts(records, { n: 20, min: 4, labels });
eq(selected.length, 20, '取 20 条');
ok(selected.every((f) => f.chart.discordantCount >= 4), '每条都应 ≥4 不和谐相位');
ok(selected.every((f, i, a) => i === 0 || a[i - 1].chart.discordantScore >= f.chart.discordantScore), '应按加权分降序');
ok(pool >= 20, `符合条件盘数 ${pool}`);
// R-V6：计数口径 = 主流西方占星（仅十大行星之间、仅对冲/四分相）
const AXES = new Set(['上升', '天顶', '下降', '天底', '北交点', '南交点']);
ok(selected.every((f) => f.chart.discordant.every((d) => !AXES.has(d.a) && !AXES.has(d.b))), 'R-V6：计数不得包含四轴/交点');
ok(selected.every((f) => f.chart.discordant.every((d) => d.type === '对冲' || d.type === '四分相')), 'R-V6：计数只允许 对冲/四分相（不含梅花/半四分/补八分）');
ok(selected.every((f) => Array.isArray(f.chart.angleContacts)), '轴相位应作为独立维度保留');
ok(pool < records.length * 0.9, `R-V6 后筛选应具区分度（符合条件 ${pool}/${records.length}）`);
const { selected: s2 } = selectCharts(records, { n: 20, min: 4, labels });
eq(s2[0].id, selected[0].id, '可复算：首条一致');
console.log(`  符合条件 ${pool}/${records.length} 盘（具区分度）｜取 20｜最高 ${selected[0].chart.discordantCount} 条｜首条 ${selected[0].name} ✓`);
console.log(`  R-V6：仅十大行星间 冲/刑，四轴已排除（独立维度 ${selected[0].chart.angleContactCount} 条）✓`);

console.log('[E] 融合结盘');
const f0 = selected[0];
for (const k of ['chart', 'bazi', 'cross', 'timeBase', 'birth']) ok(!!f0[k], `融合记录缺 ${k}`);
eq(f0.bazi.pillars.length, 4, '四柱');
ok(f0.chart.discordant.length === f0.chart.discordantCount, '相位明细与计数一致');
ok(f0.timeBase.trueSolar, '应记录真太阳时');
ok('elements' in f0.chart && 'dignity' in f0.chart && 'houses' in f0.chart, '星盘特征三块');
ok(typeof f0.bazi.ratio === 'number' && f0.bazi.yong && f0.bazi.ji, '八字特征');
ok(f0.label !== undefined, '标签字段存在（可能为 null）');
console.log(`  ${f0.name}｜四柱 ${f0.bazi.pillars.join(' ')}｜不和谐 ${f0.chart.discordantCount}｜标签 ${f0.label ? `婚${f0.label.marriages}离${f0.label.divorces}` : '无'} ✓`);

console.log('[F] 挖掘');
eq(Math.round(twoProportionP(50, 100, 50, 100) * 1000) / 1000, 1, '相同比例 p 应为 1');
ok(twoProportionP(20, 100, 5, 100) < 0.01, '差异大应显著');
const tgt = selected, ctl = selected.slice(0, 20);
const m1 = mine(tgt, ctl, { minSupport: 3, minControl: 20 });
ok(Array.isArray(m1), 'mine 返回数组');
ok(m1.every((r) => r.targetSupport >= 3), '最小支持度');
ok(m1.every((r) => r.verdict === null), '人工裁定字段应为 null（留给用户）');
ok(m1.every((r) => typeof r.pBonferroni === 'number' && typeof r.significant === 'boolean'), '应含 Bonferroni 与显著性');
const m2 = mine(tgt, ctl, { minSupport: 3, minControl: 20 });
eq(m2.length, m1.length, '可复算：维度数一致');
console.log(`  维度 ${m1.length} 个｜显著 ${m1.filter((r) => r.significant).length}｜p 检验与 Bonferroni ✓｜人工裁定列留空 ✓`);

console.log('[G] 本地库');
const samples = loadSamples();
const ids = new Set(selected.map((f) => f.id));
const ved = samples.filter((s) => /VedAstro/.test(s.intake?.note ?? ''));
ok(ved.length >= 20, `VedAstro 样本应 ≥20，实得 ${ved.length}`);
ok(ved.every((s) => s.timeBase && s.timeBase.usedTrueSolar), '每条都应记录真太阳时');
ok(ved.every((s) => s.bazi && s.bazi.pillars?.length === 4), '每条都应有四柱');
console.log(`  样本库共 ${samples.length} 条｜其中 VedAstro ${ved.length} 条（含真太阳时与四柱）✓`);

console.log('[H] 全量训练库');
const { records: db, bad: dbBad } = loadTrainingDb();
if (db.length) {
  ok(db.length >= 15000, `训练库应含全量，实得 ${db.length}`);
  eq(dbBad, 0, '坏行数');
  const d0 = db[0];
  for (const k of ['id', 'birth', 'timeBase', 'chart', 'bazi', 'cross']) ok(!!d0[k], `训练库记录缺 ${k}`);
  ok(d0.chart.discordant.every((d) => !AXES.has(d.a) && !AXES.has(d.b)), '训练库口径也应为 R-V6');
  ok(d0.bazi.pillars.length === 4, '训练库含四柱');
  const sf = sampleFused(db, { n: 50, seed: 1 });
  eq(sf.length, 50, '可抽样');
  eq(selectFromFused(db, { n: 20, min: 4 }).selected.length, 20, '可从训练库筛选 20');
  eq(sampleFused(db, { n: 50, seed: 1 })[0].id, sf[0].id, '抽样可复算');
  console.log(`  训练库 ${db.length} 条｜坏行 ${dbBad}｜可抽样/可筛选 ✓`);
} else console.log('  训练库不存在，跳过（node cli-vedastro.mjs --dump）');

console.log('[I] 双体系独立推理 + 摩擦');
{
  const t = db.slice(0, 200).map((f) => dualInfer(f));
  ok(t.length > 0, 'dualInfer 应产出结果');
  ok(t.every((r) => r.astro.system === '占星' && r.bazi.system === '八字'), '两侧体系标注');
  ok(t.every((r) => ['吉', '凶', '中'].includes(r.astro.verdict) && ['吉', '凶', '中'].includes(r.bazi.verdict)), '判定取值合法');
  ok(t.every((r) => Array.isArray(r.astro.reasons) && Array.isArray(r.bazi.reasons)), '两侧都应给出理由');
  ok(t.every((r) => ['一致', '矛盾', '单侧中性', '双中性'].includes(r.cmp.relation)), '关系取值合法');
  const a2 = astroSignal(db[0].chart);
  eq(astroSignal(db[0].chart).score, a2.score, '占星侧可复算');
  const b1 = baziSignal(db[0].bazi, db[0].gender);
  eq(baziSignal(db[0].bazi, db[0].gender).score, b1.score, '八字侧可复算');
  // 方向性：构造吉/凶两极，防止权重符号写反
  const good = astroSignal({ aspectIndex: ['金星|木星|三分相', '金星|月亮|合相'], dignity: { 金星: '庙' }, houses: { 金星: 7 }, angleContacts: [] });
  const bad = astroSignal({ aspectIndex: ['金星|土星|对冲', '月亮|天王星|四分相'], dignity: { 金星: '陷' }, houses: {}, angleContacts: [{ planet: '金星', angle: '上升' }] });
  ok(good.score > 0, `吉配置应为正分，实得 ${good.score}`);
  ok(bad.score < 0, `凶配置应为负分，实得 ${bad.score}`);
  eq(good.verdict, '吉', '吉配置判定');
  eq(bad.verdict, '凶', '凶配置判定');
  eq(compareSignals({ verdict: '吉', score: 2 }, { verdict: '凶', score: -2 }).relation, '矛盾', '吉×凶=矛盾');
  eq(compareSignals({ verdict: '吉', score: 2 }, { verdict: '吉', score: 1 }).relation, '一致', '吉×吉=一致');
  eq(compareSignals({ verdict: '中', score: 0 }, { verdict: '凶', score: -2 }).relation, '单侧中性', '中×凶=单侧中性');
  console.log(`  ${t.length} 盘推理｜两侧可复算｜吉/凶符号正确（${good.score}/${bad.score}）｜关系定义正确 ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
