// 应期/引动 回归钉（单元3）：流年干支 → 星（十神）× 宫（四柱宫位）→ 事件时间
// 判据全部机检：只依赖原局四柱 + 流年干支，独立重算不信任模块内部实现。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileBazi } from '../src/bazi/engine.mjs';
import { tenGod } from '../src/bazi/ten-gods.mjs';
import { CHONG, LIUHE, XING3, CANG, GAN_WX } from '../src/bazi/dag.mjs';
import { yearGanZhi } from '../src/cross/timing.mjs';
import { yingQi, PALACE, EVENT_TYPES, HIT_WEIGHT } from '../src/bazi/ying-qi.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${JSON.stringify(b)} 实得 ${JSON.stringify(a)}`);
const eqJson = (a, b, m) => eq(JSON.stringify(a), JSON.stringify(b), m);
const finiteNonNeg = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;

const PILLARS = ['甲子', '丙午', '戊子', '庚申'];
const WINDOW = 12;
const res = yingQi(compileBazi({ pillars: PILLARS }), { fromYear: 2020, years: WINDOW });
const byYear = (r, y) => r.hits.find((h) => h.year === y);

console.log('[A] 导出与宫位口径');
{
  ok(typeof yingQi === 'function', 'yingQi 必须是函数');
  eq(PALACE.length, 4, '四柱宫位数');
  eq(PALACE[2].name, '夫妻宫', '日支=夫妻宫（判据②钉名）');
  eq(PALACE[3].name, '子女宫', '时支=子女宫（判据③钉名）');
  eqJson(EVENT_TYPES, ['婚姻', '子女', '事业', '财运'], '事件类型闭集');
  eqJson(HIT_WEIGHT, { 冲: 0.8, 合: 0.4, 刑: 0.5 }, '权重表');
  console.log('  PALACE/闭集/权重 ✓');
}

console.log('[B] ★ 判据②：甲子/丙午/戊子/庚申 窗口 2020–2031 必含「夫妻宫 + 婚姻」（2026 丙午冲日支子）');
{
  const h = byYear(res, 2026);
  ok(h, '2026 必须在 hits 中');
  eq(h.ganzhi, '丙午', '2026 干支');
  eq(h.starTriggered, '偏印', '2026 流年干丙 对 戊日主 = 偏印');
  ok(h.palaceTriggered.includes('夫妻宫'), '2026 palaceTriggered 必须含夫妻宫');
  ok(h.eventTypes.includes('婚姻'), '2026 eventTypes 必须含婚姻');
  eq(h.score, 1.6, '2026 年支子+日支子 双冲午 ⇒ 0.8×2');
  eqJson(h.palaceTriggered, ['祖上宫', '夫妻宫'], '2026 命中宫位');
  eqJson(h.eventTypes, ['婚姻', '财运'], '2026 事件：婚姻 + 冲财官坐支子');
  ok(byYear(res, 2023)?.palaceTriggered.includes('夫妻宫'), '2023 癸卯 子卯刑也须标夫妻宫');
  console.log('  2026 丙午 → 夫妻宫 + 婚姻 + 财运，score 1.6 ✓');
}

console.log('[C] ★ 判据③：窗口内必须有「无引动」的年份（eventTypes 为空）');
{
  const empty = res.hits.filter((h) => h.eventTypes.length === 0);
  ok(empty.length >= 1, '必须存在 eventTypes 为空的年份');
  const noPalace = empty.filter((h) => h.palaceTriggered.length === 0 && h.score === 0);
  ok(noPalace.length >= 1, '必须存在完全无引动（score 0 + 空宫位）的年份，如 2028 戊申');
  eqJson(byYear(res, 2020)?.eventTypes, [], '2020 庚子：冲月支午但不对应事件 ⇒ 空');
  eqJson(byYear(res, 2028)?.palaceTriggered, [], '2028 戊申：与原局无冲/合/刑 ⇒ 空');
  eq(byYear(res, 2028)?.score, 0, '2028 score=0');
  eq(byYear(res, 2031)?.score, 0, '2031 辛亥 score=0');
  console.log(`  空事件年份 ${empty.map((h) => h.year).join('/')} ✓`);
}

