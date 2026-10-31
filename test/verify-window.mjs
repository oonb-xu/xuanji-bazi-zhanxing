// 适婚窗口加权 回归钉（用户命题：20-40 是成婚基础，核心窗口差运 ⇒ 成婚基本没有可能）
import { compileBazi } from '../src/bazi/engine.mjs';
import { dayunAlignment, ageWeight, marriageWindow } from '../cli-dayun-align.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);
const near = (a, b, d, m) => ok(Math.abs(a - b) <= d, `${m}：期望≈${b}(±${d}) 实得 ${a}`);

console.log('[A] 年龄权重必须非对称（核心窗口最高，后期靠前期缓冲）');
{
  eq(ageWeight(30), 1.0, '30 岁 = 峰值 1.0');
  ok(ageWeight(25) === 1.0 && ageWeight(36) === 1.0, '24–36 全为 1.0');
  ok(ageWeight(18) < 0.3, '18 岁应很低（0.2）');
  ok(ageWeight(45) < ageWeight(40), '45 岁应低于 40 岁');
  ok(ageWeight(50) < ageWeight(45), '50 岁应低于 45 岁');
  ok(ageWeight(40) < ageWeight(36), '★ 40 岁应低于核心窗 36 岁');
  console.log('  ' + [18, 22, 25, 30, 36, 40, 45, 50].map((a) => a + '→' + ageWeight(a).toFixed(2)).join(' | ') + ' ✓');
}

console.log('[B] 丙火女：核心窗口 0% ⇒ 必须 severe 否决');
{
  const F2 = compileBazi({ pillars: ['戊子', '丙辰', '丙戌', '癸巳'], gender: '女' });
  F2.input = { ...(F2.input ?? {}), birthDate: '2008-04-16' };
  const r = dayunAlignment(F2, F2, { sexA: '女', sexB: '女' });
  eq(r.window.coreFraction, 0, '★ 丙火女核心窗口(24–36)共同吉运必须为 0');
  eq(r.window.veto, 'weak', '自身对照时 veto 应为 weak（windowFraction 0.19）');
  ok(r.window.windowFraction < 0.30, '适婚窗比例应 <0.30');
  console.log(`  核心=${r.window.coreFraction} 窗=${r.window.windowFraction} veto=${r.window.veto} ✓`);
}

console.log('[C] 男×丙火女：severe 否决；男×乙木女：normal');
{
  const M = compileBazi({ pillars: ['丁亥', '壬子', '癸巳', '庚申'], gender: '男' });
  M.input = { ...(M.input ?? {}), birthDate: '2007-12-25' };
  const F3 = compileBazi({ pillars: ['戊子', '戊午', '乙巳', '甲申'], gender: '女' });
  F3.input = { ...(F3.input ?? {}), birthDate: '2008-07-04' };
  const F2 = compileBazi({ pillars: ['戊子', '丙辰', '丙戌', '癸巳'], gender: '女' });
  F2.input = { ...(F2.input ?? {}), birthDate: '2008-04-16' };
  const r3 = dayunAlignment(M, F3, { sexA: '男', sexB: '女' });
  const r2 = dayunAlignment(M, F2, { sexA: '男', sexB: '女' });
  eq(r2.window.veto, 'severe', '★ 男×丙火女必须 severe（核心 0%）');
  eq(r2.window.windowFraction, 0, '男×丙火女适婚窗共同吉运 = 0');
  eq(r3.window.veto, 'normal', '男×乙木女应为 normal');
  ok(r3.window.windowFraction > 0.4, '男×乙木女适婚窗应 >0.4，实得 ' + r3.window.windowFraction);
  ok(r3.window.weightedFraction > 0.5, '加权后应 >0.5');
  console.log(`  乙木女 窗=${r3.window.windowFraction} 核心=${r3.window.coreFraction} 加权=${r3.window.weightedFraction} normal ✓｜丙火女 窗=${r2.window.windowFraction} 核心=${r2.window.coreFraction} severe ✓`);
}

console.log('[D] 加权比例必须落在 [0,1] 且与全期比例不同（证明权重真在起作用）');
{
  const M = compileBazi({ pillars: ['丁亥', '壬子', '癸巳', '庚申'], gender: '男' });
  M.input = { ...(M.input ?? {}), birthDate: '2007-12-25' };
  const F3 = compileBazi({ pillars: ['戊子', '戊午', '乙巳', '甲申'], gender: '女' });
  F3.input = { ...(F3.input ?? {}), birthDate: '2008-07-04' };
  const r = dayunAlignment(M, F3, { sexA: '男', sexB: '女' });
  ok(r.window.weightedFraction >= 0 && r.window.weightedFraction <= 1, '加权比例须在 [0,1]');
  ok(r.window.weightedFraction !== r.bothFraction, '★ 加权后不应等于未加权全期比例（20–40 若与 20–50 同分布才算可疑）');
  ok(r.window.buffer !== null, '应给出前后期对比（buffer）');
  console.log(`  全期=${r.bothFraction} vs 加权=${r.window.weightedFraction}｜buffer=${r.window.buffer} ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
