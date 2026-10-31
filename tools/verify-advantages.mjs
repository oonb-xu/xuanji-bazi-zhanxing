// 验证：各体系独有优势 + 紫微亮度表 + 二十八宿 + 四系统合议
import { computeNatal } from '../src/western/natal.mjs';
import {
  ADVANTAGES, COUPLING_TABLE, FUSION_LAYERS, AXES,
  synthesize, brightnessFactor, BRIGHTNESS_LEVELS,
} from '../src/cross/system-advantages.mjs';
import {
  ZIWEI_BRIGHTNESS, ZHI12, XIU28, xiuOf, xiuRanges, ziweiBrightness,
  SIGN_TO_ZHI_YUEJIAN, LEVELS, DATA_STATUS,
} from '../src/cross/ziwei-brightness.mjs';
import { dignityOf } from '../src/cross/dynamic-ten-god.mjs';
import { HOUSE_DOMAIN } from '../src/cross/four-systems.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(' ✅', m); } else { fail++; console.log(' ❌', m); } };

/* ── ① 各体系独有优势 ── */
console.log('=== 各体系独有优势 ===');
const SYS = Object.keys(ADVANTAGES);
ok(SYS.length === 4, '四套体系都有独有优势');
for (const s of SYS) {
  const a = ADVANTAGES[s];
  console.log(`\n【${a.name}】独有 ${a.unique.length} 项`);
  for (const u of a.unique) {
    console.log(`  ${u.id} ${u.title}`);
    console.log(`     主张：${u.claim}`);
    console.log(`     为何独有：${u.why}`);
    console.log(`     别家做不到：${u.cannot}`);
  }
  console.log(`  欠缺：${a.missing}`);
}
const totalUnique = SYS.reduce((a, s) => a + ADVANTAGES[s].unique.length, 0);
ok(totalUnique === 11, `共 ${totalUnique} 项独有优势（预期 11）`);
ok(SYS.every((s) => ADVANTAGES[s].unique.every((u) => u.claim && u.why && u.cannot)), '每项都有主张/为何独有/别家做不到');
ok(SYS.every((s) => ADVANTAGES[s].missing), '每套都标注了自家缺什么');

/* ── ② 耦合 vs 分离（用户的例子）── */
console.log('\n=== 庙旺维度差异（耦合 vs 分离）===');
console.log('  ' + COUPLING_TABLE.title);
for (const r of COUPLING_TABLE.rows) {
  console.log(`  ${r.system.padEnd(18)} ${r.dim.padEnd(26)} [${r.nature}] 优点:${r.pro} 代价:${r.con}`);
}
console.log('  结论：' + COUPLING_TABLE.conclusion);
ok(COUPLING_TABLE.rows.length === 5, '对照表 5 行');
ok(COUPLING_TABLE.rows.some((r) => r.nature === '耦合'), '存在耦合型（紫微）');
ok(COUPLING_TABLE.rows.some((r) => r.nature === '分离' || r.nature === '偏分离'), '存在分离型');

/* ── ③ 紫微亮度表结构 ── */
console.log('\n=== 紫微亮度表结构校验 ===');
ok(Object.keys(ZIWEI_BRIGHTNESS).length === 14, '十四主星齐全');
ok(Object.values(ZIWEI_BRIGHTNESS).every((r) => r.length === 12), '每颗星 12 格齐全');
ok(Object.values(ZIWEI_BRIGHTNESS).every((r) => r.every((v) => LEVELS.includes(v))), '所有格子都是合法亮度级');
// ⚠️ 曾断言「每颗星都须同时含庙与陷」——错。
//    紫微斗数事实：**紫微无陷**，武曲/天府/七杀等刚性星也极少落陷；
//    而天机/太阳/太阴/廉贞/贪狼/巨门/破军这类变动星必然有陷。
//    所以正确的是「按星性分组检验」，而不是一刀切。
const GANG_XING = ['紫微', '武曲', '天府', '七杀'];          // 刚性星：无陷
const BIAN_DONG = ['天机', '太阳', '太阴', '廉贞', '贪狼', '巨门', '破军']; // 变动星：必有陷
ok(GANG_XING.every((s) => !ZIWEI_BRIGHTNESS[s].includes('陷')), `刚性星无陷（${GANG_XING.join('/')}）`);
ok(BIAN_DONG.every((s) => ZIWEI_BRIGHTNESS[s].includes('陷')), `变动星必有陷（${BIAN_DONG.join('/')}）`);
// 太阳在午应最亮、在子应最暗（这是紫微斗数的硬常识）
ok(ZIWEI_BRIGHTNESS.太阳[ZHI12.indexOf('午')] === '庙', '太阳在午宫为庙（常识校验）');
ok(ZIWEI_BRIGHTNESS.太阳[ZHI12.indexOf('子')] === '陷', '太阳在子宫为陷（常识校验）');
ok(ZIWEI_BRIGHTNESS.太阴[ZHI12.indexOf('子')] === '庙', '太阴在子宫为庙（常识校验）');
ok(ZIWEI_BRIGHTNESS.太阴[ZHI12.indexOf('午')] === '陷', '太阴在午宫为陷（常识校验）');
console.log(`  ⚠️ 数据状态：${DATA_STATUS}（未逐格核对各派，见文件头注释）`);

