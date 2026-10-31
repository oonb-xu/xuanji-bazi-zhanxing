// G 系列：女命星盘降级 + 主张审计 自检（exit 0 = 全过）
//  A 星盘降级状态与屏蔽清单  B 可用/不可用数据的自洽性  C 撤回主张已登记  D 「三会木局」误判的核实
import { existsSync, readFileSync } from 'node:fs';
import { F } from './_fixtures.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

const CH = join(ROOT, 'data', 'charts', 'CASE-002.json');
const CL = join(ROOT, 'data', 'claims', 'claim-audit.jsonl');

console.log('[A] 女命星盘降级（R-G8 / R-G11）');
ok(existsSync(CH), '缺 data/charts/CASE-002.json');
if (existsSync(CH)) {
  const c = JSON.parse(readFileSync(CH, 'utf8'));
  eq(c.status, 'unverified_house_cusps', '状态须为 unverified_house_cusps');
  // 屏蔽清单：宫位相关的每一项都必须 blocked=true
  const mustBlock = ['house', 'houseRulers', 'angularity', 'derivedHouseTopics', 'ascendantSignClaim'];
  for (const k of mustBlock) ok(c.blocked?.[k]?.blocked === true, `必须屏蔽 ${k}`);
  // 可用清单：四柱与星座级必须在可用里
  ok(c.usable?.['八字四柱']?.confidence === 'high', '四柱须标 high');
  ok(c.usable?.['星座级位置']?.上升?.confidence === 'low', '上升须标 low');
  eq(c.usable['星座级位置'].上升.value, '巨蟹 0.98°', '上升值须记录');
  ok(/双子/.test(c.usable['星座级位置'].上升.caveat), '上升须注明"可能为双子"');
  ok(c.usable?.['星座级位置']?.太阳?.confidence === 'high', '太阳须标 high');
  // 撤回清单
  ok(Array.isArray(c.previousClaimsToWithdraw) && c.previousClaimsToWithdraw.length >= 2, '须登记撤回/降级的主张');
  ok(c.previousClaimsToWithdraw.some((x) => /11 宫/.test(x.claim) && x.verdict === 'withdrawn'), '「太阳 11 宫」须标 withdrawn');
  console.log(`  状态 ${c.status}｜屏蔽 ${mustBlock.length} 类｜可用 ${Object.keys(c.usable).length} 类｜撤回 ${c.previousClaimsToWithdraw.length} 条 ✓`);
}

console.log('[B] 四柱双路径一致性（真太阳时 vs 民用时）');
{
  const { compileBazi } = await import('../src/bazi/engine.mjs');
  const { baziClock } = await import('../src/western/truesolar.mjs');
  const bc = baziClock({ date: '2008-04-16', time: '10:30', lon: 104.06, tz: 8 });
  const viaTrueSolar = compileBazi({ at: bc.at, gender: '女' }).pillars.join('');
  const viaCivil = compileBazi({ at: F.T5, gender: '女' }).pillars.join('');
  eq(viaTrueSolar, '戊子丙辰丙戌癸巳', '经真太阳时的四柱');
  eq(viaCivil, '戊子丙辰丙戌癸巳', '经民用时的四柱（两者须一致 —— 同在巳时）');
  eq(viaTrueSolar, viaCivil, '★ 两条路径必须给出同一四柱（这正是四柱可信度为 high 的依据）');
  console.log(`  真太阳时 ${bc.at} 与民用时 10:30 均得 ${viaTrueSolar} ✓`);
}

