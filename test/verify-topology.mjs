// 方案1 结构量对齐引擎自检（exit 0 = 全过）
//  A 统一语言（五行节点 + 生/克/比和 边）  B 六壬三传有向图  C 星盘硬相位有向图
//  D 相位→关系映射（以实测字符串为准）  E 签名/形状  F 几何陷阱回归钉（R-C4）
import { existsSync, readFileSync } from 'node:fs';
import { F } from './_fixtures.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHENG, KE, WX, GAN_WX, wuxingOfGan, relationOf, canonicRelation, wuxingOfLon,
  sanChuanTopology, aspectTopology, classifyChain, topologySignature, topologyShape,
  ASPECT_TYPE_REL, impliedOfType, aspectImpliedRelation,
} from '../src/cross/topology.mjs';
import { compileFromGanZhi } from '../src/daliuren.mjs';
import { computeNatal } from '../src/western/natal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, '..', 'data', 'liuren', 'cases.jsonl');

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

console.log('[A] 统一语言：五行生克');
eq(SHENG['木'], '火', '木生火');
eq(SHENG['水'], '木', '水生木');
eq(KE['金'], '木', '金克木');
eq(KE['水'], '火', '水克火');
eq(WX.length, 5, '五行 5 个');
{
  // 生克自洽：相生链走满 5 步回到自身；相克链亦然
  let s = '木'; for (let i = 0; i < 5; i++) s = SHENG[s];
  eq(s, '木', '相生链 5 步回环');
  let k = '木'; for (let i = 0; i < 5; i++) k = KE[k];
  eq(k, '木', '相克链 5 步回环');
  // 归一方向
  eq(canonicRelation('金', '木').rel, '克', '金→木 = 克');
  eq(canonicRelation('木', '金').rel, '克', '木→金 归一为 克（主动方为金）');
  eq(canonicRelation('木', '金').from, '金', '归一后主动方必须是金');
  eq(canonicRelation('木', '木').rel, '比和', '同气 = 比和');
  eq(relationOf('金', '木'), '克', 'relationOf 金木 = 克');
  eq(relationOf('木', '金'), '被克', 'relationOf 木金 = 被克');
  console.log('  生克双回环｜方向归一正确 ✓');
}
console.log('[A2] 天干五行（自带表，避免与 GAN_WU_XING / WU_XING 混淆）');
eq(Object.keys(GAN_WX).length, 10, '天干 10 个');
eq(wuxingOfGan('丁'), '火', '丁 = 火');
eq(wuxingOfGan('壬'), '水', '壬 = 水');
eq(wuxingOfGan('X'), null, '非法天干 → null');

console.log('[B] 六壬三传有向图');
{
  // 实测锚点：丁丑日午将未时 → 子亥戌（官丙子/官乙亥/子甲戌）
  const r = compileFromGanZhi({ dayGz: '丁丑', yueJiang: '午', zhanShi: '未' });
  const t = sanChuanTopology(r.sanChuan, wuxingOfGan(r.riGan));
  ok(t !== null, '应能构图');
  eq(t.chain.length, 4, '链 = 我→初→中→末 共 4 节');
  eq(t.chain[0], '火', '日干丁 = 火');
  eq(t.edges.length, 4, '边数 = 3 顺 + 1 回环');
  eq(t.edges[3].step, '末→我', '第 4 条必须是回环边');
  ok(t.edges.every((e) => ['生', '克', '比和'].includes(e.rel)), '边关系须在统一词汇内');
  ok(typeof t.label === 'string' && t.label.length > 0, '须给出拓扑型标签');
  // 伏吟例子：丁巳日未将未时 → 巳申寅
  const r2 = compileFromGanZhi({ dayGz: '丁巳', yueJiang: '未', zhanShi: '未' });
  const t2 = sanChuanTopology(r2.sanChuan, wuxingOfGan(r2.riGan));
  eq(t2.chain.join(''), '火火金木', '丁巳日未将未时 链 = 火火金木');
  // 非法输入
  ok(sanChuanTopology({ chain: [] }, '火') === null, '链不足 3 传应返回 null');
  ok(sanChuanTopology(r.sanChuan, null) === null, '缺日干五行应返回 null');
  console.log(`  ${t.chain.join('→')}｜型 ${t.label}｜伏吟例 ${t2.chain.join('')} ✓`);
}

