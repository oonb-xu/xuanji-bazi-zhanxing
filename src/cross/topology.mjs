// 方案1 · 结构量对齐引擎：统一「能量关系拓扑链」语言
//
// 目的（用户立项）：把两侧的结构量转成**同一种有向图**，做**拓扑对比**，而非日期对比。
//   · 侧 A 六壬：三传（初/中/末）的**五行生克方向** → 有向图
//   · 侧 B 占星：星盘**硬相位结构** → 有向图
//   · 统一语言：**节点 = 五行（木火土金水）**；**边 = 生 / 克 / 比和** → `EnergyTopology`
//
// ★ 本模块自带"可证伪"设计（这是它区别于巧合生成器的关键）：
//   占星侧每个硬相位同时给出**两种关系**：
//     ① **相位蕴含关系**（由角度决定：0°→比和，90°/180°→克，120°/60°→生）—— 这是项目既有映射层 ρ
//     ② **五行蕴含关系**（由两星所在黄道宫的五行决定：如 金 vs 木 → 金克木）—— 这是 L2 盘面层
//   ⇒ 定义 **方向一致性** = ① 与 ② 是否给出**同一个关系与同一个方向**。
//   这是一个**可在大样本上机检、且能被否证**的量（若一致性 ≈ 随机水平，则该映射层无信息）。
//
// 复用（不重造）：五行生克用 `src/bazi/wuxing.mjs`；相位用 `computeNatal()`；黄经→五行用 L2 公式。
import { WU_XING } from '../bazi/wuxing.mjs';
import { eclipticLongitude } from '../western/zodiac.mjs';

export const WX = ['木', '火', '土', '金', '水'];
/** 五行相生：木→火→土→金→水→木 */
export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：木克土、土克水、水克火、火克金、金克木 */
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 统一关系：a 相对 b 的关系（有向，a 为主动方） */
export function relationOf(a, b) {
  if (a === b) return '比和';
  if (SHENG[a] === b) return '生';      // a 生 b（泄）
  if (SHENG[b] === a) return '受生';    // b 生 a（a 受生）
  if (KE[a] === b) return '克';         // a 克 b
  if (KE[b] === a) return '被克';       // b 克 a
  return '其他';
}
/** 归一为"主动方→被动方"的方向（生/克 两种正关系 + 比和） */
export function canonicRelation(a, b) {
  const r = relationOf(a, b);
  if (r === '比和') return { rel: '比和', from: a, to: b };
  if (r === '生') return { rel: '生', from: a, to: b };
  if (r === '克') return { rel: '克', from: a, to: b };
  if (r === '受生') return { rel: '生', from: b, to: a };
  if (r === '被克') return { rel: '克', from: b, to: a };
  return { rel: '其他', from: a, to: b };
}

/** 天干 → 五行（自带，避免与 daliuren 的 GAN_WU_XING / bazi 的 WU_XING 混淆 —— 后者不是天干表） */
export const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
export const wuxingOfGan = (gan) => GAN_WX[gan] ?? null;

/** 黄经 → 五行（L2 盘面层：L = 270 + 30i） */
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
export const wuxingOfLon = (L) => ZHI_WX[ZHI[Math.round(((L - 270) / 30 + 1200)) % 12]];

/* ══════════ 侧 A：六壬 三传 五行生克有向图 ══════════ */
/**
 * @param sanChuan 来自 `deriveSanChuan()` 的返回值（含 chain: [{zhi, wuxing}]）
 * @param riGanWuXing 日干五行（起点的"我"）
 * @returns EnergyTopology：{ nodes, edges, chain, label }
 */
export function sanChuanTopology(sanChuan, riGanWuXing) {
  const chuan = (sanChuan?.chain ?? []).map((x) => x.wuxing);
  if (chuan.length !== 3 || !riGanWuXing) return null;
  const seq = [riGanWuXing, ...chuan];                       // 我 → 初 → 中 → 末
  const edges = [];
  for (let i = 0; i < seq.length - 1; i++) {
    const { rel, from, to } = canonicRelation(seq[i], seq[i + 1]);
    edges.push({ from, to, rel, step: ['我→初', '初→中', '中→末'][i] });
  }
  // 回环：末传与日干的关系（能量是否回流）
  const back = canonicRelation(seq[3], seq[0]);
  edges.push({ from: back.from, to: back.to, rel: back.rel, step: '末→我' });
  const label = classifyChain(edges);
  return { side: 'liuren', nodes: [...new Set(seq)], edges, chain: seq, label };
}

/** 把能量链归类为命名的拓扑型（用于跨系统比对；命名取自传统术语但**定义为拓扑性质**） */
export function classifyChain(edges) {
  const forward = edges.filter((e) => e.step !== '末→我');
  const rels = forward.map((e) => e.rel);
  const backRel = edges.find((e) => e.step === '末→我')?.rel;
  const allSheng = rels.every((r) => r === '生');
  const allKe = rels.every((r) => r === '克');
  const allSame = rels.every((r) => r === '比和');
  if (allSame) return '纯比和（同气）';
  if (allSheng && backRel === '生') return '回环生（泄而复得）';
  if (allSheng) return '顺生链（泄秀）';
  if (allKe) return '连克链（交战）';
  if (rels[0] === '生' && rels[1] === '克') return '生而遇克';
  if (rels[0] === '克' && rels[1] === '生') return '克而后生';
  if (rels.includes('比和')) return '含比和（混杂）';
  return '混合链';
}

