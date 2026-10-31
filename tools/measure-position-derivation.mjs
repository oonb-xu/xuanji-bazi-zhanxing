// 实测：仅用行星落位能推出哪些柱（含上升→时支的偏移校准）
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { monthZhiFromSunLon, ZHI } from '../src/cross/position-to-pillars.mjs';

const N = 60;
let okMonth = 0, okMonthTotal = 0;
const ascPairs = [];   // {ascIdx, trueShiZhi}

// 生成 N 个分散的样本（跨年、跨时、跨地）
const places = [
  { lng: 116.407, lat: 39.904, name: '北京' },
  { lng: 121.474, lat: 31.230, name: '上海' },
  { lng: 113.264, lat: 23.129, name: '广州' },
  { lng: 87.617, lat: 43.792, name: '乌鲁木齐' },
  { lng: 126.642, lat: 45.756, name: '哈尔滨' },
];

for (let i = 0; i < N; i++) {
  const y = 1960 + (i * 7) % 60;
  const mo = 1 + (i * 5) % 12;
  const d = 1 + (i * 11) % 28;
  const h = (i * 3) % 24;
  const at = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:30`;
  const pl = places[i % places.length];

  let bz, natal;
  try {
    bz = compileBazi({ at, gender: '男', lng: pl.lng, lat: pl.lat, tz: 8 });
    natal = computeNatal({ at, lng: pl.lng, lat: pl.lat, tz: 8 });
  } catch (e) { continue; }

  const planets = Array.isArray(natal.planets)
    ? natal.planets
    : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);
  const sun = planets.find((p) => p.name === '太阳');
  const asc = natal.angles?.['上升']?.lon ?? natal.angles?.asc;

  // ① 月支：太阳黄经推导 vs 真值
  if (sun && typeof sun.lon === 'number') {
    okMonthTotal++;
    const derived = monthZhiFromSunLon(sun.lon).zhi;
    const truth = bz.pillars[1][1];
    if (derived === truth) okMonth++;
    else console.log(`  ❌ 月支不符 ${at}: 太阳${sun.lon.toFixed(2)}° → 推${derived} / 真${truth}`);
  }

  // ② 上升 → 时支：收集配对，稍后扫最优偏移
  if (typeof asc === 'number') {
    ascPairs.push({
      signIndex: Math.floor(((asc % 360) + 360) % 360 / 30),
      ascLon: asc,
      trueShi: bz.pillars[3][1],
      at: `${at} @${pl.name}`,
    });
  }
}

console.log('=== ① 太阳黄经 → 月支 ===');
console.log(`  样本 ${okMonthTotal}，正确 ${okMonth}，准确率 ${(okMonth / okMonthTotal * 100).toFixed(1)}%`);

console.log('\n=== ② 上升黄经 → 时支（扫最优偏移）===');
console.log(`  样本 ${ascPairs.length}`);
let best = { k: null, hit: 0, rate: 0 };
for (let k = 0; k < 12; k++) {
  let hit = 0;
  for (const p of ascPairs) {
    // 假设 时支 = ZHI[(k - signIndex + 24) % 12]
    const guess = ZHI[((k - p.signIndex) % 12 + 12) % 12];
    if (guess === p.trueShi) hit++;
  }
  const rate = hit / ascPairs.length;
  if (rate > best.rate) best = { k, hit, rate };
  if (rate > 0.5) console.log(`  偏移 k=${k}: ${hit}/${ascPairs.length} = ${(rate * 100).toFixed(1)}%`);
}
console.log(`\n  最优偏移 k=${best.k}：${best.hit}/${ascPairs.length} = ${(best.rate * 100).toFixed(1)}%`);

// 展示偏移 k=best 下的错例
console.log('\n  最优偏移下的错例（说明为何不精确）：');
let shown = 0;
for (const p of ascPairs) {
  const guess = ZHI[((best.k - p.signIndex) % 12 + 12) % 12];
  if (guess !== p.trueShi && shown < 5) {
    console.log(`    ${p.at}  上升 ${p.ascLon.toFixed(1)}°(${p.signIndex}宫) → 推${guess} / 真${p.trueShi}`);
    shown++;
  }
}

// 分布检查：每个时支是否都有样本
const dist = {};
for (const p of ascPairs) dist[p.trueShi] = (dist[p.trueShi] || 0) + 1;
console.log('\n  真实时支分布：', Object.entries(dist).map(([k, v]) => `${k}${v}`).join(' '));
console.log(`\n结论：太阳→月支 ${(okMonth / okMonthTotal * 100).toFixed(1)}%（恒等），上升→时支 ${(best.rate * 100).toFixed(1)}%（近似，k=${best.k}）`);
