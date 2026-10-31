// 双盘样本采集 + 本地数据库 规程自检（exit 0 = 全过）
//  A. 样板校验：合法/缺字段/农历/精度枚举；告警不影响通过
//  B. 样本 ID 幂等：同出生+同坐标同 ID；改时间即变
//  C. 采集：双盘齐备、16 个点、八字字段齐、事件对齐字段齐、一致性阈值
//  D. 写库：只追加、同 ID 回放去重
//  E. 事件对齐：流年干支、刑冲引动、大运非空
//  F. 后端注册表：mine 与 kerykeion 同 schema；未知后端抛错
//  G. 统计聚合
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { F } from './_fixtures.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSample, sampleId, collectSample, loadSamples, sampleStats, renderSample, renderSampleRules, alignEvents, SAMPLES_DB, TEMPLATE } from '../src/cross/sample.mjs';
import { EVENT_CATEGORIES, normalizeCategory, RULE_SPECS, verifySample, sampleRuleStats } from '../src/cross/event-rules.mjs';
import { observe, buildLibrary } from '../src/cross/mapping-library.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { yearGanZhi } from '../src/cross/timing.mjs';
import { computeChart, computeDual, hasKerykeion, BACKENDS, PRIMARY_BACKEND, HARD_ASPECTS } from '../src/western/backends.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = resolve(HERE, '..');
const TMP_DB = join(PROJ, '.tmp', 'samples-test.jsonl');
const TMP_DIR = join(PROJ, '.tmp', 'samples-test');
for (const p of [TMP_DB, TMP_DIR]) rmSync(p, { recursive: true, force: true });

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

const GOOD = JSON.parse(readFileSync(TEMPLATE, 'utf8'));
let n = 0;
console.log('[A] 样板校验');
const v = validateSample(GOOD);
ok(v.ok, `模板样本应通过：${v.errors?.join('；')}`);
eq(v.errors.length, 0, '无错误');
eq(v.intake.life_events.length, 2, '事件数');
ok(validateSample({}).ok === false, '空输入应失败');
// gender 不是必填（只告警），所以"缺 gender"不能当作校验失败——下一条用 vNoGender 断言
ok(validateSample({ birth_date: { date: '2007-12-25', time: '17:30', birth_place: { longitude: 1, latitude: 2, timezone: 'Asia/Shanghai' } } }).ok === true, '缺 gender 应通过（仅告警）');
const vNoGender = validateSample({ ...GOOD, gender: undefined });
ok(vNoGender.ok === true && vNoGender.warnings.some((w) => /gender/.test(w)), '缺 gender 应通过但告警');
const vNoEvents = validateSample({ ...GOOD, life_events: [] });
ok(vNoEvents.ok === true && vNoEvents.warnings.some((w) => /life_events/.test(w)), '无事件应通过但告警');
const vLunar = validateSample({ ...GOOD, birth_date: { ...GOOD.birth_date, calendar: '农历' } });
ok(vLunar.ok === false && vLunar.errors.some((e) => /农历/.test(e)), '农历应明确拒绝（不猜历法）');
const vPrec = validateSample({ ...GOOD, birth_date: { ...GOOD.birth_date, time_precision: '大概到时辰' } });
ok(vPrec.ok === true && vPrec.warnings.some((w) => /时间精度/.test(w)), '粗精度应通过但告警');
ok(validateSample({ ...GOOD, birth_date: { ...GOOD.birth_date, time_precision: '随便' } }).ok === false, '非法精度枚举应失败');
console.log(`  必填/枚举/告警/农历拒绝 ✓（告警 ${v.warnings.length} 条）`);

console.log('[B] 样本 ID 幂等');
eq(sampleId(v.intake), sampleId(v.intake), '同输入同 ID');
const v2 = validateSample({ ...GOOD, birth_date: { ...GOOD.birth_date, time: '17:31' } });
eq(v2.ok, true, '改 1 分钟仍合法');
ok(sampleId(v2.intake) !== sampleId(v.intake), '改时间应换 ID');
ok(/^S-[0-9a-f]{10}$/.test(sampleId(v.intake)), 'ID 形如 S-<10 位哈希>');
console.log(`  ${sampleId(v.intake)} ✓`);

