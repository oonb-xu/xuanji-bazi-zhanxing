// 做功用库（补缺口 #2）回归钉
// 机检点：角色口径沿用 kuGong｜冲开/合开/透干三闸｜忌神库恒 false｜标度只取 dag 的 POS_W/CANG
//        ｜totalScore 有限非负｜magnitude 闭集分档
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compileBazi } from '../src/bazi/engine.mjs';
import { zuoGong, magnitudeOf, isWorkRole, WORK_W } from '../src/bazi/zuo-gong.mjs';
import { CANG, POS_W, CHONG, LIUHE } from '../src/bazi/dag.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);
const KEYS = ['canWork', 'ku', 'openedBy', 'role', 'touGan', 'workScore', 'zhi'];

console.log('[A] import 与返回结构');
{
  const b = compileBazi({ pillars: ['癸巳', '戊辰', '戊戌', '癸亥'] });
  const r = zuoGong(b, '水', '土');
  ok(Array.isArray(r.kus), 'kus 必须是数组');
  for (const x of r.kus) eq(Object.keys(x).sort().join(','), KEYS.join(','), `库项 ${x.zhi} 字段集`);
  eq(r.kus.length, 2, '该盘四库只有 辰/戌 两库');
  eq(Object.keys(r).sort().join(','), ['kus', 'magnitude', 'totalScore', 'verdict'].join(','), '顶层字段集');
  ok(isWorkRole('用神库') && isWorkRole('比劫库(根/帮身)') && !isWorkRole('忌神库') && !isWorkRole('闲库'), 'isWorkRole 口径');
  console.log(`  ${r.kus.map((x) => x.zhi + ':' + x.role + ':' + x.canWork).join(' ')} ✓`);
}

console.log('[B] ★ 判据②：癸巳/戊辰/戊戌/癸亥 的 辰 = 用神库·冲开·癸透 ⇒ canWork');
{
  const b = compileBazi({ pillars: ['癸巳', '戊辰', '戊戌', '癸亥'] });
  const chen = zuoGong(b, '水', '土').kus.find((x) => x.zhi === '辰');
  ok(chen, '必须检出辰库');
  eq(chen.role, '用神库', '辰=水库、水为用神');
  eq(chen.ku, '水', 'ku 取 KU 表');
  ok(chen.openedBy.includes('冲'), '辰戌冲 ⇒ openedBy 含「冲」，实得 ' + JSON.stringify(chen.openedBy));
  ok(CHONG['辰'] === '戌', '地支冲表自洽');
  ok(chen.touGan.length > 0 && chen.touGan.includes('癸'), '辰藏 戊乙癸，癸透 ⇒ touGan 含癸，实得 ' + JSON.stringify(chen.touGan));
  eq(chen.canWork, true, '角色可行且有开口 ⇒ canWork');
  // 逐项对账（POS_W/CANG 全部取自 dag.mjs，不读 L3_distribution）
  const expect = Math.round((
    chen.touGan.length * WORK_W.touGan
    + (chen.openedBy.includes('冲') ? WORK_W.chong : 0)
    + (chen.openedBy.includes('合') ? WORK_W.he : 0)
    + (CANG['辰'][0] === '戊' ? WORK_W.benUseful : 0)          // 本气戊土 = 日主五行（根）
    + POS_W['月'] * WORK_W.posW
  ) * 1000) / 1000;
  eq(chen.workScore, expect, '辰 workScore 手算对账');
  eq(chen.workScore, 3.55, '辰 workScore = 2×0.5+0.8+1.0+3×0.25');
  console.log(`  辰 role=${chen.role} opened=${chen.openedBy} touGan=${chen.touGan} workScore=${chen.workScore} ✓`);
}

console.log('[C] ★ 判据③：甲寅/丙午/戊戌/庚申 的 戌 = 火库 = 忌神库 ⇒ 恒 false');
{
  const b = compileBazi({ pillars: ['甲寅', '丙午', '戊戌', '庚申'] });
  const r = zuoGong(b, '水', '火');
  const xu = r.kus.find((x) => x.zhi === '戌');
  ok(xu, '必须检出戌库');
  eq(xu.role, '忌神库', '戌=火库、火为忌神');
  eq(xu.canWork, false, '★ 忌神库恒 false（即便有透干/开口）');
  ok(xu.touGan.length > 0, '该盘戌确有戊透（证明 false 来自角色而非无透干）');
  eq(r.kus.filter((x) => x.role === '忌神库' || x.role === '闲库').every((x) => x.canWork === false), true, '忌神库/闲库全部 false');
  console.log(`  戌 role=${xu.role} touGan=${xu.touGan} canWork=${xu.canWork}（totalScore=${r.totalScore} 仍按量级公式计） ✓`);
}