console.log('[C] 星盘硬相位有向图');
{
  const ch = computeNatal({ at: F.T7, lng: 104.06, lat: 30.67, tz: 8 });
  const t = aspectTopology(ch, { maxOrb: 10 });
  ok(t.edges.length > 0, `应产生边（实得 ${t.edges.length}）`);
  ok(t.edges.every((e) => ['生', '克', '比和'].includes(e.rel)), '边关系须在统一词汇内');
  ok(t.edges.every((e) => e.from && e.to && e.step), '边须含 from/to/step');
  ok(t.nodes.length > 0, '须有节点');
  // 严格口径：maxOrb 越小边越少
  const tight = aspectTopology(ch, { maxOrb: 1 });
  ok(tight.edges.length <= t.edges.length, '减小容许度不得增加边数');
  console.log(`  边 ${t.edges.length}（orb≤10）→ ${tight.edges.length}（orb≤1）｜型 ${t.label} ✓`);
}

console.log('[D] 相位 → 关系映射（以实测字符串为准，R-C2）');
eq(impliedOfType('合相'), '比和', '合相 → 比和');
eq(impliedOfType('对冲'), '克', '对冲 → 克');
eq(impliedOfType('四分相'), '克', '四分相 → 克');
eq(impliedOfType('三分相'), '生', '三分相 → 生');
eq(impliedOfType('六分相'), '生', '六分相 → 生');
eq(impliedOfType('梅花相'), null, '梅花相不参与拓扑');
eq(impliedOfType('不存在的相位'), null, '未知相位 → null');
// ★ 回归钉：首版按「刑相/冲相/拱相/六合」写，与实际字符串不符 → 刑冲边数静默为 0
ok(impliedOfType('刑相') === null && impliedOfType('冲相') === null,
  '「刑相/冲相」不是本引擎的实际取值，不得留在映射表里（否则刑冲边静默丢失）');
eq(aspectImpliedRelation(0), '比和', '角度 0° → 比和');
eq(aspectImpliedRelation(180), '克', '角度 180° → 克');
console.log('  6 种相位映射正确｜「刑相/冲相」虚词已排除 ✓');

console.log('[E] 签名与形状');
{
  const r = compileFromGanZhi({ dayGz: '丁丑', yueJiang: '午', zhanShi: '未' });
  const t = sanChuanTopology(r.sanChuan, wuxingOfGan(r.riGan));
  const sig = topologySignature(t), shape = topologyShape(t);
  ok(sig.startsWith('liuren:'), '签名须带侧标识');
  ok(shape.split(',').every((x) => ['生', '克', '比和'].includes(x)), `形状须只由关系词构成，实得「${shape}」`);
  // 签名与边的顺序无关
  const t2 = { ...t, edges: [...t.edges].reverse() };
  eq(topologySignature(t2), sig, '签名须与边顺序无关（规范化）');
  eq(topologyShape(t2), shape, '形状须与边顺序无关');
  console.log(`  ${sig.slice(0, 44)}…｜顺序无关 ✓`);
}

console.log('[F] 几何陷阱回归钉（R-C4：零假设必须在正确层级构造）');
{
  // 对冲/四分相的宫位偏移被角度锁死 ⇒ 「克」比例由几何决定，不是随机的 40%
  const offsetKe = (off) => {
    let ke = 0, n = 0;
    for (let i = 0; i < 12; i++) {
      const a = WX[(i % 12) % 5];                  // 近似：用 5 行分布只是示意，不做精确断言
      n++;
    }
    return { ke, n };
  };
  // 精确断言：用 L2 映射算「对冲」与「四分相」的克比例（这是几何决定的常量）
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const wxOf = (i) => wuxingOfLon(270 + 30 * i);
  let keOpp = 0, keSq = 0;
  for (let i = 0; i < 12; i++) {
    if (canonicRelation(wxOf(i), wxOf((i + 6) % 12)).rel === '克') keOpp++;
    if (canonicRelation(wxOf(i), wxOf((i + 3) % 12)).rel === '克') keSq++;
  }
  // 有序口径（i 跑 0..11，每对无序宫位计两次）
  eq(keOpp, 8, '对冲有序计 8（=4 组×2）→ 克率 66.7%');
  eq(keSq, 2, '四分相有序计 2 → 克率 16.7%');
  // 无序口径：偏移 o 的等价族共 6 个（i = 0..5）
  const fam = (off) => { let k = 0; for (let i = 0; i < 6; i++) if (canonicRelation(wxOf(i), wxOf((i + off) % 12)).rel === '克') k++; return k; };
  eq(fam(6), 4, '对冲 6 族中 4 族相克 = 66.7%');
  eq(fam(3), 1, '四分相 6 族中 1 族相克 = 16.7%（与有序口径 2/12 一致）');
  const naive = (() => { let k = 0; for (const a of WX) for (const b of WX) if (canonicRelation(a, b).rel === '克') k++; return k / 25; })();
  ok(Math.abs(naive - 0.4) < 1e-9, '朴素基线 P(克) = 40%');
  ok(Math.abs(keOpp / 12 - naive) > 0.2, '对冲的几何克率必须显著偏离朴素基线（这正是假显著 z=3.80 的来源）');
  ok(Math.abs(keSq / 12 - naive) > 0.2, '四分相的几何克率必须显著偏离朴素基线');
  console.log(`  对冲几何克率 ${(keOpp / 12 * 100).toFixed(1)}%｜四分相 ${(keSq / 12 * 100).toFixed(1)}%｜朴素基线 40% → 不可用作零假设 ✓`);
}

