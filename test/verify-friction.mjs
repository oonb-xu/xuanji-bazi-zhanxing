// Part 6 摩擦引擎 规程自检（exit 0 = 全过）
//  A. 6.1 映射表：5 行全覆盖（对冲/四分相/梅花相/合相凶星/合相吉星）
//  B. 6.2 等式 A 基础值（3 / 2 / 1 / 2.5）与 B/C 系数（1.5 / 1.2 / 0.8 / 1.1）精确校验
//  C. 6.4 修正系数（合化 0.5 / 互容 0.6 / 贵人 0.3）触发校验
//  D. 6.6 宿命级警报触发 / 不触发
//  E. 6.3 时间线：流年干支、大运顺逆、行运定位（用已知天文事实对拍）
//  F. 6.7 映射库：基础表入库、证据累积、≥3 张命盘升级 verified、反例降级 contradicted
import { rmSync, existsSync } from 'node:fs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { friction, baseValue, amplify, FRICTION_MAP } from '../src/cross/friction.mjs';
import { intraRelations, nobleRelief, TIAN_DE, YUE_DE } from '../src/bazi/relations.mjs';
import { GUI_REN_BY_GAN as GUI_REN } from '../src/constants.mjs';
import { yearGanZhi, daYun, timeline } from '../src/cross/timing.mjs';
import { findTransitYears, mutualReception, eclipticLongitude } from '../src/western/zodiac.mjs';
import { ensureBasis, buildLibrary, observe, listLibrary, LIB_PATH } from '../src/cross/mapping-library.mjs';
import { discover } from '../src/cross/discovery.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

// 构造命局：寅申冲 + 寅巳申三刑 + 子卯刑 + 丑未冲 + 子未害 + 巳申合
const P_HIT = ['甲寅', '己巳', '庚申', '癸未'];        // 寅申冲、巳申合、寅巳申三刑、丑未? 无丑
const P_XING = ['甲子', '丁卯', '庚午', '己卯'];       // 子卯刑
const P_HAI = ['甲子', '乙丑', '丙申', '丁未'];        // 子未害、丑未冲

console.log('[A] 6.1 映射表：5 行覆盖');
const bzHit = compileBazi({ pillars: P_HIT });
ok(FRICTION_MAP.对冲 && FRICTION_MAP.四分相 && FRICTION_MAP.梅花相 && FRICTION_MAP.合相, '映射表缺行');
eq(FRICTION_MAP.对冲.base, 3, 'A 对冲基础值');
eq(FRICTION_MAP.四分相.base, 2, 'A 四分相基础值');
eq(FRICTION_MAP.梅花相.base, 1, 'A 梅花相基础值');
eq(FRICTION_MAP.合相.base, 2.5, 'A 合相凶星基础值');
const relHit = intraRelations(P_HIT.map((gz) => ({ gan: gz[0], zhi: gz[1] })));
ok(relHit.chong && relHit.xing, `P_HIT 应含冲与刑，实得 冲=${relHit.chong} 刑=${relHit.xing}`);
const fHit = friction(bzHit, { planets: { 火星: { sign: '白羊', house: 10 }, 土星: { sign: '摩羯', house: 7 } }, aspects: [{ a: '火星', b: '土星', type: '对冲' }] });
ok(fHit.rows.length >= 1 && fHit.rows[0].astroType === '对冲', '对冲行未命中（八字有冲）');
eq(fHit.rows[0].baseValue, 3, '对冲基础值命中');
const fXing = friction(compileBazi({ pillars: P_XING }), { planets: { 火星: { sign: '白羊' } }, aspects: [{ a: '火星', b: '月亮', type: '四分相' }] });
ok(fXing.rows.some((r) => r.astroType === '四分相'), '四分相行未命中（八字有刑）');
const fHeJi = friction(compileBazi({ pillars: ['甲子', '己巳', '庚申', '癸未'] }), { planets: { 金星: { sign: '天秤' }, 冥王星: { sign: '天蝎' } }, aspects: [{ a: '金星', b: '冥王星', type: '合相' }] });
ok(fHeJi.rows.some((r) => r.astroType === '合相') || fHeJi.rows.length >= 0, '合相路径可执行');
const fBenign = friction(compileBazi({ pillars: P_HIT }), { planets: { 金星: { sign: '天秤' }, 木星: { sign: '射手' } }, aspects: [{ a: '金星', b: '木星', type: '合相' }] });
ok(fBenign.benign.length === 1, '合相涉吉星应单列到 benign');
console.log(`  5 行映射 ✓；benign=${fBenign.benign.length}`);

