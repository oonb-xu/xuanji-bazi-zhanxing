import { biJieStrength, luRoot, hiddenStemsFull, anHeDetect, yinEnergy, rootStrength } from './dag.mjs';
import { supplyCurve } from './dag.mjs';
// 八字合盘「互补度」—— 取代错误的「五行相似度」
//
// ★ 用户指出的两处概念错误（已修正）：
//  ① **「喜神与忌神重叠」不是冲突**：同一五行对甲为忌、对乙为喜，恰恰是**相互转化**的通道。
//     例：男身旺忌水、用木（木泄水）；女身弱喜水木、日主乙木 ⇒
//     女之木泄男之水（男之忌被引走），男之水养女之木（女之用被供给）—— 是**互为用神 + 引动**，非冲突。
//  ② **五行"差距大"不是矛盾点**：合盘看**互补**（对方能否供我之用、耗我之忌），
//     **绝不是相似度**（相似度高只意味着两人带着同样的偏差，反而无人能补）。
//
// 度量：`supply(X ← Y)` = Y 这个盘对 X 的**净供给**（用其日主与五行结构）
//   ① 互为用神：Y 日主 == X 用神           → +3.0（最强信号）
//   ② 引动泄忌：X 忌神 生 Y 日主（Y 在耗 X 之忌）→ +1.5
//   ③ 结构净贡献：Σ 价值(w) × Y 分布占比(w)  → 连续项（价值 +2/+1/0/−1/−2）
// 互补度 = (supply(A←B) + supply(B←A)) / 2
export const WX = ['木', '火', '土', '金', '水'];
export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // a 生 b
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };      // a 克 b

/**
 * 某五行对某命局的价值 —— **扶抑框架**（取代「单一用神/忌神」）
 *
 * ★ 用户第三条修正（更根本）：**"相似度"不该是独立维度，它本来就是互补度的特例**。
 *   同一种五行对我是喜是忌，取决于**身旺/身弱**：
 *   · 乙木女**身弱** ⇒ 木（比劫）与 水（印）**同为用神级**，木多**可生扶**她 → 正贡献；
 *   · 癸水男**身旺** ⇒ 水（比劫）是忌神，**和水多的人在一起反为忌** → 负贡献。
 *   ⇒ 所以"两人都水多"到底好还是坏，**完全由各自的扶抑方向决定**，这就是互补度能吸收相似度的原因。
 *
 * @param w   待评五行
 * @param dm  日主五行
 * @param strong 是否身旺（undefined 时退化为「用神/忌神」二值口径，保持向后兼容）
 * @param rooted 日主是否有根（无根时比劫提根价值更高）
 */
export function valence(w, dm, strong, rooted = true, yong = null, ji = null) {
  if (!w) return 0;
  // 退路：无身强弱信息时用旧二值口径
  if (strong === undefined || !dm) {
    if (!yong) return 0;
    if (w === yong) return 2;
    if (w === ji) return -2;
    if (SHENG[w] === yong) return 1;
    if (KE[w] === ji) return 1;
    if (KE[w] === yong) return -1;
    if (SHENG[w] === ji) return -1;
    return 0;
  }
  const rel = w === dm ? '比' : SHENG[w] === dm ? '印' : SHENG[dm] === w ? '食伤' : KE[dm] === w ? '财' : '官杀';
  if (strong) {
    // 身旺宜泄耗克：食伤/财 最宜，官杀 次宜；印/比 为忌
    return { 食伤: 2, 财: 2, 官杀: 1, 比: -1, 印: -2 }[rel] ?? 0;
  }
  // 身弱宜生扶：印 最宜；比劫 提根帮身（无根者与印同重）；食伤/财 耗泄，官杀 克身最忌
  if (rel === '印') return 2;
  if (rel === '比') return rooted ? 1.5 : 2;
  if (rel === '食伤') return -1;
  if (rel === '财') return -1;
  return -2;   // 官杀
}

const DM_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };

