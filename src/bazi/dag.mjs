// 八字断语 DAG 与非线性供给（docs/30 的可执行版）
//
// 解决四件事 + 用户新提的一点：
//  ① 供给曲线非线性化 —— 过量为负（水多木漂），替换线性占比加权
//  ② DAG 落地：[1]身强弱 → [2]有根？ → [3]比劫虚透？ → [4]有印？ → [5]印成局？
//  ③ 合化子图机检：月令助否 / 所化之支被冲否 / 争合否
//  ④ **大运是否补上缺的那股气（如木根）** + **是否出现新的合冲刑**
import { compileBazi } from './engine.mjs';
import { daYun } from '../cross/timing.mjs';

export const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
export const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
/** 地支藏干（本气+中气+余气），用于判「通根」 */
export const CANG = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'],
  午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
export const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
export const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
export const XING3 = [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯']];   // 三刑（子卯为无礼之刑）
const SANHE = { 申子辰: '水', 亥卯未: '木', 寅午戌: '火', 巳酉丑: '金' };

/* ══════════ ① 非线性供给曲线 ══════════ */
/**
 * 供方携带某五行 share（0–1）对受方的**有效价值**。
 * ★ 核心：过量为负（过犹不及 / 水多木漂）。
 *   · 边际递减：1 − e^(−s/0.25)
 *   · 过量惩罚：s > 0.40 时按 (s−0.40)×**5.0** 反扣（系数 2.5→5.0：使 v=+2 在 s≈0.79 处真正转负；
 *     2.5 时只会递减不会反噬，等于"没做到过犹不及"）
 * @param v 该五行的基础价值（valence，+2/+1/0/−1/−2）
 */
export function supplyCurve(v, s) {
  if (!s || s <= 0 || !v) return 0;
  const sat = 1 - Math.exp(-s / 0.25);                 // 0→1 递减式增长
  const excess = s > 0.40 ? (s - 0.40) * 5.0 : 0;      // 过量惩罚（★ 5.0 才能反噬）
  return v * sat - (v > 0 ? excess * (v / 2) : 0);     // 惩罚按价值强度缩放（v=2 时即 excess 全额）
}

/* ══════════ ③ 合化子图 ══════════ */
/**
 * ★ 冲的**胜负**判定 —— 返回**绝对胜方**（不是相对标签）
 * 首版返回 `'克方胜'/'被克方胜'` 是**相对**的，导致 `寅(木) vs 申(金)` 被误报成
 * 「被克方胜」（实际 申金克寅木 ⇒ **申胜**）。相对标签在多处消费时方向必错，故改绝对。
 * @returns 胜方地支字符 | '平'
 */
export function chongWinner(a, b) {
  const wa = ZHI_WX[a], wb = ZHI_WX[b];
  if (KE[wa] === wb) return a;      // a 克 b ⇒ a 胜
  if (KE[wb] === wa) return b;      // b 克 a ⇒ b 胜
  return '平';
}

/** 判「合」是否能「化」：月令助否 / 所化之支被冲否（**分胜负**）/ 是否争合 */
export function heHuaVerdict(branches) {
  const rels = [];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      if (LIUHE[branches[i]] === branches[j]) rels.push({ k: '六合', pair: branches[i] + branches[j] });
      if (CHONG[branches[i]] === branches[j]) rels.push({ k: '冲', pair: branches[i] + branches[j], winner: chongWinner(branches[i], branches[j]) });
      for (const g of XING3) if (g.includes(branches[i]) && g.includes(branches[j]) && branches[i] !== branches[j]) rels.push({ k: '刑', pair: branches[i] + branches[j] });
    }
  }
  for (const [k, wx] of Object.entries(SANHE)) {
    const hit = [...k].filter((c) => branches.includes(c));
    if (hit.length === 2) {
      // 生地半合（如 申子：申金生子水）力量更实；墓地半合较弱
      const shengDi = SHENG[ZHI_WX[hit[0]]] === ZHI_WX[hit[1]] || SHENG[ZHI_WX[hit[1]]] === ZHI_WX[hit[0]];
      rels.push({ k: '半合', pair: hit.join(''), hua: wx, missing: [...k].find((c) => !branches.includes(c)), shengDi });
    }
  }
  return rels;
}