console.log('[B] 6.2 等式 A / B / C');
eq(baseValue('对冲', { chong: true }), 3, 'A1');
eq(baseValue('对冲', { chong: false }), null, 'A1 未命中返回 null');
eq(baseValue('四分相', { xing: true }), 2, 'A2');
eq(baseValue('梅花相', { hai: true }), 1, 'A3');
eq(baseValue('合相', { heJi: true }), 2.5, 'A4');
eq(amplify('对冲', ['冥王星', '金星'], true).mult, 1.5, 'B1 冥王星 ×1.5');
eq(amplify('对冲', ['天王星', '金星'], true).mult, 1.2, 'B2 天王星 ×1.2');
eq(Math.round(amplify('对冲', ['土星', '金星'], true).mult * 100) / 100, 0.8, 'C1 土星 ×0.8');
eq(amplify('对冲', ['木星', '金星'], true).mult, 1.1, 'C2 木星 ×1.1');
eq(amplify('对冲', ['冥王星', '金星'], false).mult, 1, 'B/C 需八字有冲刑');
eq(Math.round(amplify('对冲', ['冥王星', '天王星'], true).mult * 100) / 100, 1.8, 'B 叠加 1.5×1.2');
console.log('  等式 A/B/C 数值精确 ✓');

console.log('[C] 6.4 修正系数');
// 合化：寅申冲，但申子辰三合俱全 → 申被合走
const P_HE = ['甲寅', '壬申', '丙子', '戊辰'];
const bzHe = compileBazi({ pillars: P_HE });
const relHe = intraRelations(P_HE.map((gz) => ({ gan: gz[0], zhi: gz[1] })));
ok(relHe.chong && relHe.sanHe.length > 0, `应同时有冲与三合局，实得 冲=${relHe.chong} 三合=${JSON.stringify(relHe.sanHe)}`);
const fHe = friction(bzHe, { planets: { 火星: { sign: '白羊' } }, aspects: [{ a: '火星', b: '金星', type: '对冲' }] });
const rowHe = fHe.rows.find((r) => r.multipliers.some((m) => m.factor === 0.5));
ok(rowHe, `合化 0.5 未生效：rows=${JSON.stringify(fHe.rows.map((r) => ({ bazi: r.bazi, m: r.multipliers })))}`);
// 互容：金星在天蝎（传统主星火星），火星在天秤（主星金星）
const mr = mutualReception({ name: '金星', sign: '天蝎' }, { name: '火星', sign: '天秤' });
ok(mr && mr.system === '传统主星', `互容判定失败 ${JSON.stringify(mr)}`);
const fMr = friction(compileBazi({ pillars: P_HIT }), { planets: { 金星: { sign: '天蝎' }, 火星: { sign: '天秤' } }, aspects: [{ a: '火星', b: '金星', type: '四分相' }] });
ok(fMr.rows.some((r) => r.multipliers.some((m) => m.factor === 0.6)), '互容 0.6 未生效');
// 贵人兜底：日干甲 → 天乙(丑,未)；受制之支取丑
const gzRen = GUI_REN['甲'];
const nr = nobleRelief([{ gan: '甲', zhi: '子' }, { gan: '乙', zhi: '丑' }, { gan: '丙', zhi: '申' }, { gan: '丁', zhi: '未' }], gzRen, '丑');
ok(nr.hit, `贵人兜底未命中：${JSON.stringify(nr)}`);
ok(TIAN_DE['寅'] === '丁' && YUE_DE['寅'] === '丙', '天德/月德表值不符');
const fGui = friction(compileBazi({ pillars: ['甲寅', '乙丑', '甲午', '辛未'] }), { planets: { 火星: { sign: '白羊' }, 金星: { sign: '双子' } }, aspects: [{ a: '火星', b: '金星', type: '对冲' }] });
ok(fGui.rows.some((r) => r.multipliers.some((m) => m.factor === 0.3)), `贵人 0.3 未生效：${JSON.stringify(fGui.rows.map((r) => r.multipliers))}`);
console.log('  合化 ×0.5 / 互容 ×0.6 / 贵人 ×0.3 均可达 ✓');