/* ── ④ 二十八宿 ── */
console.log('\n=== 二十八宿 ===');
const rs = xiuRanges(0);
const sumDeg = XIU28.reduce((a, x) => a + x.deg, 0);
console.log(`  共 ${XIU28.length} 宿，距度合计 ${sumDeg.toFixed(1)}°`);
ok(XIU28.length === 28, '恰为 28 宿');
ok(Math.abs(sumDeg - 360) < 6, `距度合计接近 360°（实测 ${sumDeg.toFixed(1)}°）`);
ok(rs.length === 28 && rs.every((r) => typeof r.from === 'number'), '每宿有起点黄经');
// 不等分验证：最长与最短应悬殊
const degs = XIU28.map((x) => x.deg);
ok(Math.max(...degs) / Math.min(...degs) > 10, `不等分成立（最长 ${Math.max(...degs)}° / 最短 ${Math.min(...degs)}°）`);
console.log(`  最长：${XIU28.find((x) => x.deg === Math.max(...degs)).name} ${Math.max(...degs)}°；最短：${XIU28.find((x) => x.deg === Math.min(...degs)).name} ${Math.min(...degs)}°`);
// 查宿
const t1 = xiuOf(10), t2 = xiuOf(200);
console.log(`  黄经 10° → ${t1.name}宿（本宿内 ${t1.offset}°）`);
console.log(`  黄经 200° → ${t2.name}宿（本宿内 ${t2.offset}°）`);
ok(t1 && t1.name, '黄经可查宿');
ok(t1.name !== t2.name, '不同黄经落在不同宿');

/* ── ⑤ 亮度乘子 ── */
console.log('\n=== 亮度乘子 ===');
for (const l of BRIGHTNESS_LEVELS) console.log(`  ${l.padEnd(4)} × ${brightnessFactor(l)}`);
ok(BRIGHTNESS_LEVELS.every((l) => brightnessFactor(l) > 0), '所有亮度级都有正乘子');
ok(BRIGHTNESS_LEVELS.every((l, i, a) => i === 0 || brightnessFactor(a[i - 1]) >= brightnessFactor(l)), '乘子随亮度单调递减');
const z = ziweiBrightness('太阳', '午');
console.log(`  太阳在午 → ${z.level} ×${z.factor}（${z.note.slice(0, 20)}…）`);
ok(z && z.level === '庙', 'ziweiBrightness 可用');

/* ── ⑥ 四系统合议（真实盘）── */
console.log('\n=== 四系统合议（本盘）===');
const natal = computeNatal({ at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, tz: 8 });
const planets = Array.isArray(natal.planets)
  ? natal.planets
  : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);