/**
 * ★ 某五行（通常是印）在命局中的**有效能量**
 * 用户原话：「子水为印虽然被冲克，但是因为半三合局，依旧子水获得能量，有能量生木」
 * ⇒ 能量 = 有该五行的地支（本气或藏干）+ 半合/六合生扶 − 被冲败
 */
export function yinEnergy(branches, wx) {
  const rels = heHuaVerdict(branches);
  const own = branches.filter((z) => ZHI_WX[z] === wx || (CANG[z] ?? []).some((c) => GAN_WX[c] === wx));
  if (!own.length) return { wx, has: false, energy: 0, ev: `地支无${wx}` };
  let energy = own.length;                       // 基础能量：每个地支 1
  const ev = [`地支有${wx}：${own.join('')}`];
  // 半合/六合生扶
  for (const r of rels) {
    if ((r.k === '半合' || r.k === '六合') && r.hua === wx) { energy += r.shengDi === false ? 0.5 : 1; ev.push(`${r.k}${r.pair}化${wx}（${r.shengDi === false ? '墓地，力弱' : '生地，力实'}）`); }
  }
  // 冲：只有**被克方**才损能量
  for (const r of rels) {
    if (r.k !== '冲') continue;
    const [a, b] = r.pair;
    const ownIsA = ZHI_WX[a] === wx || (CANG[a] ?? []).some((c) => GAN_WX[c] === wx);
    const ownIsB = ZHI_WX[b] === wx || (CANG[b] ?? []).some((c) => GAN_WX[c] === wx);
    if (ownIsA || ownIsB) {
      const loser = r.winner === '克方胜' ? b : r.winner === '被克方胜' ? a : null;
      if (loser && ((loser === a && ownIsA) || (loser === b && ownIsB))) { energy -= 1; ev.push(`冲${r.pair}（${r.winner}）⇒ ${wx}受捐 −1`); }
      else ev.push(`冲${r.pair}（${r.winner}）⇒ ${wx}未败`);
    }
  }
  return { wx, has: true, energy: Math.round(energy * 100) / 100, ev: ev.join('；') };
}

/* ══════════ ④ 大运补气 + 新关系（★ 已精细化：二元 → 带胜负与强度） ══════════ */
/**
 * 地支藏干**通根强度**（取代布尔 rootBen/rootCang）
 *   本气 = 1.0｜中气 = 0.5｜余气 = 0.25
 */
export function rootStrength(zhi, dmWx) {
  const cang = CANG[zhi] ?? [];
  const w = [1.0, 0.5, 0.25];
  let best = 0, which = null;
  cang.forEach((c, i) => {
    if (GAN_WX[c] === dmWx) { const v = w[Math.min(i, 2)]; if (v > best) { best = v; which = `${c}(${['本气', '中气', '余气'][Math.min(i, 2)]})`; } }
  });
  return { strength: best, ev: which };
}

/** 合/刑/冲的**强度权重**（取代"有即 1"） */
export const REL_WEIGHT = {
  三合: 1.0, 六合: 0.7, 半合生地: 0.6, 半合墓地: 0.35,
  冲: 0.8, 刑: 0.5, 自刑: 0.4, 害: 0.3, 破: 0.25,
};

