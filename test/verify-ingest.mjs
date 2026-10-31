// 外部数据库接入 + 权重模型 规程自检（exit 0 = 全过）
//  A. 归一化：EN→CN 天体、角度→相位名
//  B. 对拍基线：本仓库 data/records/癸巳-丁亥-壬子-庚申.json 的 一致/冲突/不可对拍 计数
//  C. 冲突定位 + 输入自相矛盾检测（命宫 == 身宫）
//  D. R-B9 从格守卫：占比高但克泄有根/透干 → 不作从格；真从强仍能识别
//  E. R-B10 忌神取「最旺」而非「最缺」
//  F. 权重模型：weight = 100×S×E×C×I，冲突降权，不可对拍按外部输入计
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { auditDb, astroFromDb, baziFromDb, applyOverrides } from '../src/cross/ingest.mjs';
import { computeWeights, SOURCE_TIER, tierOf, impactOf } from '../src/cross/weights.mjs';
import { compileBazi, CHONG_INTENSITY } from '../src/bazi/engine.mjs';
import { validateDivinationInput, describeInterface } from '../src/divination/input.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = JSON.parse(readFileSync(resolve(HERE, '../data/records/癸巳-丁亥-壬子-庚申.json'), 'utf8'));

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 归一化');
const A = astroFromDb(DB);
eq(Object.keys(A.planets).length, 13, 'DB 应归一出 13 个天体（含上升/南北交点）');
eq(A.planets['月亮'].sign, '巨蟹', '月亮星座');
eq(A.planets['火星'].retro, true, '火星逆行标记');
eq(A.planets['北交点'].sign, '双鱼', '北交点');
const typeOf = (pair) => A.aspects.find((x) => [x.a, x.b].sort().join() === pair.split('-').sort().join())?.type;
eq(typeOf('太阳-月亮'), '对冲', '180° → 对冲');
eq(typeOf('月亮-金星'), '三分相', '120° → 三分相');
eq(A.aspects.length, 6, '相位总数');
console.log(`  13 天体 / 6 相位 / 角度映射 ✓`);

console.log('[B] 对拍基线');
const audit = auditDb(DB);
eq(audit.summary.一致, 33, '一致数');
eq(audit.summary.冲突, 2, '冲突数');
eq(audit.summary.不可对拍, 21, '不可对拍数');
eq(audit.total, 56, '对拍总条数');
ok(audit.summary.一致 + audit.summary.冲突 + audit.summary.不可对拍 === audit.total, '三类之和应等于总数');
console.log(`  ${audit.total} 条：一致 ${audit.summary.一致} / 冲突 ${audit.summary.冲突} / 不可对拍 ${audit.summary.不可对拍} ✓`);

console.log('[C] 冲突定位 + 输入自相矛盾');
const conflicts = audit.items.filter((x) => x.status === '冲突').map((x) => x.path);
ok(conflicts.includes('tai_ming_shen.minggong'), '命宫应报冲突');
ok(conflicts.includes('bazi_basic.score.fire'), '火权重应报口径冲突');
eq(conflicts.length, 2, '冲突应恰为 2 条');
eq(DB.tai_ming_shen.minggong.ganzhi, DB.tai_ming_shen.shengong.ganzhi, '本 DB 的命宫与身宫应相同（这正是输入自相矛盾的证据）');
eq(auditDb(DB).ir.L4_mingGong.ganzhi, '癸卯', '本引擎命宫');
eq(auditDb(DB).ir.L4_shenGong.ganzhi, '己酉', '本引擎身宫');
console.log(`  冲突 2 条（命宫 / 火权重）✓；DB 命宫=身宫=${DB.tai_ming_shen.minggong.ganzhi} → 自相矛盾 ✓`);