const sun = planets.find((p) => p.name === '太阳');
const sample = planets.filter((p) => ['太阳', '月亮', '土星', '金星'].includes(p.name));
for (const p of sample) {
  const dg = dignityOf(p.name, p.sign);
  const zhi = SIGN_TO_ZHI_YUEJIAN[p.sign];
  // 取一颗最接近的紫微主星做演示（近占星映射）
  const ZMAP = { 太阳: '太阳', 月亮: '太阴', 土星: '天梁', 金星: '武曲' };
  const zb = ziweiBrightness(ZMAP[p.name], zhi);
  const xi = xiuOf(p.lon ?? 0);
  const syn = synthesize(p, {
    dignity: dg,
    domain: HOUSE_DOMAIN[p.house]?.plain,
    ziweiBrightness: zb?.level,
    ziweiStar: p.name,
    ziweiZhi: zhi,
    xiu: xi ? `${xi.name}宿（${xi.offset}°）` : null,
  });
  console.log(`\n  ${p.name} ${p.sign} 第${p.house}宫`);
  for (const l of syn.layers) console.log(`    [${l.system}] ${l.aspect} → ${l.value}`);
  console.log(`    心理轴 ${syn.axes.psych.level} (${syn.axes.psych.basis}) ×${syn.axes.psych.value}`);
  console.log(`    物质轴 ${syn.axes.material.level} (${syn.axes.material.basis}) ×${syn.axes.material.value}`);
  console.log(`    读法：${syn.quadrant.reading}`);
  ok(syn.layers.length >= 3, `${p.name} 至少叠了 3 层`);
  // ★ 双轴模型：两个轴必须都存在且独立，绝不能被压成一个数
  ok(syn.axes && syn.axes.psych && syn.axes.material, `${p.name} 有心理轴与物质轴`);
  ok(syn.strengthHint === null, `${p.name} 不再输出单一强度（避免把两轴压成一个数）`);
  ok(typeof syn.quadrant.reading === 'string' && syn.quadrant.reading.length > 4, `${p.name} 有象限读法`);
}

/* ── ⑥b 双轴模型专项：月亮天蝎落 + 太阴亥庙 应读作「物质有靠心里不安」── */
console.log('\n=== 双轴模型专项检验（用户的例子）===');
{
  const moonP = planets.find((p) => p.name === '月亮');
  const dgMoon = dignityOf('月亮', moonP.sign);           // 天蝎 → 落
  const zhiMoon = SIGN_TO_ZHI_YUEJIAN[moonP.sign];        // 天蝎 → 亥
  const zbMoon = ziweiBrightness('太阴', zhiMoon);        // 太阴在亥 → 庙
  console.log(`  月亮 ${moonP.sign}：占星本质 ${dgMoon.tier} ×${dgMoon.k}；紫微 太阴在${zhiMoon} 为 ${zbMoon.level} ×${zbMoon.factor}`);
  const s2 = synthesize(moonP, { dignity: dgMoon, ziweiBrightness: zbMoon.level, ziweiStar: '太阴', ziweiZhi: zhiMoon });
  console.log(`  心理轴 ${s2.axes.psych.level} ・ 物质轴 ${s2.axes.material.level}`);
  console.log(`  读法：${s2.quadrant.reading}`);
  ok(dgMoon.tier === '落', '占星侧确实是「落」');
  ok(zbMoon.level === '庙', '紫微侧确实是「庙」');
  ok(s2.axes.psych.value < 1 && s2.axes.material.value > 1, '两轴方向相反且各自保留（未被平均）');
  ok(!('conflict' in s2), '不再标记为「冲突」（用户纠正：一个主心理一个主物质）');
  ok(s2.quadrant.reading.includes('物质有靠'), '读作「物质有靠，但心里不安」');
}

/* ── ⑦ 融合层设计 ── */
console.log('\n=== 融合方案：一图四层 ===');
console.log('  坐标基准：' + FUSION_LAYERS.coordinate);
for (const l of FUSION_LAYERS.layers) {
  console.log(`  ${l.layer.padEnd(6)} ← ${l.from.padEnd(18)} ${l.provides.slice(0, 46)}`);
}
console.log('  规则：' + FUSION_LAYERS.rule);
ok(FUSION_LAYERS.layers.length >= 6, '融合层至少 6 层');
ok(FUSION_LAYERS.layers.every((l) => l.provides && l.why), '每层都说明提供什么与为何');
// 每层来源必须是四套之一（或组合），不能凭空造
const SOURCES = ['八字', '古典占星', '七政四余', '紫微斗数'];
ok(FUSION_LAYERS.layers.every((l) => SOURCES.some((s) => l.from.includes(s))), '每层来源都可追溯到四套体系之一');
// 四个体系都至少被用到一次
ok(SOURCES.every((s) => FUSION_LAYERS.layers.some((l) => l.from.includes(s))), '四套体系在融合方案中全部有出场');

console.log(`\n${fail ? '❌' : '✅'} 通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
