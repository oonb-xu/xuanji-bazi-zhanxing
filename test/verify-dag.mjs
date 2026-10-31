// 断语 DAG + 非线性供给 回归钉（exit 0 = 全过）
//  A DAG 主判定  B 合化子图  C ★非线性供给必须真正转负  D 大运补气与新关系
import { compileBazi } from '../src/bazi/engine.mjs';
import { structuralVerdict, dayunSupplement, supplyCurve, heHuaVerdict, chongWinner, rootStrength, REL_WEIGHT, strengthTier, monthHelp, rootSum, biJieStrength, tenGodOf, luRoot, diStrength, LU, hiddenStemsFull, anHeDetect, gaiTou, POS_W, tushiEffect, seatEffect, TUSHI } from '../src/bazi/dag.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] DAG 主判定（乙木女 戊子 戊午 乙巳 甲申）');
const F = compileBazi({ at: '2008-07-04 15:41', gender: '女' });
const F2 = compileBazi({ at: '2008-04-16 09:26', gender: '女' });
F.input = { ...(F.input ?? {}), birthDate: '2008-07-04' };
const v = structuralVerdict(F);
eq(v.hasRoot, false, '应判无根（地支子午巳申，藏干亦无甲乙）');
eq(v.biJie.length, 1, '比劫应有 1 个（时干甲）');
eq(v.biJieMode, '虚透(天干有、地支无根)', '比劫应判「虚透」——★ 有透即不从');
ok(/^\[5B\]/.test(v.node), 'DAG 应落在 [5B]，实得 '+v.node);
ok(v.yinEffective === true, '★ 印必须有能量（子水未被子午冲败，且有申子半合生扶）');
ok(v.yinEnergy.energy >= 2, '★ 印能量应 >=2，实得 '+v.yinEnergy.energy);
ok(v.node.includes('木得水生'), '★ 应判「木得水生」，不得判「虚透无援」');
console.log(`  ${v.node}｜无根 ${!v.hasRoot}｜比劫 ${v.biJie.join('')}(${v.biJieMode}) ✓`);

console.log('[B] 合化子图（三条件）');
eq(v.heHua.anyHe, true, '应检出合（巳申六合 / 申子半合）');
eq(v.heHua.monthHelpsYin, false, '★ 月令午火不助水 ⇒ 合而不化');
eq(v.heHua.chongHit, true, '应检出子午冲 ⇒ 合被冲解');
eq(v.heHua.chengJu, false, '★ 成局三条件不全 ⇒ 印未成局');
ok(v.heHua.heRels.length >= 2, `应至少检出 2 组合（实得 ${v.heHua.heRels.length}）`);
// 独立复算：heHuaVerdict 与 structuralVerdict 一致
eq(heHuaVerdict(['子', '午', '巳', '申']).length, v.heHua.rels.length, 'heHuaVerdict 与主判定口径一致');
console.log(`  合 ${v.heHua.heRels.map((r) => r.k + r.pair + (r.hua ? '化' + r.hua : '')).join(' + ')}｜月令助印 ${v.heHua.monthHelpsYin}｜有冲 ${v.heHua.chongHit} ⇒ 成局 ${v.heHua.chengJu} ✓`);

console.log('[C] ★ 非线性供给曲线（过量为负）');
ok(supplyCurve(2, 0.20) > 0, '低占比应为正');
ok(supplyCurve(2, 0.40) > supplyCurve(2, 0.20), '0.40 应高于 0.20（边际仍在上升）');
ok(supplyCurve(2, 0.53) < supplyCurve(2, 0.40), '0.53 已开始递减（过犹不及）');
ok(supplyCurve(2, 0.79) < 0, '★ 0.79 必须转负（水多木漂）——系数 2.5 时做不到，故定 5.0');
ok(supplyCurve(2, 0.85) < supplyCurve(2, 0.79), '过量越多应越负');
eq(supplyCurve(2, 0), 0, '占比 0 无贡献');
console.log(`  0.20→${supplyCurve(2, 0.2).toFixed(2)}｜0.40→${supplyCurve(2, 0.4).toFixed(2)}｜0.53→${supplyCurve(2, 0.53).toFixed(2)}｜0.79→${supplyCurve(2, 0.79).toFixed(2)}｜0.85→${supplyCurve(2, 0.85).toFixed(2)} ✓`);

