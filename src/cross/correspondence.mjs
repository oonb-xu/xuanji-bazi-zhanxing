// 八字十神 ↔ 星盘行星 对应（Part 8.1.1 的底层度量）
// 独立成模块：避免 discovery.mjs（6.7.4 第三问）与 db-discovery.mjs 之间形成循环依赖
import { GAN_WU_XING } from '../bazi/constants.mjs';
import { PLANET_TO_SHISHEN, normalizeAstro } from './calibration.mjs';
import { dignityOf } from '../western/dignity.mjs';

const SHI_SHEN_GROUPS = {
  食伤: ['食神', '伤官'], 印星: ['正印', '偏印'], 财星: ['正财', '偏财'],
  比劫: ['比肩', '劫财'], 官杀: ['正官', '七杀'], 羊刃: ['劫财'],
  七杀: ['七杀'], 正官: ['正官'], 偏财: ['偏财'], 偏印: ['偏印'],
  日主: ['日主'], 命宫: [], 身宫: [],
};
const POSITION_KEYS = ['年柱', '月柱', '日柱', '时柱'];

/** 十神权重表：天干各 1.0 + 藏干带权重 */
export function shiShenWeights(bazi) {
  const w = {};
  for (const g of bazi.L1_gan) { if (g.shiShen === '日主') continue; w[g.shiShen] = (w[g.shiShen] ?? 0) + 1.0; }
  for (const z of bazi.L1_zhi) for (const h of z.hide) w[h.shiShen] = (w[h.shiShen] ?? 0) + h.weight;
  return w;
}
/** 柱权重（干 1.0 + 藏干权重和） */
export function pillarWeight(bazi, i) {
  return 1.0 + bazi.L1_zhi[i].hide.reduce((a, h) => a + h.weight, 0);
}
function resolveGroup(token, bazi, w) {
  const t = token.trim();
  if (!t) return null;
  if (SHI_SHEN_GROUPS[t]) {
    const names = SHI_SHEN_GROUPS[t];
    if (t === '命宫') return { kind: 'position', label: '命宫', value: pillarWeight(bazi, 1) * 0.5, note: '以月柱近似度量' };
    if (t === '身宫') return { kind: 'position', label: '身宫', value: pillarWeight(bazi, 3) * 0.5, note: '以时柱近似度量' };
    if (t === '日主') return { kind: 'self', label: '日主', value: bazi.L3_distribution.adjusted[GAN_WU_XING[bazi.dayMaster]], note: '本体' };
    if (!names.length) return null;
    const value = names.reduce((a, n) => a + (w[n] ?? 0), 0);
    return { kind: 'shishen', label: t, value: Math.round(value * 100) / 100, members: names };
  }
  if (t === '用神' || t === '通关用神') return { kind: 'wuxing', label: '用神', value: bazi.L3_distribution.adjusted[bazi.L5_yongJi.yong], wx: bazi.L5_yongJi.yong };
  if (t === '忌神' || t === '业力') return { kind: 'wuxing', label: '忌神', value: bazi.L3_distribution.adjusted[bazi.L5_yongJi.ji], wx: bazi.L5_yongJi.ji };
  if (POSITION_KEYS.includes(t)) return { kind: 'position', label: t, value: pillarWeight(bazi, POSITION_KEYS.indexOf(t)) };
  if (t === '财帛') return resolveGroup('财星', bazi, w);
  if (t === '兄弟') return resolveGroup('比劫', bazi, w);
  return { kind: 'unknown', label: t, value: 0 };
}

/**
 * 一致性判据（裁定 R-D12）：十神侧强弱 × 行星庙旺陷落，同号 → 共振，反号 → 背离
 */
export function correspondences(bazi, astroInput) {
  const A = astroInput?.planets ? normalizeAstro(astroInput) : null;
  const w = shiShenWeights(bazi);
  const vals = Object.values(w);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const level = (v) => (v >= mean * 1.2 ? '强' : v <= mean * 0.6 ? '弱' : '中');

  const rows = [];
  for (const [planet, info] of Object.entries(PLANET_TO_SHISHEN)) {
    const p = A?.planets?.[planet];
    const tokens = String(info.shiShen).split('/').map((s) => s.trim()).filter(Boolean);
    const groups = tokens.map((t) => resolveGroup(t, bazi, w)).filter(Boolean);
    const measured = groups.filter((g) => g.kind !== 'unknown');
    const shiVal = measured.length ? Math.max(...measured.map((g) => g.value)) : null;
    const dig = p?.sign ? dignityOf(planet, p.sign) : null;
    let verdict = '不可比';
    if (shiVal !== null && dig) {
      const sl = level(shiVal);
      const dl = dig.score > 0 ? '强' : dig.score < 0 ? '弱' : '中';
      verdict = sl === dl ? '共振' : (sl === '中' || dl === '中' ? '中性' : '背离');
    }
    rows.push({
      planet, shiShen: info.shiShen, meaning: info.mean,
      groups: measured.map((g) => ({ label: g.label, kind: g.kind, value: g.value, note: g.note ?? null, members: g.members ?? null })),
      shiShenValue: shiVal, shiShenLevel: shiVal === null ? null : level(shiVal),
      sign: p?.sign ?? null, house: p?.house ?? null,
      dignity: dig?.state ?? null, dignityScore: dig?.score ?? null, dignityDisputed: dig?.disputed ?? false,
      verdict,
    });
  }
  const comparable = rows.filter((r) => r.verdict !== '不可比');
  return {
    rows,
    meta: {
      shiShenWeights: w, mean: Math.round(mean * 100) / 100, hasAstro: !!A,
      syncCount: rows.filter((r) => r.verdict === '共振').length,
      divergeCount: rows.filter((r) => r.verdict === '背离').length,
      comparable: comparable.length,
    },
  };
}
