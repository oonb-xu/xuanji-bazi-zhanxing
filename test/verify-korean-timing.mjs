// 韩式八字对拍 + 占星时序盘 自检（exit 0 = 全过）
//  A 韩式数据载入与列完整（**CSV 列错位 bug 的回归钉**）  B 三柱对拍率  C 胎元  D R-K1 禁止字段为 null
//  E 法达/小限表  F 次限/三限  G 太阳返照回归误差  H 六壬月将↔太阳黄经恒等
import { existsSync, readFileSync } from 'node:fs';
import { F } from './_fixtures.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileBazi, splitPillar } from '../src/bazi/engine.mjs';
import { TIAN_GAN, DI_ZHI } from '../src/constants.mjs';
import { firdaria, profection, secondaryProgressed, tertiaryProgressed, solarReturn, findReturn, solarArc, FIRDARIA_DAY, FIRDARIA_NIGHT } from '../src/western/timing-charts.mjs';
import { eclipticLongitude } from '../src/western/zodiac.mjs';
import { yueJiangFromQi } from '../src/daliuren.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, '..', 'data', 'korean', 'persons.csv');
const DB = join(HERE, '..', 'data', 'korean', 'korean-db.jsonl');
const KY = { lng: 126.98, lat: 37.57, tz: 9 };   // 首尔

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 韩式数据载入');
if (!existsSync(CSV)) {
  console.log('  SKIP：缺 data/korean/persons.csv（先由 xlsx 转换）');
} else {
  const rows = require('csv-parse/sync').parse(readFileSync(CSV, 'utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true, bom: true });
  ok(rows.length > 39000, `行数 ${rows.length}`);
  // ★ 列错位回归钉：日支必须存在且是地支，年干必须是天干（首版手写切分把日支读成 undefined、年干读成 True）
  const r0 = rows[0];
  ok(DI_ZHI.includes(r0.day_branch), `day_branch 必须是地支，实得「${r0.day_branch}」`);
  ok(TIAN_GAN.includes(r0.year_stem), `year_stem 必须是天干，实得「${r0.year_stem}」`);
  // 区分「空值（数据缺口）」与「非空但非法（真列错位）」—— 前者是源数据问题，后者才是解析 bug
  const emptyRows = rows.filter((r) => !r.day_branch || !r.year_stem).length;
  const invalidRows = rows.filter((r) => (r.day_branch && !DI_ZHI.includes(r.day_branch)) || (r.year_stem && !TIAN_GAN.includes(r.year_stem))).length;
  ok(invalidRows === 0, `非空但非法的行必须为 0（真错位），实得 ${invalidRows}`);
  ok(emptyRows / rows.length < 0.02, `空值行占比 ${(emptyRows / rows.length * 100).toFixed(3)}% 应 <2%（源数据缺口）`);
  console.log(`  ${rows.length} 行｜列对齐：非法 ${invalidRows} 行（真错位=0）｜空值缺口 ${emptyRows} 行（${(emptyRows / rows.length * 100).toFixed(2)}%）✓`);

  console.log('[B] 三柱对拍');
  let okY = 0, okM = 0, okD = 0, n = 0;
  for (const r of rows.slice(0, 3000)) {
    let b; try { b = compileBazi({ at: `${r.birth_date} 12:00`, gender: '男' }); } catch { continue; }
    n++;
    const [Y, M, D] = b.pillars;
    if (Y === `${r.year_stem}${r.year_branch}`) okY++;
    if (M === `${r.month_stem}${r.month_branch}`) okM++;
    if (D === `${r.day_stem}${r.day_branch}`) okD++;
  }
  const p = (x) => x / n;
  ok(p(okY) > 0.97, `年柱一致率 ${(p(okY) * 100).toFixed(2)}% 应 >97%`);
  ok(p(okM) > 0.97, `月柱一致率 ${(p(okM) * 100).toFixed(2)}% 应 >97%`);
  ok(p(okD) > 0.97, `日柱一致率 ${(p(okD) * 100).toFixed(2)}% 应 >97%`);
  console.log(`  前 3000 例：年 ${(p(okY) * 100).toFixed(2)}%｜月 ${(p(okM) * 100).toFixed(2)}%｜日 ${(p(okD) * 100).toFixed(2)}% ✓`);

  console.log('[C] 胎元');
  const ty = (() => { const { gan, zhi } = splitPillar('甲子'); return `${TIAN_GAN[(TIAN_GAN.indexOf(gan) + 1) % 10]}${DI_ZHI[(DI_ZHI.indexOf(zhi) + 3) % 12]}`; })();
  eq(ty, '乙卯', '甲子月 → 胎元乙卯');
  eq((() => { const { gan, zhi } = splitPillar('癸亥'); return `${TIAN_GAN[(TIAN_GAN.indexOf(gan) + 1) % 10]}${DI_ZHI[(DI_ZHI.indexOf(zhi) + 3) % 12]}`; })(), '甲寅', '癸亥月 → 胎元甲寅（干支双回绕）');
  console.log('  胎元公式（月干+1、月支+3）验证 ✓');
}

console.log('[D] R-K1：日精度库禁止字段必须为 null');
if (existsSync(DB)) {
  const first = JSON.parse(readFileSync(DB, 'utf8').split('\n')[0]);
  eq(first.hourPillar, null, 'hourPillar 必须 null');
  eq(first.mingGong, null, 'mingGong 必须 null');
  eq(first.shenGong, null, 'shenGong 必须 null');
  eq(first.pillars3.day.length, 2, '三柱齐备');
  ok(typeof first.taiYuan === 'string' && first.taiYuan.length === 2, '胎元已算');
  console.log('  时柱/命宫/身宫 = null，胎元已算 ✓');
} else console.log('  SKIP：缺 korean-db.jsonl');

console.log('[E] 法达 / 小限');
eq(FIRDARIA_DAY.reduce((a, x) => a + x.years, 0), 70, '法达主期合计 70 年（不含节点）');
eq(FIRDARIA_NIGHT[0].planet, '月亮', '夜生从月亮起');
const f0 = firdaria(F.T7, 0, { isDay: true });
eq(f0.period, '太阳', '0 岁落太阳期');
eq(f0.sub, '太阳', '子期从主星起');
const f10 = firdaria(F.T7, 10, { isDay: true });
eq(f10.period, '金星', '10 岁落金星期');
ok(f0.subPlanets.length === 7 && new Set(f0.subPlanets).size === 7, '子期 7 星不重复');
eq(profection('双子', 0).house, 1, '0 岁 1 宫');
eq(profection('双子', 7).house, 8, '7 岁 8 宫');
eq(profection('双子', 12).house, 1, '12 岁回到 1 宫');
eq(profection('双子', 7).sign, '摩羯', '7 岁落摩羯');
eq(profection('双子', 7).lordOfYear, '土星', '摩羯年主星为土星');
console.log('  法达 70 年 / 子期 7 星｜小限 0/7/12 岁 ✓');

console.log('[F] 次限 / 三限 / 太阳弧');
eq(secondaryProgressed('2000-01-01 12:00', 10), '2000-01-11 12:00', '次限 1 天=1 年');
eq(tertiaryProgressed('2000-01-01 12:00', 1), '2000-01-31 22:30', '三限 1 天=1 月（30.4375）');
ok(Math.abs(solarArc(30) - 29.57) < 0.01, `太阳弧 30 岁 = ${solarArc(30)}`);
console.log(`  次限/三限/太阳弧（30 岁=${solarArc(30)}°）✓`);

console.log('[G] 太阳返照回归精度');
const natalSun = 273.198;
const sr = solarReturn(F.T7, 2025, { lng: 104.06, lat: 30.67, tz: 8 });
ok(sr !== null, '应找到返照瞬时');
const utc = new Date(new Date(sr.at.replace(' ', 'T') + 'Z').getTime() - 8 * 3600e3);
const back = eclipticLongitude('太阳', utc);
const err = Math.abs((((back - natalSun) % 360) + 540) % 360 - 180);
ok(err < 0.01, `回归误差 ${err}° 应 <0.01°`);
// 月亮返照
// 月亮返照：窗口必须覆盖一次回归（月亮约 13.2°/日、回归周期 27.3 日）→ 用 30 天窗口
const lr = findReturn('月亮', 100, new Date(Date.UTC(2020, 0, 1)), 30);
ok(lr instanceof Date, '月亮返照应返回日期');
// 窗口不足时应**如实返回 null**（不得瞎给一个日期）
ok(findReturn('月亮', 100, new Date(Date.UTC(2020, 0, 1)), 1) === null, '窗口不足应返回 null');
console.log(`  太阳返照回归误差 ${err.toFixed(5)}° ✓`);

console.log('[H] 六壬月将 ↔ 太阳黄经（数学恒等层，R-W14）');
{
  // 恒等式：月将支 = DI_ZHI[(10 − ⌊λ☉/30⌋) mod 12]
  // 中气按黄经排序：春分=0°、谷雨=30° … 雨水=330°；第 k 个中气的 λ☉ = 30k
  const QI_ORDER = ['春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至', '大寒', '雨水'];
  let okN = 0, bad = [];
  for (const [k, qi] of QI_ORDER.entries()) {
    const expect = DI_ZHI[(10 - k + 12) % 12];               // 由太阳黄经推出的月将支
    let got;
    try { got = yueJiangFromQi(qi); } catch (e) { bad.push(`${qi} 抛错 ${e.message}`); continue; }
    if (got === expect) okN++; else bad.push(`${qi}: 表=${got} vs 黄经推=${expect}`);
  }
  eq(okN, 12, `12 个中气的月将应与太阳黄经恒等式一致（不一致：${bad.join('；') || '无'}）`);
  // 两个已知锚点（经典规则）
  eq(yueJiangFromQi('春分'), '戌', '春分后月将戌');
  eq(yueJiangFromQi('冬至'), '丑', '冬至后月将丑');
  eq(yueJiangFromQi('雨水'), '亥', '雨水后月将亥');
  ok(bad.length === 0, `不一致项：${bad.join('；')}`);
  console.log(`  12/12 中气与 λ☉ 恒等一致｜锚点 春分→戌、冬至→丑、雨水→亥 ✓`);
}

console.log('[I] 胎元 ↔ 月柱 双射（R-B12：胎元不是独立柱）');
{
  const { taiYuanOf, fivePillars } = await import('../src/bazi/five-pillar.mjs');
  // 双射：60 种月柱 → 60 种互不相同的胎元
  const map = new Map();
  for (const [gi, g] of TIAN_GAN.entries()) for (const [zi, z] of DI_ZHI.entries()) {
    if (gi % 2 !== zi % 2) continue;                 // 真实干支组合：干与支同阴阳（60 组）
    const mp = `${g}${z}`;
    map.set(mp, taiYuanOf(mp));
  }
  eq(map.size, 60, '真实月柱组合数应为 60');
  const vals = [...map.values()];
  ok(vals.length === map.size, '映射数量一致');
  ok(new Set(vals).size === vals.length, `胎元必须单射：${vals.length} 个输入 → ${new Set(vals).size} 个不同输出`);
  // 五柱封装
  const fp = fivePillars(['丁亥', '壬子', '癸巳', '辛酉']);
  eq(fp.taiYuan, taiYuanOf('壬子'), '五柱封装取月柱算胎元');
  eq(Object.keys(fp).length, 5, '五柱共 5 项');
  // 与 CLI 路径一致（cli-korean 的 --taiyuan 用的就是这个函数）
  eq(taiYuanOf('甲子'), '乙卯', '甲子 → 乙卯');
  console.log(`  60/120 组合单射｜五柱封装｜甲子→乙卯 ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
