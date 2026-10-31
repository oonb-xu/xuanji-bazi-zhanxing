// 实测（修正版）：太阳时角法推时支
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { monthZhiFromSunLon, shiZhiFromHourAngle, ZHI } from '../src/cross/position-to-pillars.mjs';

const N = 80;
const places = [
  { lng: 116.407, lat: 39.904 }, { lng: 121.474, lat: 31.230 },
  { lng: 113.264, lat: 23.129 }, { lng: 87.617, lat: 43.792 },
  { lng: 126.642, lat: 45.756 },
];

let okM = 0, totM = 0, okS = 0, totS = 0;
const errs = [];
const dist = {};

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
  } catch { continue; }

  const planets = Array.isArray(natal.planets)
    ? natal.planets
    : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);
  const sun = planets.find((p) => p.name === '太阳');
  if (!sun) continue;

  // 真值
  const trueMonth = bz.pillars[1][1];
  const trueShi = bz.pillars[3][1];
  dist[trueShi] = (dist[trueShi] || 0) + 1;

  // ① 月支
  totM++;
  if (monthZhiFromSunLon(sun.lon).zhi === trueMonth) okM++;
  else console.log(`  ❌ 月支 ${at}: ${monthZhiFromSunLon(sun.lon).zhi} vs ${trueMonth}`);

  // ② 时支（时角法）：需要天顶黄经
  const cusps = natal.cusps || natal.houses;
  let mcLon = null;
  if (Array.isArray(cusps) && cusps.length >= 10) mcLon = typeof cusps[9] === 'number' ? cusps[9] : cusps[9]?.lon;
  if (mcLon == null) mcLon = natal.angles?.['天顶']?.lon;
  if (typeof mcLon !== 'number') { console.log(`  ⚠️ 缺天顶 ${at}`); continue; }

  totS++;
  const got = shiZhiFromHourAngle(sun.lon, mcLon);
  if (got.zhi === trueShi) okS++;
  else errs.push({ at, sun: sun.lon.toFixed(1), mc: mcLon.toFixed(1), ha: got.hourAngle, got: got.zhi, truth: trueShi });
}

console.log('=== ① 太阳黄经 → 月支 ===');
console.log(`  ${okM}/${totM} = ${(okM / totM * 100).toFixed(1)}%`);
console.log('\n=== ② 太阳时角 → 时支 ===');
console.log(`  ${okS}/${totS} = ${(okS / totS * 100).toFixed(1)}%`);
if (errs.length) {
  console.log(`\n  错例 ${errs.length} 例（看时角是否卡在 30° 边界）：`);
  for (const e of errs.slice(0, 6)) {
    const near = (e.ha % 30);
    console.log(`    ${e.at}  HA=${e.ha}° (mod30=${near.toFixed(1)})  推${e.got} 真${e.truth}`);
  }
}
console.log('\n  真实时支分布：', Object.entries(dist).sort().map(([k, v]) => `${k}${v}`).join(' '));
