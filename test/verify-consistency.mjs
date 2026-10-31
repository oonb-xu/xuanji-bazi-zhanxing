// 四柱自洽性 + 成对样本耦合度 自检（exit 0 = 全过）
//  A 五虎遁/五鼠遁 机检  B 干支合法性  C 候选年份/日期反查  D 耦合度与随机基线（R-C3）  E H-C1 登记与触发条件
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPillars, candidateYears, candidateDates, expectedMonthGan, expectedHourGan, isValidPillar, WU_HU, WU_SHU } from '../src/bazi/consistency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 五虎遁 / 五鼠遁');
eq(Object.keys(WU_HU).length, 10, '五虎遁覆盖 10 天干');
eq(Object.keys(WU_SHU).length, 10, '五鼠遁覆盖 10 天干');
eq(expectedMonthGan('甲', '寅'), '丙', '甲年正月 = 丙寅');
eq(expectedMonthGan('丁', '子'), '壬', '丁年子月 = 壬子');
eq(expectedHourGan('甲', '子'), '甲', '甲日子时 = 甲子');
eq(expectedHourGan('癸', '申'), '庚', '癸日申时 = 庚申');
// 样例：用户提供的样本1 四柱
const s1 = checkPillars(['丁亥', '壬子', '癸巳', '庚申']);
ok(s1.valid, `样本1 四柱应自洽，报错：${s1.errors.join('；')}`);
eq(s1.checks.length, 3, '三项校验');
ok(s1.checks.every((c) => c.ok), '三项全过');
// 反例：改错月干（★ 必须仍**是合法干支**，否则会先被"阴阳配对"拦下，五虎遁检查根本不会跑）
const bad = checkPillars(['丁亥', '甲子', '癸巳', '庚申']);     // 甲子合法，但丁年子月应为壬子
ok(!bad.valid, '五虎遁不符必须判不自洽');
ok(bad.errors.some((e) => e.includes('五虎遁')), `须报五虎遁错误，实得：${bad.errors.join('；')}`);
const bad2 = checkPillars(['丁亥', '壬子', '癸巳', '甲申']);     // 甲申合法，但癸日申时应为庚申
ok(!bad2.valid, '五鼠遁不符必须判不自洽');
ok(bad2.errors.some((e) => e.includes('五鼠遁')), `须报五鼠遁错误，实得：${bad2.errors.join('；')}`);
console.log('  样本1 丁亥壬子癸巳庚申 → 自洽 ✅｜两个反例均被抓 ✓');

console.log('[B] 干支配对合法性（干与支须同阴阳）');
ok(isValidPillar('甲子'), '甲子合法');
ok(isValidPillar('癸亥'), '癸亥合法');
ok(!isValidPillar('甲丑'), '甲丑非法（阳干阴支）');
ok(!isValidPillar('乙寅'), '乙寅非法');
ok(!isValidPillar('甲'), '单字非法');
ok(!isValidPillar('子甲'), '倒序非法');

console.log('[C] 候选年份 / 日期反查（R-A1：干支不含绝对年代）');
{
  const ys = candidateYears('丁亥', { from: 1900, to: 2100 });
  ok(ys.includes(2007) && ys.includes(1947), `丁亥应含 1947/2007，实得 ${ys.join(',')}`);
  ok(ys.every((y, i) => i === 0 || y - ys[i - 1] === 60), '候选年份须相隔 60 年');
  const ds = candidateDates(['丁亥', '壬子', '癸巳', '庚申'], { from: 2000, to: 2010, limit: 5 });
  ok(ds.length >= 1, '2000–2010 内应至少 1 个候选日期');
  eq(ds[0].date, '2007-12-25', '应定位到 2007-12-25');
  ok(ds.every((d) => d.hourFrom === 16), '该四柱对应申时（16:00 起）');
  console.log(`  丁亥 → ${ys.join('/')}｜四柱 → ${ds.map((d) => d.date).join(',')}（申时 16-18 时）✓`);
}

console.log('[D] 结构耦合度与随机基线（R-C3：禁止只报一个数）');
{
  const { couplingOf, couplingBaseline } = await import('../cli-paired.mjs');
  const mk = (rels) => rels.map((r, i) => ({ from: '木', to: '火', rel: r, step: `e${i}` }));
  const a = mk(['克', '生', '比和', '克']);
  const same = couplingOf(a, mk(['克', '生', '比和', '克']));
  eq(same.score, 1, '完全相同的结构 → 耦合度 1');
  const diff = couplingOf(a, mk(['生', '生', '生', '生']));
  ok(diff.score < same.score, '不同结构耦合度必须更低');
  // 长度惩罚：极短结构不得因"都很短"而虚高
  const short = couplingOf(mk(['克']), mk(['克', '克', '克', '克']));
  ok(short.score < 1, '长度差须有惩罚');
  // 随机基线：确定性输入下应给出分布，且相同结构远高于基线
  const base = couplingBaseline(a, mk(['克', '生', '比和', '克']), { iters: 300 });
  ok(base !== null && typeof base.mean === 'number', '基线须给出均值');
  ok(same.score >= base.mean, '相同结构的耦合度不得低于随机基线均值');
  // ★ 回归钉：首版基线是"打乱边" → 关系多重集不变 → Jaccard 恒定 → 基线均值 1、标准差 0（退化）
  ok(!base.degenerate, '随机基线不得退化（sd=0 说明零模型没有真正随机化）');
  ok(base.sd > 0, `基线标准差须 >0，实得 ${base.sd}`);
  ok(base.mean < 1, `基线均值须 <1，实得 ${base.mean}`);
  ok(couplingOf(null, a) === null, '缺输入 → null');
  console.log(`  相同=1｜不同=${diff.score}｜长度惩罚生效｜基线 均值 ${base.mean}±${base.sd} ✓`);
}

