// 实证：七柱的独立性与可推断性
import { compileBazi } from '../src/bazi/engine.mjs';
import {
  enumerateShiZhi, distinctOf, PILLAR_DEPENDENCY, DERIVABILITY_TIERS,
  HOUSE_TABLE, houseZhiTable, ziweiHouseZhi, HIDDEN_STEM_TRIGGERS, HIDDEN_STEM_DEF,
  ZHI, HOUSE_ZHI_CONVENTION, pickGz,
} from '../src/cross/pillar-derivation.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

/* ══════════ ① 单盘结构确认 ══════════ */
const one = compileBazi({ at: '1990-03-15 12:00', gender: '男', lng: 116.407, lat: 39.904, tz: 8 });
console.log('=== 单盘 ===');
console.log('  四柱:', one.pillars.join(' '));
console.log('  胎元:', JSON.stringify(one.L4_taiYuan));
console.log('  命宫:', JSON.stringify(one.L4_mingGong));
console.log('  身宫:', JSON.stringify(one.L4_shenGong));
ok(Array.isArray(one.pillars) && one.pillars.length === 4, 'pillars 恒为 4（七柱不并入四柱）');
ok(one.L4_taiYuan != null, '胎元存在');
ok(one.L4_mingGong != null, '命宫存在');
ok(one.L4_shenGong != null, '身宫存在');

/* ══════════ ② 遍历 12 时支 ══════════ */
console.log('\n=== 固定年月日，遍历 12 个时辰 ===');
const rows = enumerateShiZhi({ at: '1990-03-15 12:00' });
const tz = (r) => r.pillars[3];
console.log('  时支 : 年柱 月柱 日柱 时柱  胎元   命宫   身宫');
for (const r of rows) {
  if (r.error) { console.log(`  ${r.hour}时: ❌ ${r.error}`); continue; }
  console.log(`  ${String(r.hour).padStart(2)}时 : ${r.pillars.join(' ')}  ${String(r.taiYuan).padEnd(5)} ${String(r.mingGong).padEnd(5)} ${String(r.shenGong)}`);
}

/* ③ 年/月/日柱在 12 时支下是否恒定 */
const yrs = distinctOf(rows, (r) => r.pillars[0]);
const mos = distinctOf(rows, (r) => r.pillars[1]);
const days = distinctOf(rows, (r) => r.pillars[2]);
console.log(`\n  年柱取值数: ${yrs.length} (${yrs.join(',')})`);
console.log(`  月柱取值数: ${mos.length} (${mos.join(',')})`);
console.log(`  日柱取值数: ${days.length} (${days.join(',')})`);
ok(yrs.length === 1, '年柱不随时辰变');
ok(mos.length === 1, '月柱不随时辰变');
// ⚠️ 23:00 换日：子时(0点与22点取样)可能跨日，所以日柱可能有 1–2 个值
ok(days.length <= 2, `日柱最多 2 个值（23点换日），实测 ${days.length}`);

/* ④ 胎元在 12 时支下是否恒定 ⇒ 证明它只依赖月柱 */
const tys = distinctOf(rows, (r) => r.taiYuan);
console.log(`\n  胎元取值数: ${tys.length} (${tys.join(',')})`);
ok(tys.length === 1, `胎元不随时辰变（取值数 ${tys.length}）⇒ 只依赖月柱`);

/* ⑤ 命宫 / 身宫 是否与 时支 双射 */
const mgs = distinctOf(rows, (r) => r.mingGong);
const sgs = distinctOf(rows, (r) => r.shenGong);
console.log(`  命宫取值数: ${mgs.length} (${mgs.join(',')})`);
console.log(`  身宫取值数: ${sgs.length} (${sgs.join(',')})`);
ok(mgs.length === 12, `命宫随 12 时辰取 12 个不同值（双射成立）`);
ok(sgs.length === 12, `身宫随 12 时辰取 12 个不同值（双射成立）`);

/* ⑥ 命宫 ↔ 身宫 是否一一对应（给定月支） */
const pair = new Map();
let pairOk = true;
for (const r of rows) {
  if (r.error) continue;
  if (pair.has(r.mingGong) && pair.get(r.mingGong) !== r.shenGong) pairOk = false;
  pair.set(r.mingGong, r.shenGong);
}
ok(pairOk && pair.size === 12, '命宫↔身宫是一一对应（给定月支后，一个定另一个）');

/* ⑥b ★ 命宫与身宫互为镜像（实证发现） */
console.log('\n=== 命宫 / 身宫 的镜像结构 ===');
const mirror = rows.filter((r) => !r.error);
const coincide = mirror.filter((r) => r.mingGong === r.shenGong);
console.log(`  命宫=身宫 的时辰数：${coincide.length}（${coincide.map((r) => r.hour + '时').join('、')}）`);
// 检查镜像：若 时支A 的命宫 = 时支B 的身宫 且 时支A 的身宫 = 时支B 的命宫，则为镜像对
let mirrorPairs = 0;
for (const a of mirror) {
  for (const b of mirror) {
    if (a === b) continue;
    if (a.mingGong === b.shenGong && a.shenGong === b.mingGong) mirrorPairs++;
  }
}
console.log(`  互为镜像的配对：${mirrorPairs} 组（含 A→B 与 B→A）`);
ok(coincide.length === 2, `恰有 2 个时辰命身重合（实测 ${coincide.length}）`);
ok(mirrorPairs >= 8, `存在镜像配对（实测 ${mirrorPairs} 组）`);

