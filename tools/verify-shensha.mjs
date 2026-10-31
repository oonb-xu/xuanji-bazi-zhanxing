// 验证：神煞体系 + 占星印证
import { compileBazi } from '../src/bazi/engine.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { findShenSha, astroSignature, psychologicalProfile, SHENSHA } from '../src/bazi/shensha.mjs';

const AT = '1990-03-15 12:00', LNG = 116.407, LAT = 39.904;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

const bz = compileBazi({ at: AT, gender: '男' });
const natal = computeNatal({ at: AT, lng: LNG, lat: LAT, tz: 8 });
const planets = Array.isArray(natal.planets)
  ? natal.planets
  : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);

console.log('四柱:', bz.pillars.join(' '), '\n');

/* ── ① 查神煞 ── */
const ss = findShenSha(bz.pillars);
console.log('=== 神煞命中 ===');
for (const s of ss) {
  if (!s.present) continue;
  console.log(`  ${s.name.padEnd(5)} ${s.hit.map((h) => h.at + h.zhi).join('·')}  心理：${s.psych.join('/')}  〔${s.axis}〕`);
  console.log(`        查法：${s.rule}   占星签名：${s.astro.note}`);
}
const present = ss.filter((s) => s.present);
console.log(`\n命中 ${present.length} / ${ss.length} 项\n`);

ok(ss.length === Object.keys(SHENSHA).length, '所有神煞都被检查');
ok(ss.every((s) => Array.isArray(s.hit)), '每项都有命中数组');
ok(ss.every((s) => s.psych && s.psych.length > 0), '每项都有心理语义');
ok(ss.every((s) => s.axis), '每项都有心理轴');
ok(ss.every((s) => s.astro && s.astro.planets), '每项都有占星签名假设');
ok(present.length > 0, '本盘至少命中一项神煞');

/* ── ② 旬空自检（已知案例）── */
import { xunKongOf } from '../src/bazi/shensha.mjs';
console.log('=== 旬空自检 ===');
const cases = [
  ['甲子', ['戌', '亥']],  // 甲子旬空戌亥
  ['甲戌', ['申', '酉']],
  ['甲申', ['午', '未']],
  ['甲午', ['辰', '巳']],
  ['甲辰', ['寅', '卯']],
  ['甲寅', ['子', '丑']],
];
for (const [gz, want] of cases) {
  const got = xunKongOf(gz[0], gz[1]);
  const same = got[0] === want[0] && got[1] === want[1];
  console.log(`  ${gz} 旬空 → ${got.join('')}  ${same ? '✅' : '❌ 应为 ' + want.join('')}`);
  ok(same, `旬空 ${gz} = ${want.join('')}`);
}

/* ── ③ 占星印证 ── */
const prof = psychologicalProfile(ss, planets);
console.log('\n=== 占星印证（收敛度）===');
for (const r of prof.rows) {
  console.log(`  ${r.name.padEnd(5)} 收敛 ${(r.converge * 100).toFixed(0)}%  [${r.level}]  ${r.detail.join('、') || '无签名'}`);
}
console.log(`\n  心理画像：${prof.profile}\n`);

ok(prof.rows.length === present.length, '每个命中的神煞都做了印证');
ok(prof.rows.every((r) => r.converge >= 0 && r.converge <= 1), '收敛度在 [0,1]');
ok(prof.rows.every((r) => ['强收敛', '中收敛', '弱收敛'].includes(r.level)), '收敛等级枚举正确');
ok(prof.rows.every((r) => r.note.includes('不是外部验证')), '已标注不可作外部验证');
// 收敛度必须不是恒 0 或恒 1（避免"永远通过"的退化）
const convs = prof.rows.map((r) => r.converge);
const degenerate = convs.every((c) => c === convs[0]);
ok(!degenerate, `收敛度非退化（本盘取值 ${convs.map((c) => c.toFixed(2)).join('/')}）`);

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
