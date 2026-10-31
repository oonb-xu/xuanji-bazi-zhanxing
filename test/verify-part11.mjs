// Part 11 修正版自检（exit 0 = 全过）
//  A 置信度闸门（修正指令3 / R-B13）——封顶 0.6 与禁入正式库
//  B 月将→黄经区间（修正指令2 步骤1–3 / R-A9，第一优先级天文约束）
//  C 黄经→地支→五行（L2 盘面层，两侧共同时空坐标）
//  D 事项类别归一（修正指令1 的事件共振口径）
//  E 卡方检验可复算 + 空表防护
//  F 检验产物落地 + 结论为负的显式记录
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIDENCE_CAP, gateConfidence, zhiOfLongitude, wuxingOfLongitude, categoryOfMatter, chiSquare } from '../cli-resonance.mjs';
import { YUE_JIANG_TO_QI } from '../cli-calib.mjs';
import { eclipticLongitude } from '../src/western/zodiac.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 置信度闸门（R-B13）');
eq(CONFIDENCE_CAP, 0.6, '封顶值必须为 0.6');
{
  const blocked = gateConfidence(0.95);
  eq(blocked.capped, 0.6, '无天文约束且无双事件验证 → 封顶 0.6');
  eq(blocked.writable, false, '被封顶的配对必须禁入正式库');
  ok(blocked.blocked === true, '应标记为 blocked');
  const astro = gateConfidence(0.95, { hasAstroConstraint: true });
  eq(astro.capped, 0.95, '有天文物理约束 → 不封顶');
  eq(astro.writable, true, '有独立约束 → 可入库');
  const dual = gateConfidence(0.95, { hasDualEventWitness: true });
  eq(dual.capped, 0.95, '有双重事件验证 → 不封顶');
  const low = gateConfidence(0.4);
  eq(low.capped, 0.4, '低于封顶值时不应被抬高');
  eq(low.writable, false, '低置信度且无约束 → 仍禁入');
  console.log('  封顶 0.6｜禁入正式库｜有约束才放行 ✓');
}

console.log('[B] 月将 → 太阳黄经区间（R-A9 第一优先级约束）');
{
  // 12 个月将都须有对应中气
  const yjs = Object.keys(YUE_JIANG_TO_QI);
  eq(yjs.length, 12, '应覆盖 12 个月将');
  eq(YUE_JIANG_TO_QI['午'], '大暑', '午将 ⇒ 大暑后');
  eq(YUE_JIANG_TO_QI['丑'], '冬至', '丑将 ⇒ 冬至后');
  eq(YUE_JIANG_TO_QI['戌'], '春分', '戌将 ⇒ 春分后');
  eq(YUE_JIANG_TO_QI['亥'], '雨水', '亥将 ⇒ 雨水后');
  // 反向验证：大暑时的太阳黄经须落在 [120,150)
  const lon = eclipticLongitude('太阳', new Date(Date.UTC(2025, 6, 25)));   // 7/25 ≈ 大暑后
  ok(lon >= 120 && lon < 150, `大暑后太阳黄经应 ∈[120,150)，实得 ${lon.toFixed(2)}°`);
  console.log(`  12 个月将齐备｜大暑(7/25) λ☉=${lon.toFixed(2)}° ∈[120,150) ✓`);
}

console.log('[C] 黄经 → 地支 → 五行（共同时空坐标）');
{
  // 口径以 L2 公式为准：L = 270 + 30i ⇒ i = ((L−270)/30) mod 12
  eq(zhiOfLongitude(270), '子', 'λ=270° → i=0 → 子');
  eq(zhiOfLongitude(300), '丑', 'λ=300° → i=1 → 丑');
  eq(zhiOfLongitude(0), '卯', 'λ=0° → i=(−9 mod 12)=3 → 卯');
  eq(zhiOfLongitude(90), '午', 'λ=90° → i=(−6 mod 12)=6 → 午');
  eq(wuxingOfLongitude(270), '水', '子 → 水');
  eq(wuxingOfLongitude(0), '木', '卯 → 木');
  eq(wuxingOfLongitude(90), '火', '午 → 火');
  // 12 宫全覆盖且与地支一一对应
  const set = new Set();
  for (let i = 0; i < 12; i++) set.add(zhiOfLongitude(270 + 30 * i));
  eq(set.size, 12, '12 宫须映射到 12 个不同地支');
  console.log('  12 宫↔12 支一一对应｜五行映射正确 ✓');
}

console.log('[D] 事项类别归一（事件共振口径）');
eq(categoryOfMatter('前程'), '事业功名', '占前程 → 事业功名');
eq(categoryOfMatter('赴任及前程'), '事业功名', '占赴任及前程 → 事业功名');
eq(categoryOfMatter('病'), '疾病', '占病 → 疾病');
eq(categoryOfMatter('宅'), '家宅', '占宅 → 家宅');
eq(categoryOfMatter('求财'), '财运', '占求财 → 财运');
eq(categoryOfMatter('婚姻'), '婚恋', '占婚姻 → 婚恋');
eq(categoryOfMatter('乱七八糟'), '其他', '无法归类 → 其他');
console.log('  7 类归一 + 兜底 ✓');

console.log('[E] 卡方检验');
{
  const empty = chiSquare([]);
  eq(empty.p, 1, '空表应返回 p=1（防护，不得抛错）');
  ok(empty.empty === true, '空表须标记 empty');
  const perfect = chiSquare([[100, 0], [0, 100]]);
  ok(perfect.p < 0.001, `完全分离应极显著，实得 p=${perfect.p}`);
  const same = chiSquare([[50, 50], [50, 50]]);
  ok(same.p > 0.9, `完全一致应不显著，实得 p=${same.p}`);
  eq(same.df, 1, 'df = (2−1)(2−1) = 1');
  // 可复算
  const a = chiSquare([[10, 20], [30, 40]]), b = chiSquare([[10, 20], [30, 40]]);
  eq(a.chi2, b.chi2, '卡方可复算');
  console.log(`  空表防护｜完全分离 p=${perfect.p.toFixed(6)}｜一致 p=${same.p.toFixed(3)} ✓`);
}

console.log('[F] 检验产物与负结果记录');
{
  const OUT = join(HERE, '..', 'data', 'cross', 'resonance.json');
  if (!existsSync(OUT)) console.log('  SKIP：缺 resonance.json（先跑 cli-resonance.mjs --run）');
  else {
    const j = JSON.parse(readFileSync(OUT, 'utf8'));
    ok(typeof j.meta.test6?.p === 'number', '侧 A 卡方 p 须记录');
    ok(typeof j.meta.ved?.test?.p === 'number', '侧 B 卡方 p 须记录');
    eq(j.meta.cap, 0.6, '产物须记录置信度封顶值');
    // ★ 显式钉住"负结果"：两侧 p 均不显著 —— 若未来变显著，测试会失败并提示复核
    ok(j.meta.test6.p > 0.05, `侧 A 当前为负结果（p=${j.meta.test6.p}）；若变显著须复核而非直接采信`);
    ok(j.meta.ved.test.p > 0.05, `侧 B 当前为负结果（p=${j.meta.ved.test.p}）`);
    console.log(`  侧 A p=${j.meta.test6.p.toFixed(4)}｜侧 B p=${j.meta.ved.test.p.toFixed(4)}｜封顶 ${j.meta.cap} ✓`);
  }
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