console.log('[C] 主张审计登记');
ok(existsSync(CL), '缺 data/claims/claim-audit.jsonl');
if (existsSync(CL)) {
  const rows = readFileSync(CL, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  ok(rows.length >= 2, `审计条目应 ≥2，实得 ${rows.length}`);
  const a1 = rows.find((r) => r.id === 'A-0001');
  ok(a1, '须登记 A-0001（三会木局误判）');
  ok(/锚点错位/.test(a1.verdict), '判定须含「锚点错位」');
  ok(/跨盘拼接/.test(a1.methodologicalError ?? ''), '须写明方法论错误 = 跨盘拼接结构零件');
  // ★ 核实项：女命无寅无卯、男命无寅有卯（胎元）、男命命宫是酉不是寅
  const fc = a1.factCheck;
  ok(fc.女命地支.has辰 === true && fc.女命地支.has寅 === false && fc.女命地支.has卯 === false, '女命地支须为 有辰/无寅/无卯');
  ok(fc.男命地支.has寅 === false && fc.男命地支.has卯 === false, '男命地支须无寅无卯');
  ok(fc.男命胎元.支 === '卯', '男命胎元须为卯');
  eq(fc.男命命宫.value, '己酉', '★ 男命命宫须为 己酉（更正用户归因中的「寅」）');
  ok(/有误/.test(fc.男命命宫.note ?? ''), '须在记录中标明用户归因中的事实错误');
  ok(/不可能成立/.test(a1.conclusion), '结论须明确木局不可能成立');
  console.log(`  审计 ${rows.length} 条｜A-0001 判定「${a1.verdict}」｜事实核实含命宫更正 ✓`);
}

console.log('[D] 耦合度零分布（3000 对规格 + 20 万对交叉核验）');
{
  const f3 = join(ROOT, 'data', 'cross', 'coupling-null-3000.json');
  const f200 = join(ROOT, 'data', 'cross', 'coupling-null.json');
  if (!existsSync(f3)) console.log('  SKIP：缺 3000 对结果（--pairs 3000 输出到 coupling-null.json 后另存）');
  else {
    const j = JSON.parse(readFileSync(f3, 'utf8')).meta;
    eq(j.pairs, 3000, '配对数须为 3000');
    ok(typeof j.pGreater === 'number' && typeof j.pLess === 'number' && typeof j.pTwo === 'number', '须给出经验 P（单侧×2 + 双侧）');
    // 观测落在中位附近 ⇒ 双侧 P 应接近 1（即完全普通）
    ok(j.pTwo > 0.5, `双侧 P 应 >0.5（观测贴中位），实得 ${j.pTwo}`);
    ok(Math.abs(j.percentile - 0.5) < 0.1, `观测分位应接近 P50，实得 P${(j.percentile * 100).toFixed(1)}`);
    if (existsSync(f200)) {
      const k = JSON.parse(readFileSync(f200, 'utf8')).meta;
      ok(Math.abs(k.mean - j.mean) < 0.02, `两次运行的均值须一致（3000 对 ${j.mean} vs 20 万对 ${k.mean}）`);
    }
    console.log(`  3000 对：均值 ${j.mean}±${j.sd}｜观测 ${j.observed} 落 P${(j.percentile * 100).toFixed(1)}｜双侧 P=${j.pTwo} ✓`);
  }
}

console.log('[E] daYun 回归钉（R-G6：入参形状必须机检）');
{
  const { compileBazi } = await import('../src/bazi/engine.mjs');
  const { daYun } = await import('../src/cross/timing.mjs');
  const F = compileBazi({ at: F.T1, gender: '女' });
  const M = compileBazi({ at: F.T6, gender: '男' });
  ok(Array.isArray(F.pillars) && typeof F.pillars[0] === 'string', '前置：pillars 必须是字符串数组');
  const dyF = daYun(F.pillars, new Date('2008-07-04'), '女');
  const dyM = daYun(M.pillars, new Date('2007-12-25'), '男');
  eq(dyF.direction, '逆行', '★ 戊(阳)年女命须逆行（旧 bug：年干读成 undefined 恒作阴 ⇒ 顺行）');
  eq(dyM.direction, '逆行', '丁(阴)年男命须逆行');
  eq(dyF.steps[0].ganzhi, '丁巳', '女命月柱戊午 逆排首位应为 丁巳（旧 bug 给出甲子）');
  eq(dyM.steps[0].ganzhi, '辛亥', '男命月柱壬子 逆排首位应为 辛亥（旧 bug 给出壬戌）');
  const G = '甲乙丙丁戊己庚辛壬癸', Z = '子丑寅卯辰巳午未申酉戌亥';
  const idx = (gz) => { for (let i = 0; i < 60; i++) if (G[i % 10] === gz[0] && Z[i % 12] === gz[1]) return i; return -1; };
  for (const [label, dy] of [['女', dyF], ['男', dyM]]) {
    let prev = idx(dy.steps[0].ganzhi), good = true;
    for (let k = 1; k < dy.steps.length; k++) { const cur = idx(dy.steps[k].ganzhi); if (((cur - prev + 60) % 60) !== 59) { good = false; break; } prev = cur; }
    ok(good, `${label}命大运序列须逆序连续（每步 −1）`);
  }
  let threw = false;
  try { daYun([{ zhi: '子' }, { gan: '戊', zhi: '午' }], new Date('2008-07-04'), '女'); } catch { threw = true; }
  ok(threw, '★ 年柱缺 gan 时必须抛错（禁静默用 undefined）');
  console.log(`  女命 ${dyF.direction} 起 ${dyF.steps[0].ganzhi}｜男命 ${dyM.direction} 起 ${dyM.steps[0].ganzhi} ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
