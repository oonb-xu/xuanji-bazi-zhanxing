// 验证三钟对齐：大运 / 流年 × 次运 / 行运
import { compileBazi } from '../src/bazi/engine.mjs';
import { buildTimeline, yearGanZhi, progressionAt, transitAt } from '../src/cross/timeline.mjs';

const AT = '1990-03-15 12:00', LNG = 116.407, LAT = 39.904, TZ = 8;
const birth = new Date('1990-03-15T12:00:00+08:00');

console.log('=== ① 流年干支自检（1984=甲子）===');
for (const y of [1984, 1990, 2000, 2024, 2026]) console.log(`  ${y} → ${yearGanZhi(y)}`);

console.log('\n=== ② 三钟刻度 ===');
console.log(`  次运：出生后第 30 天 = 30 岁 → ${progressionAt(birth, 30).toISOString().slice(0,10)}`);
console.log(`  行运：出生后第 30 年      = 30 岁 → ${transitAt(birth, 30).toISOString().slice(0,10)}`);

const bz = compileBazi({ at: AT, gender: '男' });
const tl = buildTimeline({
  birth, gender: '男', pillars: bz.pillars, lng: LNG, lat: LAT, tz: TZ,
  fromYear: 1990, toYear: 2050,
});

console.log(`\n=== ③ 时间轴（${tl.range.from}–${tl.range.to}，共 ${tl.range.count} 年）===`);
console.log('  抽样行（每 5 年一条）：');
for (const r of tl.rows.filter((x) => x.age % 5 === 0).slice(0, 10)) {
  const pm = r.astro.progression['月亮'];
  const ts = r.astro.transit['土星'];
  console.log(`  ${r.year} ${String(r.age).padStart(2)}岁  大运${r.bazi.dayun ?? '—'}  流年${r.bazi.liunian}  ` +
    `次运月${pm?.sign ?? '?'}  行运土星${ts?.sign ?? '?'}(${ts?.house ?? '?'}宫)`);
}

console.log('\n=== ④ 互通层：各钟换格年份 ===');
const t = tl.transitions;
console.log(`  大运换步 ${t.dayunChange.length} 次：` + t.dayunChange.slice(0, 4).map((x) => `${x.year}(${x.from}→${x.to})`).join(' '));
console.log(`  次运月亮换座 ${t.progMoonSign.length} 次：` + t.progMoonSign.slice(0, 4).map((x) => `${x.year}→${x.to}`).join(' '));
console.log(`  次运太阳换座 ${t.progSunSign.length} 次：` + t.progSunSign.slice(0, 4).map((x) => `${x.year}→${x.to}`).join(' '));
console.log(`  行运土星换宫 ${t.transitSaturnHouse.length} 次：` + t.transitSaturnHouse.slice(0, 4).map((x) => `${x.year}→第${x.to}宫`).join(' '));
console.log(`  行运木星换宫 ${t.transitJupiterHouse.length} 次：` + t.transitJupiterHouse.slice(0, 4).map((x) => `${x.year}→第${x.to}宫`).join(' '));

console.log('\n=== ⑤ 不互通层（补充内容）===');
console.log('  ' + tl.supplement.note);
for (const s of tl.supplement.nonAlignable) console.log('  · ' + s);

console.log('\n=== ⑥ 周期核对（刻度差异的证据）===');
const moonYears = t.progMoonSign.length ? (tl.range.count / t.progMoonSign.length) : NaN;
const satYears = t.transitSaturnHouse.length ? (tl.range.count / t.transitSaturnHouse.length) : NaN;
const jupYears = t.transitJupiterHouse.length ? (tl.range.count / t.transitJupiterHouse.length) : NaN;
console.log(`  次运月亮换座平均 ${moonYears.toFixed(1)} 年/次  （理论 27.3/12 ≈ 2.3 年）`);
console.log(`  行运土星换宫平均 ${satYears.toFixed(1)} 年/次  （理论 29.46/12 ≈ 2.46 年）`);
console.log(`  行运木星换宫平均 ${jupYears.toFixed(1)} 年/次  （理论 11.86/12 ≈ 0.99 年）`);
console.log(`  八字大运换步   10.0 年/次`);
console.log('  ⇒ 四个钟周期互不相同 ⇒ 只能按"年份"对齐，不能互相换算');
