// 动态十神权重：一个行星对应多个十神，权重随盘面状态变化
//
// ★ 用户命题（2026-10-27）：
//   「权重比例是动态的」
//   「一个行星不止对应一个十神」
//   「合相可能导致特质放大，这是否和生有关系？」
//   「这个权重能在八字的能量印证吗？」
//
// 本模块回答这四问，并把答案写成可机检的函数。
//
// ── 核心设计 ──────────────────────────────────────────────
// ① 一个行星 = 一个「十神权重向量」，不是单一标签
// ② 权重 = 基础配比 × 尊贵 × 宫位档 × 相位 × 顺逆 × 得时
// ③ 合相的两个效应必须分开算：
//      · 可见度放大（both 加权）        —— 同度共处，不是「生」
//      · 单向输能（strong → weak）      —— 尊贵差驱动的「生」式补给，才是印
// ④ 印证：把占星侧权重与八字侧同组的能量做对照

const GROUPS = ['比劫', '印', '食伤', '财', '官杀'];

/**
 * ★ 多十神映射：每颗行星的**基础配比**（和为 1）
 * 依据：行星的复合性质。土星兼边界（官杀）与承载（印）；
 *      金星兼占有（财）与给予（食伤）；太阳兼自我（比劫）与权威（官杀）。
 */
export const MULTI_MAP = {
  太阳: { 比劫: 0.62, 官杀: 0.26, 印: 0.12 },   // 自我 + 权威 + 精神核心
  月亮: { 印: 0.70, 比劫: 0.18, 食伤: 0.12 },   // 滋养 + 情绪自我 + 感受表达
  水星: { 食伤: 0.66, 印: 0.22, 财: 0.12 },     // 表达 + 学习 + 交易
  金星: { 财: 0.58, 食伤: 0.27, 印: 0.15 },     // 占有 + 审美创造 + 愉悦依靠
  火星: { 官杀: 0.64, 比劫: 0.24, 食伤: 0.12 }, // 攻击 + 斗志 + 行动输出
  木星: { 印: 0.58, 财: 0.24, 食伤: 0.18 },     // 扩张庇护 + 机遇资源 + 乐观表达
  土星: { 官杀: 0.55, 印: 0.45 },               // ★ 边界：压迫 / 承载（用户命题）
  天王星: { 食伤: 0.52, 比劫: 0.30, 官杀: 0.18 }, // 破格 + 独立 + 冲突
  海王星: { 印: 0.58, 食伤: 0.30, 财: 0.12 },   // 消融 + 想象 + 幻财
  冥王星: { 官杀: 0.60, 印: 0.24, 财: 0.16 },   // 清算 + 深层依托 + 掌控资源
  凯龙: { 官杀: 0.45, 印: 0.35, 食伤: 0.20 },
};

const ANGULAR = new Set([1, 4, 7, 10]);
const SUCCEDENT = new Set([2, 5, 8, 11]);
const DOMICILE = { 太阳: ['狮子'], 月亮: ['巨蟹'], 水星: ['双子', '处女'], 金星: ['金牛', '天秤'], 火星: ['白羊', '天蝎'], 木星: ['射手', '双鱼'], 土星: ['摩羯', '水瓶'] };
const EXALT = { 太阳: ['白羊'], 月亮: ['金牛'], 水星: ['处女'], 金星: ['双鱼'], 火星: ['摩羯'], 木星: ['巨蟹'], 土星: ['天秤'] };
const DETRIMENT = { 太阳: ['水瓶'], 月亮: ['摩羯'], 水星: ['射手', '双鱼'], 金星: ['天蝎', '白羊'], 火星: ['天秤', '金牛'], 木星: ['双子', '处女'], 土星: ['巨蟹', '狮子'] };
const FALL = { 太阳: ['天秤'], 月亮: ['天蝎'], 水星: ['双鱼'], 金星: ['处女'], 火星: ['巨蟹'], 木星: ['摩羯'], 土星: ['白羊'] };

const norm = (d) => ((d % 360) + 360) % 360;
const sepAt = (a, b) => { const d = Math.abs(norm(a) - norm(b)) % 360; return d > 180 ? 360 - d : d; };
const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** 本质尊贵档位与系数 */
export function dignityOf(name, sign) {
  if ((DOMICILE[name] || []).includes(sign)) return { tier: '庙', k: 1.55 };
  if ((EXALT[name] || []).includes(sign)) return { tier: '旺', k: 1.38 };
  if ((DETRIMENT[name] || []).includes(sign)) return { tier: '陷', k: 0.72 };
  if ((FALL[name] || []).includes(sign)) return { tier: '落', k: 0.60 };
  return { tier: '平', k: 1.0 };
}

