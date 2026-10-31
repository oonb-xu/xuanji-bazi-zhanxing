import fs from 'node:fs';
const t = fs.readFileSync('web/fusion3d.js', 'utf8');
console.log('fusion3d.js 大小', t.length);

for (const key of ['pp-weights', 'showPlanetPanel', '十神比例', '__fwSetDeep']) {
  console.log('\n=== ' + key + ' ===');
  let i = -1, n = 0;
  while ((i = t.indexOf(key, i + 1)) >= 0 && n < 4) {
    n++;
    console.log('  @' + i + '  ' + JSON.stringify(t.slice(Math.max(0, i - 130), i + 170).replace(/\s+/g, ' ')));
  }
  if (!n) console.log('  （无）');
}