console.log('[D] ★ 判据④：score 有限非负、eventTypes 闭集、排序与 schema');
{
  // 候选盘只由原局四柱驱动：逐条独立重算，不读模块内部
  const dm = PILLARS[2][0];
  const zhis = PILLARS.map((p) => p[1]);
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const caiWx = KE[GAN_WX[dm]];
  const guanWx = Object.keys(KE).find((w) => KE[w] === GAN_WX[dm]);
  const seatNames = [];
  PILLARS.forEach((p, i) => {
    const stems = i === 2 ? [] : [p[0]];
    stems.push(...(CANG[p[1]] ?? []));
    if (stems.some((g) => GAN_WX[g] === caiWx || GAN_WX[g] === guanWx)) seatNames.push(PALACE[i].name);
  });

  for (const h of res.hits) {
    ok(finiteNonNeg(h.score), `${h.year} score 必须有限非负，实得 ${h.score}`);
    ok(h.eventTypes.every((t) => EVENT_TYPES.includes(t)), `${h.year} eventTypes 必须在闭集内`);
    ok(Array.isArray(h.palaceTriggered), `${h.year} palaceTriggered 必须是数组`);
    ok(h.palaceTriggered.every((n) => PALACE.some((p) => p.name === n)), `${h.year} 宫名必须来自 PALACE`);
    eqJson(Object.keys(h).sort(), ['eventTypes', 'ganzhi', 'palaceTriggered', 'score', 'starTriggered', 'year'], `${h.year} hit 字段集`);
    eq(h.ganzhi, yearGanZhi(h.year), `${h.year} 干支须等于 yearGanZhi`);
    eq(h.starTriggered, tenGod(h.ganzhi[0], dm), `${h.year} starTriggered 须等于流年干十神`);

    // 独立重算关系与分数：优先级 冲 > 合 > 刑，逐支累加
    let sum = 0;
    const palaces = [];
    zhis.forEach((z, i) => {
      let rel = null;
      if (CHONG[z] === h.ganzhi[1]) rel = '冲';
      else if (LIUHE[z] === h.ganzhi[1]) rel = '合';
      else if (z !== h.ganzhi[1] && XING3.some((g) => g.includes(z) && g.includes(h.ganzhi[1]))) rel = '刑';
      if (rel) { sum += HIT_WEIGHT[rel]; palaces.push(PALACE[i].name); }
    });
    eq(h.score, Math.round(sum * 100) / 100, `${h.year} score 须等于独立重算的 Σ权重`);
    eqJson(h.palaceTriggered, palaces, `${h.year} palaceTriggered 须等于独立重算`);
    // 事件映射独立重算
    const types = [];
    if (palaces.includes('夫妻宫')) types.push('婚姻');
    if (palaces.includes('子女宫')) types.push('子女');
    // 财运：冲/合且该支为财官所坐支（seatNames 已在循环外独立重算）
    zhis.forEach((z, i) => {
      let rel = null;
      if (CHONG[z] === h.ganzhi[1]) rel = '冲';
      else if (LIUHE[z] === h.ganzhi[1]) rel = '合';
      if ((rel === '冲' || rel === '合') && seatNames.includes(PALACE[i].name)) {
        if (!types.includes('财运')) types.push('财运');
      }
    });
    if (['正官', '七杀'].includes(tenGod(h.ganzhi[0], dm))) types.push('事业');
    eqJson(h.eventTypes, EVENT_TYPES.filter((t) => types.includes(t)), `${h.year} eventTypes 须等于独立重算`);
  }

  eq(res.hits.length, WINDOW, 'hits 必须覆盖窗口每一年（含 0 分年）');
  eqJson(res.hits.map((h) => h.year).sort((a, b) => a - b), Array.from({ length: WINDOW }, (_, i) => 2020 + i), '年份覆盖 2020–2031');
  for (let i = 1; i < res.hits.length; i++) {
    const a = res.hits[i - 1], b = res.hits[i];
    ok(a.score > b.score || (a.score === b.score && a.year < b.year), `排序须 score 降序、同分年升序（${a.year} vs ${b.year}）`);
  }
  ok(res.topYears.every((h) => h.score > 0), 'topYears 必须全部 score>0');
  ok(res.topYears.length <= 5, 'topYears 默认上限 5');
  eq(res.topYears[0].year, 2026, 'topYears 第一名 2026');
  eq(res.topYears.length, 5, '本盘 score>0 年份 ≥5 ⇒ 默认取 5');
  eqJson(res.topYears.map((h) => h.year), [2026, 2023, 2020, 2021, 2022], 'topYears 顺序');
  console.log(`  12 年逐年独立重算一致｜topYears ${res.topYears.map((h) => `${h.year}(${h.score})`).join(' ')} ✓`);
}

console.log('[E] ★ 只依赖原局四柱 + 流年干支（不依赖 compileBazi 附加字段 / 主会话）');
{
  const bare = yingQi(PILLARS, { fromYear: 2020, years: WINDOW });
  eqJson(bare.hits, res.hits, '裸四柱与 compileBazi 结果的 hits 必须一致');
  const again = yingQi(compileBazi({ pillars: PILLARS }), { fromYear: 2020, years: WINDOW });
  eqJson(again.hits, res.hits, '同一输入两次调用必须完全一致');
  const top2 = yingQi(PILLARS, { fromYear: 2020, years: WINDOW, topN: 2 });
  eqJson(top2.topYears.map((h) => h.year), [2026, 2023], 'topN 可覆盖');
  ok(!('L3_distribution' in res) && !('L5_yongJi' in res), '返回值不得夹带引擎层字段');
  // 源码级约束：只允许 import 已提交的 timing/ten-gods/dag（不 import 单元1/2 新文件）
  const srcPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'bazi', 'ying-qi.mjs');
  const src = readFileSync(srcPath, 'utf8');
  const froms = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  eqJson(froms.sort(), ['../cross/timing.mjs', './dag.mjs', './ten-gods.mjs'], '★ import 白名单（独立验收，不引单元1/2）');
  console.log('  裸四柱/编译盘/重复调用一致，import 白名单 ✓');
}