console.log('[D] R-B9 从格守卫（用锁定版 DB：含 ARCH-1/ARCH-2）');
const LOCKED = JSON.parse(readFileSync(resolve(HERE, '../data/records/bazi_meta_db.json'), 'utf8'));
const kuiLocked = baziFromDb(LOCKED);
const kuiRaw = baziFromDb(DB);   // 未锁定：R-B11 生效后 火=1.75
eq(kuiLocked.L3_verdict.verdict, '身旺', '锁定盘：应判身旺（非从格）');
ok(kuiLocked.L3_verdict.ratio > 0.7 && kuiLocked.L3_verdict.ratio < 0.8, `锁定盘占比应在 0.70–0.80，实得 ${kuiLocked.L3_verdict.ratio}`);
eq(kuiLocked.L3_verdict.follow.canFollow, false, 'canFollow 应为 false');
eq(kuiLocked.L3_verdict.follow.oppTouGan, true, '应检出克泄方透干（丁）');
eq(kuiLocked.L3_verdict.follow.oppBenqiRooted, true, '应检出克泄方本气之根（巳本气丙）');
eq(kuiRaw.L3_verdict.verdict, '身旺', 'R-B11 后未锁定盘同样是身旺');
ok(kuiRaw.L3_verdict.ratio < 0.8, `R-B11 后未锁定盘占比应 <0.8（实得 ${kuiRaw.L3_verdict.ratio}），进一步远离从格门槛`);
// 真从强：甲寅×4（克泄耗不透干、无本气之根）
const cong = compileBazi({ pillars: ['甲寅', '甲寅', '甲寅', '甲寅'] });
eq(cong.L3_verdict.verdict, '从强格', '甲寅×4 应判从强格');
eq(cong.L3_verdict.follow.canFollow, true, '甲寅×4 canFollow 应为 true');
// R-B11：相冲力度分级
eq(CHONG_INTENSITY[1].main, 0.5, 'R-B11 相邻冲本气 ×0.5');
eq(CHONG_INTENSITY[2].main, 0.75, 'R-B11 隔柱冲本气 ×0.75');
const modChong = kuiRaw.L2_hidden.mods.find((m) => m.type === '冲');
eq(modChong.dist, 2, '亥巳应为隔一柱之冲（distance=2）');
eq(modChong.main, 0.75, '该冲本气系数应为 0.75');
console.log(`  锁定盘 身旺(${kuiLocked.L3_verdict.ratio}) / 未锁定 身旺(${kuiRaw.L3_verdict.ratio}) / 甲寅×4 从强 ✓；R-B11 分级生效 ✓`);

console.log('[E] R-B10 忌神取最旺 + 人工锁定层');
eq(kuiLocked.L5_yongJi.ji, '水', '锁定盘忌神应为最旺之水');
eq(kuiLocked.L5_yongJi.yong, '木', '锁定盘用神应为最缺之木');
eq(kuiLocked.L3_distribution.adjusted.火, 3.0, 'ARCH-2：火应被锁定为 3.0');
eq(kuiLocked.L4_mingGong.ganzhi, '己酉', 'ARCH-1：命宫应被锁定为 己酉');
eq(kuiLocked.L4_mingGong.shiShen, '七杀', 'ARCH-1：命宫十神应收敛为 七杀');
eq(kuiLocked.L4_shenGong.ganzhi, '己酉', '身宫不受影响');
const auditLocked = auditDb(LOCKED);
eq(auditLocked.summary.人工锁定, 2, '锁定项应恰为 2 条');
eq(auditLocked.summary.冲突, 0, '锁定后应无冲突');
for (const it of auditLocked.items.filter((x) => x.status === '人工锁定')) ok(/引擎派生值/.test(it.note), `锁定项须留派生值痕迹：${it.path}`);
const Wl = computeWeights(auditLocked, {});
for (const r of Wl.rows.filter((x) => x.status === '人工锁定')) {
  eq(r.S, SOURCE_TIER.人工裁定, '人工锁定应按「人工裁定」档计权');
  eq(r.C, 1.0, '人工锁定的一致性系数应为 1.0');
}
console.log(`  锁定后：冲突 0｜人工锁定 2｜用 ${kuiLocked.L5_yongJi.yong} / 忌 ${kuiLocked.L5_yongJi.ji}｜锁定项权重按 1.00 档 ✓`);

