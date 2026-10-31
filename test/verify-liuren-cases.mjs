// 六壬课例对拍回归钉（exit 0 = 全过）
// 钉住 4 条从《大六壬断案》原文**自证**的规则 —— 它们最怕被后续改动静默破坏：
//   · 贼克（主流程基线）      · 伏吟（刚日干上神/柔日支上神 + 刑链）
//   · 伏吟自刑变例（自刑→支上神；再自刑→冲）   · 返吟（无克取驿马，中支上神、末干上神）
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFromGanZhi } from '../src/daliuren.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, '..', 'data', 'liuren', 'cases.jsonl');

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);
const sc = (dayGz, yueJiang, zhanShi) => {
  const r = compileFromGanZhi({ dayGz, yueJiang, zhanShi });
  return { zhi: [r.sanChuan.chu, r.sanChuan.zhong, r.sanChuan.mo].join(''), method: r.sanChuan.method, special: r.sanChuan.specialKeti };
};

console.log('[A] 主流程基线（贼克）——不得退化');
// 《大六壬断案》原文：官 丙子 蛇 / 官 乙亥 贵 / 子 甲戌 后
eq(sc('丁丑', '午', '未').zhi, '子亥戌', '丁丑日午将未时');
ok(sc('丁丑', '午', '未').method.startsWith('贼克'), '应判贼克');
// 原文：父 庚戌 合 ⊙ / 官 乙巳 常 / 子 壬子 蛇
eq(sc('庚戌', '亥', '辰').zhi, '戌巳子', '庚戌日亥将辰时');
console.log('  丁丑日午将未时→子亥戌｜庚戌日亥将辰时→戌巳子 ✓');

console.log('[B] 伏吟课（月将=占时）：刚日干上神 / 柔日支上神 + 刑链');
// 原文（丁巳日未将未时）：兄丁巳 / 财庚申 / 父甲寅 —— 柔日取支上神巳，巳刑申、申刑寅
const f1 = sc('丁巳', '未', '未');
eq(f1.zhi, '巳申寅', '丁巳日未将未时（柔日伏吟，刑链）');
eq(f1.special, '伏吟', '应判伏吟');
ok(/柔日取支上神/.test(f1.method), `方法应写明柔日取支上神，实得 ${f1.method}`);
// 原文（壬午日子将子时）：兄乙亥 / 财壬午 / 兄丙子 —— 刚日取干上神亥；亥自刑→中取支上神午；午自刑→末取冲子
const f2 = sc('壬午', '子', '子');
eq(f2.zhi, '亥午子', '壬午日子将子时（刚日伏吟 + 自刑变例）');
ok(/刚日取干上神/.test(f2.method) && /自刑/.test(f2.method), `方法应写明刚日+自刑变例，实得 ${f2.method}`);
console.log(`  丁巳→${f1.zhi}（柔日·刑链）｜壬午→${f2.zhi}（刚日·自刑变例）✓`);

console.log('[C] 返吟课（月将与占时相冲）：无克取驿马，中支上神、末干上神');
// 原文（丁未日午将子时）：兄乙巳 / 子癸丑 / 子癸丑 —— 未属亥卯未、驿马在巳；支上神丑、干上神丑
const f3 = sc('丁未', '午', '子');
eq(f3.zhi, '巳丑丑', '丁未日午将子时（返吟取驿马）');
eq(f3.special, '返吟', '应判返吟');
ok(/驿马/.test(f3.method), `方法应写明取驿马，实得 ${f3.method}`);
console.log(`  丁未日午将子时→${f3.zhi}（驿马 + 支上神 + 干上神）✓`);

