// 验证：iztro 适配器 + 与本地八字引擎交叉校验四柱
import { ziweiChart, crossCheckPillars, toShiChenIndex } from './adapter.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

/* ① 时辰换算 */
console.log('=== 时辰换算 ===');
const cases = [[0, 0], [1, 1], [2, 1], [4, 2], [6, 3], [12, 6], [12.5, 6], [13, 7], [23, 0], [22, 11]];
for (const [h, want] of cases) {
  const got = toShiChenIndex(h);
  console.log(`  ${String(h).padStart(4)}时 → 序号 ${got} ${got === want ? '✅' : '❌ 应' + want}`);
}
ok(cases.every(([h, w]) => toShiChenIndex(h) === w), '时辰换算全对');

/* ② 排一张盘 */
console.log('\n=== 排盘（1990-3-15 午时 女）===');
const z = ziweiChart({ date: '1990-3-15', hour: 12, gender: '女' });
console.log(`  农历: ${z.lunarDate}`);
console.log(`  干支: ${z.chineseDate}`);
console.log(`  时辰: ${z.time} (${z.timeRange})`);
console.log(`  命宫支: ${z.soulPalaceZhi}  身宫支: ${z.bodyPalaceZhi}`);
console.log(`  五行局: ${z.fiveElementsClass}  命主: ${z.soulStar}  身主: ${z.bodyStar}`);
console.log('\n  十二宫：');
for (const p of z.palaces) {
  const maj = p.major.length
    ? p.major.map((s) => `${s.name}${s.brightness ? '(' + s.brightness + ')' : ''}→${s.tg}${s.mutagen ? '·' + s.mutagen : ''}`).join(' ')
    : '（无主星）';
  console.log(`    ${p.name.padEnd(3)} ${p.ganZhi}  ${maj}${p.isBody ? '  【身宫】' : ''}`);
}
console.log('\n  四化落点：', z.summary.mutagenMap.map((m) => `${m.star}→${m.mutagen}@${m.palace}`).join('  '));
console.log('  无主星宫：', z.summary.emptyPalaces.join('、') || '无');

ok(z.palaces.length === 12, '十二宫齐全');
ok(z.palaces.every((p) => p.zhi && p.name), '每宫都有支与名');
ok(z.palaces.filter((p) => p.isSoul).length === 1, '恰有一个命宫');
ok(z.palaces.filter((p) => p.isBody).length === 1, '恰有一个身宫');
ok(Object.keys(z).includes('fiveElementsClass'), '有五行局');
ok(z.summary.mutagenMap.length > 0, '有四化落点');
// 每颗主星都映射到五组之一
const allTg = z.palaces.flatMap((p) => p.major.map((s) => s.tg));
ok(allTg.length > 0 && allTg.every((t) => ['比劫', '印', '食伤', '财', '官杀'].includes(t)), '主星全部归入五组十神');
console.log(`  （共 ${allTg.length} 颗主星，十神组分布：${['比劫','印','食伤','财','官杀'].map(g => g + (allTg.filter(x => x === g).length)).join(' ')}）`);

/* ③ ★ 与本地八字引擎交叉校验四柱 */
console.log('\n=== 交叉校验四柱（iztro vs 本地引擎）===');
const checks = [
  { date: '1990-3-15', hour: 12, at: '1990-03-15 12:00', gender: '女' },
  { date: '1985-7-20', hour: 8, at: '1985-07-20 08:00', gender: '男' },
  { date: '2001-12-5', hour: 20, at: '2001-12-05 20:00', gender: '女' },
  { date: '1967-6-12', hour: 3, at: '1967-06-12 03:30', gender: '男' },
  { date: '2020-5-5', hour: 9, at: '2020-05-05 09:00', gender: '女' },
];
let allOk = true;
for (const c of checks) {
  const zz = ziweiChart({ date: c.date, hour: c.hour, gender: c.gender });
  const bz = compileBazi({ at: c.at, gender: c.gender, lng: 116.407, lat: 39.904, tz: 8 });
  const r = crossCheckPillars(zz, bz.pillars);
  console.log(`  ${c.at}  iztro=[${r.iztro.join(' ')}]  本地=[${r.local.join(' ')}]  ${r.ok ? '✅' : '❌ ' + r.diff.join('; ')}`);
  if (!r.ok) allOk = false;
}
ok(allOk, `四柱交叉校验（${checks.length} 盘）`);

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
