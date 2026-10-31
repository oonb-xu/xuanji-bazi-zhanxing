// 正确实现：时角用引擎直给的 ramc（= LST 度数），并实证扫描时支边界
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const EPS = 23.4392911 * D2R;
const norm = (d) => ((d % 360) + 360) % 360;
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const raOfEcliptic = (lonDeg) => {
  const l = norm(lonDeg) * D2R;
  return norm(Math.atan2(Math.cos(EPS) * Math.sin(l), Math.cos(l)) * R2D);
};

const places = [
  { lng: 116.407, lat: 39.904 }, { lng: 121.474, lat: 31.230 },
  { lng: 113.264, lat: 23.129 }, { lng: 87.617, lat: 43.792 },
  { lng: 126.642, lat: 45.756 },
];

const samples = [];
for (let i = 0; i < 96; i++) {
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
    : Object.entries(natal.planets || {}).map(([k, v]) => ({ name: v?.name ?? k, ...v }));
  const sun = planets.find((p) => p.name === '太阳');
  const a = natal.angles || {};
  if (!sun || typeof a.ramc !== 'number') continue;
  const ha = norm(a.ramc - raOfEcliptic(sun.lon));
  samples.push({ at, ha, truth: bz.pillars[3][1], sunLon: sun.lon, ramc: a.ramc });
}

console.log(`样本 ${samples.length}`);

// 扫描边界偏移 b：index = floor(norm(HA - b)/30)
let best = { b: null, hit: -1 };
const rows = [];
for (let b = 0; b < 30; b++) {
  let hit = 0;
  for (const s of samples) {
    const idx = Math.floor(norm(s.ha - b) / 30) % 12;
    if (ZHI[idx] === s.truth) hit++;
  }
  rows.push({ b, hit, rate: hit / samples.length });
  if (hit > best.hit) best = { b, hit };
}
console.log('\n边界偏移扫描（只显示 ≥60%）:');
for (const r of rows.filter((r) => r.rate >= 0.6)) {
  console.log(`  b=${String(r.b).padStart(2)}°  ${r.hit}/${samples.length} = ${(r.rate * 100).toFixed(1)}%`);
}
console.log(`\n最优：b=${best.b}°，${best.hit}/${samples.length} = ${(best.hit / samples.length * 100).toFixed(1)}%`);

// 用最优 b 看错例
console.log('\n最优下错例（≤8 条）：');
let n = 0;
for (const s of samples) {
  const idx = Math.floor(norm(s.ha - best.b) / 30) % 12;
  if (ZHI[idx] !== s.truth && n < 8) {
    console.log(`  ${s.at}  HA=${s.ha.toFixed(1)}°  mod30=${(norm(s.ha - best.b) % 30).toFixed(1)}  推${ZHI[idx]} 真${s.truth}`);
    n++;
  }
}