console.log('[D] 全语料对拍率（不得低于 95%）');
if (!existsSync(CASES)) console.log('  SKIP：缺 cases.jsonl');
else {
  const all = readFileSync(CASES, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((c) => c.sanChuanZhi);
  let hit = 0;
  for (const c of all) {
    const r = compileFromGanZhi({ dayGz: c.dayGz, yueJiang: c.yueJiang, zhanShi: c.zhanShi });
    if ([r.sanChuan.chu, r.sanChuan.zhong, r.sanChuan.mo].join('') === c.sanChuanZhi.join('')) hit++;
  }
  const rate = hit / all.length;
  ok(rate >= 0.95, `对拍率 ${(rate * 100).toFixed(1)}% 应 ≥95%（${hit}/${all.length}）`);
  ok(all.length >= 41, `语料规模应 ≥41，实得 ${all.length}`);
  console.log(`  ${hit}/${all.length} = ${(rate * 100).toFixed(1)}%（阈值 95%）✓`);
}

console.log('[E] 结构自检');
const r = compileFromGanZhi({ dayGz: '甲子', yueJiang: '卯', zhanShi: '寅' });
eq(Object.keys(r).length >= 9, true, '返回结构完整');
ok(r.sanChuan.chain.length === 3 && r.tianPan && r.siKe, '三传链/天地盘/四课齐备');
ok(r.sanChuan.chain.every((x) => x.pos && x.zhi && x.wuxing), '三传每层含 位/支/五行');
let threw = false;
try { compileFromGanZhi({ dayGz: 'X子', yueJiang: '卯', zhanShi: '寅' }); } catch { threw = true; }
ok(threw, '非法天干应抛错');

console.log('[F] 年号锚点与年份校准（R-A1~A4）');
{
  const { verifyAnchors, scanAnchors, buildAnchorTable } = await import('../cli-anchors.mjs');
  const { readdirSync } = await import('node:fs');
  const dir = join(HERE, '..', 'data', 'liuren');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [f, readFileSync(join(dir, f), 'utf8')]);
  const scanned = scanAnchors(files);
  ok(scanned.length >= 5, `实扫锚点应 ≥5，实得 ${scanned.length}`);
  const ver = verifyAnchors(scanned);
  const okN = ver.filter((v) => v.ok).length;
  eq(okN, ver.length, `全部锚点须自洽（年号纪年→公历→干支）`);
  // ★ 关键回归钉：日干支不得被误当年干支（「宣和三年十二月二十七日丁巳」里的丁巳是日柱）
  ok(!scanned.some((a) => a.era === '宣和' && a.ganzhi === '丁巳'), '日干支 丁巳 不得被当成宣和三年之年干支');
  const table = buildAnchorTable(ver);
  eq(table['己酉']?.year, 1129, '建炎三年己酉 → 1129');
  eq(table['丙午']?.year, 1126, '靖康元年丙午 → 1126');
  eq(table['乙丑']?.year, 1145, '绍兴十五年乙丑 → 1145');
  eq(table['戊申']?.year, 1128, '戊申（推断）→ 1128');
  eq(table['戊申']?.type, 'inferred', '戊申 须标为推断而非直接锚点');
  eq(table['己酉']?.type, 'direct', '己酉 须标为直接锚点');
  console.log(`  实扫 ${scanned.length} 锚点全自洽｜己酉=1129 丙午=1126 乙丑=1145｜戊申=1128（推断）✓`);
}

console.log('[G] cases.jsonl 回写字段完整性');
{
  const cs = readFileSync(CASES, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const lv = {}; for (const c of cs) lv[c.evidenceLevel] = (lv[c.evidenceLevel] ?? 0) + 1;
  ok(cs.every((c) => 'candidateYears' in c && 'anchor' in c && 'calibratedYear' in c && 'yearConfidence' in c && 'evidenceLevel' in c),
    '每条须含 candidateYears/anchor/calibratedYear/yearConfidence/evidenceLevel');
  eq((lv.A ?? 0) + (lv.B ?? 0) + (lv.C ?? 0), cs.length, '证据等级须覆盖全部课例');
  eq(lv.C ?? 0, 0, '不应有 C 级（无候选且无锚点）');
  ok(cs.filter((c) => c.evidenceLevel === 'A').every((c) => c.sanChuanMatch === true && c.yearConfidence === 'anchored'),
    'A 级必须同时满足三传对拍一致 + 直接锚点定年');
  ok((lv.A ?? 0) >= 15, `A 级应 ≥15，实得 ${lv.A}`);
  console.log(`  A ${lv.A}｜B ${lv.B}｜C ${lv.C ?? 0}｜字段齐备、A 级判据正确 ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