export function dayunSupplement(bazi, gender) {
  const birth = new Date(bazi.input?.birthDate ?? Date.now());
  const dy = daYun(bazi.pillars, birth, gender);
  const dmGan = bazi.pillars[2][0];
  const dmWx = GAN_WX[dmGan];
  const natal = bazi.pillars.map((p) => p[1]);
  return dy.steps.map((s) => {
    const [g, z] = [s.ganzhi[0], s.ganzhi[1]];
    // ① 补根强度（分级）
    const rs = rootStrength(z, dmWx);
    const rootBen = ZHI_WX[z] === dmWx;                          // 本气即日主五行
    const rootCang = rs.strength > 0;
    const supplyRoot = rootBen ? '本气通根(1.0)' : rootCang ? `${rs.ev}通根(${rs.strength})` : '无根';
    // ② 新关系（带胜负与强度）
    const newRels = [];
    for (const nb of natal) {
      if (CHONG[nb] === z) {
        const winner = chongWinner(z, nb);                       // ★ 谁胜
        const zWins2 = winner === z;                              // ★ z 是否胜方
        newRels.push({ k: '冲', with: nb, winner, weight: REL_WEIGHT.冲, zWins: zWins2, note: `${z}${ZHI_WX[z]} vs ${nb}${ZHI_WX[nb]} → ${winner}` });
      }
      if (LIUHE[nb] === z) newRels.push({ k: '六合', with: nb, weight: REL_WEIGHT.六合 });
      for (const gp of XING3) if (gp.includes(nb) && gp.includes(z) && nb !== z) newRels.push({ k: '刑', with: nb, weight: REL_WEIGHT.刑, note: '刑无胜负（互相）' });
    }
    for (const [k, wx] of Object.entries(SANHE)) {
      const inSet = [...k].filter((c) => c === z || natal.includes(c));
      if (inSet.includes(z) && inSet.length === 2) {
        const shengDi = SHENG[ZHI_WX[inSet[0]]] === ZHI_WX[inSet[1]] || SHENG[ZHI_WX[inSet[1]]] === ZHI_WX[inSet[0]];
        newRels.push({ k: '半合', hua: wx, set: k, shengDi, weight: shengDi ? REL_WEIGHT.半合生地 : REL_WEIGHT.半合墓地 });
      }
    }
    // ③ 综合：补根收益 vs 新关系扰动（加权）
    const rootGain = rootBen ? 1.0 : rs.strength;
    const disturb = newRels.reduce((a, r) => a + (r.weight ?? 0), 0);
    return {
      ganzhi: s.ganzhi, startAge: s.startAge, endAge: s.endAge,
      ganWx: GAN_WX[g], zhiWx: ZHI_WX[z],
      rootBen, rootCang, rootStrength: rs.strength, supplyRoot,
      newRels, rootGain, disturb,
      net: Math.round((rootGain - disturb * 0.5) * 100) / 100,   // 补根收益 − 扰动折半
    };
  });
}

/* ══════════ ② DAG 主判定 ══════════ */
export function structuralVerdict(bazi) {
  const [y, m, d, h] = bazi.pillars;
  const branches = [y[1], m[1], d[1], h[1]];
  const dmGan = d[0], dmWx = GAN_WX[dmGan];
  const monthWx = ZHI_WX[m[1]];
  const st = bazi.L3_strength ?? {};
  const ver = bazi.L3_verdict ?? {};
  // [2] 有无根
  const roots = branches.map((z) => ({ z, ben: ZHI_WX[z] === dmWx, cang: (CANG[z] ?? []).some((c) => GAN_WX[c] === dmWx) })).filter((r) => r.ben || r.cang);
  const hasRoot = roots.some((r) => r.ben);
  // [3] 天干比劫
  const biJie = [y[0], m[0], h[0]].filter((g) => GAN_WX[g] === dmWx);
  // [4] 印星（生我）
  const yinWx = Object.keys(SHENG).find((w) => SHENG[w] === dmWx);
  const yinGan = [y[0], m[0], h[0]].filter((g) => GAN_WX[g] === yinWx);
  const yinZhi = branches.filter((z) => ZHI_WX[z] === yinWx || (CANG[z] ?? []).some((c) => GAN_WX[c] === yinWx));
  // [5] 印是否成局 / 是否有力
  const rels = heHuaVerdict(branches);
  const heRels = rels.filter((r) => r.k === '六合' || r.k === '半合');
  const monthHelpsYin = monthWx === yinWx || SHENG[monthWx] === yinWx;
  const anyHe = heRels.length > 0;
  const chongHit = rels.filter((r) => r.k === '冲').length > 0;
  // ★ 关键修正：「有冲」不等于「印被冲败」——按胜负判能量
  const ye = yinEnergy(branches, yinWx);
  const yinEffective = ye.has && ye.energy > 0;      // 印是否有能量生身
  const chengJu = anyHe && monthHelpsYin && !chongHit;      // 成局三条件（严格）
  let node = '[2A] 有根 → 常规扶抑';
  if (!hasRoot) {
    if (!biJie.length) node = '[3A] 无根无比劫 → 查从格';
    else if (!yinEffective) node = '[4A] 虚透无援（有透即不从）';
    else node = chengJu ? '[5A] 印旺成局 → 母慈灭子（印多为病）'
      : `[5B] 印有力(能量${ye.energy})而未成局 → 木得水生（水宜引不宜多）`;
  }
  return {
    dmGan, dmWx, monthWx, branches,
    hasRoot, roots, biJie, biJieMode: biJie.length ? '虚透(天干有、地支无根)' : '无',
    yinWx, yinGan, yinZhi,
    yinEnergy: ye, yinEffective,
    heHua: { rels, heRels, anyHe, monthHelpsYin, chongHit, chengJu },
    lifeForce: { deLing: st.deLing, deDi: st.deDi, deShi: st.deShi, verdict: ver.verdict, ratio: ver.ratio },
    node,
  };
}

