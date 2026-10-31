// 验证：动态十神权重 / 多十神映射 / 合相双效应 / 八字能量印证
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { dynamicWeights, analyzeConjunction, crossValidate, MULTI_MAP, GROUPS, dignityOf } from '../src/cross/dynamic-ten-god.mjs';
import { tenGodProfile } from '../src/bazi/ten-gods.mjs';
import { isDayChart } from '../src/western/reception.mjs';

const AT = '1990-03-15 12:00', LNG = 116.407, LAT = 39.904;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

const natal = computeNatal({ at: AT, lng: LNG, lat: LAT, tz: 8 });
const planets = Array.isArray(natal.planets)
  ? natal.planets
  : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);
const isDay = isDayChart(natal);
const sun = planets.find((p) => p.name === '太阳');
const bazi = compileBazi({ at: AT, gender: '男' });

console.log(`昼夜：${isDay ? '日盘' : '夜盘'}\n`);

/* ── ① 多十神映射：每颗星至少 2 组，且和为 1 ── */
console.log('=== 多十神映射（每颗星不止一个十神）===');
for (const [pl, m] of Object.entries(MULTI_MAP)) {
  const s = GROUPS.reduce((a, g) => a + (m[g] || 0), 0);
  const parts = GROUPS.filter((g) => m[g]).map((g) => `${g}${(m[g] * 100).toFixed(0)}%`).join(' · ');
  console.log(`  ${pl.padEnd(4)}  ${parts}   (和=${s.toFixed(3)})`);
}
ok(Object.values(MULTI_MAP).every((m) => GROUPS.filter((g) => m[g]).length >= 2), '每颗星至少对应 2 个十神组');
ok(Object.values(MULTI_MAP).every((m) => Math.abs(GROUPS.reduce((a, g) => a + (m[g] || 0), 0) - 1) < 1e-9), '每颗星基础配比和为 1');

/* ── ② 动态权重 ── */
console.log('\n=== 动态权重（本盘）===');
const dyn = [];
for (const p of planets) {
  if (!MULTI_MAP[p.name]) continue;
  const d = dynamicWeights(p, { aspects: natal.aspects, sunLon: sun?.lon, isDay });
  if (!d) continue;
  dyn.push(d);
  const top = GROUPS.map((g) => [g, d.weights[g]]).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([g, w]) => `${g}${(w * 100).toFixed(1)}%`).join(' ');
  console.log(`  ${p.name.padEnd(4)} ${(p.sign + ' ' + p.deg + '°').padEnd(12)} 第${String(p.house ?? '?').padStart(2)}宫  ${top}`);
  console.log(`       修正：${d.mods.map((m) => `${m.k}${m.v !== '—' ? '(' + m.v + ')' : ''}×${m.f}`).join('  ') || '无'}`);
}
ok(dyn.length >= 9, '至少 9 颗行星算出动态权重');
ok(dyn.every((d) => Math.abs(GROUPS.reduce((a, g) => a + d.weights[g], 0) - 1) < 1e-6), '每颗星归一后和为 1');
ok(dyn.every((d) => d.primary.group !== d.secondary.group), '每颗星主次组不同');
ok(dyn.some((d) => d.mods.length > 0), '修正项生效（非恒定）');
// 动态性验证：同一颗星在不同状态下权重应不同
const sat = planets.find((p) => p.name === '土星');
const d1 = dynamicWeights(sat, { aspects: natal.aspects, sunLon: sun?.lon, isDay });
const d2 = dynamicWeights({ ...sat, sign: '白羊', house: 3, retro: true }, { aspects: natal.aspects, sunLon: sun?.lon, isDay });
ok(Math.abs(d1.strength - d2.strength) > 0.2, '同一颗星换位置后 strength 变化（动态性成立）');
console.log(`  动态性样例：土星 摩羯7宫 strength ${d1.strength} ；改成白羊3宫逆行 strength ${d2.strength}`);
console.log(`  组内分布对比：摩羯→官杀 ${(d1.weights['官杀']*100).toFixed(1)}% ；白羊→官杀 ${(d2.weights['官杀']*100).toFixed(1)}%`);

/* ── ③ 合相双效应 ── */
console.log('\n=== 合相：两个效应分开算 ===');
const pairs = [];
for (let i = 0; i < planets.length; i++) for (let j = i + 1; j < planets.length; j++) {
  const r = analyzeConjunction(planets[i], planets[j], 8);
  if (r) pairs.push(r);
}
for (const r of pairs) {
  console.log(`  ${r.pair[0]}×${r.pair[1]}  orb ${r.orb}°`);
  console.log(`    A 可见度 ×${r.emphasis.k}  （同度共处 ⇒ 强调，不是生）`);
  if (r.transfer) console.log(`    B 单向输能 ${r.transfer.from}→${r.transfer.to} ＝${r.transfer.amount}  （尊贵差驱动的「生」式）`);
  else console.log('    B 无单向输能（尊贵相当）');
  console.log(`    八字类比：${r.baziAnalog}`);
}
ok(pairs.length > 0, '检出至少一对合相');
ok(pairs.every((r) => typeof r.emphasis.k === 'number' && r.emphasis.k > 1), '可见度放大恒 >1');
ok(pairs.every((r) => r.transfer === null || r.transfer.amount > 0), '输能量非负');

/* ── ④ 八字能量印证 ── */
console.log('\n=== 八字能量印证 ===');
const tenEn = (bazi.bazi ?? bazi).tenGods || tenGodProfile(bazi).byGroup || null;
console.log('  八字 tenGods:', JSON.stringify(tenEn));
if (tenEn) {
  const cv = crossValidate(dyn, tenEn);
  console.log('  占星侧:', JSON.stringify(cv.astro));
  console.log('  八字侧:', JSON.stringify(cv.bazi));
  console.log('  余弦相似度:', cv.cosine, '→', cv.verdict);
  for (const r of cv.rows) console.log(`    ${r.group.padEnd(3)} 占星${(r.astro * 100).toFixed(1)}%  八字${(r.bazi * 100).toFixed(1)}%  ${r.agree}`);
  ok(typeof cv.cosine === 'number' && cv.cosine >= 0 && cv.cosine <= 1, '余弦相似度在 [0,1]');
  ok(cv.rows.length === 5, '五行组都有对照');
  ok(cv.note.includes('结构性无解'), '已标注不可作为外部验证');
} else {
  console.log('  ⚠️ 八字输出无 tenGods 字段，跳过');
  ok(false, '八字能量字段缺失');
}

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