console.log('[D] 大运补气 + 新关系');
const dy = dayunSupplement(F, '女');
const by = (gz) => dy.find((s) => s.ganzhi === gz);
ok(by('乙卯') !== undefined, '应有乙卯大运');
eq(by('乙卯').rootBen, true, '★ 乙卯为本气通根（木根补上）');
eq(by('甲寅').rootBen, true, '★ 甲寅为本气通根');
ok(by('乙卯').newRels.some((r) => r.k === '刑' && r.with === '子'), '★ 乙卯应刑子（补根同时刑印）');
ok(by('甲寅').newRels.some((r) => r.k === '冲' && r.with === '申'), '★ 甲寅应冲申');
ok(by('甲寅').newRels.some((r) => r.k === '刑' && r.with === '巳'), '甲寅应刑巳');
eq(by('壬子').rootBen, false, '壬子不应通根（水非木）');
console.log(`  乙卯 ${by('乙卯').supplyRoot} + ${by('乙卯').newRels.map((r) => r.k + r.with).join(',')}｜甲寅 ${by('甲寅').supplyRoot} + ${by('甲寅').newRels.map((r) => r.k + (r.with ?? r.hua)).join(',')} ✓`);


console.log('[E] ★ 冲的胜负必须返回**绝对胜方**（相对标签会方向错）');
eq(chongWinner('子', '午'), '子', '子水克午火 ⇒ 子胜');
eq(chongWinner('寅', '申'), '申', '★ 申金克寅木 ⇒ 申胜（旧版误报「被克方胜」）');
eq(chongWinner('申', '寅'), '申', '顺序无关');
eq(chongWinner('巳', '申'), '巳', '巳火克申金 ⇒ 巳胜');
eq(chongWinner('寅', '寅'), '平', '同支为平');
console.log('  子/午→子｜寅/申→申｜巳/申→巳 ✓');

console.log('[F] ★ 通根分级（取代布尔）与关系强度权重');
ok(rootStrength('卯', '木').strength === 1.0, '卯为本气，强度应为 1.0');
ok(rootStrength('辰', '木').strength === 0.5, '辰藏乙为中气，强度应为 0.5');
ok(rootStrength('寅', '水').strength === 0, '寅无藏水');
ok(REL_WEIGHT.冲 > REL_WEIGHT.刑, '冲权重应大于刑');
ok(REL_WEIGHT.半合生地 > REL_WEIGHT.半合墓地, '生地半合应强于墓地半合');
console.log('  卯=1.0｜辰=0.5｜冲'+REL_WEIGHT.冲+' > 刑'+REL_WEIGHT.刑+' ✓');

console.log('[G] ★ 大运净分：乙卯应优于甲寅（补根同为本气，但甲寅被申冲败）');
{
  const dy = dayunSupplement(F, '女');
  const by = (gz) => dy.find((s) => s.ganzhi === gz);
  eq(by('乙卯').rootStrength, 1.0, '乙卯本气 1.0');
  eq(by('甲寅').rootStrength, 1.0, '甲寅本气 1.0');
  ok(by('乙卯').net > 0, '乙卯净分应为正');
  ok(by('甲寅').net < 0, '★ 甲寅净分应为负（寅申冲、申胜 ⇒ 补根被冲败）');
  ok(by('乙卯').net > by('甲寅').net, '★ 乙卯必须优于甲寅——二元判断会掩盖这个差别');
  console.log('  乙卯 net=' + by('乙卯').net + '｜甲寅 net=' + by('甲寅').net + ' ✓');
}

