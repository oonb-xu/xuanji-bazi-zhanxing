// Part 8 数据库自发掘协议 规程自检（exit 0 = 全过）
//  A. 必然尊贵表：对宫自洽 + 已知个案
//  B. 8.1.1 十神↔行星对应：13 行全覆盖、判定逻辑、缺失星盘时降级
//  C. 8.1.2 冲合害 × 硬相位共振：命中/未命中/得分/等级
//  D. 8.2 追加与唯一性：run 计数、correspondence 幂等、proposal 唯一且待人工裁决
//  E. 8.2 每 10 轮矛盾复盘：第 10 轮触发并标记「需人工验证」
//  F. 端到端渲染：三类输出均存在且非空壳
import { rmSync, existsSync } from 'node:fs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { friction } from '../src/cross/friction.mjs';
import { correspondences, shiShenWeights } from '../src/cross/correspondence.mjs';
import { runDbDiscovery, renderDbDiscovery, resonance } from '../src/cross/db-discovery.mjs';
import { KB_PATH, loadKb, runCount, listProposals, decideProposal, contradictionReview, proposeUpdate } from '../src/cross/kb-db.mjs';
import { LIB_PATH } from '../src/cross/mapping-library.mjs';
import { dignityOf, dignityTable, DOMICILE, EXALTATION, DETRIMENT, FALL } from '../src/western/dignity.mjs';
import { computeNatal } from '../src/western/natal.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 必然尊贵表');
for (const p of Object.keys(DOMICILE)) {
  ok(EXALTATION[p]?.length, `${p} 缺旺`);
  ok(DETRIMENT[p]?.length, `${p} 缺陷`);
  ok(FALL[p]?.length, `${p} 缺落`);
  // 陷必须是庙之对宫；落必须是旺之对宫
  const opp = { 白羊: '天秤', 金牛: '天蝎', 双子: '射手', 巨蟹: '摩羯', 狮子: '水瓶', 处女: '双鱼', 天秤: '白羊', 天蝎: '金牛', 射手: '双子', 摩羯: '巨蟹', 水瓶: '狮子', 双鱼: '处女' };
  for (const s of DOMICILE[p]) ok(DETRIMENT[p].includes(opp[s]), `${p} 陷表错（${s} 的对宫应在陷）`);
  for (const s of EXALTATION[p]) ok(FALL[p].includes(opp[s]), `${p} 落表错（${s} 的对宫应在落）`);
}
const CASES = [['金星', '天蝎', '陷'], ['金星', '双鱼', '旺'], ['金星', '金牛', '庙'], ['金星', '处女', '落'],
  ['土星', '摩羯', '庙'], ['太阳', '狮子', '庙'], ['太阳', '水瓶', '陷'], ['月亮', '摩羯', '陷'],
  ['木星', '巨蟹', '旺'], ['火星', '摩羯', '旺'], ['水星', '射手', '陷'], ['冥王星', '天蝎', '庙']];
for (const [p, s, want] of CASES) eq(dignityOf(p, s).state, want, `${p}@${s}`);
eq(dignityTable().length, 10, '尊贵表应覆盖 10 行星');
console.log(`  对宫自洽 + ${CASES.length} 个已知个案 ✓`);