/* ⑦ 换日期同日支 → 胎元应相同（进一步证明胎元只依赖月柱） */
console.log('\n=== 跨日期检验：胎元是否只依赖月柱 ===');
const other = compileBazi({ at: '1991-03-20 08:00', gender: '女', lng: 116.407, lat: 39.904, tz: 8 });
const tyA = pickGz(one.L4_taiYuan);
const tyB = pickGz(other.L4_taiYuan);
console.log(`  1990-03-15 月柱 ${one.pillars[1]} → 胎元 ${tyA}`);
console.log(`  1991-03-20 月柱 ${other.pillars[1]} → 胎元 ${tyB}`);
if (one.pillars[1] === other.pillars[1]) {
  ok(tyA === tyB, '同月柱 ⇒ 同胎元（跨年验证）');
} else {
  console.log('  （两盘月柱不同，跳过等值断言）');
  ok(tyA !== tyB, '月柱不同 ⇒ 胎元不同（也是"只依赖月柱"的证据）');
}

/* ⑧ 依赖图自洽 */
console.log('\n=== 七柱依赖图 ===');
for (const [k, v] of Object.entries(PILLAR_DEPENDENCY)) {
  console.log(`  ${k.padEnd(3)} 依赖 [${v.needs.join(',')}]  精度 ${v.precision}  ${v.derived ? '（派生）' : ''}`);
}
ok(Object.keys(PILLAR_DEPENDENCY).length === 7, '七柱齐全');
ok(PILLAR_DEPENDENCY.胎元.derived === true, '胎元标为派生');
ok(PILLAR_DEPENDENCY.命宫.derived === true, '命宫标为派生');
ok(PILLAR_DEPENDENCY.身宫.derived === true, '身宫标为派生');
// 派生柱的 needs 必须只含别的柱或支，不能含"日""时"以外的独立输入
ok(PILLAR_DEPENDENCY.胎元.needs.includes('月柱'), '胎元依赖月柱（而非年月日）');

/* ⑨ 三档可推断性 */
console.log('\n=== 可推断性四档（实际作用层的答案）===');
for (const t of DERIVABILITY_TIERS) {
  console.log(`\n  【${t.tier}】`);
  console.log(`    可推：${t.canDerive.join('、') || '（无）'}`);
  console.log(`    不可推：${t.cannot.join('、') || '（无）'}`);
  console.log(`    ${t.note}`);
}
ok(DERIVABILITY_TIERS.length === 4, '四档齐全');
const tierB = DERIVABILITY_TIERS.find((t) => t.tier.startsWith('B'));
ok(tierB.canDerive.includes('胎元'), 'B 档（不知时辰）仍可推胎元');
ok(tierB.cannot.includes('命宫') && tierB.cannot.includes('身宫'), 'B 档命宫身宫悬空');
const tierA = DERIVABILITY_TIERS.find((t) => t.tier.startsWith('A'));
ok(tierA.canDerive.length === 0, 'A 档（完全无时间）一柱都推不出');

/* ⑩ 宫位 ↔ 十二地支 */
console.log('\n=== 宫位 ↔ 十二地支 ===');
console.log('  两套约定：');
for (const [k, v] of Object.entries(HOUSE_ZHI_CONVENTION)) {
  console.log(`    ${v.name}：锚点=${v.anchor}，绝对坐标=${v.absolute}`);
    console.log(`      ${v.rule}`);
}
ok(HOUSE_ZHI_CONVENTION.ziwei.absolute === true, '紫微以地支为绝对坐标');
ok(HOUSE_ZHI_CONVENTION.astro.absolute === false, '占星宫位为相对坐标');

const ascT = houseZhiTable('巨蟹');
console.log('\n  占星（上升巨蟹 ⇒ 第1宫地支 未）：');
for (const h of ascT) console.log(`    ${String(h.no).padStart(2)}宫 ${h.astroZhi}  ${h.ziwei.padEnd(3)} ${h.plain}`);
ok(ascT.length === 12, '占星宫位表 12 行');
ok(new Set(ascT.map((h) => h.astroZhi)).size === 12, '占星地支不重复');

const zwT = ziweiHouseZhi('酉');
console.log('\n  紫微（命宫在酉）：');
for (const h of zwT) console.log(`    ${h.ziwei.padEnd(3)} 落 ${h.ziweiZhi}  ${h.plain}`);
ok(zwT.length === 12, '紫微宫位表 12 行');
ok(new Set(zwT.map((h) => h.ziweiZhi)).size === 12, '紫微地支不重复');
ok(zwT[0].ziweiZhi === '酉', '命宫地支即传入值');

/* ⑪ 藏干 */
console.log('\n=== 藏干 ===');
console.log('  是什么：' + HIDDEN_STEM_DEF.what);
console.log('  为什么：' + HIDDEN_STEM_DEF.why);
console.log('  例：' + HIDDEN_STEM_DEF.example);
console.log('  何时出现：' + HIDDEN_STEM_DEF.whenAppear);
console.log('\n  八字原生触发条件：');
for (const t of HIDDEN_STEM_TRIGGERS.native.items) console.log(`    ${t.name.padEnd(6)} [${t.strength}] ${t.cond} ⇒ ${t.effect}`);
console.log('\n  占星类比（非等价）：');
for (const t of HIDDEN_STEM_TRIGGERS.astroAnalog.items) console.log(`    ${t.name.padEnd(6)} ${t.score.padStart(3)}  ${t.cond}  ${t.note}`);
console.log(`    阈值 ${HIDDEN_STEM_TRIGGERS.astroAnalog.threshold}`);
ok(HIDDEN_STEM_TRIGGERS.native.items.length >= 4, '原生触发条件 ≥4 条');
ok(HIDDEN_STEM_TRIGGERS.astroAnalog.note.includes('结构类比'), '占星类比已标注非等价');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
