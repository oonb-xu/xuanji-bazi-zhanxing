// 验证：藏干透出 + 土星双角色
import { compileBazi } from '../src/bazi/engine.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { hiddenStemReveal, saturnDualRole } from '../src/cross/hidden-stem.mjs';
import { isDayChart } from '../src/western/reception.mjs';

const AT = '1990-03-15 12:00', LNG = 116.407, LAT = 39.904;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

const natal = computeNatal({ at: AT, lng: LNG, lat: LAT, tz: 8 });
const planets = Array.isArray(natal.planets) ? natal.planets : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);
const isDay = isDayChart(natal);

console.log(`=== 昼夜盘：${isDay ? '日盘' : '夜盘'} ===\n`);

/* ── ① 藏干透出 ── */
const hs = hiddenStemReveal(planets, natal.angles, isDay);
console.log('=== 藏干透出（占星实现）===');
for (const sec of hs.sections) {
  if (!sec.stems.length) continue;
  console.log(`  ${sec.sign}(${sec.zhi}) ${sec.from}–${sec.to}°：`);
  for (const s of sec.stems) console.log(`     ${s.label}  透出分 ${s.revealScore}  [${s.why.join('·') || '无'}]`);
}
console.log('');
ok(hs.sections.length === 12, '切出 12 个黄道段');
ok(hs.sections.reduce((a, s) => a + s.stems.length, 0) === planets.filter(p => typeof p.lon === 'number' && !['上升','天顶','下降','天底','北交点','南交点'].includes(p.name)).length, '所有实体行星都被归入某个段');
ok(hs.revealed.length + hs.hiddenOnly.length === hs.sections.reduce((a, s) => a + s.stems.length, 0), '透出 + 藏 = 总数');
ok(hs.revealed.every(x => x.revealScore >= 2), '透出的都达到阈值');
ok(hs.hiddenOnly.every(x => x.revealScore < 2), '纯藏的都没到阈值');
ok(['本气','中气','余气'].includes(hs.revealed[0]?.grade) || hs.revealed.length === 0, '等级只取本气/中气/余气');
console.log(`\n  统计：透出 ${hs.revealed.length} 颗 · 纯藏 ${hs.hiddenOnly.length} 颗\n`);

/* ── ② 土星双角色 ── */
const sat = planets.find(p => p.name === '土星');
const sr = saturnDualRole(sat, isDay);
console.log('=== 土星双角色 ===');
console.log(`  土星 ${sat.sign} ${sat.deg}° 第${sat.house}宫 ${sat.retro ? '逆行' : '顺行'}`);
console.log(`  评分 ${sr.score} → 主:${sr.primary}(${sr.ratio}) 次:${sr.secondary}(${(1 - sr.ratio).toFixed(2)})`);
for (const w of sr.why) console.log('   ·', w);
console.log('');
ok(typeof sr.score === 'number', '有评分');
ok(Math.abs(sr.groups[sr.primary] + sr.groups[sr.secondary] - 1) < 1e-9, '双角色配比和为 1');
ok(sr.primary !== sr.secondary, '主次不同（双角色成立）');
ok(['印','官杀'].includes(sr.primary), '主角色在 印/官杀 之内');

/* ── ③ 极端情形自检：土星入庙角宫昼盘 ⇒ 应偏印；土星入陷果宫夜盘 ⇒ 应偏官杀 ── */
const goodSat = { name: '土星', sign: '摩羯', house: 10, retro: true };
const badSat = { name: '土星', sign: '巨蟹', house: 3, retro: false };
const rGood = saturnDualRole(goodSat, true);
const rBad = saturnDualRole(badSat, false);
console.log(`  极端自检：摩羯10宫昼盘逆行 → ${rGood.primary}(${rGood.score})`);
console.log(`  极端自检：巨蟹3宫夜盘顺行 → ${rBad.primary}(${rBad.score})\n`);
ok(rGood.primary === '印', '入庙+角宫+昼盘+逆行 ⇒ 偏印');
ok(rBad.primary === '官杀', '入陷+果宫+夜盘+顺行 ⇒ 偏官杀');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