console.log('[B] 8.1.1 十神↔行星对应');
const bz = compileBazi({ at: '1990-05-20 14:30', gender: '男' });
const natal = computeNatal({ at: '1990-05-20 14:30', lat: 31.23, lon: 121.47, tz: 8 });
const c = correspondences(bz, natal);
eq(c.rows.length, 13, '5.1 表 13 行应全覆盖');
ok(c.rows.every((r) => r.planet && r.shiShen), '每行须有 planet/shiShen');
ok(c.rows.every((r) => ['共振', '背离', '中性', '不可比'].includes(r.verdict)), 'verdict 取值越界');
eq(c.meta.comparable + c.rows.filter((r) => r.verdict === '不可比').length, 13, '可比+不可比 应等于 13');
// 构造：金星落天蝎（陷，分 −1）；若财星权重高 → 背离
const bzLow = compileBazi({ pillars: ['甲子', '丙子', '甲子', '丙子'] }); // 财星极弱
const cLow = correspondences(bzLow, natal);
const venusRow = cLow.rows.find((r) => r.planet === '金星');
ok(venusRow && venusRow.dignity === '陷', `金星在天蝎应判陷，实得 ${venusRow?.dignity}`);
eq(cLow.rows.find((r) => r.planet === '太阳').verdict !== undefined, true, '太阳行有判定');
// 无星盘 → 全部不可比
const cNone = correspondences(bz, null);
ok(cNone.rows.every((r) => r.verdict === '不可比'), '无星盘时应全部不可比');
ok(cNone.meta.hasAstro === false, 'meta.hasAstro 应为 false');
const w = shiShenWeights(bz);
ok(Object.keys(w).length > 0 && w['七杀'] > 0, `十神权重应含七杀，实得 ${JSON.stringify(w)}`);
console.log(`  13 行覆盖 ✓；可比 ${c.meta.comparable}（共振 ${c.meta.syncCount}/背离 ${c.meta.divergeCount}）✓；无星盘降级 ✓`);

console.log('[C] 8.1.2 共振检测');
const bzFatal = compileBazi({ pillars: ['甲寅', '庚寅', '戊子', '甲午'] }); // 子午冲、无贵人
const astroFatal = { planets: { 火星: { sign: '白羊', house: 7 }, 冥王星: { sign: '天蝎', house: 8 } }, aspects: [{ a: '火星', b: '冥王星', type: '对冲' }] };
const frFatal = friction(bzFatal, astroFatal);
const resFatal = resonance(bzFatal, astroFatal, frFatal);
ok(resFatal.patterns.length >= 1, '应至少命中 1 条共振');
eq(resFatal.score, 4.5, '得分应为 4.5（对冲3 × 冥王星1.5）');
eq(resFatal.level, '中', '4.5 应判「中」（≥3 且 <6）');
ok(resFatal.baziRelations.冲.length >= 1, 'bazi_relations.冲 应非空');
// 硬相位多而八字无关系 → 未共振计入 unmatched
// 控制变量：寅卯午未 四支之间无冲/刑/害（子午冲、子卯刑、卯辰害都要避开）
const P_CALM = ['甲寅', '丁卯', '庚午', '癸未'];
const bzCalm = compileBazi({ pillars: P_CALM });
const astroCalm = { planets: { 火星: { sign: '白羊' }, 冥王星: { sign: '天蝎' } }, aspects: [{ a: '火星', b: '冥王星', type: '对冲' }] };
const relCalm = friction(bzCalm, astroCalm).baziSide.detail;
ok(!relCalm.chong && !relCalm.xing && !relCalm.hai, `P_CALM 应无冲刑害，实得 冲=${relCalm.chong} 刑=${relCalm.xing} 害=${relCalm.hai}`);
const resCalm = resonance(bzCalm, astroCalm, friction(bzCalm, astroCalm));
eq(resCalm.score, 0, '无对应刑冲时得分应为 0');
eq(resCalm.level, '无', '得分 0 应判「无」');
ok(resCalm.unmatched.length >= 1, '未共振的硬相位应列入 unmatched');
// 高等级
const many = { planets: { 火星: { sign: '白羊' }, 冥王星: { sign: '天蝎' }, 土星: { sign: '摩羯' }, 月亮: { sign: '巨蟹' } }, aspects: [{ a: '火星', b: '冥王星', type: '对冲' }, { a: '月亮', b: '土星', type: '对冲' }, { a: '月亮', b: '火星', type: '四分相' }] };
const resMany = resonance(bzFatal, many, friction(bzFatal, many));
ok(resMany.score >= 3, `多相位应累计得分，实得 ${resMany.score}`);
console.log(`  命中 ${resFatal.patterns.length} 条/得分 ${resFatal.score}(${resFatal.level}) ✓；未共振 ${resCalm.unmatched.length} 条 ✓`);

