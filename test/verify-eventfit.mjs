// 重大事项应期拟合台自检（exit 0 = 全过）
//  A AA 筛选（Astro-Databank 出生证明级）  B 行运表  C 应期排序  D AUC 语义  E 拟合可复算与过拟合量化
import { existsSync } from 'node:fs';
import { loadEventSet, buildTransitTable, preparePerson, rankYears, summarize, aucOf, fitEventWeights, DEFAULT_EVENT_W, EVENT_FEATURES, baziYearFeatures, astroYearFeatures } from '../src/cross/event-fit.mjs';
import { VEDASTRO_CSV } from '../src/vedastro/adapter.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

if (!existsSync(VEDASTRO_CSV)) {
  console.log('[eventfit] SKIP：缺 data/vedastro/PersonList-15k.csv');
  console.log('\nRESULT: PASS (skipped)');
  process.exit(0);
}

console.log('[A] AA 筛选（出生证明级）');
const set = loadEventSet({ limit: 60 });
ok(set.aaCount > 1000, `AA 条数 ${set.aaCount} 应 > 1000（必须全量计数；首版受 limit 截断只报 172）`);
ok(set.candidates.length > 0, `有事件的 AA 案例 ${set.candidates.length}`);
ok(set.candidates.every((c) => c.rec.rodden === 'AA'), '每条都必须是 AA 级');
ok(set.candidates.every((c) => c.events instanceof Set && c.events.size > 0), '每条都必须有真实事件年份');
console.log(`  全量 ${set.total}｜AA ${set.aaCount}｜有事件 ${set.candidates.length}（取样 60）✓`);

console.log('[B] 行运表');
const table = buildTransitTable({ fromYear: 1980, toYear: 1990, stepDays: 20 });
eq(table.size, 11, '年份数');
ok(table.get(1985).length > 0, '应有行运点');
ok(table.get(1985).every((r) => typeof r.lon === 'number' && r.lon >= 0 && r.lon < 360), '黄经范围');
console.log(`  11 年 × ${table.get(1985).length} 点 ✓`);

console.log('[C] 应期排序');
const prep = set.candidates.slice(0, 30).map((c) => ({ P: preparePerson(c.rec), events: c.events }));
ok(prep.every((p) => p.P.natal['上升'] !== undefined && p.P.bazi.pillars.length === 4), '星盘四轴与四柱齐备');
const r0 = rankYears(prep[0].P, prep[0].events, DEFAULT_EVENT_W, table);
ok(r0 && r0.years.length === 53, `年份跨度应为 53（18–70 岁），实得 ${r0?.years.length}`);
ok(r0.sorted.length === r0.years.length, '排序不丢样本');
ok(r0.ranks.every((x) => x >= 1 && x <= r0.years.length), '排名在范围内');
ok(r0.mrr === 1 / r0.bestRank, 'MRR = 1/最佳名次');
ok(r0.years.filter((x) => x.isEvent).length === r0.eventYears.length, '事件年标记数一致');
// 无事件年应返回 null
ok(rankYears(prep[0].P, new Set([1800]), DEFAULT_EVENT_W, table) === null, '事件年超出窗口应返回 null');
// 特征取值
const bf = baziYearFeatures(prep[0].P, 2020).f;
const af = astroYearFeatures(prep[0].P, 2020, table);
eq(Object.keys(bf).length, EVENT_FEATURES.length, '八字侧特征维度');
eq(Object.keys(af).length, EVENT_FEATURES.length, '星盘侧特征维度');
ok(Object.values({ ...bf, ...af }).every((v) => v === 0 || v === 1), '特征应为 0/1');
ok(EVENT_FEATURES.some((k) => k.startsWith('a_')) && EVENT_FEATURES.some((k) => k.startsWith('b_')), '两侧特征都有');
console.log(`  53 年窗口｜排名/MRR/特征维度 ${EVENT_FEATURES.length} ✓`);

console.log('[D] AUC 语义');
const mk = (posS, negS) => [{ years: [...posS.map((s) => ({ score: s, isEvent: true })), ...negS.map((s) => ({ score: s, isEvent: false }))] }];
ok(Math.abs(aucOf(mk([10], [1])).auc - 1.0) < 1e-9, '正样本全高 → AUC=1');
ok(Math.abs(aucOf(mk([1], [10])).auc - 0.0) < 1e-9, '正样本全低 → AUC=0');
ok(Math.abs(aucOf(mk([5], [5])).auc - 0.5) < 1e-9, '并列 → AUC=0.5');
ok(aucOf([{ years: [{ score: 1, isEvent: true }] }]).auc === null, '无对照 → null');
const s0 = summarize([r0]);
ok(s0.n === 1 && typeof s0.auc === 'number' && typeof s0.hit5 === 'number', 'summary 结构（命中率是数值不是布尔）');
ok(Math.abs(s0.randomHit5 - 5 / 53) < 1e-9, '随机 Top-5 基线 = 5/53');
console.log(`  AUC 三态语义｜随机基线 5/53=${(s0.randomHit5 * 100).toFixed(1)}% ✓`);

console.log('[E] 拟合（可复算 + 过拟合量化）');
const train = prep.slice(0, 12), test = prep.slice(12, 24);
const f1 = fitEventWeights(train, DEFAULT_EVENT_W, { passes: 1, table });
ok(f1.trainAuc >= summarize(train.map((p) => rankYears(p.P, p.events, DEFAULT_EVENT_W, table))).auc - 1e-9, '训练 AUC 不应下降');
ok(Object.values(f1.weights).every((v) => Number.isFinite(v)), '权重有限');
eq(Object.keys(f1.weights).length >= EVENT_FEATURES.length, true, '权重覆盖全部特征');
const f2 = fitEventWeights(train, DEFAULT_EVENT_W, { passes: 1, table });
eq(JSON.stringify(f2.weights), JSON.stringify(f1.weights), '拟合可复算');
const baseS = summarize(test.map((p) => rankYears(p.P, p.events, DEFAULT_EVENT_W, table))).auc;
const fitS = summarize(test.map((p) => rankYears(p.P, p.events, f1.weights, table))).auc;
ok(Number.isFinite(baseS) && Number.isFinite(fitS), '测试 AUC 可计算');
console.log(`  训练 ${f1.trainAuc.toFixed(4)}｜测试 ${baseS.toFixed(4)}→${fitS.toFixed(4)}｜可复算 ✓`);

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
