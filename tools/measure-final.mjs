// 【任务1 验证】修正后全量实测：月支 + 时支
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { monthZhiFromSunLon, shiZhiFromHourAngle } from '../src/cross/position-to-pillars.mjs';

const places = [
  [116.407, 39.904], [121.474, 31.230], [113.264, 23.129],
  [87.617, 43.792], [126.642, 45.756], [102.712, 25.040],
];
let okM = 0, okS = 0, n = 0;
const errM = [], errS = [];

for (let i = 0; i < 120; i++) {
  const y = 1955 + (i * 7) % 65;
  const mo = 1 + (i * 5) % 12;
  const d = 1 + (i * 11) % 28;
  const h = (i * 7) % 24;
  const mi = (i * 13) % 60;
  const at = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  const [lng, lat] = places[i % places.length];
  let bz, natal;
  try {
    bz = compileBazi({ at, gender: '男', lng, lat, tz: 8 });
    natal = computeNatal({ at, lng, lat, tz: 8 });
  } catch { continue; }
  const planets = Array.isArray(natal.planets)
    ? natal.planets
    : Object.entries(natal.planets || {}).map(([k, v]) => ({ name: v?.name ?? k, ...v }));
  const sun = planets.find((p) => p.name === '太阳');
  const ramc = natal.angles?.ramc;
  if (!sun || typeof ramc !== 'number') continue;
  n++;

  const trueM = bz.pillars[1][1], trueS = bz.pillars[3][1];
  const gotM = monthZhiFromSunLon(sun.lon).zhi;
  const gotS = shiZhiFromHourAngle(sun.lon, ramc).zhi;
  if (gotM === trueM) okM++; else if (errM.length < 5) errM.push(`${at} 推${gotM}/真${trueM}`);
  if (gotS === trueS) okS++; else if (errS.length < 5) errS.push(`${at} 太阳${sun.lon.toFixed(1)}° ramc${ramc.toFixed(1)}° 推${gotS}/真${trueS}`);
}

console.log(`样本 ${n}`);
console.log(`① 太阳黄经 → 月支：${okM}/${n} = ${(okM / n * 100).toFixed(1)}%`);
console.log(`② 太阳时角 → 时支：${okS}/${n} = ${(okS / n * 100).toFixed(1)}%`);
if (errM.length) console.log('  月支错例：', errM.join(' | '));
if (errS.length) console.log('  时支错例：', errS.join(' | '));