/* ══════════ ⑤ 二元 → 连续：身强弱 / 比劫力度 / 月令助力 / 通根总量 ══════════ */
/** ★ 身强弱连续化（取代 strong 二分）；ratio = 印比占比 */
export function strengthTier(ratio) {
  if (typeof ratio !== 'number') return { tier: '未知', continuous: 0, ratio: null };
  const tier = ratio <= 0.25 ? '极弱' : ratio <= 0.40 ? '弱' : ratio <= 0.55 ? '中和' : ratio <= 0.70 ? '旺' : '极旺';
  const continuous = Math.max(-1, Math.min(1, (ratio - 0.45) / 0.30));
  return { tier, continuous: Math.round(continuous * 1000) / 1000, ratio };
}

/** 十神类别 */
export function tenGodOf(w, dmWx) {
  if (!w || !dmWx) return null;
  if (w === dmWx) return '比';
  if (SHENG[w] === dmWx) return '印';
  if (SHENG[dmWx] === w) return '食伤';
  if (KE[dmWx] === w) return '财';
  return '官杀';
}

/** ★ 月令助力分级（取代 monthHelpsYin 布尔）：同=1.0 生我=0.6 我生=0.3 克我=-0.3 其余=0 */
export function monthHelp(monthWx, targetWx) {
  if (!monthWx || !targetWx) return 0;
  if (monthWx === targetWx) return 1.0;
  if (SHENG[monthWx] === targetWx) return 0.6;
  if (SHENG[targetWx] === monthWx) return 0.3;
  if (KE[monthWx] === targetWx) return -0.3;
  return 0;
}

/** ★ 通根总量（连续，取代布尔 hasRoot） */
export function rootSum(branches, dmWx) {
  const s = branches.reduce((a, z) => a + rootStrength(z, dmWx).strength, 0);
  return { total: Math.round(s * 100) / 100, detail: branches.map((z) => z + ':' + rootStrength(z, dmWx).strength).join(' ') };
}

/** ★ 比劫坐支力度（取代只看个数）：坐同类=1.0 坐印=0.8 坐泄=0.5 坐克=0.2 */
export function biJieStrength(bazi) {
  const [y, m, d, h] = bazi.pillars;
  const dmWx = GAN_WX[d[0]];
  const spots = [['年', y[0], y[1]], ['月', m[0], m[1]], ['时', h[0], h[1]]];
  return spots.filter(([, g]) => GAN_WX[g] === dmWx).map(([pos, g, z]) => {
    const zw = ZHI_WX[z];
    const force = zw === dmWx ? 1.0 : SHENG[zw] === dmWx ? 0.8 : KE[zw] === dmWx ? 0.2 : 0.5;
    return { pos, gan: g, zhi: z, force, ev: g + '坐' + z + '(' + zw + ') → 力度 ' + force };
  });
}

/* ══════════ ⑥ 禄根与冲克损伤（接入身强弱） ══════════ */
/** 日主禄位：甲寅 乙卯 丙戊巳 丁己午 庚申 辛酉 壬亥 癸子 */
export const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

/**
 * ★ 禄根及其**损伤**（用户指出的：禄根被冲则身强弱要跟着变）
 * 损伤权重：被冲且败=0.8｜被冲但胜=0.3｜被刑=0.4｜被六合羁绊=0.2｜被半合泄=0.15
 * @returns { has, pos, luZhi, damage(0–1), effective(禄根剩余效力), ev }
 */
