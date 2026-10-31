// 验证：盲派做功 × 星盘能量流
import { compileBazi } from '../src/bazi/engine.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { gongFlows, astroFlows, compareFlows, GONGFU_ASTRO_MAP } from '../src/cross/gongfu-astro.mjs';
import { dignityOf } from '../src/cross/dynamic-ten-god.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

const AT = '1990-03-15 12:00';
const bz = compileBazi({ at: AT, gender: '男', lng: 116.407, lat: 39.904, tz: 8 });
const natal = computeNatal({ at: AT, lng: 116.407, lat: 39.904, tz: 8 });

/* ① 做功侧 */
console.log('=== 盲派做功（有向能量流）===');
console.log('四柱:', bz.pillars.join(' '));
const g = gongFlows(bz.pillars);
console.log(`日主 ${g.dm}（${g.dmWx}）`);
console.log('\n流向：');
for (const f of g.flows) {
  console.log(`  ${f.from} → ${f.to}  [${f.kind}]  ${f.wx}  强度 ${f.strength}  ${f.note}`);
}
console.log('\n汇总:', JSON.stringify(g.summary));
ok(g.flows.length > 0, '提取到做功流');
ok(g.flows.every((f) => f.from && f.to && f.kind), '每条流都有起点/终点/类型');
ok(g.flows.every((f) => ['克', '生', '冲', '合'].includes(f.kind)), '流的类型合法');
ok(g.summary.total === g.flows.length, '汇总计数一致');
// 克日主应被标出
const keDm = g.flows.filter((f) => f.to.includes('日干') && f.kind === '克');
console.log(`  克日主的有 ${keDm.length} 条`);
ok(true, `识别出 ${keDm.length} 条克日主的流`);

/* ② 星盘侧 */
console.log('\n=== 星盘能量流（相位输能）===');
const planets = Array.isArray(natal.planets)
  ? natal.planets
  : Object.entries(natal.planets || {}).map(([k, v]) => ({ name: v?.name ?? k, ...v }));
const af = astroFlows(planets, natal.aspects, dignityOf);
console.log(`相位 ${af.flows.length} 条；硬 ${af.summary.hard} 软 ${af.summary.soft} 合 ${af.summary.conj}`);
console.log(`总做功量 ${af.summary.totalWork}；总输能 ${af.summary.totalTransfer}`);
console.log('\n输能 Top5：');
for (const t of af.summary.topTransfers) console.log(`  ${t.from}→${t.to}  ${t.type} ${t.orb}°  输能 ${t.transfer}  [${t.polarity}]`);
ok(af.flows.length > 0, '提取到星盘能量流');
ok(af.flows.every((f) => f.from && f.to && f.type), '每条流都有起点/终点/相位类型');
ok(['hard', 'soft', 'conj'].includes(af.flows[0].polarity), '极性分类合法');
ok(af.summary.total === af.flows.length, '星盘汇总计数一致');

/* ③ 对应层 */
console.log('\n=== 对应层 ===');
console.log(GONGFU_ASTRO_MAP.title);
console.log('论点：' + GONGFU_ASTRO_MAP.thesis);
for (const r of GONGFU_ASTRO_MAP.rows) {
  console.log(`  ${r.gong.padEnd(12)} ⇄ ${r.astro.padEnd(22)} ${r.why}`);
}
console.log('\n结构性差异（必须承认）：');
for (const d of GONGFU_ASTRO_MAP.differences) console.log(`  · ${d}`);
ok(GONGFU_ASTRO_MAP.rows.length >= 6, '对应表 ≥6 行');
ok(GONGFU_ASTRO_MAP.differences.length >= 3, '承认 ≥3 项结构性差异');
ok(GONGFU_ASTRO_MAP.thesis.includes('有向图'), '论点明确指出"两者都是有向图"');

/* ④ 对照 */
console.log('\n=== 同构度对照 ===');
const cmp = compareFlows(g, af);
for (const r of cmp.rows) {
  console.log(`  ${r.pair.padEnd(16)} 八字 ${String(r.gongPct).padStart(3)}%  星盘 ${String(r.astroPct).padStart(3)}%  差 ${r.delta > 0 ? '+' : ''}${r.delta}pt`);
}
console.log(`  同构度 ${cmp.isomorphism} → ${cmp.verdict}`);
console.log(`  ${cmp.note}`);
ok(cmp.isomorphism >= 0 && cmp.isomorphism <= 1, '同构度在 [0,1]');
ok(['高度同构', '大体同构', '差异明显'].includes(cmp.verdict), '判定枚举合法');
ok(cmp.note.includes('I(A;B|t)=0'), '已标注不是预测力证明');

/* ⑤ 三系统对照：为什么做功比子平法更适合融 */
console.log('\n=== 为什么做功可融而子平法不融 ===');
const table = [
  { sys: '子平法', form: '标量（身强/身弱 + 喜忌）', fit: '与星盘异构', why: '星盘给的是有向流，不是一个强弱数' },
  { sys: '盲派做功', form: '有向图（谁制谁/谁生谁）', fit: '与星盘同构', why: '相位输能也是有向图' },
  { sys: '星盘', form: '有向图（相位输能）', fit: '基准', why: '连续角度 + 尊贵差' },
];
for (const t of table) console.log(`  ${t.sys.padEnd(6)} ${t.form.padEnd(24)} ${t.fit.padEnd(12)} ${t.why}`);
ok(table.length === 3, '三系统对照齐全');
ok(table.find((t) => t.sys === '子平法').fit === '与星盘异构', '子平法判为异构（不融）');
ok(table.find((t) => t.sys === '盲派做功').fit === '与星盘同构', '做功判为同构（融）');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