/* ══════════ 侧 B：星盘 硬相位 有向图 ══════════ */
/** 相位角度 → 蕴含关系（项目既有映射层 ρ 的口径） */
export function aspectImpliedRelation(angle) {
  const a = Math.abs(angle);
  if (a <= 8) return '比和';                    // 合相
  if (Math.abs(a - 60) <= 4 || Math.abs(a - 120) <= 4) return '生';   // 六合/拱
  if (Math.abs(a - 90) <= 6 || Math.abs(a - 180) <= 6) return '克';   // 刑/冲
  return null;                                   // 非硬相位，不参与拓扑
}
/** ★ 相位**名称** → 蕴含关系（`computeNatal().aspects[].type` 用的是名称，无 angle 字段）
 *  实测取值：合相 / 对冲 / 三分相 / 六分相 / 梅花相 / 四分相
 *  ★ 首版按「刑相/冲相/拱相/六合」写，与实际字符串不符 → 刑冲边数静默为 0（又一次"沉默的错"） */
export const ASPECT_TYPE_REL = {
  合相: '比和',
  对冲: '克', 四分相: '克',
  三分相: '生', 六分相: '生',
  梅花相: null,
};
export const impliedOfType = (type) => ASPECT_TYPE_REL[type] ?? null;

/**
 * ★ 现代占星容许度标准（按参与天体取值，取代"一律 6/8°"）
 * 依据现代占星通行口径：太阳/月亮 10°，内行星 8°，外行星 7°，轴点 8°
 */
export const MODERN_ORB = {
  太阳: 10, 月亮: 10,
  水星: 8, 金星: 8, 火星: 8,
  木星: 7, 土星: 7, 天王星: 7, 海王星: 7, 冥王星: 7,
  上升: 8, 下降: 8, 天顶: 8, 天底: 8, 北交点: 7, 南交点: 7, 凯龙: 6,
};
export const orbFor = (body, fallback = 8) => MODERN_ORB[body] ?? fallback;

/**
 * ★ 容许度权重：贴近精确相位的边权重大，边缘容许度的边权重小。
 *   w = (1 − orb/max)^0.7   —— 幂次 0.7 使中等容许度不至过快衰减
 * ★ 大偏移提醒：orb/max > 0.6 时标 `largeOrb`（"仍在相位内，但偏离较大"）
 */
export function orbWeight(orb, max, { largeAt = 0.6 } = {}) {
  if (!max) return 1;
  const r = Math.min(1, orb / max);
  const w = Math.round(Math.pow(1 - r, 0.7) * 1000) / 1000;
  return { w, ratio: Math.round(r * 1000) / 1000, largeOrb: r > largeAt };
}

/**
 * @param chart `computeNatal()` 的返回值（含 planets[].lon、aspects[]）
 * @param maxOrb 容许度上限（默认改为**按天体取现代标准**；显式传入则作为上限封顶）
 * @returns EnergyTopology（side:'astro'）+ **方向一致性**统计
 */
export function aspectTopology(chart, { maxOrb = null, largeAt = 0.6 } = {}) {
  const edges = [];
  let consistent = 0, inconsistent = 0, neutral = 0;
  const pairs = chart?.aspects ?? [];
  for (const asp of pairs) {
    const orb = Math.abs(asp.orb ?? asp.exact ?? 99);
    const aName = asp.a ?? asp.from, bName = asp.b ?? asp.to;
    // ★ 现代标准：取两颗天体容许度的**较小者**（严格侧），再受显式 maxOrb 封顶
    const std = Math.min(orbFor(aName), orbFor(bName));
    const lim = maxOrb === null ? std : Math.min(std, maxOrb);
    if (orb > lim) continue;
    const implied = asp.type ? impliedOfType(asp.type) : aspectImpliedRelation(asp.angle);
    if (!implied) continue;
    const A = chart.planets?.[asp.a ?? asp.from];
    const B = chart.planets?.[asp.b ?? asp.to];
    if (!A || !B || A.lon === undefined || B.lon === undefined) continue;
    const wa = wuxingOfLon(A.lon), wb = wuxingOfLon(B.lon);
    const wx = canonicRelation(wa, wb);                 // 五行蕴含关系
    const ow = orbWeight(orb, lim, { largeAt });
    // ★ 方向一致性：把相位蕴含关系与五行蕴含关系比对
    const agree = implied === wx.rel;
    if (implied === '克') { if (agree) consistent++; else inconsistent++; }
    else neutral++;
    edges.push({
      from: wa, to: wb, rel: wx.rel, step: `${asp.a ?? asp.from}—${asp.b ?? asp.to}`,
      aspect: asp.type, implied, orb, agree,
      weight: ow.w, orbRatio: ow.ratio, largeOrb: ow.largeOrb, orbLimit: lim,
    });
  }
  return {
    side: 'astro', nodes: [...new Set(edges.flatMap((e) => [e.from, e.to]))],
    edges, label: classifyChain(edges.filter((e) => e.rel)),
    consistency: { consistent, inconsistent, neutral, rate: (consistent + inconsistent) ? consistent / (consistent + inconsistent) : null },
  };
}

/* ══════════ 统一签名（跨系统比对用） ══════════ */
/** 规范化签名：节点集合 + 边的多重集（与顺序无关，可哈希、可比较） */
export function topologySignature(topo) {
  if (!topo) return null;
  const nodes = [...new Set(topo.nodes)].sort().join('');
  const edges = topo.edges
    .map((e) => `${e.from}${e.rel}${e.to}`)
    .sort()
    .join('|');
  return `${topo.side}:${nodes}#${edges}`;
}

/** 拓扑"形状"（只取 关系多重集，不取具体五行）—— 用于跨系统同构判定 */
export function topologyShape(topo) {
  if (!topo) return null;
  return topo.edges.map((e) => e.rel).sort().join(',');
}
