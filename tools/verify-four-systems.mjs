// 四系统统一：自检 + 输出对照表
import {
  QIZHENG, SIYU, ZHI_SIGN, HOUSE_DOMAIN, ZIWEI_STARS, SIHUA,
  translate, FOUR_SYSTEM_MAP, PLANET_PLAIN,
} from '../src/cross/four-systems.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

/* ── ① 七政 = 七曜 ── */
console.log('=== 七政（七曜）↔ 行星 ===');
for (const [zh, v] of Object.entries(QIZHENG)) console.log(`  ${zh}  →  ${v.planet.padEnd(3)}  ${v.note}`);
ok(Object.keys(QIZHENG).length === 7, '七政恰为 7 颗');
ok(['太阳', '月亮', '木星', '火星', '土星', '金星', '水星'].every((p) => Object.values(QIZHENG).some((v) => v.planet === p)), '七政覆盖日月五星');

/* ── ② 四余 = 现代四个计算点 ── */
console.log('\n=== 四余（虚星）↔ 现代计算点 ===');
for (const [zh, v] of Object.entries(SIYU)) console.log(`  ${zh}  →  ${v.calc.padEnd(18)}  ${v.note}`);
ok(Object.keys(SIYU).length === 4, '四余恰为 4 颗');

/* ── ③ 十二宫 ↔ 十二支 ↔ 十二星座 ── */
console.log('\n=== 十二支 ↔ 星座（两套约定）===');
console.log('  月将（七政四余・十二次，太阳实际所在）：');
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
for (const z of ZHI) console.log(`    ${z} ↔ ${ZHI_SIGN.yuejiang[z]}`);
ok(Object.keys(ZHI_SIGN.yuejiang).length === 12, '月将 12 支齐全');
ok(Object.keys(ZHI_SIGN.yuejian).length === 12, '月建 12 支齐全');
ok(new Set(Object.values(ZHI_SIGN.yuejiang)).size === 12, '月将映射为一一对应（无重复星座）');
ok(new Set(Object.values(ZHI_SIGN.yuejian)).size === 12, '月建映射为一一对应');
// ⚠️ 曾误以为「月将与月建恒差一宫」——错。月建按节气换、月将按中气换，
//    两者中点差半个月，不存在固定偏移。这里只断言两张表各自是一一映射（上面已测）。
ok(true, '月将/月建为两套独立约定，不做固定偏移断言（见模块注释）');

/* ── ④ 宫位领域 ── */
console.log('\n=== 十二宫 ↔ 紫微 ↔ 白话 ===');
for (let h = 1; h <= 12; h++) {
  const d = HOUSE_DOMAIN[h];
  console.log(`  ${String(h).padStart(2)}宫  ${d.astro.padEnd(8)} ${d.ziwei.padEnd(3)}  ${d.plain}`);
}
ok(Object.keys(HOUSE_DOMAIN).length === 12, '十二宫齐全');
ok(Object.values(HOUSE_DOMAIN).every((d) => d.astro && d.ziwei && d.plain), '每宫都有占星/紫微/白话三层');

/* ── ⑤ 紫微主星 ── */
console.log('\n=== 紫微十四主星 → 十神 → 白话 ===');
for (const [star, v] of Object.entries(ZIWEI_STARS)) {
  console.log(`  ${star.padEnd(3)} → ${v.tg.padEnd(3)} ${v.plain}`);
}
ok(Object.keys(ZIWEI_STARS).length === 14, '紫微十四主星齐全');
ok(Object.values(ZIWEI_STARS).every((v) => ['比劫','印','食伤','财','官杀'].includes(v.tg)), '每颗主星都归入五组之一');
// 五组都有代表，不能全挤在一组
const tgSet = new Set(Object.values(ZIWEI_STARS).map((v) => v.tg));
ok(tgSet.size === 5, `五组都有主星代表（覆盖 ${[...tgSet].join('/')}）`);

/* ── ⑥ 四化 ── */
console.log('\n=== 四化 → 十神 ===');
for (const [h, v] of Object.entries(SIHUA)) console.log(`  ${h} → ${v.tg.padEnd(3)} ${v.plain}`);
ok(Object.keys(SIHUA).length === 4, '四化齐全');

/* ── ⑦ 翻译器 ── */
console.log('\n=== 白话翻译器自测 ===');
const samples = ['日', '月', '罗睺', '计都', '紫微', '贪狼', '七杀', '化忌', '白羊', '天蝎'];
for (const s of samples) {
  const r = translate(s);
  if (r) console.log(`  「${s}」→ [${r.system}] ${r.tg || '—'} ｜ ${r.plain}`);
  else console.log(`  「${s}」→ ❌ 未识别`);
}
ok(samples.every((s) => translate(s) !== null), '所有样例术语都能翻译');
ok(translate('不存在的东西') === null, '无法识别的术语返回 null（不瞎编）');

/* ── ⑧ 四系统总表 ── */
console.log('\n' + '═'.repeat(70));
console.log('四系统共同骨架');
console.log('═'.repeat(70));
for (const r of FOUR_SYSTEM_MAP.rows) {
  console.log(`\n【${r.layer}】`);
  console.log(`  八字     : ${r.bazi}`);
  console.log(`  古典占星 : ${r.astro}`);
  console.log(`  七政四余 : ${r.qizheng}`);
  console.log(`  紫微斗数 : ${r.ziwei}`);
  console.log(`  白话     : ${r.plain}`);
}
console.log('\n结论：' + FOUR_SYSTEM_MAP.conclusion);
ok(FOUR_SYSTEM_MAP.rows.length === 5, '总表五层齐全');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
