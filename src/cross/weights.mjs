// 数据权重模型（用户要求「计算每个数据的权重」）
// 三条纪律：① 权重是**可复算的函数**，不是主观打分；② 因子各自有明确来源；③ 口径变更必须改本节注释与文档 R-E1
//
//   weight = 100 × S × E × C × I
//   S 来源可信度：规则表给定 1.00 / 引擎严格计算(可对拍) 0.95 / 引擎启发式(裁定项) 0.70 / 外部输入 0.55
//   E 证据强度  ：(支持数 + 1) / (支持 + 反例 + 2)   —— 无证据 = 0.50；3 支持 0 反例 = 0.80
//   C 一致性    ：与引擎对拍一致 1.00 / 冲突 0.35 / 不可对拍 0.75
//   I 影响面    ：该数据在 Part1–8 链条上被引用的次数 → 0.80 + 0.20×min(refs/5, 1)
//
// 说明：把「影响面 I」纳入乘积是刻意的——一条完全正确但无人引用的数据，对结论的价值低于
// 一条正确且被多处依赖的数据。若只想要"正确性"，读 `trust = 100×S×E×C` 这一列。

export const SOURCE_TIER = {
  人工裁定: 1.00,     // 架构师/用户的显式锁定（最高权威；派生值同时留痕）
  规则表: 1.00,       // 用户给定的规则表原文
  引擎严格: 0.95,     // 有唯一等式、可与第三方库对拍（四柱/藏干/十神/庙旺陷落/胎元…）
  引擎启发: 0.70,     // 规则表未给、由裁定补全（用神忌神/强弱阈值/涉害口径…）
  外部输入: 0.55,     // DB 自带但本引擎无法复算（紫微/大运评级/部分神煞）
};

/** 判定某条数据的来源层级 */
export function tierOf(item) {
  if (item.status === '人工锁定') return '人工裁定';
  if (item.status === '不可对拍') return '外部输入';
  if (/yongshen|jishen|strength|geju/.test(item.path)) return '引擎启发';
  return '引擎严格';
}

/** 影响面：该 path 被哪些 Part 依赖（静态依赖表，避免"看起来被引用"这种含糊说法） */
export const IMPACT_REFS = {
  'bazi_basic.day': ['Part1', 'Part2', 'Part3', 'Part4', 'Part5', 'Part6', 'Part8'],
  'bazi_basic.day_master': ['Part1', 'Part4'],
  'bazi_basic.year': ['Part2', 'Part3', 'Part4'],
  'bazi_basic.month': ['Part1', 'Part2', 'Part3', 'Part4'],
  'bazi_basic.hour': ['Part1', 'Part2', 'Part4'],
  'bazi_basic.strength': ['Part4', 'Part5', 'Part8'],
  'bazi_basic.yongshen.geshi': ['Part5', 'Part6', 'Part8'],
  'bazi_basic.jishen': ['Part5', 'Part6', 'Part8'],
  'bazi_relations.di_zhi_chong': ['Part5', 'Part6', 'Part8'],
  'tai_ming_shen.taiyuan': ['Part3', 'Part5', 'Part8'],
  'tai_ming_shen.minggong': ['Part3', 'Part5', 'Part8'],
  'tai_ming_shen.shengong': ['Part3', 'Part5', 'Part8'],
  'astro.月亮.dignity': ['Part5', 'Part8'],
  'astro.金星.dignity': ['Part5', 'Part8'],
  'astro.火星.dignity': ['Part5', 'Part8'],
  'astro.木星.dignity': ['Part5', 'Part8'],
};
const DEFAULT_REFS = 1;

export function impactOf(path) {
  const key = Object.keys(IMPACT_REFS).find((k) => path === k || path.startsWith(k + '.')) ?? Object.keys(IMPACT_REFS).find((k) => path.startsWith(k));
  const refs = key ? IMPACT_REFS[key].length : DEFAULT_REFS;
  return { refs, parts: key ? IMPACT_REFS[key] : [], I: 0.8 + 0.2 * Math.min(refs / 5, 1) };
}