console.log('[G] 侧 A 语料拓扑型分布（可复算）');
if (!existsSync(CASES)) console.log('  SKIP：缺 cases.jsonl');
else {
  const cs = readFileSync(CASES, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((c) => c.sanChuanZhi);
  const dist = {};
  for (const c of cs) {
    const r = compileFromGanZhi({ dayGz: c.dayGz, yueJiang: c.yueJiang, zhanShi: c.zhanShi });
    const t = sanChuanTopology(r.sanChuan, wuxingOfGan(r.riGan));
    if (t) dist[t.label] = (dist[t.label] ?? 0) + 1;
  }
  const kinds = Object.keys(dist);
  ok(kinds.length >= 5, `拓扑型应 ≥5 类，实得 ${kinds.length}`);
  eq(Object.values(dist).reduce((a, b) => a + b, 0), cs.length, '每例都须归入一个拓扑型');
  ok(dist['含比和（混杂）'] >= 10, '比和类应为主要类型之一（少类型 ⇒ 同构易偶然成立，R-C3）');
  console.log(`  ${cs.length} 例 → ${kinds.length} 类：${Object.entries(dist).map(([k, v]) => k + ':' + v).join('｜')} ✓`);
}

console.log('[H] 相位双口径（R-G4：整宫制 vs 容许度制，必须并列）');
{
  const { wholeSignAspects, compareAspectSystems, WHOLE_SIGN_ASPECTS } = await import('../src/western/aspect-systems.mjs');
  const ch = computeNatal({ at: F.T7, lng: 104.06, lat: 30.67, tz: 8 });
  const ws = wholeSignAspects(ch);
  ok(ws.length > 0, `整宫制应产生相位，实得 ${ws.length}`);
  // ★ 核心回归钉：复现专家档案所说的「日月冲」（太阳摩羯 vs 月亮巨蟹 = 对宫）
  const sm = ws.find((x) => (x.a === '太阳' && x.b === '月亮') || (x.a === '月亮' && x.b === '太阳'));
  ok(sm !== undefined, '整宫制必须检出 日月 相位');
  eq(sm.type, '对冲', '整宫制下 太阳摩羯 vs 月亮巨蟹 = 对冲（专家口径）');
  eq(sm.signDistance, 6, '星座距应为 6');
  eq(sm.system, 'whole-sign', '须标注体系');
  eq(sm.orb, null, '整宫制无容许度（orb 为 null）');
  // 容许度制（R-V6 口径）：同一对日月在 orb 制下**不构成对冲**
  const orbSunMoon = (ch.aspects ?? []).find((x) => (x.a === '太阳' && x.b === '月亮') || (x.a === '月亮' && x.b === '太阳'));
  ok(orbSunMoon === undefined || orbSunMoon.type !== '对冲',
    `容许度制下日月不应判为对冲（实际黄经差超出 orb），实得 ${orbSunMoon?.type ?? '未检出'}`);
  // 双口径对照结构
  const cmp = compareAspectSystems(ch);
  ok(cmp.orbCount > 0 && cmp.wholeSignCount > 0, '两套体系都须有产出');
  ok(cmp.onlyOrb.length > 0 && cmp.onlyWholeSign.length > 0,
    `两套口径应有实质差异（仅orb ${cmp.onlyOrb.length}｜仅整宫 ${cmp.onlyWholeSign.length}）——差异为零说明开关没生效`);
  ok(/都合法/.test(cmp.note), '对照结果须带"两种口径都合法"的说明（R-G4）');
  // 整宫制映射表自洽
  eq(WHOLE_SIGN_ASPECTS[0], '合相', '星座距 0 = 合相');
  eq(WHOLE_SIGN_ASPECTS[6], '对冲', '星座距 6 = 对冲');
  eq(WHOLE_SIGN_ASPECTS[3], '四分相', '星座距 3 = 四分相');
  console.log(`  整宫制 ${ws.length} 个｜日月=${sm.type}（星座距 ${sm.signDistance}）｜容许度制未判冲 ✓`);
  console.log(`  双口径：orb ${cmp.orbCount}／整宫 ${cmp.wholeSignCount}｜共同 ${cmp.same.length}｜仅orb ${cmp.onlyOrb.length}｜仅整宫 ${cmp.onlyWholeSign.length} ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
