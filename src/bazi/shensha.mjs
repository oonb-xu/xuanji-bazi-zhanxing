// 神煞体系 + 心理维度 + 占星印证
//
// ★ 用户命题（2026-10-27）：「试图融入神煞体系，并且分析神煞所代表的心理在八字测的印证」
//
// 设计：
//   ① 神煞查法（按传统口诀，只用日干/年支/三合局）
//   ② 每个神煞附「心理语义」（它描述的是什么心理倾向）
//   ③ 占星印证：每个神煞有一个「应出现在星盘哪里」的假设签名，
//      用盘面强度做收敛度打分 —— 这是**可检验的内部一致性**，不是外部验证。
//
// ⚠️ 纪律：神煞属符号层，置信度按经验类处理（≤0.6）。此处只做收敛度描述，不下吉凶。

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/* ══════════════════════════════════════════════
 *  ① 神煞定义：查法 + 心理语义 + 占星签名
 * ══════════════════════════════════════════════ */
export const SHENSHA = {
  天乙贵人: {
    psych: ['易获外援', '被善待的经验', '关键时刻有人扶'],
    axis: '依恋安全感 / 社会支持感',
    // 日干 → 地支
    byDayGan: { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['午', '寅'] },
    astro: { planets: ['木星', '金星'], houses: [2, 7, 11], note: '木星/金星的宫位强度' },
  },
  文昌: {
    psych: ['好学', '文字/表达欲', '以知识立身'],
    axis: '认知驱力',
    byDayGan: { 甲: ['巳'], 乙: ['午'], 丙: ['申'], 戊: ['申'], 丁: ['酉'], 己: ['酉'], 庚: ['亥'], 辛: ['子'], 壬: ['寅'], 癸: ['卯'] },
    astro: { planets: ['水星'], houses: [3, 9], note: '水星与三/九宫' },
  },
  桃花: {
    psych: ['吸引力', '审美好', '异性缘旺', '也易沉于情'],
    axis: '亲密与魅力',
    byGroup: { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' },
    astro: { planets: ['金星'], houses: [5, 7, 8], note: '金星 + 五/七/八宫' },
  },
  驿马: {
    psych: ['不安于位', '爱动', '迁移感强', '坐不住'],
    axis: '探索与流动',
    byGroup: { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' },
    astro: { planets: ['木星', '天王星'], houses: [3, 9], note: '木星/天王 + 三/九宫' },
  },
  华盖: {
    psych: ['孤高', '偏精神性', '艺术或宗教倾向', '享受独处'],
    axis: '独处与超越',
    byGroup: { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未' },
    astro: { planets: ['海王星', '土星'], houses: [12, 9], note: '海王/土星 + 十二/九宫' },
  },
  羊刃: {
    psych: ['刚烈', '不服输', '爆发力强', '也易过刚'],
    axis: '攻击性与自我边界',
    byDayGan: { 甲: ['卯'], 乙: ['辰'], 丙: ['午'], 丁: ['未'], 戊: ['午'], 己: ['未'], 庚: ['酉'], 辛: ['戌'], 壬: ['子'], 癸: ['丑'] },
    astro: { planets: ['火星', '冥王星'], houses: [1, 8], note: '火星/冥王 + 一/八宫' },
  },
  将星: {
    psych: ['统御欲', '担得起事', '天然带主导'],
    axis: '权力与责任',
    byGroup: { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 巳: '酉', 酉: '酉', 丑: '酉', 亥: '卯', 卯: '卯', 未: '卯' },
    astro: { planets: ['太阳', '火星'], houses: [1, 10], note: '太阳/火星 + 一/十宫' },
  },
  红鸾: {
    psych: ['情感来得早', '重视关系', '易被情感推动'],
    axis: '亲密需求',
    byYearZhi: { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' },
    astro: { planets: ['金星', '月亮'], houses: [5, 7], note: '金星/月亮 + 五/七宫' },
  },
  孤辰: {
    psych: ['内在孤独感', '不易被理解', '自处能力强'],
    axis: '孤独与自主',
    byYearZhi: { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' },
    astro: { planets: ['土星', '天王星'], houses: [12, 1], note: '土星/天王 + 十二/一宫' },
  },
  空亡: {
    psych: ['易感落空', '对"意义"敏感', '不执着于实'],
    axis: '虚与实的拉扯',
    byXunKong: true,
    astro: { planets: ['海王星'], houses: [12], note: '海王星 + 十二宫' },
  },
};

/* ══════════════════════════════════════════════
 *  ② 查神煞
 * ══════════════════════════════════════════════ */
function xunKongOf(dayGan, dayZhi) {
  // 旬空：按日柱所在旬，取该旬空亡的两个地支
  const gi = GAN.indexOf(dayGan), zi = ZHI.indexOf(dayZhi);
  if (gi < 0 || zi < 0) return [];
  // 该旬的起点：甲X
  const start = (zi - gi + 12) % 12;
  return [ZHI[(start + 10) % 12], ZHI[(start + 11) % 12]];
}

/**
 * @param pillars ['庚午','己卯','己卯','庚午'] 年/月/日/时
 * @returns [{name, hit: [{zhi, at}], psych, axis, astro}]
 */
export function findShenSha(pillars) {
  if (!Array.isArray(pillars) || pillars.length < 4) return [];
  const zhis = pillars.map((p) => p[1]);
  const [yearZhi, , dayZhi] = zhis;
  const dayGan = pillars[2][0];

  const out = [];
  for (const [name, def] of Object.entries(SHENSHA)) {
    const hit = [];
    let targets = [];
    if (def.byDayGan && def.byDayGan[dayGan]) targets = def.byDayGan[dayGan];
    else if (def.byGroup && def.byGroup[yearZhi]) targets = [def.byGroup[yearZhi]];
    else if (def.byYearZhi && def.byYearZhi[yearZhi]) targets = [def.byYearZhi[yearZhi]];
    else if (def.byXunKong) targets = xunKongOf(dayGan, dayZhi);

    if (targets.length) {
      zhis.forEach((z, i) => {
        if (targets.includes(z)) hit.push({ zhi: z, at: ['年支', '月支', '日支', '时支'][i] });
      });
    }
    out.push({
      name, hit,
      present: hit.length > 0,
      psych: def.psych, axis: def.axis, astro: def.astro,
      rule: def.byDayGan ? `日干${dayGan} → ${targets.join('/') || '—'}`
        : def.byGroup ? `年支${yearZhi}三合 → ${targets.join('/') || '—'}`
          : def.byYearZhi ? `年支${yearZhi} → ${targets.join('/') || '—'}`
            : def.byXunKong ? `日柱旬空 → ${targets.join('/') || '—'}` : '',
    });
  }
  return out;
}

/* ══════════════════════════════════════════════
 *  ③ 占星印证（收敛度）
 * ══════════════════════════════════════════════ */
/**
 * 给每个已出现的神煞，算它在星盘里「该出现的签名」有多强
 * @param shensha findShenSha 结果（只取 present 的）
 * @param planets 星盘行星（含 house）
 * @param ascLon  上升黄经（判角宫用 house 即可）
 */
export function astroSignature(shensha, planets) {
  const list = Array.isArray(planets)
    ? planets
    : Object.entries(planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);
  const ANG = new Set([1, 4, 7, 10]);

  return (shensha || []).filter((s) => s.present).map((s) => {
    const wantPlanets = s.astro.planets || [];
    const wantHouses = s.astro.houses || [];

    let score = 0, max = 0, detail = [];

    // 行星是否在「有关键宫位」或「有强状态」
    for (const pn of wantPlanets) {
      const p = list.find((x) => x.name === pn);
      if (!p) continue;
      max += 3;
      let s1 = 0;
      if (ANG.has(p.house)) { s1 += 2; detail.push(`${pn}落角宫`); }
      else if (p.house) { s1 += 0.6; detail.push(`${pn}落第${p.house}宫`); }
      if (wantHouses.includes(p.house)) { s1 += 1; detail.push(`${pn}落${p.house}宫(命中)`); }
      score += s1;
    }
    // 目标宫位是否有行星群（宫位强调）
    for (const h of wantHouses) {
      const inside = list.filter((p) => p.house === h && p.name !== '上升');
      if (inside.length >= 2) { score += 1; max += 1; detail.push(`第${h}宫有${inside.length}星`); }
    }

    const converge = max > 0 ? Math.min(1, score / max) : 0;
    return {
      name: s.name,
      hit: s.hit,
      psych: s.psych,
      axis: s.axis,
      astroWanted: s.astro.note,
      converge: Math.round(converge * 1000) / 1000,
      level: converge >= 0.66 ? '强收敛' : converge >= 0.34 ? '中收敛' : '弱收敛',
      detail,
      note: '这是「八字神煞 ⟷ 星盘签名」的内部一致性，不是外部验证；置信度 ≤0.6。',
    };
  });
}

/** 汇总：按收敛度排序，给出心理画像 */
export function psychologicalProfile(shensha, planets) {
  const rows = astroSignature(shensha, planets);
  const strong = rows.filter((r) => r.converge >= 0.66);
  return {
    rows: rows.sort((a, b) => b.converge - a.converge),
    strong,
    profile: strong.map((r) => `${r.name}（${r.axis}）`).join(' · ') || '无明显强收敛项',
    note: '强收敛 = 八字神煞的心理倾向在星盘上也有对应签名；不等于该倾向必然显现。',
  };
}

export { ZHI, GAN, xunKongOf };
