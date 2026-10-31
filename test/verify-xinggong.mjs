// 星宫分层（星=十神 / 宫=宫位）回归钉 —— 缺口 #1
// 载入即验证五条机检：import 成功、分层表结构、夫妻宫被冲正例、反例、npm test 可跑
import { compileBazi } from '../src/bazi/engine.mjs';
import { starPalace, xingGongWar, PALACE } from '../src/bazi/xing-gong.mjs';
import { CANG, GAN_WX, KE, POS_W } from '../src/bazi/dag.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

const P = ['甲子', '丙午', '戊子', '庚申'];       // 日支子，月支午 ⇒ 子午冲（确定性）
const PN = ['甲寅', '丙午', '戊戌', '庚申'];      // 日支戌，无辰 ⇒ 不被冲（反例）

console.log('[A] 宫位常量');
{
  eq(PALACE['年'], '祖上/父母宫', 'PALACE.年');
  eq(PALACE['月'], '父母/兄弟宫', 'PALACE.月');
  eq(PALACE['日'], '夫妻宫', 'PALACE.日');
  eq(PALACE['时'], '子女宫', 'PALACE.时');
  console.log('  四宫位常量 ✓');
}

console.log('[B] ★ starPalace 分层表：4 项，index2 必为夫妻宫/日支');
{
  const sp = starPalace(compileBazi({ pillars: P }));
  eq(sp.length, 4, '必须返回 4 项');
  eq(sp[2].palace, '夫妻宫', 'index2 palace');
  eq(sp[2].zhi, '子', 'index2 zhi');
  eq(sp[2].pos, '日', 'index2 pos');
  // 每项字段必须齐（pos/palace/zhi/mainGan/star/group/posW）
  for (const r of sp) {
    ok(typeof r.pos === 'string' && typeof r.palace === 'string', `${r.pos} pos/palace 必须为字符串`);
    ok(typeof r.zhi === 'string' && r.zhi.length === 1, `${r.pos} zhi 必须是单字地支`);
    eq(r.mainGan, CANG[r.zhi][0], `${r.pos}${r.zhi} mainGan 必须等于本气藏干`);
    ok(typeof r.star === 'string' && typeof r.group === 'string', `${r.pos} star/group 必须非空`);
    eq(r.posW, POS_W[r.pos], `${r.pos} posW 必须取 POS_W`);
  }
  // 本气藏干 + 日干(戊) 的十神（与 ten-gods 口径一致）
  eq(sp[0].mainGan, '癸', '年支子本气癸');
  eq(sp[0].star, '正财', '癸 vs 戊：我克+异 → 正财');
  eq(sp[0].group, '财', '正财 → 分组财');
  eq(sp[1].mainGan, '丁', '月支午本气丁');
  eq(sp[1].star, '正印', '丁 vs 戊：生我+异 → 正印');
  eq(sp[1].group, '印', '正印 → 分组印');
  eq(sp[3].star, '食神', '庚 vs 戊：我生+同 → 食神');
  eq(sp[3].group, '食伤', '食神 → 分组食伤');
  console.log(`  ${sp.map((r) => `${r.pos}${r.zhi}/${r.mainGan}/${r.star}(${r.group})@${r.posW}`).join(' ')} ✓`);
}

console.log('[C] ★ 夫妻宫被冲正例（子午冲）⇒ war=true 且 reasons 含「夫妻宫被冲」');
{
  const w = xingGongWar(compileBazi({ pillars: P }));
  eq(w.war, true, '子午冲必须判 war=true');
  ok(w.reasons.includes('夫妻宫被冲'), `reasons 必须含「夫妻宫被冲」，实得 ${JSON.stringify(w.reasons)}`);
  eq(w.verdict, '星宫交战', 'verdict');
  eq(w.palace.length, 4, '返回必须带 palace 分层表 4 项');
  eq(w.palace[2].palace, '夫妻宫', 'palace[2] 必须是夫妻宫');
  eq(w.gender, '男', 'gender 缺省男');
  eq(w.genderAssumed, true, '干支输入未给 gender ⇒ genderAssumed=true');
  console.log(`  ${w.verdict} ${JSON.stringify(w.reasons)} ✓`);
}

console.log('[D] ★ 反例：日支戌无辰 ⇒ reasons 不含「夫妻宫被冲」');
{
  const w = xingGongWar(compileBazi({ pillars: PN }));
  ok(!w.reasons.includes('夫妻宫被冲'), `反例不得出现「夫妻宫被冲」，实得 ${JSON.stringify(w.reasons)}`);
  eq(w.war, w.reasons.length > 0, 'war 必须与 reasons 是否非空一致');
  eq(w.verdict, w.war ? '星宫交战' : '星宫安和', 'verdict 必须与 war 一致');
  console.log(`  反例 ${w.verdict} ${JSON.stringify(w.reasons)} ✓`);
}