export function luRoot(bazi) {
  const [y, m, d, h] = bazi.pillars;
  const dm = d[0], luZhi = LU[dm];
  const spots = [['年', y[1]], ['月', m[1]], ['日', d[1]], ['时', h[1]]];
  const hit = spots.filter(([, z]) => z === luZhi);
  if (!hit.length) return { has: false, pos: null, luZhi, damage: 0, effective: 0, ev: `日主${dm}禄在${luZhi}，地支无${luZhi} ⇒ 无禄根` };
  let damage = 0; const ev = [];
  const pos = hit[0][0];
  const others = spots.filter(([p, z]) => p !== pos && z !== luZhi);
  for (const [p, z] of others) {
    if (CHONG[z] === luZhi) {
      const w = chongWinner(luZhi, z);
      const lost = w === z;                       // 禄根输 ⇒ 受损重
      damage += lost ? 0.8 : 0.3;
      ev.push(`${luZhi}被${p}${z}冲，${w}胜 ⇒ ${lost ? '禄根受损 0.8' : '禄根小损 0.3'}`);
    }
    if (LIUHE[z] === luZhi) { damage += 0.2; ev.push(`${luZhi}与${p}${z}六合（羁绊）0.2`); }
    for (const g of XING3) if (g.includes(luZhi) && g.includes(z)) { damage += 0.4; ev.push(`${luZhi}与${p}${z}相刑 0.4`); }
  }
  damage = Math.min(1, damage);
  // 禄根本气 = 1.0，按损伤折减
  const effective = Math.round(1.0 * (1 - damage) * 100) / 100;
  return { has: true, pos, luZhi, damage: Math.round(damage * 100) / 100, effective, ev: ev.length ? ev.join('；') : `禄在${pos}${luZhi}，无冲刑合 ⇒ 完整 1.0` };
}

/** ★ 得地强度（禄根 + 通根，含损伤） */
export function diStrength(bazi) {
  const [y, m, d, h] = bazi.pillars;
  const dmWx = GAN_WX[d[0]];
  const branches = [y[1], m[1], d[1], h[1]];
  const lu = luRoot(bazi);
  const rs = rootSum(branches, dmWx);
  // 禄根已含在 rootStrength（本气）里，故取 max(通根总量, 禄根效力) 避免重复计
  const di = Math.max(rs.total, lu.effective * (lu.has ? 1 : 0));
  return { di: Math.round(di * 100) / 100, rootTotal: rs.total, lu };
}

/* ══════════ ⑦ 藏干全算 / 暗合 / 盖头截脚 / 位置加权 ══════════ */
/** 位置权重：月令最重，日支（坐下）次之 —— 用户要求「日主坐下权重更高」 */
export const POS_W = { 年: 1.0, 月: 3.0, 日: 2.0, 时: 1.5 };

/** 暗合（基于藏干五合）：子巳、寅丑、午亥、卯申 */
export const AN_HE = [['子', '巳'], ['寅', '丑'], ['午', '亥'], ['卯', '申']];

/**
 * ★ 藏干全算（不再只看禄根）：逐柱逐藏干给出 十神 与 **位置加权**贡献
 * 贡献 = 藏干权重(本气1.0/中气0.5/余气0.25) × 位置权重(POS_W)
 */
export function hiddenStemsFull(bazi) {
  const [y, m, d, h] = bazi.pillars;
  const dmWx = GAN_WX[d[0]];
  const spots = [['年', y[1]], ['月', m[1]], ['日', d[1]], ['时', h[1]]];
  const W = [1.0, 0.5, 0.25];
  const out = [];
  for (const [pos, z] of spots) {
    (CANG[z] ?? []).forEach((g, i) => {
      const w = W[Math.min(i, 2)];
      out.push({
        pos, zhi: z, gan: g, wx: GAN_WX[g],
        level: ['本气', '中气', '余气'][Math.min(i, 2)], w,
        posW: POS_W[pos], contrib: Math.round(w * POS_W[pos] * 1000) / 1000,
        tenGod: tenGodOf(GAN_WX[g], dmWx),
      });
    });
  }
  // 按五行汇总（位置加权后）
  const byWx = {};
  for (const x of out) byWx[x.wx] = Math.round(((byWx[x.wx] ?? 0) + x.contrib) * 1000) / 1000;
  return { stems: out, byWx, dmWx };
}

/** ★ 暗合检测：地支两两是否构成暗合 */
export function anHeDetect(bazi) {
  const zhi = bazi.pillars.map((p) => p[1]);
  const hits = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    for (const [a, b] of AN_HE) {
      if ((zhi[i] === a && zhi[j] === b) || (zhi[i] === b && zhi[j] === a)) {
        hits.push({ pair: zhi[i] + zhi[j], by: ['年', '月', '日', '时'][i] + '-' + ['年', '月', '日', '时'][j], weight: 0.25 });
      }
    }
  }
  return hits;
}