console.log('[H] ★ 二元 → 连续（身强弱 / 月令 / 通根 / 比劫力度）');
{
  eq(strengthTier(0.20).tier, '极弱', 'ratio 0.20 → 极弱');
  eq(strengthTier(0.33).tier, '弱', 'ratio 0.33 → 弱');
  eq(strengthTier(0.50).tier, '中和', 'ratio 0.50 → 中和');
  eq(strengthTier(0.80).tier, '极旺', 'ratio 0.80 → 极旺');
  ok(strengthTier(0.80).continuous > strengthTier(0.33).continuous, '连续值须随 ratio 单调');
  eq(monthHelp('水', '水'), 1.0, '月令同五行 = 当令 1.0');
  eq(monthHelp('金', '水'), 0.6, '月令生我 = 相 0.6');
  eq(monthHelp('土', '水'), -0.3, '月令克我 = 死 -0.3');  // 土克水（首版误写 火克水，实际是水克火）
  eq(tenGodOf('木', '水'), '食伤', '水生木 ⇒ 木为水之食伤');
  eq(tenGodOf('金', '水'), '印', '金生水 ⇒ 金为水之印');
  // 乙木女：通根总量必须为 0；比劫力度必须为 0.2（甲坐申=绝）
  eq(rootSum(['子', '午', '巳', '申'], '木').total, 0, '★ 乙木女通根总量 = 0');
  const bj = biJieStrength(F);
  eq(bj.length, 1, '应有 1 个比劫');
  eq(bj[0].force, 0.2, '★ 甲坐申(金克木) → 力度 0.2，而非 1.0');
  // 男：壬坐子应满力
  const Mz = compileBazi({ at: '2007-12-25 16:26', gender: '男' });
  eq(biJieStrength(Mz)[0].force, 1.0, '壬坐子(同类) → 力度 1.0');
  console.log(`  极弱/弱/中和/极旺 ✓｜月令 1.0/0.6/-0.3 ✓｜乙木女通根0、甲坐申0.2 ✓｜壬坐子1.0 ✓`);
}

console.log('[I] ★ 禄根与冲克损伤（接入身强弱）');
{
  eq(LU['乙'], '卯', '乙禄在卯'); eq(LU['丙'], '巳', '丙禄在巳'); eq(LU['癸'], '子', '癸禄在子');
  // 乙木女：禄卯，地支无卯 ⇒ 无禄根
  const luF = luRoot(F);
  eq(luF.has, false, '★ 乙木女无禄根（地支子午巳申无卯）');
  // 男：禄子，在月，无冲刑 ⇒ 完整
  const Mz = compileBazi({ at: '2007-12-25 16:26', gender: '男' });
  const luM = luRoot(Mz);
  eq(luM.has, true, '男应有禄根');
  eq(luM.luZhi, '子', '癸禄在子');
  eq(luM.damage, 0, '无冲刑合 ⇒ 损伤 0');
  eq(luM.effective, 1.0, '禄根完整应为 1.0');
  // ★ 禄根被冲：造一个 癸日见子且见午冲的盘（子午冲，子胜 ⇒ 小损 0.3）
  const fake = { pillars: ['壬午', '壬子', '癸巳', '甲寅'] };
  const luC = luRoot(fake);
  ok(luC.has, '该盘有禄（子）');
  ok(luC.damage > 0, '★ 子午冲 ⇒ 禄根应有损伤，实得 ' + luC.damage);
  ok(luC.effective < 1.0, '★ 禄根效力应下降，实得 ' + luC.effective);
  // 得地强度
  ok(diStrength(F).di === 0, '乙木女得地 0');
  ok(diStrength(Mz).di > 0, '男得地 > 0');
  console.log(`  乙禄卯无根｜癸禄子完整1.0｜子午冲时 damage=${luC.damage} eff=${luC.effective} ✓`);
}