console.log('[H] Divination_Input 接口（ARCH-3 解耦）');
const dv = validateDivinationInput({ interface: 'Divination_Input', askedAt: '2026-10-08 21:30', tz: 8, question: '示例' });
ok(dv.ok === true, '合法输入应通过');
eq(dv.yueJiangMode, 'auto', '未给月将应为 auto');
ok(validateDivinationInput({}).ok === false, '缺必填应校验失败');
ok(validateDivinationInput({ askedAt: '2026-10-08 21:30', shiChen: '巳' }).ok === true, '有合法时刻即可（占时由时刻推）');
ok(validateDivinationInput({ askedAt: '2026-10-08 21:30', riGanZhi: '甲X' }).ok === false, '非法日干支应失败');
ok(validateDivinationInput({ askedAt: '2026-10-08 21:30', shiChen: 'X' }).ok === false, '非法占时应失败');
const dvManual = validateDivinationInput({ riGanZhi: '己酉', shiChen: '巳', yueJiang: '辰', question: '古法盘' });
ok(dvManual.ok === true && dvManual.yueJiangMode === 'manual', '古法直给应走 manual');
ok(Array.isArray(describeInterface().required) && describeInterface().decoupledFrom.includes('bazi_meta_db'), '接口说明应声明与命盘 DB 解耦');
console.log('  auto/manual 两种模式、必填校验、解耦声明 ✓');

console.log('[F] 权重模型');
const W = computeWeights(audit, {});
eq(W.total, audit.total, '权重行数应等于数据条数');
for (const r of W.rows) {
  ok(r.weight > 0 && r.weight <= 100, `${r.path} 权重越界 ${r.weight}`);
  const expect = Math.round(100 * r.S * r.E * r.C * r.I * 10) / 10;
  ok(Math.abs(r.weight - expect) <= 0.11, `${r.path} 权重公式不符：${r.weight} vs ${expect}`);
  const trust = Math.round(100 * r.S * r.E * r.C * 10) / 10;
  ok(Math.abs(r.trust - trust) <= 0.11, `${r.path} trust 公式不符`);
}
eq(W.conflicts.length, 2, '权重表冲突数');
eq(W.conflicts[0].C, 0.35, '冲突项 C 应为 0.35');
for (const r of W.rows.filter((x) => x.status === '不可对拍')) eq(r.S, SOURCE_TIER.外部输入, `${r.path} 不可对拍应记外部输入`);
for (const r of W.rows.filter((x) => x.status === '一致' && /score|day_master|year|month|day|hour|canggan/.test(x.path) && !/yongshen|jishen|strength|geju/.test(x.path))) eq(r.S, SOURCE_TIER.引擎严格, `${r.path} 应为引擎严格`);
// 无证据时 E=0.5，故不可能出现「高」权（这是设计，不是缺陷）
ok(W.rows.every((r) => r.E === 0.5 && r.support === 0), '无库证据时 E 应为 0.5');
ok(W.byLevel.高 === undefined, '零证据下不应出现高权项（有证据才会升级）');
// 影响面：日柱被最多 Part 依赖
const dayImpact = impactOf('bazi_basic.day');
ok(dayImpact.refs >= 7 && dayImpact.I === 1, `日柱影响面应为最大，实得 refs=${dayImpact.refs}`);
console.log(`  ${W.total} 行公式自洽 ✓；冲突降权 ✓；外部输入档 ✓；零证据下无高权项 ✓；日柱影响面最大 ✓`);

console.log('[G] 确定性');
ok(JSON.stringify(auditDb(DB).summary) === JSON.stringify(auditDb(DB).summary), '对拍结果应可复现');
ok(JSON.stringify(computeWeights(audit, {}).rows) === JSON.stringify(computeWeights(audit, {}).rows), '权重应可复现');
console.log('  两次调用完全一致 ✓');

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
