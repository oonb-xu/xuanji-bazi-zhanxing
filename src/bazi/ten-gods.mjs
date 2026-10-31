// 十神与「制」关系模型 —— 吸收盲派核心（食神制杀 / 伤官制官 / 枭印夺食 / 比劫夺财 / 印化杀）
//
// 为什么必须有这个模块：杨炎 120+ 条论断里，约 40% 的机理是「制」——
//   "食神制杀用印化杀取财"、"伤官制官"、"枭印夺食，食伤混杂"、"比劫夺财给人打工"、
//   "官杀生印印生身"、"财滋沙克身容易被骗"。
// 而项目此前的 valence/扶抑只回答"这个五行对我好不好"，**回答不了"两个十神谁压谁"**。
//
// ★ 关键概念区分（本轮明确登记）：
//   · 扶抑（子平）：某五行对**日主**的吉凶     → 已有 `valence()`
//   · 制化（盲派）：某十神对**另一十神**的作用 → 本模块
//   同一五行在两个框架里可以有不同角色，**不矛盾，是两层**。
import { GAN_WX, ZHI_WX, CANG, SHENG, KE } from './dag.mjs';

/** 天干阴阳：甲丙戊庚壬 = 阳 */
export const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);
export const isYang = (gan) => YANG_GAN.has(gan);

/**
 * 十神（必须带阴阳，否则食神/伤官、正官/七杀、正财/偏财、正印/偏印全分不开）
 * @param gan 待判天干
 * @param dmGan 日干
 */
export function tenGod(gan, dmGan) {
  if (!gan || !dmGan) return null;
  const wa = GAN_WX[gan], wd = GAN_WX[dmGan];
  const same = isYang(gan) === isYang(dmGan);
  if (wa === wd) return same ? '比肩' : '劫财';
  if (SHENG[wa] === wd) return same ? '偏印' : '正印';        // 生我
  if (SHENG[wd] === wa) return same ? '食神' : '伤官';        // 我生
  if (KE[wd] === wa) return same ? '偏财' : '正财';           // 我克
  return same ? '七杀' : '正官';                               // 克我
}
/** 十神的五行类别（用于力度比较） */
export const TG_GROUP = {
  比肩: '比劫', 劫财: '比劫', 正印: '印', 偏印: '印',
  食神: '食伤', 伤官: '食伤', 正财: '财', 偏财: '财', 正官: '官杀', 七杀: '官杀',
};

/**
 * ★ 制关系定义（谁克谁）—— 盲派核心
 * ★★ 必须标 `level`：十神级（食神制七杀 ≠ 伤官制正官，阴阳不同、意味不同）
 *    vs 分组级（食伤制官杀 只是聚合视角）。
 *    首版全部用分组名去查 `byGroup`，导致**前四条十神级规则 byGroup[name]=undefined ⇒ 永不触发**（静默 bug）。
 */
export const CONTROL_RULES = [
  { level: 'tenGod', by: '食神', on: '七杀', name: '食神制杀', good: true, note: '食神压七杀（同阴阳）：化暴力为能力，主掌权/技术立身，成则贵' },
  { level: 'tenGod', by: '伤官', on: '正官', name: '伤官制官', good: true, note: '伤官压正官（同异性）：不服管束，主开创/自由业；制过则伤贵气' },
  { level: 'tenGod', by: '偏印', on: '食神', name: '枭印夺食', good: false, note: '偏印夺食神：断财路/断表达，主思虑过度、机会被夺' },
  { level: 'tenGod', by: '正印', on: '伤官', name: '印制伤官', good: true, note: '正印压伤官：收敛锋芒，主涵养/学历' },
  { level: 'group', by: '比劫', on: '财', name: '比劫夺财', good: false, note: '比劫夺财：财被分夺，主合伙破财、替人扛债' },
  { level: 'group', by: '官杀', on: '比劫', name: '官杀制身', good: null, note: '官杀压比劫：身弱则受制于人，身旺则为贵' },
  { level: 'group', by: '财', on: '印', name: '财破印', good: false, note: '财克印：为财弃学/弃靠山，主贪小失大' },
  { level: 'group', by: '食伤', on: '官杀', name: '食伤制官杀（聚合）', good: true, note: '食伤压官杀（聚合视角，非独立机制）' },
];
/** 化（不是克，是"泄"）：官杀 → 印 → 身 */
export const TRANSFORM_RULES = [
  { from: '官杀', via: '印', to: '日主', name: '印化杀', note: '杀生印、印生身：把压力转化为庇护，主化险为夷' },
  { from: '财', via: '官杀', to: '忌', name: '财滋杀', good: false, note: '财生官杀：财助纣为虐，主因财招灾' },
  { from: '印', via: '比劫', to: '日主', name: '印生比劫', note: '印生身、身得助' },
  { from: '食伤', via: '财', to: '忌', name: '食伤生财', good: true, note: '食伤生财：以才华取财（他极高频）' },
];

/**
 * 四柱内所有天干/藏干的十神分布（位置加权）
 */
