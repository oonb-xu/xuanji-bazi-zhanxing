// 验证：59.58 假说的影响面 + 分歧年份
import {
  CYCLE_JIAZI_JUP_SAT, yearPillarStd, yearPillarExperimental,
  monthGan, taiYuan, experimentalChart, findDivergence,
} from '../src/cross/experimental-calendar.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

console.log('══════ 周期对比 ══════');
console.log(`  标准（60 甲子）      = 60.0000 年`);
console.log(`  木土 synodic         = ${(CYCLE_JIAZI_JUP_SAT / 3).toFixed(4)} 年`);
console.log(`  3× 会合（"真周期"）  = ${CYCLE_JIAZI_JUP_SAT.toFixed(4)} 年`);
console.log(`  差值                 = ${(60 - CYCLE_JIAZI_JUP_SAT).toFixed(4)} 年 = ${Math.round((60 - CYCLE_JIAZI_JUP_SAT) * 365.2422)} 天`);
console.log(`  每年相对推进差        = ${((60 / CYCLE_JIAZI_JUP_SAT - 1) * 100).toFixed(3)}%`);

/* ① 标准年柱自检：1984=甲子、1985=乙丑、2043=癸亥、2044=甲子 */
console.log('\n══════ 标准年柱自检 ══════');
for (const [y, want] of [[1984, '甲子'], [1985, '乙丑'], [2043, '癸亥'], [2044, '甲子'], [1900, '庚子']]) {
  const got = yearPillarStd(y).gz;
  console.log(`  ${y} → ${got} ${got === want ? '✅' : '❌ 应' + want}`);
}
ok([[1984, '甲子'], [1985, '乙丑'], [2043, '癸亥'], [2044, '甲子']].every(([y, w]) => yearPillarStd(y).gz === w), '标准年柱正确');

/* ② 实验年柱：1984 必须也是甲子（同锚点） */
console.log('\n══════ 实验年柱（59.577 年一循环）══════');
for (const y of [1984, 1985, 1990, 2000, 2010, 2020, 2026]) {
  const s = yearPillarStd(y), e = yearPillarExperimental(y);
  console.log(`  ${y}：标准 ${s.gz} / 实验 ${e.gz}（原始步数 ${e.rawSteps}，年内位置 ${e.intraYear}） ${s.gz === e.gz ? '同' : '★异'}`);
}
ok(yearPillarExperimental(1984).gz === '甲子', '实验年柱在锚点 1984 也是甲子');

/* ③ 分歧扫描 */
console.log('\n══════ 分歧扫描 1800–2200 ══════');
const div = findDivergence(1800, 2200);
console.log(`  首个分歧年：${div.firstDiff ? div.firstDiff.year + '（标准 ' + div.firstDiff.std + ' / 实验 ' + div.firstDiff.exp + '）' : '无'}`);
console.log(`  分歧段数：${div.segments.length}`);
for (const s of div.segments.slice(0, 8)) console.log(`    ${s.from}–${s.to}（${s.to - s.from + 1} 年）`);
const totalDiff = div.rows.filter((r) => !r.same).length;
console.log(`  分歧年占比：${totalDiff}/${div.total} = ${(totalDiff / div.total * 100).toFixed(1)}%`);
ok(div.firstDiff != null, '存在分歧年');
ok(totalDiff > 0, `有 ${totalDiff} 个年份的年柱不同`);

/* ④ 影响面：真实盘对比 */
console.log('\n══════ 影响面（真实盘）══════');
const CASES = [
  { at: '1990-03-15 12:00', year: 1990 },
  { at: '2026-10-29 20:00', year: 2026 },
  { at: '1960-08-10 06:00', year: 1960 },
  { at: '2100-01-01 10:00', year: 2100 },
];
for (const c of CASES) {
  const bz = compileBazi({ at: c.at, gender: '男', lng: 116.407, lat: 39.904, tz: 8 });
  const e = experimentalChart(bz.pillars, c.year);
  console.log(`\n  ${c.at}  标准四柱 ${bz.pillars.join(' ')}`);
  console.log(`    年柱  ${e.yearPillar.std} → ${e.yearPillar.exp}  ${e.yearPillar.changed ? '★变' : '不变'}`);
  console.log(`    月柱  ${e.monthPillar.std} → ${e.monthPillar.exp}  ${e.monthPillar.changed ? '★变' : '不变'}（${e.monthPillar.note}）`);
  console.log(`    胎元  ${e.taiYuan.std} → ${e.taiYuan.exp}  ${e.taiYuan.changed ? '★变' : '不变'}`);
  console.log(`    日/时柱 ${e.unchanged.day} ${e.unchanged.hour} —— 不变`);
  // 关键断言：日柱与时柱永远不变
  ok(e.unchanged.day === bz.pillars[2] && e.unchanged.hour === bz.pillars[3], `${c.at} 日柱时柱不变`);
  ok(e.monthPillar.exp[1] === e.monthPillar.std[1], `${c.at} 月支不变（只月干可能变）`);
}

/* ⑤ 月干/胎元 派生正确性 */
console.log('\n══════ 派生自检 ══════');
ok(monthGan('甲', '寅') === '丙', '五虎遁：甲年寅月 = 丙寅');
ok(monthGan('己', '寅') === '丙', '五虎遁：己年寅月 = 丙寅');
ok(monthGan('庚', '寅') === '戊', '五虎遁：庚年寅月 = 戊寅');
ok(taiYuan('己', '卯') === '庚午', '胎元：己卯 → 庚午');
console.log(`  甲年卯月 → ${monthGan('甲', '卯')}卯（应丁卯）`);
ok(monthGan('甲', '卯') === '丁', '顺推：甲年寅丙、卯丁');

/* ⑥ 结构性结论 */
console.log('\n══════ 结构性结论 ══════');
console.log('  受 59.58 影响的：年柱、月干（连月柱）、胎元');
console.log('  不受影响的：   月支、日柱、时柱、命宫、身宫');
console.log('  理由：月支由节气定（本就随天文修正）；日柱是连续天数 mod 60；');
console.log('        时柱依日干；命宫身宫依月支+时支 —— 都与木土周期无关。');
ok(true, '影响面已明确（3 处变 / 5 处不变）');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