/**
 * ★ 盖头 / 截脚（大运、流年的干支内部关系）
 *   干克支 = **盖头**（天干压制地支，支力减）
 *   支克干 = **截脚**（地支制天干，干力减）
 *   同/生 = 平
 */
export function gaiTou(ganzhi) {
  const [g, z] = [ganzhi[0], ganzhi[1]];
  const gw = GAN_WX[g], zw = ZHI_WX[z];
  if (KE[gw] === zw) return { type: '盖头', ratio: 0.6, ev: `${g}(${gw})克${z}(${zw}) → 干制支，支力×0.6` };
  if (KE[zw] === gw) return { type: '截脚', ratio: 0.6, ev: `${z}(${zw})克${g}(${gw}) → 支制干，干力×0.6` };
  if (SHENG[gw] === zw) return { type: '干生支', ratio: 1.1, ev: `${g}生${z} → 支得生 ×1.1` };
  if (SHENG[zw] === gw) return { type: '支生干', ratio: 1.1, ev: `${z}生${g} → 干得生 ×1.1` };
  return { type: '同气', ratio: 1.0, ev: `${g}/${z} 同五行 ${gw}` };
}

/* ══════════ ⑧ 土的燥湿（用户：案例乙坐下土的影响较大） ══════════ */
/**
 * ★ 燥湿土：辰丑为**湿土**（含水，能生金、晦火、养木）；未戌为**燥土**（含火，能脆金、燥木、助火）
 * 关键区别（对火日主）：
 *   · 坐**燥土**（未/戌，含丁火）→ 火库助身，**不减反增**
 *   · 坐**湿土**（辰/丑，含癸水）→ 晦火泄身，**削弱**
 */
export const TUSHI = { 辰: '湿', 丑: '湿', 未: '燥', 戌: '燥' };

/**
 * 某土支对某日主五行的**燥湿效应**
 * @returns { nature, effect('助身'|'泻身'|'中性'), mult, ev }
 */
export function tushiEffect(zhi, dmWx) {
  const nature = TUSHI[zhi];
  if (!nature) return { nature: null, effect: '非土', mult: 1.0, ev: `${zhi} 非土` };
  if (dmWx === '火') {
    return nature === '燥'
      ? { nature, effect: '助身', mult: 1.15, ev: `${zhi}为燥土（火库，藏丁）→ 助火 ×1.15` }
      : { nature, effect: '泻身', mult: 0.80, ev: `${zhi}为湿土（含水，藏癸）→ 晦火 ×0.80` };
  }
  if (dmWx === '金') {
    return nature === '湿'
      ? { nature, effect: '助身', mult: 1.15, ev: `${zhi}为湿土 → 生金 ×1.15` }
      : { nature, effect: '脆金', mult: 0.85, ev: `${zhi}为燥土 → 脆金 ×0.85` };
  }
  if (dmWx === '木') {
    return nature === '湿'
      ? { nature, effect: '养木', mult: 1.10, ev: `${zhi}为湿土 → 润木 ×1.10` }
      : { nature, effect: '燥木', mult: 0.90, ev: `${zhi}为燥土 → 燥木 ×0.90` };
  }
  if (dmWx === '水') {
    return nature === '燥'
      ? { nature, effect: '耗水', mult: 0.90, ev: `${zhi}为燥土 → 耗水 ×0.90` }
      : { nature, effect: '碍水', mult: 0.95, ev: `${zhi}为湿土 → 土克水 ×0.95` };
  }
  return { nature, effect: '中性', mult: 1.0, ev: `${zhi}为${nature}土，对${dmWx}日主中性` };
}

/** ★ 坐下（日支）综合效应：位置权重 2.0 + 燥湿修正 */
export function seatEffect(bazi) {
  const d = bazi.pillars[2];
  const dmWx = GAN_WX[d[0]];
  const ts = tushiEffect(d[1], dmWx);
  return { zhi: d[1], posW: POS_W['日'], ...ts, weighted: Math.round(POS_W['日'] * ts.mult * 100) / 100 };
}