console.log('[D] ★ 判据④：magnitude 闭集 + totalScore 有限非负（多盘）');
{
  const SET = new Set(['微', '小', '中', '大']);
  const charts = [
    compileBazi({ pillars: ['癸巳', '戊辰', '戊戌', '癸亥'] }),
    compileBazi({ pillars: ['甲寅', '丙午', '戊戌', '庚申'] }),
    compileBazi({ at: '2007-12-25 16:26', gender: '男' }),
    compileBazi({ at: '2008-07-04 15:41', gender: '女' }),
    compileBazi({ at: '2008-04-16 09:26', gender: '女' }),
    compileBazi({ pillars: ['甲寅', '丙午', '庚申', '丁亥'] }),      // 全盘无四库
  ];
  for (const b of charts) {
    const r = zuoGong(b);
    ok(Number.isFinite(r.totalScore) && r.totalScore >= 0, `${b.pillars.join('')} totalScore 必须有限非负，实得 ${r.totalScore}`);
    ok(SET.has(r.magnitude), `${b.pillars.join('')} magnitude 越界：${r.magnitude}`);
    eq(r.verdict, r.totalScore > 0 ? '做功' : '未做功', `${b.pillars.join('')} verdict 与 totalScore 一致`);
    const sum = Math.round(r.kus.reduce((a, x) => a + x.workScore, 0) * 1000) / 1000;
    eq(r.totalScore, sum, `${b.pillars.join('')} totalScore = ΣworkScore`);
    ok(r.kus.every((x) => Number.isFinite(x.workScore) && x.workScore >= 0), `${b.pillars.join('')} workScore 有限非负`);
  }
  // 无库盘：未做功 / 微
  const none = zuoGong(charts[5]);
  eq(none.kus.length, 0, '寅午申亥 无四库');
  eq(none.totalScore, 0, '无库 ⇒ totalScore 0');
  eq(none.verdict, '未做功', 'totalScore 0 ⇒ 未做功');
  eq(none.magnitude, '微', 'totalScore 0 ⇒ 微');
  console.log(`  ${charts.length} 盘全部闭合 ✓`);
}

console.log('[E] ★ 标度纪律：只取 dag.mjs 的 POS_W/CANG，绝不读 L3_distribution');
{
  const src = readFileSync(resolve(HERE, '../src/bazi/zuo-gong.mjs'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   // 注释里的说明不算读取
  ok(!/L3_distribution/.test(code), '★ 代码不得出现 L3_distribution（注释除外）');
  ok(/from '\.\/dag\.mjs'/.test(code), 'POS_W/CANG/CHONG/LIUHE 必须来自 dag.mjs');
  ok(/from '\.\/ten-gods\.mjs'/.test(code), 'KU/kuGong 必须来自 ten-gods.mjs');
  eq(POS_W['月'], 3, 'dag POS_W 月 = 3（标度锚点）');
  eq(POS_W['日'], 2, 'dag POS_W 日 = 2（标度锚点）');
  // 同一支在月/日位置的 workScore 差 = (3−2)×0.25
  const m = zuoGong(compileBazi({ pillars: ['癸巳', '戊辰', '戊戌', '癸亥'] }), '水', '土').kus.find((x) => x.zhi === '辰');
  const d = zuoGong(compileBazi({ pillars: ['癸巳', '戊戌', '戊辰', '癸亥'] }), '水', '土').kus.find((x) => x.zhi === '辰');
  eq(Math.round((m.workScore - d.workScore) * 1000) / 1000, (POS_W['月'] - POS_W['日']) * WORK_W.posW, '位置权重差可机算');
  console.log(`  月/日位差 = ${Math.round((m.workScore - d.workScore) * 1000) / 1000} ✓`);
}

console.log('[F] 合开 + 透干闸（无开口无透干 ⇒ 用神库也不做功）');
{
  // 子丑六合 → 丑「合开」；辛透
  const he = zuoGong(compileBazi({ pillars: ['甲子', '乙丑', '戊辰', '辛酉'] }), '金', '木').kus.find((x) => x.zhi === '丑');
  ok(he, '必须检出丑库');
  eq(he.role, '用神库', '丑=金库、金为用神');
  eq(he.openedBy.includes('合'), true, '子丑六合 ⇒ 含「合」');
  eq(LIUHE['丑'], '子', '六合表自洽');
  eq(he.canWork, true, '合开 + 透干 ⇒ canWork');
  eq(he.workScore, Math.round((1 * 0.5 + 0.4 + 1.0 + POS_W['月'] * 0.25) * 1000) / 1000, '丑 workScore 手算对账');
  // 用神库但既无冲合、也无藏干透干 ⇒ false
  const g = zuoGong(compileBazi({ pillars: ['癸卯', '甲戌', '戊未', '壬子'] }), '木', '土').kus.find((x) => x.zhi === '未');
  ok(g, '必须检出未库');
  eq(g.role, '用神库', '未=木库、木为用神');
  eq(g.openedBy.length, 0, '无丑亦无午 ⇒ 无开口');
  eq(g.touGan.length, 0, '未藏 己丁乙，四干 癸甲戊壬 ⇒ 不透');
  eq(g.canWork, false, '★ 用神库但无开口无透干 ⇒ 不做功');
  console.log(`  丑 合开 canWork=${he.canWork}｜未 无开口无透 canWork=${g.canWork} ✓`);
}

console.log('[G] 缺省 yong/ji 读 L5_yongJi；量级分档边界');
{
  const b = compileBazi({ pillars: ['癸巳', '戊辰', '戊戌', '癸亥'] });
  const a = JSON.stringify(zuoGong(b));
  const c = JSON.stringify(zuoGong(b, b.L5_yongJi.yong, b.L5_yongJi.ji));
  eq(a, c, '缺省参数必须等价于显式传 L5_yongJi.yong/.ji');
  eq(magnitudeOf(0.99), '微'); eq(magnitudeOf(1), '小'); eq(magnitudeOf(2.49), '小');
  eq(magnitudeOf(2.5), '中'); eq(magnitudeOf(4), '中'); eq(magnitudeOf(4.01), '大');
  ok(['微', '小', '中', '大'].includes(magnitudeOf(NaN)), '非法输入也必须落在闭集内');
  console.log('  分档边界 1/2.5/4 全部闭集 ✓');
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