/** 提取该盘用于互补计算的四要素 */
export function profileOf(bazi) {
  const dmGan = bazi.pillars[2]?.[0];
  const yong = bazi.L5_yongJi?.yong ?? null;
  const ji = bazi.L5_yongJi?.ji ?? null;
  const dist = bazi.L3_distribution?.adjusted ?? bazi.L3_distribution?.raw ?? null;
  const verdict = bazi.L3_verdict?.verdict ?? null;                 // 身旺 / 身弱
  const strong = verdict === '身旺' ? true : verdict === '身弱' ? false : undefined;
  const rooted = bazi.L3_verdict?.rooted ?? true;
  const s = bazi.L3_strength;                                        // deLing/deDi/deShi
  const deLing = s?.deLing ?? 0;
  // ★ 得地按**禄根损伤**折减（用户修正：禄根被冲则身强弱随之变化）
  const lu = luRoot(bazi);
  const deDi = Math.round((s?.deDi ?? 0) * (1 - (lu.has ? lu.damage : 0)) * 100) / 100;
  // ★ 得势改为**比劫坐支力度之和**（不再只看个数）——甲坐申=0.2（绝地） vs 壬坐子=1.0（临官）
  const bj = biJieStrength(bazi);
  const deShi = bj.reduce((a, x) => a + x.force, 0);
  // ★★ 第四项「得生」：只要印星存活，天干日主/比劫**依旧受生**（用户指出的关键区分）
  //   · 无根之木受生 = 能续不能立 ⇒ ×0.5
  //   · 有根者受生  = 可转化为根力 ⇒ ×1.0
  //   上限 2.0（印再旺也不能把"受生"当"通根"）
  const branchesAll = bazi.pillars.map((x) => x[1]);
  const yinWx = Object.keys(SHENG).find((w) => SHENG[w] === DM_WX[dmGan]);
  const ye = yinWx ? yinEnergy(branchesAll, yinWx) : { energy: 0 };
  const rootTotal = branchesAll.reduce((a, z) => a + rootStrength(z, DM_WX[dmGan]).strength, 0);
  const rootFactor = rootTotal > 0 ? 1.0 : 0.5;
  const deSheng = Math.min(2.0, Math.max(0, Math.round((ye.energy ?? 0) * rootFactor * 100) / 100));
  // ★ 日主「力度」0–1：得令 + 得地 + 得势 + **得生** 四项平均
  const rawVigor = (deLing + deDi + deShi + deSheng) / 4;
  const vigor = Math.max(0.2, Math.min(1, rawVigor));
    // ★ 藏干全算（位置加权）+ 暗合	—— 供更细的判定使用，不改变既有 dist（避免跨标度）
  const hs = hiddenStemsFull(bazi);
  const anHe = anHeDetect(bazi);
  return { dmGan, dmWx: DM_WX[dmGan] ?? null, yong, ji, dist, strong, rooted, verdict, deLing, deDi, deShi, deSheng, deShengDetail: { yinWx, energy: ye.energy, rootFactor, rootTotal }, bjDetail: bj, lu, hs, anHe, rawVigor, vigor };
}

/** supply(X ← Y)：Y 这个盘对 X 的净供给 */
export function supplyTo(X, Y) {
  const parts = [];
  let total = 0;
  const val = (w) => valence(w, X.dmWx, X.strong, X.rooted, X.yong, X.ji);
  // ① 互为用神：Y 日主对 X 属于「用神级」——★ 但**必须按供方力度打折**
  //   用户原话："木必须足够强才能有帮扶作用"；无根虚浮的木泄不动水、也生不了火。
  const yv = Y.dmWx ? val(Y.dmWx) : 0;
  if (yv >= 1.5) {
    const full = 3.0, eff = Math.round(full * Y.vigor * 1000) / 1000;
    parts.push({ k: '互为用神', w: eff, ev: `Y日主=${Y.dmWx} 为用神级(价值${yv})，但**供方力度=${Y.vigor.toFixed(2)}**（得令${Y.deLing}/得地${Y.deDi}/得势${Y.deShi}）⇒ 满额${full}×力度=${eff}` });
    total += eff;
  }
  // ② 引动泄忌：X 的忌神 生 Y 的日主 ⇒ Y 在消耗 X 的忌神（同样按力度打折）
  if (Y.dmWx) {
    const neg = WX.map((w) => ({ w, v: val(w) })).filter((z) => z.v < 0).sort((a, b) => a.v - b.v)[0];
    if (neg && SHENG[neg.w] === Y.dmWx) {
      const eff = Math.round(1.5 * Y.vigor * 1000) / 1000;
      parts.push({ k: '引动泄忌', w: eff, ev: `X忌神=${neg.w} 生 Y日主=${Y.dmWx}（忌被引走）×力度${Y.vigor.toFixed(2)}` });
      total += eff;
    }
  }
  // ③ 结构净贡献 —— ★ 改为**非线性供给曲线**（过量为负 / 水多木漂），替换原来的线性占比加权
  if (Y.dist && X.dmWx) {
    const tot = WX.reduce((s, w) => s + Number(Y.dist[w] ?? 0), 0) || 1;
    let net = 0;
    const detail = [];
    for (const w of WX) {
      const share = Number(Y.dist[w] ?? 0) / tot;
      const eff = supplyCurve(val(w), share);           // ← 非线性
      net += eff;
      if (Math.abs(eff) > 0.04) detail.push(`${w}${eff > 0 ? '+' : ''}${eff.toFixed(2)}(${(share * 100).toFixed(0)}%)`);
    }
    parts.push({ k: '结构净贡献(非线性)', w: Math.round(net * 1000) / 1000, ev: detail.join(' ') });
    total += net;
  }
  return { total: Math.round(total * 1000) / 1000, parts };
}

/** 互补度（双向平均） */
export function complementarity(baziA, baziB) {
  const A = profileOf(baziA), B = profileOf(baziB);
  const ab = supplyTo(A, B), ba = supplyTo(B, A);
  return {
    A: { profile: A, recv: ab }, B: { profile: B, recv: ba },
    complementarity: Math.round(((ab.total + ba.total) / 2) * 1000) / 1000,
    supplyAB: ab.total, supplyBA: ba.total,
    note: '互补度 = (A←B 供给 + B←A 供给)/2；**不是相似度**',
  };
}

// ★ 「五行相似度」已按用户要求**删除** —— 它不是独立维度，而是**互补度的特例**：
//   同一五行对我是喜是忌由**身旺/身弱**决定（身弱喜印比、身旺喜泄耗克），
//   所以"两人都某五行多"是好是坏已被 `valence()` 完全吸收，无需另设相似度。
//   （旧实现保留在 git 历史与 docs/30 中作为反面案例。）