console.log('[E] ② 夫妻宫坐忌：与引擎 L5_yongJi.ji 自洽（三人实盘 + 忌神注入）');
{
  const charts = [
    compileBazi({ at: '2007-12-25 16:26', gender: '男' }),
    compileBazi({ at: '2008-07-04 15:41', gender: '女' }),
    compileBazi({ at: '2008-04-16 09:26', gender: '女' }),
  ];
  for (const b of charts) {
    const ji = b.L5_yongJi.ji;
    const dayZhi = b.pillars[2][1];
    const dayWx = GAN_WX[CANG[dayZhi][0]];
    const w = xingGongWar(b);
    eq(w.reasons.includes('夫妻宫坐忌'), dayWx === ji, `${b.pillars.join('')} 日支${dayZhi}本气${dayWx} vs 忌神${ji} ⇒ 坐忌判定`);
  }
  // 忌神注入：把那盘忌神改成日支本气五行，② 必须亮
  const fake = { ...compileBazi({ pillars: P }), L5_yongJi: { ji: '水' } };
  ok(xingGongWar(fake).reasons.includes('夫妻宫坐忌'), '日支子(水)==忌神水 ⇒ 必须报夫妻宫坐忌');
  const fake2 = { ...compileBazi({ pillars: P }), L5_yongJi: { ji: '金' } };
  ok(!xingGongWar(fake2).reasons.includes('夫妻宫坐忌'), '日支子(水)!=忌神金 ⇒ 不得报夫妻宫坐忌');
  console.log('  三名实盘 + 忌神注入自洽 ✓');
}

console.log('[F] ③④ 配偶星：男财/女官杀，引动与星宫相克');
{
  const wM = xingGongWar(compileBazi({ pillars: P }));
  eq(wM.spouseStar.group, '财', '男命配偶星 = 财');
  eq(wM.spouseStar.wx, KE['土'], '戊土之财 = 水');
  ok(wM.reasons.includes('配偶星被引动交战'), '年支子(正财)被子午冲命中 ⇒ 配偶星被引动');
  // ④ 星宫相克：戊午日（宫火）＋配偶星水 ⇒ 水克火
  const P4 = ['甲子', '丙午', '戊午', '庚申'];
  const w4 = xingGongWar(compileBazi({ pillars: P4 }));
  eq(w4.palace[2].mainGan, '丁', '戊午日 夫妻宫本气丁');
  const expectKe = KE['水'] === GAN_WX['丁'] || KE[GAN_WX['丁']] === '水';
  eq(expectKe, true, '水/火 相克应成立');
  ok(w4.reasons.includes('星宫相克'), `配偶星水 vs 宫本气火 ⇒ 必须报星宫相克，实得 ${JSON.stringify(w4.reasons)}`);
  // 女命取官杀
  const F = compileBazi({ at: '2008-04-16 09:26', gender: '女' });
  const wF = xingGongWar(F);
  eq(wF.spouseStar.group, '官杀', '女命配偶星 = 官杀');
  eq(wF.gender, '女', 'date 输入应取 meta.gender');
  eq(wF.genderAssumed, false, 'date 输入有 gender ⇒ genderAssumed=false');
  const wOverride = xingGongWar(compileBazi({ pillars: P }), { gender: '女' });
  eq(wOverride.spouseStar.group, '官杀', '显式 gender=女 ⇒ 配偶星取官杀');
  eq(wOverride.genderAssumed, false, '显式 gender ⇒ genderAssumed=false');
  console.log(`  ${wM.spouseStar.group}/${wM.spouseStar.wx}｜${wF.spouseStar.group}/${wF.spouseStar.wx} ✓`);
}

console.log('[G] ★ 标度纪律：星宫不得读 L3_distribution（只允许 CANG/tenGod 自身标度）');
{
  const b = compileBazi({ pillars: P });
  const a = xingGongWar(b);
  const b2 = { ...b, L3_distribution: { raw: {}, adjusted: {} } };   // 抽掉引擎分布
  const c = xingGongWar(b2);
  eq(JSON.stringify(c.reasons), JSON.stringify(a.reasons), 'L3_distribution 置空后星宫判定必须不变');
  eq(JSON.stringify(c.palace), JSON.stringify(a.palace), 'L3_distribution 置空后分层表必须不变');
  console.log('  与 L3_distribution 解耦 ✓');
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