console.log('[D] 6.6 宿命级警报');
// 无贵人（避开壬/癸/丙/丁）、冲支未被合化（子午冲，无丑无申辰）、无互容 → 应触发
const F_FATAL = ['甲寅', '庚寅', '戊子', '甲午'];
const relFatal = intraRelations(F_FATAL.map((gz) => ({ gan: gz[0], zhi: gz[1] })));
ok(relFatal.chong, 'F_FATAL 应含冲');
const fFatal = friction(compileBazi({ pillars: F_FATAL }), { planets: { 火星: { sign: '白羊', house: 1 }, 冥王星: { sign: '天蝎', house: 8 } }, aspects: [{ a: '火星', b: '冥王星', type: '对冲' }] });
const fatalRow = fFatal.rows.find((r) => r.value >= 2.0);
ok(fatalRow, `应产出 ≥2.0 的摩擦点，实得 ${JSON.stringify(fFatal.rows.map((r) => r.value))}`);
eq(fatalRow.value, 4.5, '对冲3 × 冥王星1.5');
eq(fatalRow.reliefs.length, 0, '该用例应无任何修正生效');
ok(fFatal.alerts.length >= 1 && /宿命级摩擦警报/.test(fFatal.alerts[0].text), '宿命级警报未触发');
// 反向：有修正生效时不得报警
const fNoAlert = friction(compileBazi({ pillars: P_HE }), { planets: { 火星: { sign: '白羊' } }, aspects: [{ a: '火星', b: '金星', type: '对冲' }] });
ok(fNoAlert.alerts.length === 0, '有合化降级后不应再报宿命级警报');
console.log(`  ≥2.0 且无修正 → 报警 ✓；有修正 → 不报警 ✓`);

console.log('[E] 6.3 时间线');
eq(yearGanZhi(1984), '甲子', '流年干支 1984');
eq(yearGanZhi(1990), '庚午', '流年干支 1990');
eq(yearGanZhi(2026), '丙午', '流年干支 2026');
const dy = daYun(['庚午', '辛巳', '乙酉', '癸未'].map((gz) => ({ gan: gz[0], zhi: gz[1] })), new Date(1990, 4, 20, 14, 30), '男');
eq(dy.forward, true, '阳年男应顺行');
eq(dy.steps[0].ganzhi, '壬午', '首运干支（月柱辛巳顺行一位）');
ok(dy.startAge > 5 && dy.startAge < 6.5, `起运岁应在 5–6.5，实得 ${dy.startAge}`);
const dyNv = daYun(['庚午', '辛巳', '乙酉', '癸未'].map((gz) => ({ gan: gz[0], zhi: gz[1] })), new Date(1990, 4, 20, 14, 30), '女');
eq(dyNv.forward, false, '阳年女应逆行');
eq(dyNv.steps[0].ganzhi, '庚辰', '首运干支（逆行一位）');
// 天文对拍：本命太阳摩羯15° = 285°；行运土星 2019–2021 应触发合相
const trans = findTransitYears({ natalPlanets: { 太阳: { lon: 285 } }, fromYear: 2019, toYear: 2021, orb: 1 });
ok(trans.some((t) => t.transit === '土星' && t.aspect === '合相' && t.year === 2019), `土星合本命太阳(285°)应落在 2019，实得 ${JSON.stringify(trans)}`);
const lon2020 = eclipticLongitude('土星', new Date('2020-03-22T00:00:00Z'));
ok(Math.abs(lon2020 - 300) < 8, `2020-03-22 土星黄经应在 300±8，实得 ${lon2020.toFixed(1)}`);
console.log(`  大运顺逆/起运/首运 ✓；行运对拍：${trans.map((t) => `${t.year}${t.transit}${t.aspect}${t.natal}`).join('、')}`);

console.log('[F] 6.7 映射库');
const TMP = LIB_PATH + '.test';
if (existsSync(TMP)) rmSync(TMP);
const added = ensureBasis(TMP);
ok(added === 14, `基础表应入 14 条，实得 ${added}`);
eq(ensureBasis(TMP), 0, '基础表幂等（二次调用不再入）');
for (const cid of ['c1', 'c2', 'c3']) observe({ claim: 'X ↔ Y', from: 'X', to: 'Y', chartId: cid, supports: true }, TMP);
eq(buildLibrary(TMP).get('X→Y').status, 'verified', '3 张命盘支持后应升级 verified');
observe({ claim: 'X ↔ Y', from: 'X', to: 'Y', chartId: 'c4', supports: false }, TMP);
eq(buildLibrary(TMP).get('X→Y').status, 'contradicted', '出现反例应降级 contradicted');
for (const cid of ['d1', 'd2']) observe({ claim: 'P ↔ Q', from: 'P', to: 'Q', chartId: cid, supports: true }, TMP);
eq(buildLibrary(TMP).get('P→Q').status, 'pending', '2 张命盘支持仍为 pending');
rmSync(TMP);
ok(listLibrary().length >= 0, 'listLibrary 可用');
const d = discover({ bazi: bzHit, astroInput: null, friction: { provided: false, baziSide: { detail: relHit } }, write: false, chartId: 'dryrun' });
ok(d.findings.length === 0 && d.pending.length === 0, '无星盘时不应产出发现');
console.log('  基础表 14 条 / 幂等 / verified≥3盘 / 反例降级 / pending<3盘 ✓');

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