export function tenGodProfile(bazi) {
  const [y, m, d, h] = bazi.pillars;
  const dmGan = d[0];
  const POS_W = { 年: 1.0, 月: 3.0, 日: 2.0, 时: 1.5 };
  const W = [1.0, 0.5, 0.25];
  const out = [];
  // 天干
  [['年', y[0]], ['月', m[0]], ['时', h[0]]].forEach(([pos, gan]) => {
    out.push({ pos, src: '天干', gan, tg: tenGod(gan, dmGan), group: TG_GROUP[tenGod(gan, dmGan)], w: 1.0, posW: POS_W[pos], contrib: POS_W[pos] });
  });
  // 藏干
  [['年', y[1]], ['月', m[1]], ['日', d[1]], ['时', h[1]]].forEach(([pos, zhi]) => {
    (CANG[zhi] ?? []).forEach((gan, i) => {
      const tg = tenGod(gan, dmGan);
      const w = W[Math.min(i, 2)];
      out.push({ pos, src: '藏干' + zhi, gan, tg, group: TG_GROUP[tg], w, posW: POS_W[pos], contrib: Math.round(w * POS_W[pos] * 1000) / 1000 });
    });
  });
  // 按十神汇总
  const byTg = {}, byGroup = {};
  for (const x of out) {
    byTg[x.tg] = Math.round(((byTg[x.tg] ?? 0) + x.contrib) * 1000) / 1000;
    byGroup[x.group] = Math.round(((byGroup[x.group] ?? 0) + x.contrib) * 1000) / 1000;
  }
  return { dmGan, items: out, byTg, byGroup };
}

/**
 * ★ 检测盘中的「制」与「化」关系，并判成败
 * 成败依据：制方力度 vs 被制方力度（位置加权后）
 *   ratio = 制方 / (制方 + 被制方)
 *   ≥0.65 制得住｜0.45–0.65 相持｜<0.45 制不住（反被害）
 */
export function controlAnalysis(bazi) {
  const p = tenGodProfile(bazi);
  const g = p.byGroup, tg = p.byTg;
  // ★ 按 level 选查询源：十神级查 byTg，分组级查 byGroup
  const getW = (rule, key) => (rule.level === 'tenGod' ? (tg[key] ?? 0) : (g[key] ?? 0));
  const hits = [];
  for (const r of CONTROL_RULES) {
    const byW = getW(r, r.by);
    const onW = getW(r, r.on);
    if (byW <= 0 || onW <= 0) continue;
    const ratio = byW / (byW + onW);
    const verdict = ratio >= 0.65 ? '制得住' : ratio >= 0.45 ? '相持' : '制不住';
    hits.push({ name: r.name, level: r.level, by: r.by, on: r.on, byW, onW, ratio: Math.round(ratio * 1000) / 1000, verdict, good: r.good, note: r.note });
  }
  const trans = [];
  for (const t of TRANSFORM_RULES) {
    const fromW = g[t.from] ?? 0, viaW = g[t.via] ?? 0;
    if (fromW <= 0 || viaW <= 0) continue;
    trans.push({ name: t.name, from: t.from, via: t.via, fromW, viaW, ratio: Math.round((viaW / (viaW + fromW)) * 1000) / 1000, good: t.good ?? null, note: t.note });
  }
  return { tenGod: p, controls: hits, transforms: trans, groups: g, byTg: tg };
}

/* ══════════ 库（做功）与寒暖 —— 他另外两个高频维度 ══════════ */
/** 四库：辰=水库｜戌=火库｜丑=金库｜未=木库 */
export const KU = { 辰: '水', 戌: '火', 丑: '金', 未: '木' };

/**
 * ★ 用库做功：库里藏的五行，是否为日主可用（用神/喜神）
 * @param yong 用神五行；ji 忌神五行
 */
export function kuGong(bazi, yong, ji) {
  const zhi = bazi.pillars.map((x) => x[1]);
  const dmWx = GAN_WX[bazi.pillars[2][0]];
  const out = [];
  for (const z of zhi) {
    const k = KU[z];
    if (!k) continue;
    // ★ 修正：首版只判「库的五行 == 用神/忌神」，漏了**库的五行 == 日主五行**这一最重要情形
    //   — 火日主坐戌（火库）= 火库为根，是帮身而非"闲库"
    const role = k === dmWx ? '比劫库(根/帮身)' : k === yong ? '用神库' : k === ji ? '忌神库' : '闲库';
    out.push({ zhi: z, ku: k, role, usable: k === yong || k === dmWx, self: k === dmWx });
  }
  return out;
}

/**
 * ★ 寒暖（他常说"比较寒的八字""可惜了太寒"）
 * 判据：月令五行 + 四支寒暖属性 + 有无火/水调和
 *   寒：生于亥子丑月，或四支多水，且无火
 *   暖：生于巳午未月，或四支多火，且无水
 */
export const ZHI_TEMP = {
  亥: -2, 子: -3, 丑: -2, 寅: 1, 卯: 1, 辰: 0, 巳: 2, 午: 3, 未: 2, 申: -1, 酉: -1, 戌: 0,
};
export function hanNuan(bazi) {
  const zhi = bazi.pillars.map((x) => x[1]);
  const score = zhi.reduce((a, z) => a + (ZHI_TEMP[z] ?? 0), 0);
  const monthT = ZHI_TEMP[zhi[1]] ?? 0;
  // 是否有火/水调候
  const hasFire = zhi.some((z) => ZHI_WX[z] === '火' || (CANG[z] ?? []).some((c) => GAN_WX[c] === '火'));
  const hasWater = zhi.some((z) => ZHI_WX[z] === '水' || (CANG[z] ?? []).some((c) => GAN_WX[c] === '水'));
  const total = score + monthT * 1.5;
  const nature = total <= -5 ? '太寒' : total <= -2 ? '偏寒' : total >= 5 ? '太燥' : total >= 2 ? '偏暖' : '中和';
  const need = nature === '太寒' || nature === '偏寒' ? (hasFire ? '有火调候（救）' : '**无火调候（病）**')
    : nature === '太燥' || nature === '偏暖' ? (hasWater ? '有水润泽（救）' : '**无水润泽（病）**') : '无需调候';
  return { score, monthT, total: Math.round(total * 100) / 100, nature, hasFire, hasWater, need };
}
