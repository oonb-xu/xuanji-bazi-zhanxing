// 十神与「制」关系 回归钉 v2（吸收盲派核心）
import { compileBazi } from '../src/bazi/engine.mjs';
import { F } from './_fixtures.mjs';
import { tenGod, TG_GROUP, controlAnalysis, kuGong, hanNuan, KU, CONTROL_RULES } from '../src/bazi/ten-gods.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 十神必须区分阴阳');
{
  eq(tenGod('甲', '癸'), '伤官', '甲 vs 癸：我生+异 → 伤官');
  eq(tenGod('乙', '癸'), '食神', '乙 vs 癸：我生+同 → 食神');
  eq(tenGod('庚', '癸'), '正印', '庚 vs 癸：生我+异 → 正印');
  eq(tenGod('辛', '癸'), '偏印', '辛 vs 癸：生我+同 → 偏印');
  eq(tenGod('丙', '癸'), '正财', '丙：我克+异 → 正财');
  eq(tenGod('丁', '癸'), '偏财', '丁：我克+同 → 偏财');
  eq(tenGod('戊', '癸'), '正官', '戊：克我+异 → 正官');
  eq(tenGod('己', '癸'), '七杀', '己：克我+同 → 七杀');
  eq(tenGod('壬', '癸'), '劫财', '壬：同类+异 → 劫财');
  eq(tenGod('癸', '癸'), '比肩', '癸：同类+同 → 比肩');
  console.log('  十神阴阳全对 ✓');
}

console.log('[B] ★ 规则必须标 level，且十神级规则不得用分组名查询（静默 bug 回归钉）');
{
  ok(CONTROL_RULES.every((r) => r.level === 'tenGod' || r.level === 'group'), '每条规则必须有 level');
  // 十神级规则的两端必须都是十神名，不得混入分组名
  const GROUPS = new Set(['比劫', '印', '食伤', '财', '官杀']);
  for (const r of CONTROL_RULES.filter((x) => x.level === 'tenGod')) {
    ok(!GROUPS.has(r.by), `十神级规则 ${r.name} 的 by(${r.by}) 不得是分组名`);
    ok(!GROUPS.has(r.on), `十神级规则 ${r.name} 的 on(${r.on}) 不得是分组名`);
  }
  // 分组级规则的两端必须都是分组名
  for (const r of CONTROL_RULES.filter((x) => x.level === 'group')) {
    ok(GROUPS.has(r.by) && GROUPS.has(r.on), `分组级规则 ${r.name} 两端必须是分组名`);
  }
  console.log('  ' + CONTROL_RULES.filter((r) => r.level === 'tenGod').length + ' 条十神级 / ' + CONTROL_RULES.filter((r) => r.level === 'group').length + ' 条分组级，命名层级自洽 ✓');
}

console.log('[C] ★ 食神制杀必须能触发（合成盘：癸日 + 乙食神 + 己七杀）');
{
  // 癸日主(阴水)：乙=食神(阴木,同)；己=七杀(阴土,同)
  const fake = { pillars: ['己巳', '乙卯', '癸亥', '癸丑'] };
  const ca = controlAnalysis(fake);
  const zhiSha = ca.controls.find((x) => x.name === '食神制杀');
  ok(zhiSha, '★ 合成盘必须检出「食神制杀」（首版因查询源错而永不触发）');
  ok(zhiSha.byW > 0 && zhiSha.onW > 0, '制方与被制方力度都必须 >0');
  eq(zhiSha.level, 'tenGod', '食神制杀属十神级');
  console.log(`  食神制杀 by=${zhiSha.byW} on=${zhiSha.onW} → ${zhiSha.verdict} ✓`);
}

console.log('[D] 三人制关系实测（对齐杨炎论断类型）');
{
  const M = compileBazi({ at: F.T6, gender: '男' });
  const F = compileBazi({ at: F.T1, gender: '女' });
  const F2 = compileBazi({ at: F.T3, gender: '女' });
  const caM = controlAnalysis(M), caF = controlAnalysis(F), caF2 = controlAnalysis(F2);
  // 男：比劫极旺 ⇒ 夺财制得住（对应杨炎「财星被比劫控制，给人打工」）
  const dM = caM.controls.find((x) => x.name === '比劫夺财');
  eq(dM.verdict, '制得住', '★ 男比劫极旺 ⇒ 夺财制得住');
  // 案例丙：财重破印（对应「财破印」）
  const dF = caF.controls.find((x) => x.name === '财破印');
  eq(dF.verdict, '制得住', '★ 案例丙财 6.375 ≫ 印 1.75 ⇒ 财破印制得住');
  // 案例乙：食伤最重 ⇒ 食伤制官杀制得住（对应「食神制杀」类）
  const dF2 = caF2.controls.find((x) => x.name === '食伤制官杀（聚合）');
  eq(dF2.verdict, '制得住', '★ 案例乙食伤 6.375 ⇒ 制得住');
  console.log(`  男 比劫夺财 ${dM.ratio} ✓｜案例丙 财破印 ${dF.ratio} ✓｜案例乙 食伤制官杀 ${dF2.ratio} ✓`);
}

console.log('[E] ★ 库必须区分「比劫库（根）」——案例乙坐戌(火库)应为根，不是闲库');
{
  eq(KU['辰'], '水'); eq(KU['戌'], '火'); eq(KU['丑'], '金'); eq(KU['未'], '木');
  const F2 = compileBazi({ at: F.T3, gender: '女' });
  const ku = kuGong(F2, '木', '土');
  const xu = ku.find((x) => x.zhi === '戌');
  ok(xu, '案例乙应有戌库');
  eq(xu.role, '比劫库(根/帮身)', '★ 丙火坐戌(火库) ⇒ 比劫库/根，首版误判为闲库');
  eq(xu.self, true, 'self 标记应为 true');
  console.log(`  案例乙 戌 → ${xu.role} ✓（与「燥土助火 ×1.15」一致）`);
}

console.log('[F] 寒暖调候');
{
  const hnM = hanNuan(compileBazi({ at: F.T6, gender: '男' }));
  ok(/寒/.test(hnM.nature), '男子月生判寒，实得 ' + hnM.nature);
  eq(hnM.hasFire, true, '男有丁火/巳火 ⇒ 有火调候');
  const hnF = hanNuan(compileBazi({ at: F.T1, gender: '女' }));
  ok(/燥|暖/.test(hnF.nature), '案例丙午月生判燥/暖，实得 ' + hnF.nature);
  eq(hnF.hasWater, true, '案例丙有子水 ⇒ 有水润泽');
  const hnF2 = hanNuan(compileBazi({ at: F.T3, gender: '女' }));
  console.log(`  男 ${hnM.nature}(${hnM.total})｜案例丙 ${hnF.nature}(${hnF.total})｜案例乙 ${hnF2.nature}(${hnF2.total}) ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
