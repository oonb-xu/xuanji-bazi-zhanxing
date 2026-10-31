// 挖掘用维度辅助：行星顺序 + 从数据里出现过的相位对（避免穷举 400 个无样本组合）
export const KEY_POINTS_ORDER = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];

/** 从 fused 集合里实际出现过的「行星对 + 不和谐相位类型」，按出现次数降序 */
export function discordantPairs(fused) {
  const counts = new Map();
  for (const f of fused) for (const d of f.chart?.discordant ?? []) {
    const k = `${d.a}|${d.b}|${d.type}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => { const [a, b, type] = k.split('|'); return { a, b, type }; });
}
