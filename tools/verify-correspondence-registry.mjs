// 验证置信度注册表：分级是否正确、低置信是否真被丢弃、补充块是否正常工作
import { compileBazi } from '../src/bazi/engine.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { buildSupplement, registrySummary, confidenceOf, tierOf, CORRESPONDENCES, THRESHOLD } from '../src/cross/correspondence-registry.mjs';

console.log('=== ① 注册表分级 ===');
const s = registrySummary();
console.log(`  共 ${s.total} 条，分层：${JSON.stringify(s.byTier)}`);
console.log('  置信'.padEnd(8) + '档位'.padEnd(10) + '证据'.padEnd(6) + '八字侧'.padEnd(22) + '星盘侧');
for (const r of s.rows) {
  const mark = r.tier === '丢弃' ? '  ← 丢弃' : '';
  console.log(`  ${String(r.confidence).padEnd(8)}${r.tier.padEnd(8)}${r.evidence.padEnd(6)}${r.bazi.padEnd(22)}${r.astro}${mark}`);
}

console.log('\n=== ② 丢弃规则是否生效 ===');
const co = CORRESPONDENCES.find((x) => x.id === 'CO-01');
const coc = confidenceOf(co, {});
console.log(`  CO-01（巧合型，已证伪）置信 ${coc} → ${tierOf(coc).label}  ${tierOf(coc).show ? '❌ 仍会显示（错）' : '✅ 已丢弃'}`);
const below = THRESHOLD.discard;
console.log(`  丢弃阈值 ${below}，低于它的条目 show=false ⇒ 不出现在输出中`);

console.log('\n=== ③ 真实盘的补充块 ===');
const cases = [
  { name: '样例A 北京1990-03-15 12:00', at: '1990-03-15 12:00', lng: 116.407, lat: 39.904 },
  { name: '样例B 上海1992-08-20 12:00', at: '1992-08-20 12:00', lng: 121.474, lat: 31.230 },
];
for (const c of cases) {
  const bz = compileBazi({ at: c.at, gender: '男' });
  const ch = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: 8 });
  const sup = buildSupplement(bz, ch);
  console.log(`\n  【${c.name}】 ${sup.display}`);
  for (const it of sup.items) {
    console.log(`    · [${it.tierLabel} ${it.confidence}] ${it.detail}`);
  }
  console.log(`    ${sup.disclaimer.slice(0, 60)}…`);
}

console.log('\n=== ④ 置信度上限纪律检查 ===');
const maxNonIdentity = Math.max(...CORRESPONDENCES.filter((x) => x.evidence !== 'identity').map((x) => confidenceOf(x, {})));
console.log(`  非恒等类最高置信 = ${maxNonIdentity}  ${maxNonIdentity <= 0.6 ? '✅ 未越过 0.6 纪律上限' : '❌ 超出'}`);
const idMax = Math.max(...CORRESPONDENCES.filter((x) => x.evidence === 'identity').map((x) => confidenceOf(x, {})));
console.log(`  恒等类最高置信   = ${idMax}  ${idMax >= 0.9 ? '✅ 恒等得以保留高分' : '⚠️ 偏低'}`);
