// 双体系独立推理：占星侧与八字侧**各自独立**给出判断，再比对摩擦
//
// 用户的三个要求在这里落实：
//   ① 独立运行 —— 两个模型互不引用对方的数据，各自只用自己体系的输入；
//   ② 分别分析 —— 每个体系的判断与真实标签各自统计（见 cli-dual.mjs）；
//   ③ 检查矛盾摩擦 —— compare() 找出「一吉一凶」的盘，单独看这一群的结果分布。
//
// 所有参数都是**显式**的（哪个点、哪种相位、多少分），便于人工裁定修改（R-V7）。
// 口径统一遵守 R-V6（主流西方占星：只看托勒密主相位）。

/* ══════════ 占星侧（主流西方占星：婚姻结构） ══════════ */
/** 参数表：可调，权重写明依据，便于人工改 */
export const ASTRO_W = {
  金星_凶相位_外行星: -2.0,      // 金星 与 土/天/海/冥 的 冲或刑：关系受压（主流解读）
  金星_合相_外行星: -1.0,        // 合相：强度大但方向需分星
  月亮_凶相位_外行星: -1.5,      // 月亮 与 土/天 的 冲或刑：情绪供给受损
  金星_吉相位_木星月亮: 1.5,     // 金星 与 木/月 的 合/三分/六分
  金星_七宫: 1.5,                // 金星落 7 宫：婚姻主题突出
  月亮_七宫: 1.0,
  太阳_七宫: 1.0,
  金星_庙旺: 1.5,
  金星_陷落: -1.5,
  轴_金星硬相位: -1.0,           // 上升/天顶 与 金星 成 冲/刑
  七宫主_凶相位: -1.0,           // 7 宫头星座的主星与土星成硬相位
};

const HARD = new Set(['对冲', '四分相']);
const SOFT = new Set(['合相', '三分相', '六分相']);
const hasAsp = (idx, a, b, types) => idx.some((s) => {
  const [x, y, t] = s.split('|');
  return types.has(t) && ((x === a && y === b) || (x === b && y === a));
});

/** 占星侧独立判断：只吃星盘特征 */
export function astroSignal(chart) {
  const W = ASTRO_W, reasons = [];
  const idx = chart.aspectIndex ?? [];
  const dig = chart.dignity ?? {}, hs = chart.houses ?? {};
  let s = 0;
  const add = (v, why) => { if (v !== 0) { s += v; reasons.push(`${why} ${v > 0 ? '+' : ''}${v}`); } };

  for (const p of ['土星', '天王星', '海王星', '冥王星']) {
    if (hasAsp(idx, '金星', p, HARD)) add(W.金星_凶相位_外行星, `金星${p === '土星' ? '刑/冲土星' : `与${p}硬相位`}`);
    else if (hasAsp(idx, '金星', p, new Set(['合相']))) add(W.金星_合相_外行星, `金星合${p}`);
  }
  for (const p of ['土星', '天王星']) if (hasAsp(idx, '月亮', p, HARD)) add(W.月亮_凶相位_外行星, `月亮与${p}硬相位`);
  for (const p of ['木星']) if (hasAsp(idx, '金星', p, SOFT)) add(W.金星_吉相位_木星月亮, `金星与${p}吉相位`);
  if (hasAsp(idx, '金星', '月亮', SOFT)) add(W.金星_吉相位_木星月亮, '金星月亮吉相位');
  for (const [p, w] of [['金星', W.金星_七宫], ['月亮', W.月亮_七宫], ['太阳', W.太阳_七宫]]) if (hs[p] === 7) add(w, `${p}落7宫`);
  if (dig['金星'] === '庙' || dig['金星'] === '旺') add(W.金星_庙旺, `金星${dig['金星']}`);
  if (dig['金星'] === '陷' || dig['金星'] === '落') add(W.金星_陷落, `金星${dig['金星']}`);
  for (const [a, v] of Object.entries(chart.angleContacts ?? [])) void a;   // 保留占位：轴相位单独计
  for (const c of chart.angleContacts ?? []) if (c.planet === '金星') add(W.轴_金星硬相位, `金星与${c.angle}硬相位`);

  return { system: '占星', score: round(s), verdict: s >= 1.5 ? '吉' : s <= -1.5 ? '凶' : '中', reasons };
}