console.log('[J] ★ 藏干全算 / 暗合 / 盖头截脚 / 位置加权');
{
  eq(POS_W['月'], 3.0, '月令权重最高 3.0');
  ok(POS_W['日'] > POS_W['时'] && POS_W['时'] > POS_W['年'], '★ 日支（坐下）权重须高于时/年');
  eq(POS_W['日'], 2.0, '日支权重 2.0');
  const hs = hiddenStemsFull(F);
  eq(hs.byWx['木'] ?? 0, 0, '★ 乙木女藏干加权后 木 = 0（第四重确认无根）');
  eq(hs.stems.length, 9, '乙木女藏干总数 9（子1 + 午2 + 巳3 + 申3）');
  // 日支（坐下）藏干必须被识别
  const riZhi = hs.stems.filter((x) => x.pos === '日');
  ok(riZhi.length >= 2, '日支巳应有多个藏干');
  ok(riZhi.some((x) => x.gan === '丙'), '巳本气为丙');
  // 暗合
  ok(anHeDetect(F).length > 0, '乙木女应有暗合（子巳）');
  eq(anHeDetect(F)[0].pair, '子巳', '暗合应为子巳');
  // 盖头 / 截脚
  eq(gaiTou('甲戌').type, '盖头', '甲戌：木克土 ⇒ 盖头');
  eq(gaiTou('甲申').type, '截脚', '甲申：金克木 ⇒ 截脚');
  eq(gaiTou('丙子').type, '截脚', '丙子：水克火 ⇒ 截脚');
  eq(gaiTou('乙卯').type, '同气', '乙卯同气');
  ok(gaiTou('甲戌').ratio < 1 && gaiTou('乙卯').ratio === 1, '盖头/截脚须降力，同气不降');
  console.log(`  月3.0>日2.0>时1.5>年1.0 ✓｜藏在木=0 ✓｜暗合子巳 ✓｜甲戌盖头/甲申截脚 ✓`);
}

console.log('[K] ★ 燥湿土（辰丑湿 / 未戌燥）与坐下效应');
{
  eq(TUSHI['辰'], '湿', '辰为湿土'); eq(TUSHI['丑'], '湿', '丑为湿土');
  eq(TUSHI['戌'], '燥', '★ 戌为燥土（非湿土）'); eq(TUSHI['未'], '燥', '未为燥土');
  // 火日主：燥土助火、湿土晦火 —— 方向必须相反
  eq(tushiEffect('戌', '火').effect, '助身', '火日主坐燥土戌 ⇒ 助身');
  ok(tushiEffect('戌', '火').mult > 1, '燥土对火应 ×>1');
  eq(tushiEffect('辰', '火').effect, '泻身', '火日主坐湿土辰 ⇒ 泻身');
  ok(tushiEffect('辰', '火').mult < 1, '湿土对火应 ×<1');
  // 丙火女：坐下是戌（燥），不是辰（湿）
  eq(seatEffect(F2).zhi, '戌', '★ 丙火女坐下为戌');
  eq(seatEffect(F2).nature, '燥', '★ 坐下属燥土');
  eq(seatEffect(F2).effect, '助身', '★ 燥土火库 ⇒ 助身（x1.15）');
  ok(seatEffect(F2).weighted > 2.0, '位置加权后应 >2.0（位置权重 2.0 × 1.15）');
  console.log(`  辰/丑=湿、戌/未=燥 ✓｜戌助火1.15、辰晦火0.80 ✓｜丙火女坐戌(燥)助身 x1.15 → 加权2.3 ✓`);
}