console.log('[C] 双盘采集');
const rec = collectSample(GOOD, { write: true, dbPath: TMP_DB, dirPath: TMP_DIR });
eq(rec.kind, 'sample', '记录类型');
const KEYS = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星', '北交点', '南交点', '上升', '天顶', '下降', '天底'];
for (const b of KEYS) ok(!!rec.charts.mine.planets[b], `本引擎缺 ${b}`);
eq(rec.bazi.pillars.length, 4, '四柱');
ok(typeof rec.bazi.ratio === 'number', '强弱占比');
ok(rec.bazi.yongJi.yong && rec.bazi.yongJi.ji, '用忌神');
if (hasKerykeion()) {
  for (const b of KEYS) ok(!!rec.charts.kerykeion.planets[b], `kerykeion 缺 ${b}`);
  eq(rec.consistencyOk, true, '双盘一致性应通过');
  ok(rec.consistency.maxBodyDelta <= 0.05, `星体最大 Δ${rec.consistency.maxBodyDelta}° > 0.05`);
  ok(rec.consistency.angles.asc <= 0.15 && rec.consistency.angles.mc <= 0.15, '四轴 Δ 超阈值');
  ok(rec.consistency.aspect.rate >= 0.8, `硬相位覆盖率 ${rec.consistency.aspect.rate}`);
  eq(rec.consistency.perBody.length, 10, '可比星体 10 个');
  ok(rec.consistency.perBody.every((x) => x.signMatch), '10 行星星座应逐一致');
  console.log(`  Δ星体 ${rec.consistency.maxBodyDelta}°｜Δ上升 ${rec.consistency.angles.asc}°｜相位 ${rec.consistency.aspect.covered}/${rec.consistency.aspect.kerykeion} ✓`);
} else {
  console.log('  kerykeion 不可用 → 仅本引擎盘（一致性跳过）');
}

console.log('[D] 写库与去重');
ok(existsSync(TMP_DB), '库文件已建');
ok(existsSync(join(TMP_DIR, `${rec.id}.json`)), '单样本快照已建');
collectSample(GOOD, { write: true, dbPath: TMP_DB, dirPath: TMP_DIR });
const rawLines = readFileSync(TMP_DB, 'utf8').split('\n').filter(Boolean).length;
eq(rawLines, 2, '只追加：两次采集 → 2 行事件');
eq(loadSamples(TMP_DB).length, 1, '回放去重后 1 条样本');
console.log(`  追加 ${rawLines} 行 / 回放 ${loadSamples(TMP_DB).length} 条 ✓`);

console.log('[E] 事件对齐');
eq(yearGanZhi(2022), '壬寅', '2022 流年');
eq(yearGanZhi(2024), '甲辰', '2024 流年');
const ev = rec.events;
eq(ev.length, 2, '事件数');
for (const e of ev) {
  ok(e.liuNian.ganzhi && e.liuNian.zhi, `${e.year} 缺流年`);
  ok(Array.isArray(e.hits), `${e.year} 缺 hits`);
  ok(typeof e.activation === 'boolean', `${e.year} 缺 activation`);
  ok(e.daYun && e.daYun.ganzhi, `${e.year} 缺大运`);
  ok(e.shiShen, `${e.year} 缺流年十神`);
}
const e2022 = ev.find((x) => x.year === 2022);
eq(e2022.liuNian.ganzhi, '壬寅', '2022 对齐');
ok(e2022.hits.length > 0, '2022 应引动原局（合亥/害巳）');
console.log(`  ${ev.map((x) => `${x.year}${x.liuNian.ganzhi}(${x.hits.map((h) => h.type + h.with).join('/') || '无'})`).join('  ')} ✓`);

console.log('[F] 后端注册表');
eq(BACKENDS.length, 2, '两个后端');
eq(PRIMARY_BACKEND, 'mine', '主后端 R-W12');
const m = computeChart('mine', { at: F.T7, lon: 104.06, lat: 30.67, tzName: 'Asia/Shanghai' });
for (const b of KEYS) ok(!!m.planets[b], `mine 后端缺 ${b}`);
ok(HARD_ASPECTS.has('对冲') && HARD_ASPECTS.has('四分相') && HARD_ASPECTS.has('梅花相'), '硬相位集合');
let threw = false;
try { computeChart('nonexistent', { at: F.T7, lon: 1, lat: 1 }); } catch { threw = true; }
ok(threw, '未知后端应抛错');
const d = computeDual({ at: F.T7, lon: 104.06, lat: 30.67, tzName: 'Asia/Shanghai' });
ok(d.mine && (d.kerykeion || d.keryErr), 'computeDual 结构');
console.log(`  两后端同 schema ✓；未知后端抛错 ✓；computeDual ${d.kerykeion ? '双盘' : `单盘（${d.keryErr}）`} ✓`);

console.log('[G] 统计');
const st = sampleStats(TMP_DB, join(PROJ, '.tmp', 'lib-none.jsonl'));
eq(st.total, 1, '样本数');
eq(st.events, 2, '事件数');
ok(st.byCategory['家庭'] === 1 || st.byCategory['健康'] === 1, '类别枚举聚合');
ok(typeof st.eventActivationRate === 'number', '事件引动率');
console.log(`  ${JSON.stringify(st.byCategory)}｜引动率 ${(st.eventActivationRate * 100).toFixed(0)}% ✓`);

