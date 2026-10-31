// 用户命题（2026-10-25）形式化：
//   ① 八字结论在星盘中有**多种表达形式**（一对多，不是一对一）
//   ② 行星 → 十神是「**基础类别 + 宫位修饰**」：
//      土星 base = 官杀；**只有落在重要宫位才"变味"为七杀**
//   ③ **行运层**：行星过境某宫 = 对应的大运性质（土星过境四宫 = 七杀大运）
//   ④ 行星**力量**由相位决定 → 对应十神的**力量大小**
//   ⑤ 天文层精度：占星 > 八字（占星对时刻精度要求更高）
//
// 本模块把 ①–④ 做成可计算函数，并检验 ③ 在时间尺度上是否自洽。

export const TEN_GOD_GROUPS = ['比劫', '印', '食伤', '财', '官杀'];

/** 行星 → 十神基础类别（用户指定土星=官杀；其余按传统性质）
 *  ⚠️ 这一层是**约定**（符号层），可争议；本模块的可检验部分在 ②③④ 的结构上。 */
export const PLANET_BASE = {
  太阳: { group: '比劫', note: '自我本体' },
  月亮: { group: '印', note: '滋养/接收' },
  水星: { group: '食伤', note: '思维/输出' },
  金星: { group: '财', note: '价值/结合' },
  火星: { group: '官杀', note: '攻击/冲突' },
  木星: { group: '印', note: '扩张/赐予' },
  土星: { group: '官杀', note: '限制/纪律' },   // ★ 用户指定
  天王星: { group: '食伤', note: '突变/破格' },
  海王星: { group: '印', note: '消融/迷离' },
  冥王星: { group: '官杀', note: '彻底转化' },
  凯龙: { group: '食伤', note: '创伤/表达' },
};

/** 重要宫位（角宫）—— 用户："只有落在重要宫位才变味"
 *  传统占星：1/4/7/10 为角宫，力量最强 */
export const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);
/** 续宫（次强）：2/5/8/11；果宫（最弱）：3/6/9/12 */
export const SUCCEDENT_HOUSES = new Set([2, 5, 8, 11]);

/**
 * ★ 行星 → 十神（**基础 + 宫位修饰**）
 * 官杀 会因落角宫而"变味"为 七杀（严酷那一支）；落果宫则偏 正官（温和/虚位）
 * 其余类别也按此逻辑给出"张力档"
 */
export function planetTenGod(planet, house) {
  const base = PLANET_BASE[planet];
  if (!base) return null;
  const g = base.group;
  const angular = ANGULAR_HOUSES.has(house);
  const succedent = SUCCEDENT_HOUSES.has(house);
  const mansion = angular ? '角宫(强)' : succedent ? '续宫(中)' : '果宫(弱)';

  // 变味规则（用户核心命题的推广）
  let label = g, tension = 'neutral', why = '';
  if (g === '官杀') {
    if (angular) { label = '七杀'; tension = 'harsh'; why = `官杀落${house}宫(角) ⇒ 变味七杀`; }
    else if (succedent) { label = '官杀'; tension = 'mixed'; why = `官杀落${house}宫(续) ⇒ 仍为官杀`; }
    else { label = '正官'; tension = 'mild'; why = `官杀落${house}宫(果) ⇒ 退为正官(虚位)`; }
  } else if (g === '印') {
    if (angular) { label = '偏印'; tension = 'mixed'; why = `印落${house}宫(角) ⇒ 偏印(重)`; }
    else label = '正印';
  } else if (g === '食伤') {
    if (angular) { label = '伤官'; tension = 'harsh'; why = `食伤落${house}宫(角) ⇒ 伤官(烈)`; }
    else label = '食神';
  } else if (g === '财') {
    if (angular) { label = '偏财'; tension = 'mixed'; why = `财落${house}宫(角) ⇒ 偏财(动)`; }
    else label = '正财';
  } else if (g === '比劫') {
    if (angular) { label = '劫财'; tension = 'mixed'; why = `比劫落${house}宫(角) ⇒ 劫财`; }
    else label = '比肩';
  }
  return { planet, house, mansion, group: g, label, tension, why, baseNote: base.note };
}

/**
 * ★ 力量大小（相位决定）—— 对应十神的"力量"
 * 用项目已有的相位语义：对冲/四分=压力(推高张力)，合=强化，三分/六分=顺畅(降低冲击)
 * 返回 strength ∈ [0,1] 与 polarity（压力型/顺遂型）
 */
export const ASPECT_FORCE = { 合相: 1.0, 对冲: 0.9, 四分相: 0.8, 三分相: 0.4, 六分相: 0.3 };
export function planetStrength(planet, aspects, { maxOrb = 8 } = {}) {
  const hits = (aspects ?? []).filter((a) => a.a === planet || a.b === planet);
  let pressure = 0, ease = 0, n = 0;
  for (const a of hits) {
    const f = ASPECT_FORCE[a.type];
    if (f === undefined) continue;
    const orb = Math.abs(a.orb ?? 0);
    const w = Math.max(0, 1 - orb / maxOrb);          // 越精确越强
    const v = f * w;
    if (a.type === '对冲' || a.type === '四分相' || a.type === '合相') pressure += v;
    else ease += v;
    n++;
  }
  const strength = Math.min(1, (pressure + ease) / 3);  // 归一（经验除数）
  return {
    planet, count: n, pressure: +pressure.toFixed(3), ease: +ease.toFixed(3),
    strength: +strength.toFixed(3),
    polarity: pressure > ease * 1.5 ? '压力型' : ease > pressure * 1.5 ? '顺遂型' : '混合',
  };
}

/** 由「宫位 + 相位」合成该行星在盘中的十神判定（用户的 ②+④ 合并） */
export function planetTenGodOf(chart, planet) {
  const p = chart?.planets?.[planet];
  if (!p) return null;
  const t = planetTenGod(planet, p.house);
  if (!t) return null;
  const s = planetStrength(planet, chart.aspects);
  return { ...t, ...s, combined: `${t.label}·${s.polarity}·力${s.strength}` };
}