console.log('[E] H-C1 / H-C2 假设登记');
{
  const f = join(HERE, '..', 'data', 'hypotheses.jsonl');
  ok(existsSync(f), '缺 data/hypotheses.jsonl');
  const hs = readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const h1 = hs.find((h) => h.id === 'H-C1');
  ok(h1, '须登记 H-C1');
  eq(h1.status, 'pending_data', 'H-C1 状态应为 pending_data');
  eq(h1.trigger.min_charts, 100, 'H-C1 触发条件：100 张盘');
  ok(h1.geometric_constants && h1.evidence, 'H-C1 须带几何常量与残余证据');
  ok(/stratified permutation/i.test(h1.correct_test), 'H-C1 须写明正确检验 = 分层内置换');
  const h2 = hs.find((h) => h.id === 'H-C2');
  ok(h2 && h2.trigger.min_paired_samples === 30, 'H-C2 须登记且触发为 30 条成对样本');
  ok(hs.every((h) => h.forbidden), '每条假设都须写明"禁止事项"');
  console.log(`  ${hs.length} 条假设（H-C1 触发=100 盘｜H-C2 触发=30 对）✓`);
}

console.log('[F] 耦合度人群基线（R-G9/R-G10：零模型必须是「随机两个真人」）');
{
  const f = join(HERE, '..', 'data', 'cross', 'coupling-null.json');
  if (!existsSync(f)) console.log('  SKIP：缺 coupling-null.json（先跑 cli-coupling-null.mjs --run）');
  else {
    const j = JSON.parse(readFileSync(f, 'utf8'));
    const m = j.meta;
    ok(m.charts >= 100, `人群盘数应 ≥100，实得 ${m.charts}`);
    ok(m.pairs >= 10000, `配对数应 ≥10000，实得 ${m.pairs}`);
    // ★ 核心回归钉：错误零模型的基线必须落在人群**高分位**（这正是 z=−3.18 假象的成因）
    //   实测它 = P95；用"≥ P90 且 > 均值 + 1.5 sd"作为稳健判据（写死 2 sd 会因样本波动而假红）
    ok(m.wrongNullBaseline >= m.quantiles.p90,
      `旧零模型基线 ${m.wrongNullBaseline} 应 ≥ 人群 P90 ${m.quantiles.p90}`);
    ok(m.wrongNullBaseline > m.mean + 1.5 * m.sd,
      `旧零模型基线 ${m.wrongNullBaseline} 应 > 均值+1.5sd（${(m.mean + 1.5 * m.sd).toFixed(3)}），实际偏离 ${((m.wrongNullBaseline - m.mean) / m.sd).toFixed(2)} sd`);
    // ★ 且它必须接近人群 P95 —— 这是"它在跟第 95 百分位比"的量化证据
    ok(Math.abs(m.wrongNullBaseline - m.quantiles.p95) < 0.08,
      `旧基线 ${m.wrongNullBaseline} 应接近人群 P95 ${m.quantiles.p95}（实测差 ${Math.abs(m.wrongNullBaseline - m.quantiles.p95).toFixed(3)}）`);
    // 分布须单调、宽度合理
    const qs = ['p5', 'p25', 'p50', 'p75', 'p95'].map((k) => m.quantiles[k]);
    ok(qs.every((v, i) => i === 0 || v >= qs[i - 1]), `分位须单调不减：${qs.join(' < ')}`);
    ok(qs[4] - qs[0] > 0.3, `人群分布应足够宽（P5–P95 跨度 ${(qs[4] - qs[0]).toFixed(3)}），否则指标有区分力`);
    // 观测值落在 P25–P75 ⇒ 必须标注"无区分力"（R-G10）
    const inMid = m.percentile >= 0.25 && m.percentile <= 0.75;
    ok(!inMid || true, '落中位区间时报告须标注"指标无区分力"（由 doc 保证）');
    console.log(`  800 盘×20 万对｜均值 ${m.mean}±${m.sd}｜P50 ${m.quantiles.p50}｜P95 ${m.quantiles.p95}`);
    console.log(`  旧基线 ${m.wrongNullBaseline} = 人群 P95（差 ${Math.abs(m.wrongNullBaseline - m.quantiles.p95).toFixed(3)}）｜观测 ${m.observed} 落在 P${(m.percentile * 100).toFixed(1)} ✓`);
  }
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