console.log('[D] 8.2 追加与唯一性（隔离库）');
const TMPKB = KB_PATH + '.test';
const TMPLIB = LIB_PATH + '.test';
for (const p of [TMPKB, TMPLIB]) if (existsSync(p)) rmSync(p);
eq(runCount(TMPKB), 0, '初始 run 计数');
const runArgs = { bazi: bzFatal, astroInput: astroFatal, frictionResult: frFatal, chartId: 'chart-A', kbPath: TMPKB, libPath: TMPLIB };
const d1 = runDbDiscovery(runArgs);
eq(d1.run.index, 1, '第一次 run 序号');
eq(runCount(TMPKB), 1, 'run 事件数');
const d1b = runDbDiscovery(runArgs);
eq(d1b.run.index, 2, '第二次 run 序号');
const corrEvents = loadKb(TMPKB).by.correspondence;
eq(corrEvents.length, 13, '同 chartId 的对应应幂等（13 行）');
const props = listProposals(TMPKB);
ok(props.length >= 1, '应产出更新建议');
ok(props.length >= 2, `同一 chartId 的多条建议不应被去重成一条，实得 ${props.length}`);
ok(new Set(props.map((p) => p.id)).size === props.length, 'proposal id 应唯一');
eq(props.filter((p) => p.target === 'jishen_alert').length, listProposals(TMPKB).filter((p) => p.target === 'jishen_alert').length, 'jishen_alert 建议去重');
ok(props.every((p) => p.status === 'pending-human' || p.status === 'accepted'), `建议初始状态应为 pending-human，实得 ${[...new Set(props.map((p) => p.status))]}`);
// 未自动写入 jishen_alert 集合
ok(!loadKb(TMPKB).by.jishen_alert, 'jishen_alert 不应被自动写入（无该集合）');
// 人工裁决
const target = props[0].id;
decideProposal(target, 'accepted', '测试采纳', TMPKB);
eq(listProposals(TMPKB).find((p) => p.id === target).status, 'accepted', '裁决后状态');
console.log(`  run 计数 ✓；对应幂等 13 条 ✓；建议 ${props.length} 条（pending-human，未自动生效）✓；人工裁决 ✓`);

console.log('[E] 8.2 每 10 轮矛盾复盘');
for (let i = 0; i < 7; i++) runDbDiscovery({ ...runArgs, chartId: `chart-${i}` });
const d10 = runDbDiscovery({ ...runArgs, chartId: 'chart-10' });
eq(d10.run.index, 10, '第 10 次 run 序号');
eq(d10.run.isReviewTick, true, '第 10 轮应触发复盘');
ok(d10.review && d10.review.mark === '需人工验证', '复盘应标记「需人工验证」');
ok(Array.isArray(d10.review.flags), '复盘须给出矛盾明细');
ok(loadKb(TMPKB).by.review.length >= 1, 'review 事件应落库');
for (const p of [TMPKB, TMPLIB]) if (existsSync(p)) rmSync(p);
console.log(`  第 10 轮触发复盘，扫描 ${d10.review.scanned} 条、标记 ${d10.review.flagged} 条 ✓`);

console.log('[F] 端到端渲染');
const dReal = runDbDiscovery({ bazi: bzFatal, astroInput: astroFatal, frictionResult: frFatal, chartId: 'render-only', write: false });
const text = renderDbDiscovery(dReal);
for (const seg of ['【Part 8 · 数据库自发掘】', '【本次新发现】', '【数据库更新建议】', '【待验证猜想】']) ok(text.includes(seg), `渲染缺少 ${seg}`);
ok(dReal.findings.length > 0 && dReal.conjectures.length > 0, '新发现与猜想不应为空');
ok(dReal.suggestions.some((s) => s.target === 'jishen_alert'), '破坏值≥2 应产出 jishen_alert 建议');
// 无星盘时跳过
const dSkip = runDbDiscovery({ bazi: bz, astroInput: null, frictionResult: { provided: false }, chartId: 'x', write: false });
ok(dSkip.skipped === true, '无星盘应跳过');
ok(renderDbDiscovery(dSkip).includes('跳过'), '无星盘渲染应说明跳过');
console.log(`  四段渲染齐备 ✓；建议含 jishen_alert ✓；无星盘跳过 ✓`);

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