/**
 * ★ 单颗行星的动态十神权重
 * @param p   行星 {name, lon, sign, house, retro}
 * @param ctx { aspects, sunLon, isDay, moonLon }
 */
export function dynamicWeights(p, ctx = {}) {
  const base = MULTI_MAP[p.name];
  if (!base) return null;
  const w = { ...base };
  const mods = [];

  // ★ strength：总体强弱（统一作用，不参与组内归一）
  //   ⇒ 入庙的木星 = 更强的木星，而不是"不同的木星"
  let strength = 1.0;
  const strengthMods = [];

  // ① 本质尊贵
  const dg = dignityOf(p.name, p.sign);
  if (dg.k !== 1) { strength *= dg.k; strengthMods.push({ k: '尊贵', v: dg.tier, f: dg.k }); }

  // ② 宫位档
  const h = p.house;
  let hk = 1.0, hTag = '';
  if (ANGULAR.has(h)) { hk = 1.28; hTag = '角宫'; }
  else if (SUCCEDENT.has(h)) { hk = 1.06; hTag = '续宫'; }
  else if (h) { hk = 0.80; hTag = '果宫'; }
  if (hk !== 1) { strength *= hk; strengthMods.push({ k: '宫位', v: hTag, f: hk }); }

  // ③ 逆行：力量内化（整体仍增益，但方向向内）
  if (p.retro === true) { strength *= 1.10; strengthMods.push({ k: '逆行', v: '内化', f: 1.10 }); }

  // ④ 得时（hayz 简化）
  const daySet = new Set(['太阳', '木星', '土星']);
  const nightSet = new Set(['月亮', '金星', '火星']);
  if (ctx.isDay != null) {
    const hayz = (ctx.isDay && daySet.has(p.name)) || (!ctx.isDay && nightSet.has(p.name));
    if (hayz) { strength *= 1.15; strengthMods.push({ k: '得时', v: ctx.isDay ? '昼' : '夜', f: 1.15 }); }
  }

  // ⑤ 与太阳距角：灼伤/光束下
  if (typeof ctx.sunLon === 'number' && p.name !== '太阳') {
    const d = sepAt(p.lon, ctx.sunLon);
    if (d < 8.5) { strength *= 0.72; strengthMods.push({ k: '日光灼伤', v: d.toFixed(1) + '°', f: 0.72 }); }
    else if (d < 17) { strength *= 0.84; strengthMods.push({ k: '在光束下', v: d.toFixed(1) + '°', f: 0.84 }); }
  }

  // ⑥ ★ 相位：合相 = 可见度放大（不是「生」）
  let conjAmp = 1.0;
  const hard = [], soft = [], conj = [];
  if (Array.isArray(ctx.aspects)) {
    for (const a of ctx.aspects) {
      if (a.a !== p.name && a.b !== p.name) continue;
      const other = a.a === p.name ? a.b : a.a;
      if (a.type === '合相') { conj.push(other); conjAmp *= 1 + 0.16 * (1 - Math.min(1, (a.orb ?? 0) / 8)); }
      else if (a.type === '对冲' || a.type === '四分相') hard.push(other);
      else if (a.type === '三分相' || a.type === '六分相') soft.push(other);
    }
  }
  // 合相 = 可见度放大（进 strength，不改组内配比）
  if (conjAmp !== 1) { strength *= conjAmp; strengthMods.push({ k: '合相放大', v: conj.join('+') || '—', f: round(conjAmp) }); }
  // 硬相位：加冲突性（官杀/比劫略升），和谐相位：加顺滑（印/食伤略升）
  // ★ 硬/和谐相位 = 方向性修正，改变组内配比（这才是"什么时候偏哪个十神"）
  const aspectMods = [];
  if (hard.length) {
    const f = 1 + 0.10 * hard.length;
    w.官杀 = (w.官杀 || 0) * f; w.比劫 = (w.比劫 || 0) * (1 + 0.06 * hard.length);
    aspectMods.push({ k: '硬相位', v: hard.length + '条', f: round(f), dir: '→官杀/比劫' });
  }
  if (soft.length) {
    const f = 1 + 0.08 * soft.length;
    w.印 = (w.印 || 0) * f; w.食伤 = (w.食伤 || 0) * (1 + 0.05 * soft.length);
    aspectMods.push({ k: '和谐相位', v: soft.length + '条', f: round(f), dir: '→印/食伤' });
  }

  // 归一
  const sum = GROUPS.reduce((a, g) => a + (w[g] || 0), 0) || 1;
  const pct = {};
  for (const g of GROUPS) pct[g] = (w[g] || 0) / sum;
  // 先四舍五入其余组，再把最大组设成 1−其余和 ⇒ 严格为 1（浮点内精确）
  const maxG = GROUPS.reduce((m, g) => (pct[g] > pct[m] ? g : m), GROUPS[0]);
  const out = {};
  let acc = 0;
  for (const g of GROUPS) {
    if (g === maxG) continue;
    out[g] = round(pct[g], 6);
    acc += out[g];
  }
  out[maxG] = 1 - acc;
  for (const g of GROUPS) pct[g] = out[g];

  // 主次
  const sorted = GROUPS.map((g) => [g, pct[g]]).sort((x, y) => y[1] - x[1]);

  return {
    planet: p.name, sign: p.sign, house: p.house ?? null, retro: !!p.retro,
    weights: pct,
    primary: { group: sorted[0][0], w: sorted[0][1] },
    secondary: { group: sorted[1][0], w: sorted[1][1] },
    mods: [...strengthMods, ...aspectMods],
    strength: round(strength, 4),
    strengthMods, aspectMods,
    conj: conj,
    hard, soft,
    dynamic: true,
  };
}