console.log('[L] ★ 现代占星容许度标准 + orb 加权 + 大偏移提醒');
{
  const { MODERN_ORB, orbFor, orbWeight, aspectTopology } = await import('../src/cross/topology.mjs');
  const { computeNatal } = await import('../src/western/natal.mjs');
  eq(MODERN_ORB['太阳'], 10, '太阳容许度 10°'); eq(MODERN_ORB['月亮'], 10, '月亮 10°');
  eq(MODERN_ORB['水星'], 8, '内行星 8°'); eq(MODERN_ORB['木星'], 7, '外行星 7°');
  eq(orbFor('凯龙'), 6, '凯龙 6°');
  ok(orbWeight(0.5, 8).w > orbWeight(4, 8).w, '精确相位权重须大于宽容许度');
  ok(orbWeight(4, 8).w > orbWeight(7.5, 8).w, '权重须随 orb 单调递减');
  eq(orbWeight(0, 8).w, 1, 'orb=0 权重 1');
  ok(orbWeight(6, 8).largeOrb, '★ orb/max>0.6 须标 largeOrb（仍在相位内但偏离大）');
  ok(!orbWeight(2, 8).largeOrb, 'orb=2 不应标大偏移');
  // 真实盘：边必须带权重与大偏移标记
  const ch = computeNatal({ at: '2008-07-04 16:45', lng: 105.05, lat: 29.58, tz: 8 });
  const t2 = aspectTopology(ch);
  ok(t2.edges.length > 0, '应有边');
  ok(t2.edges.every((e) => typeof e.weight === 'number' && e.weight <= 1), '每条边须有 weight ≤1');
  ok(t2.edges.some((e) => e.largeOrb === true), '★ 必须存在被标记的大偏移边');
  ok(t2.edges.some((e) => e.largeOrb === false), '也应有正常容许度的边');
  ok(t2.edges.every((e) => typeof e.orbLimit === 'number'), '每条边须记录所用容许度上限');
  console.log(`  太阳月亮10/内8/外7/凯龙6 ✓｜权重单调递减 ✓｜大偏移阈值0.6 ✓｜真实盘 ${t2.edges.length} 边、大偏移 ${t2.edges.filter(e=>e.largeOrb).length} 条 ✓`);
}

console.log('[M] ★ 得生（无根 ≠ 无援）');
{
  const { profileOf } = await import('../src/bazi/complementarity.mjs');
  const pF = profileOf(F), pF2 = profileOf(F2), pM = profileOf(compileBazi({ at: '2007-12-25 16:26', gender: '男' }));
  // 无根者仍有得生，且必须 >0（子水存活 ⇒ 乙木受生）
  ok(pF.deSheng > 0, '★ 乙木女无根但得生必须 >0，实得 ' + pF.deSheng);
  eq(pF.deShengDetail.rootFactor, 0.5, '★ 无根时受生须打半折（能续不能立）');
  ok(pF.deShengDetail.energy >= 2, '印能量应 ≥2，实得 ' + pF.deShengDetail.energy);
  // 有根者受生不打折
  eq(pF2.deShengDetail.rootFactor, 1.0, '有根（丙火女）受生不打折');
  eq(pM.deShengDetail.rootFactor, 1.0, '有根（男）受生不打折');
  // 上限 2.0
  ok(pF.deSheng <= 2.0 && pM.deSheng <= 2.0, '得生不得超过上限 2.0');
  // vigor 必须体现得生：乙木女 vigor 应高于"仅得令/地/势三项平均"
  const threeOnly = (pF.deLing + pF.deDi + pF.deShi) / 3;
  ok(pF.vigor > Math.max(0.2, threeOnly), `★ 加入得生后 vigor(${pF.vigor}) 应高于三项平均(${threeOnly.toFixed(3)})`);
  ok(pF.vigor < pM.vigor, '乙木女 vigor 仍应低于男（得生不能喧宾夺主）');
  console.log(`  乙木女 得生${pF.deSheng}(水${pF.deShengDetail.energy}×0.5) → vigor ${pF.vigor}｜男 得生${pM.deSheng}×1.0 → ${pM.vigor} ✓`);
}
console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