console.log('[H] 事件类别枚举（R-S6）');
eq(EVENT_CATEGORIES.length, 12, '枚举项数');
eq(normalizeCategory('家庭/健康').category, '家庭', '复合写法取第一个可识别值');
eq(normalizeCategory('家庭/健康').tags.join(), '健康', '其余进 tags');
eq(normalizeCategory('婚恋').category, '婚恋', '单值');
eq(normalizeCategory('随便').category, null, '不可识别应为 null');
ok(normalizeCategory('家庭/玄学').unknown.join() === '玄学', '未收录值进 unknown');
ok(validateSample({ ...GOOD, life_events: [{ year: 2022, event: 'x', category: '随便' }] }).ok === false, '非法类别应报错');
ok(validateSample({ ...GOOD, life_events: [{ year: 2022, event: 'x' }] }).ok === false, 'category 必填');
ok(validateSample({ ...GOOD, life_events: [{ year: 2022, event: 'x', category: '家庭/健康' }] }).ok === true, '复合写法应被归一化后通过');
console.log('  12 项枚举｜复合归一｜非法/缺失报错 ✓');

console.log('[I] 规则打通（样本 → rules 证据链）');
const TMPLIB = join(PROJ, '.tmp', 'lib-test.jsonl');
rmSync(TMPLIB, { force: true });
eq(RULE_SPECS.length, 7, '规则规格数（A1–A4 + B1–B3）');
eq(RULE_SPECS.filter((r) => r.family === 'A').length, 4, 'A 族 4 条');
eq(RULE_SPECS.filter((r) => r.family === 'B').length, 3, 'B 族 3 条');
const recR = collectSample(GOOD, { write: true, dbPath: TMP_DB, dirPath: TMP_DIR, libPath: TMPLIB });
ok(recR.rules?.length === 7, '每样本产出 7 条规则结论');
ok(recR.rules.some((r) => r.status === 'support'), '该样本应至少支持 1 条 A 族规则');
ok(recR.rules.every((r) => ['support', 'contradict', 'notApplicable', 'pending-ensemble'].includes(r.status)), '状态取值合法');
ok(Object.keys(recR.dignity ?? {}).length > 0, '应记录行星尊贵');
const lib = buildLibrary(TMPLIB);
ok(lib.size > 0, '规则证据应写进 rules 库');
const aKey = [...lib.keys()].find((k) => k.startsWith('规则:A'));
ok(!!aKey, `rules 库应含规则证据键，实得 ${[...lib.keys()].join(',')}`);
eq(lib.get(aKey).chartCount, 1, '1 张盘');
eq(lib.get(aKey).status, 'pending', '1 盘不足以 verified');
// 门槛验证：补两张不同命盘的证据 → verified（证明样本证据与 6.7 门槛完全兼容）
observe({ claim: lib.get(aKey).claim, from: aKey.split('→')[0], to: aKey.split('→')[1], chartId: 'T2', supports: true }, TMPLIB);
observe({ claim: lib.get(aKey).claim, from: aKey.split('→')[0], to: aKey.split('→')[1], chartId: 'T3', supports: true }, TMPLIB);
eq(buildLibrary(TMPLIB).get(aKey).status, 'verified', '3 盘 0 反例应升级 verified');
observe({ claim: lib.get(aKey).claim, from: aKey.split('→')[0], to: aKey.split('→')[1], chartId: 'T4', supports: false }, TMPLIB);
eq(buildLibrary(TMPLIB).get(aKey).status, 'contradicted', '出现反例应降级');
const rows = sampleRuleStats(loadSamples(TMP_DB), buildLibrary(TMPLIB));
eq(rows.length, 7, '规则统计行数');
ok(rows.filter((r) => r.family === 'A').every((r) => typeof r.support === 'number'), 'A 族含支持/反例计数');
ok(rows.filter((r) => r.family === 'B').every((r) => r.verdict), 'B 族含判定（样本不足/支持/反例/无差异）');
const shown = renderSampleRules(TMP_DB);
ok(/规则复现统计/.test(shown) && /门槛/.test(shown), '报表应含标题与门槛说明');
console.log(`  7 条规则结论 ✓；证据键 ${aKey} ✓；补 2 盘→verified、加反例→contradicted ✓；报表 ✓`);
rmSync(TMPLIB, { force: true });

rmSync(TMP_DB, { force: true }); rmSync(TMP_DIR, { recursive: true, force: true });
console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