/**
 * ★ 合相的两个效应分开算
 *  A. 可见度放大：同处 ⇒ 两者都被"看见"（不是「生」）
 *  B. 单向输能：尊贵差悬殊 ⇒ 强者向弱者补给（这段才近似「生 / 印」）
 */
/** 更实用：给一对行星 + 各自星座，算合相的两部分效应 */
export function analyzeConjunction(pa, pb, orbLimit = 8) {
  if (!pa || !pb) return null;
  const orb = sepAt(pa.lon, pb.lon);
  if (orb > orbLimit) return null;
  const dA = dignityOf(pa.name, pa.sign);
  const dB = dignityOf(pb.name, pb.sign);
  const kA = dA.k, kB = dB.k;

  // A. 可见度放大（对称）
  const amp = 1 + 0.18 * (1 - orb / orbLimit);

  // B. 单向输能（非对称，尊贵差驱动）—— 这一段才是「生」
  const diff = kA - kB;
  const strong = diff > 0 ? pa : pb;
  const weak = diff > 0 ? pb : pa;
  const amount = Math.abs(diff) * 0.5 * (1 - orb / orbLimit);

  return {
    pair: [pa.name, pb.name], orb: round(orb, 2),
    emphasis: { k: round(amp), note: '同度共处 ⇒ 可见度叠加（不是生）' },
    transfer: amount > 0.05 ? {
      from: strong.name, to: weak.name, amount: round(amount, 3),
      note: `尊贵差 ${round(Math.abs(diff), 2)} ⇒ 单向补给，这一段才是「生」式`,
    } : null,
    // 与八字对照：合相 ≈ 合/同柱；单向输能 ≈ 印
    baziAnalog: amount > 0.05 ? '合（位置）＋ 印（强弱悬殊时的单向补给）' : '合（位置）',
  };
}

/**
 * ★ 八字能量印证：把占星权重与八字同组能量对照
 * @param dynWeights [{planet, weights}]
 * @param baziEnergy {比劫,印,食伤,财,官杀} 归一后的八字五行-十神能量
 */
export function crossValidate(dynWeights, baziEnergy) {
  if (!Array.isArray(dynWeights) || !baziEnergy) return null;
  // 占星侧：把所有行星的权重加总归一
  const astro = {};
  for (const g of GROUPS) astro[g] = 0;
  for (const d of dynWeights) for (const g of GROUPS) astro[g] += d.weights[g] || 0;
  const aSum = GROUPS.reduce((a, g) => a + astro[g], 0) || 1;
  for (const g of GROUPS) astro[g] = round(astro[g] / aSum, 4);

  const bSum = GROUPS.reduce((a, g) => a + (baziEnergy[g] || 0), 0) || 1;
  const bazi = {};
  for (const g of GROUPS) bazi[g] = round((baziEnergy[g] || 0) / bSum, 4);

  // 余弦相似度 + 逐组差
  let dot = 0, na = 0, nb = 0;
  for (const g of GROUPS) { dot += astro[g] * bazi[g]; na += astro[g] ** 2; nb += bazi[g] ** 2; }
  const cos = na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;

  const rows = GROUPS.map((g) => ({
    group: g, astro: astro[g], bazi: bazi[g],
    delta: round(astro[g] - bazi[g], 4),
    agree: Math.abs(astro[g] - bazi[g]) < 0.08 ? '一致' : (astro[g] > bazi[g] ? '占星偏重' : '八字偏重'),
  }));

  return {
    astro, bazi, rows,
    cosine: round(cos, 4),
    verdict: cos > 0.95 ? '高度一致' : cos > 0.85 ? '大体一致' : cos > 0.7 ? '部分一致' : '不一致',
    note: '⚠️ 这不是"证明两套体系对应"。两者都由同一个 t 决定，一致性可能来自共同输入（结构性无解 I(A;B|t)=0）。此处只作**内部一致性**描述，不作外部验证。',
  };
}

export { GROUPS };