/* ══════════ 八字侧（夫妻宫 / 财官 / 用忌） ══════════ */
export const BAZI_W = {
  夫妻宫_冲: -2.0, 夫妻宫_刑: -1.5, 夫妻宫_害: -1.0,
  夫妻宫_合: 1.0,
  夫妻宫_为忌神: -1.5, 夫妻宫_为用神: 1.5,
  配偶星_为用: 1.5, 配偶星_为忌: -1.5,
  配偶星_过多: -1.0,       // 财/官 ≥3：感情选择多但难专
  配偶星_缺: -1.0,         // 财/官 =0
  比劫_在夫妻宫: -0.8,     // 争夫/争妻
};

/** 八字侧独立判断：只吃八字特征（男看财、女看官杀） */
export function baziSignal(bazi, gender) {
  const W = BAZI_W, reasons = [];
  let s = 0;
  const add = (v, why) => { if (v !== 0) { s += v; reasons.push(`${why} ${v > 0 ? '+' : ''}${v}`); } };
  const types = bazi.spouseTypes ?? [];
  const rel = bazi.relationCount ?? {};
  const spouseZhi = bazi.spouseZhi;
  const wxOfZhi = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };

  // 夫妻宫（日支）本身的关系与用忌
  const spouseWx = wxOfZhi[spouseZhi];
  if (bazi.yong === spouseWx) add(W.夫妻宫_为用神, `夫妻宫${spouseZhi}(${spouseWx})为用神`);
  if (bazi.ji === spouseWx) add(W.夫妻宫_为忌神, `夫妻宫${spouseZhi}(${spouseWx})为忌神`);
  if (types.includes('冲')) add(W.夫妻宫_冲, '夫妻宫被冲');
  if (types.includes('刑')) add(W.夫妻宫_刑, '夫妻宫被刑');
  if (types.includes('害')) add(W.夫妻宫_害, '夫妻宫被害');
  if (types.includes('合')) add(W.夫妻宫_合, '夫妻宫被合');
  if ((rel.冲 ?? 0) > 0 && !types.includes('冲')) add(W.夫妻宫_冲 * 0.5, `原局有冲(${rel.冲})`);
  // 配偶星：男财、女官杀
  const star = gender === '女' ? ['正官', '七杀'] : ['正财', '偏财'];
  const cnt = star.reduce((a, k) => a + (bazi.shiShenCount?.[k] ?? 0), 0);
  const starWx = gender === '女' ? { 正官: null, 七杀: null } : null; void starWx;
  if (cnt >= 3) add(W.配偶星_过多, `配偶星(${star.join('/')})共${cnt}`);
  else if (cnt === 0) add(W.配偶星_缺, `配偶星(${star.join('/')})缺`);
  else {
    // 有配偶星时看它与用忌的关系（用十神所属五行的近似：直接用其力量归属判断）
    const strongEnough = cnt >= 1;
    if (strongEnough) add(W.配偶星_为用 * 0.5, `配偶星出现${cnt}次`);
  }
  if (types.includes('比劫')) add(W.比劫_在夫妻宫, '夫妻宫见比劫');

  return { system: '八字', score: round(s), verdict: s >= 1.5 ? '吉' : s <= -1.5 ? '凶' : '中', reasons };
}

/* ══════════ 摩擦比对 ══════════ */
/** 一致 / 矛盾 / 中性；矛盾＝两侧方向相反且都不中性 */
export function compareSignals(a, b) {
  const dir = (v) => (v === '吉' ? 1 : v === '凶' ? -1 : 0);
  const da = dir(a.verdict), db = dir(b.verdict);
  let relation;
  if (da === 0 || db === 0) relation = da === db ? '双中性' : '单侧中性';
  else relation = da === db ? '一致' : '矛盾';
  return { relation, astro: a.verdict, bazi: b.verdict, astroScore: a.score, baziScore: b.score, gap: round(Math.abs(a.score - b.score)) };
}

/** 对一个融合记录做双体系独立推理 */
export function dualInfer(fused, gender) {
  const a = astroSignal(fused.chart);
  const b = baziSignal(fused.bazi, gender ?? fused.gender);
  return { id: fused.id, astro: a, bazi: b, cmp: compareSignals(a, b), label: fused.label ?? null };
}

const round = (x) => Math.round(x * 1000) / 1000;
