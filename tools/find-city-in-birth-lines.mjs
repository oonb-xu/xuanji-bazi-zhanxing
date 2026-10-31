import fs from 'node:fs';

const FILES = [
  'docs/10-双盘采样与样本库.md',
  'docs/11-星盘反推八字-生时校正.md',
  'docs/32-十神行星条件映射.md',
];
const CITIES = ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆'];

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const hits = [];
  lines.forEach((l, i) => {
    if (!/\b(19|20)\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(l)) return;
    const c = CITIES.find(x => l.includes(x));
    if (c) hits.push({ i, city: c, line: l.trim().slice(0, 120) });
  });
  console.log('\n── ' + f + '  (' + hits.length + ' 行含出生时刻+城市)');
  hits.slice(0, 4).forEach(h => console.log('   L' + (h.i + 1) + ' [' + h.city + '] ' + h.line));
}