console.log('[F] 星宫事件口径逐条钉死（合/刑/官杀/时支）');
{
  const h2021 = byYear(res, 2021);
  eq(h2021.score, 0.8, '2021 辛丑 六合双子宫 ⇒ 0.4×2');
  eqJson(h2021.eventTypes, ['婚姻', '财运'], '2021 合夫妻宫 + 合财官坐支 ⇒ 婚姻/财运');
  const h2023 = byYear(res, 2023);
  eq(h2023.score, 1.0, '2023 癸卯 子卯刑双子宫 ⇒ 0.5×2');
  eqJson(h2023.eventTypes, ['婚姻'], '2023 刑不算「冲/合财官」⇒ 无财运');
  const h2022 = byYear(res, 2022);
  eq(h2022.score, 0.8, '2022 壬寅 冲时支申');
  eqJson(h2022.eventTypes, ['子女', '财运'], '2022 时支命中 ⇒ 子女；申藏壬财 ⇒ 财运');
  const h2025 = byYear(res, 2025);
  eq(h2025.score, 0.4, '2025 乙巳 与申既六合又三刑 ⇒ 按优先级只取合 0.4');
  eqJson(h2025.eventTypes, ['子女', '事业', '财运'], '2025 合时支 + 乙正官 ⇒ 子女/事业/财运');
  const h2024 = byYear(res, 2024);
  eq(h2024.score, 0, '2024 甲辰 原局无冲合刑');
  eqJson(h2024.eventTypes, ['事业'], '2024 仅因流年干甲=七杀 ⇒ 事业（星引动，不靠宫）');
  // 财官所坐支：年支子(甲七杀+藏癸财)、日支子(藏癸财)、时支申(藏壬财)；月支午不含财官
  eqJson(res.caiGuanSeats.map((s) => s.zhi), ['子', '子', '申'], '财官所坐支 = 年子/日子/申');
  ok(res.caiGuanSeats.every((s) => s.kinds.length > 0), '所坐支必须标财/官杀类别');
  console.log('  合/刑/时支/官杀/财官坐支口径 ✓');
}

console.log('[G] 第二张盘与边界（真太阳时盘，非本单元样本）');
{
  const f2 = compileBazi({ at: '2008-04-16 09:26', gender: '女' });
  const r2 = yingQi(f2, { fromYear: 2024, years: 10 });
  eq(r2.hits.length, 10, '第二盘 hits 覆盖 10 年');
  const dm2 = f2.pillars[2][0];
  const zhis2 = f2.pillars.map((p) => p[1]);
  for (const h of r2.hits) {
    ok(finiteNonNeg(h.score), `第二盘 ${h.year} score 有限非负`);
    ok(h.eventTypes.every((t) => EVENT_TYPES.includes(t)), `第二盘 ${h.year} eventTypes 闭集`);
    ok(h.palaceTriggered.every((n) => PALACE.some((p) => p.name === n)), `第二盘 ${h.year} 宫名合法`);
    let sum = 0;
    zhis2.forEach((z) => {
      if (CHONG[z] === h.ganzhi[1]) sum += 0.8;
      else if (LIUHE[z] === h.ganzhi[1]) sum += 0.4;
      else if (z !== h.ganzhi[1] && XING3.some((g) => g.includes(z) && g.includes(h.ganzhi[1]))) sum += 0.5;
    });
    eq(h.score, Math.round(sum * 100) / 100, `第二盘 ${h.year} score 独立重算`);
    eq(h.starTriggered, tenGod(h.ganzhi[0], dm2), `第二盘 ${h.year} 星=流年干十神`);
  }
  ok(r2.topYears.every((h) => h.score > 0), '第二盘 topYears 全为 score>0');

  let threw = false;
  try { yingQi({ pillars: ['甲子', '丙午', '戊子'] }); } catch { threw = true; }
  ok(threw, '不足 4 柱必须报错（不静默补空）');
  threw = false;
  try { yingQi({ pillars: ['甲子', '丙午', '戊子', '庚X'] }); } catch { threw = true; }
  ok(threw, '非法干支必须报错');
  console.log(`  第二盘 ${r2.fromYear}–${r2.toYear} 通过｜边界报错 ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
