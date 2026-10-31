import fs from 'node:fs';

/* ① 行星点击面板 / 十神比例 */
console.log('=== ① 行星点击 · 十神比例 ===');
for (const f of ['web/fusion3d.js', 'web/fusion-wheel.js', 'web/app.js', 'web/deep-panel.js']) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  const hits = [];
  for (const k of ['pp-weights', 'showPlanetPanel', '十神比例', 'weightsMini', 'planetPanel']) {
    if (t.includes(k)) hits.push(k);
  }
  console.log('  ' + f.padEnd(22) + (hits.length ? '有: ' + hits.join(', ') : '无'));
}

/* ② 关于页里与「融合」定位可能矛盾的表述 */
console.log('\n=== ② 关于页可疑表述 ===');
const h = fs.readFileSync('web/index.html', 'utf8');
const SEC = '<section class="page" data-page="about">';
const so = h.indexOf(SEC);
const re = /<section\b|<\/section>/g; re.lastIndex = so + SEC.length;
let d = 1, m, iE = -1;
while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) { iE = m.index; break; } }
const inner = h.slice(so + SEC.length, iE);
const text = inner.replace(/<[^>]*>/g, '\n').replace(/\n{2,}/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);

const pats = [
  ['并排', /并排|摊给你看|并排摊/],
  ['不替你下结论', /不替你下结论|不替你|下结论的是你/],
  ['三种老办法', /三种老办法|各算一遍|三种办法/],
  ['不是融合/只是并列', /不是融合|只是并列|不做融合/],
  ['不合并', /不合并|不取平均/],
  ['各自算各自的', /各测各的|各算各的/],
];
for (const [label, re2] of pats) {
  const found = text.filter((s) => re2.test(s));
  if (found.length) {
    console.log('\n  【' + label + '】' + found.length + ' 处');
    found.slice(0, 6).forEach((s) => console.log('    · ' + s.slice(0, 100)));
  }
}