/** 证据强度：来自映射库（6.7）与知识库（Part8）中同名 claims 的支持/反例计数 */
export function evidenceOf(path, claimText, lib) {
  const key = Object.entries(lib ?? {}).find(([, v]) => String(v).includes(String(claimText).slice(0, 6)));
  const sup = key?.[1]?.supportCount ?? 0;
  const con = key?.[1]?.contradictCount ?? 0;
  return { sup, con, E: (sup + 1) / (sup + con + 2) };
}

/**
 * 计算逐条权重
 * @param audit  auditDb() 的结果
 * @param libStats 映射库/知识库的统计（可空）
 */
export function computeWeights(audit, libStats = {}) {
  const rows = audit.items.map((it) => {
    const tier = tierOf(it);
    const S = SOURCE_TIER[tier];
    const { sup, con, E } = evidenceOf(it.path, it.claim, libStats);
    const C = it.status === '一致' ? 1.0 : it.status === '人工锁定' ? 1.0 : it.status === '冲突' ? 0.35 : 0.75;
    const { refs, parts, I } = impactOf(it.path);
    const trust = 100 * S * E * C;
    const w = 100 * S * E * C * I;
    return {
      path: it.path, claim: it.claim, engine: it.engine, status: it.status,
      tier, S, E, C, I, refs, parts, support: sup, contradict: con,
      trust: Math.round(trust * 10) / 10,
      weight: Math.round(w * 10) / 10,
      level: w >= 60 ? '高' : w >= 35 ? '中' : '低',
    };
  });
  const byLevel = rows.reduce((a, r) => ((a[r.level] = (a[r.level] ?? 0) + 1), a), {});
  const mean = rows.length ? rows.reduce((a, r) => a + r.weight, 0) / rows.length : 0;
  return {
    rows, byLevel,
    mean: Math.round(mean * 10) / 10,
    total: rows.length,
    top: [...rows].sort((a, b) => b.weight - a.weight).slice(0, 12),
    bottom: [...rows].sort((a, b) => a.weight - b.weight).slice(0, 12),
    conflicts: rows.filter((r) => r.status === '冲突'),
  };
}

export function renderWeights(W) {
  const L = [];
  L.push('');
  L.push('## 【数据权重表】');
  L.push(`- 口径：\`weight = 100 × S(来源) × E(证据) × C(一致性) × I(影响面)\`；\`trust = 100 × S × E × C\`（纯正确性）`);
  L.push(`- 数据项 ${W.total} 条｜均权 ${W.mean}｜高 ${W.byLevel.高 ?? 0} / 中 ${W.byLevel.中 ?? 0} / 低 ${W.byLevel.低 ?? 0}｜冲突 ${W.conflicts.length}`);
  L.push('');
  L.push('### 权重最低的 12 条（最该被质疑/被复核的数据）');
  L.push('| path | 声称 | 引擎 | 状态 | S | E | C | I | trust | weight |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of W.bottom) L.push(`| ${r.path} | ${String(r.claim).slice(0, 18)} | ${String(r.engine ?? '—').slice(0, 18)} | ${r.status} | ${r.S} | ${r.E.toFixed(2)} | ${r.C} | ${r.I.toFixed(2)} | ${r.trust} | **${r.weight}** |`);
  L.push('');
  L.push('### 权重最高的 12 条（可作为推演地基）');
  L.push('| path | 声称 | 状态 | trust | weight | 依赖 Part |');
  L.push('|---|---|---|---|---|---|');
  for (const r of W.top) L.push(`| ${r.path} | ${String(r.claim).slice(0, 24)} | ${r.status} | ${r.trust} | **${r.weight}** | ${r.parts.join('/')} |`);
  if (W.conflicts.length) {
    L.push('');
    L.push('### ⚠ 冲突项（必须人工裁定，禁止静默采信任一方）');
    for (const r of W.conflicts) L.push(`- ${r.path}：DB 声称「${r.claim}」 vs 引擎「${r.engine}」 → weight ${r.weight}`);
  }
  return L.join('\n');
}
