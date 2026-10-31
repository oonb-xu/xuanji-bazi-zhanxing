// 对应关系注册表：**每条对应都带置信度，低的直接丢弃，高的只作输出补充**
//
// 用户裁定（2026-10-25）：
//   「并非要求完全对应…占星对时间敏感度这么高，八字精确度本身就有限，这本身就没法完全对应」
//   「用时间日期探索对应度的思路本身就是荒谬的，更应该从具体事件去印证」
//   「你现在应该考虑对应关系的置信度问题，太低的抛弃，作为输出结果的补充」
//
// 设计原则：
//   1. **不追求完全对应**：每条对应只在自己能成立的条件下生效（condition）
//   2. **置信度来自证据类型**，不是来自"我觉得像"
//   3. **低于阈值一律丢弃**（不显示、不参与加权）
//   4. **只作补充**：输出中独立成块，不改动主结论
//
// 置信度分级（上限受 R-B13/R-G16 纪律约束：未经事件验证者 ≤0.6）
import fs from 'node:fs';
import path from 'node:path';
import { planetTenGod, planetStrength, ANGULAR_HOUSES, PLANET_BASE } from './ten-god-mapping.mjs';

/* ══════════ 证据类型的基础置信度 ══════════ */
export const EVIDENCE_BASE = {
  identity:    { base: 0.95, label: '恒等',   note: '两边编码同一个天文量，可机检复算' },
  structural:  { base: 0.60, label: '结构',   note: '形式规则可机检，但语义对应是约定' },
  textual:     { base: 0.40, label: '文献',   note: '有传统出处，但无观测验证' },
  empirical:   { base: 0.20, label: '经验',   note: '需事件标签；样本不足时只作先验' },
  coincidence: { base: 0.00, label: '巧合',   note: '结构互比产物，已被证伪（I(A;B|t)=0）' },
};

/* ══════════ 阈值 ══════════ */
export const THRESHOLD = {
  discard: 0.30,     // < 0.30 直接丢弃
  weak: 0.60,        // 0.30–0.60 弱补充（仅供参考）
  support: 0.90,     // 0.60–0.90 补充证据
  identity: 0.90,    // ≥ 0.90 恒等（可复算）
};

/* ══════════ 已登记的对应关系 ══════════ */
// 每条：id / 八字侧 / 星盘侧 / 证据类型 / 附加条件 / 备注
export const CORRESPONDENCES = [
  // ── 恒等型：真的同一个量 ──
  {
    id: 'ID-01',
    bazi: '月将（六壬用）/ 节气月柱边界',
    astro: '太阳黄经 λ☉',
    evidence: 'identity',
    validated: '项目机检 12/12 通过',
    condition: '六壬月将 ⇔ λ☉ 按 30° 分箱',
  },
  {
    id: 'ID-02',
    bazi: '月柱地支（节气月）',
    astro: '太阳所在星座（回归黄道）',
    evidence: 'identity',
    validated: '同 ID-01（节气即 λ☉ = 15°+30k 的时刻）',
    condition: '须用回归黄道，不用恒星黄道',
  },

  // ── 结构型：形式可机检，语义是约定 ──
  {
    id: 'ST-01',
    bazi: '官杀（克我）',
    astro: '土星',
    evidence: 'structural',
    validated: 'docs/32：本命土星角宫 ⇒ 七杀，两例结构吻合',
    condition: '基础映射；仅在"限制/约束"语义上成立',
  },
  {
    id: 'ST-02',
    bazi: '七杀（严酷之克）',
    astro: '土星落角宫（1/4/7/10）',
    evidence: 'structural',
    validated: 'docs/32 §3.1：7 宫→七杀、3 宫→正官',
    condition: '仅当 house ∈ {1,4,7,10}',
  },
  {
    id: 'ST-03',
    bazi: '正官（虚位之克）',
    astro: '土星落果宫（3/6/9/12）',
    evidence: 'structural',
    validated: 'docs/32 §3.1',
    condition: '仅当 house ∈ {3,6,9,12}',
  },
  {
    id: 'ST-04',
    bazi: '七杀的力量大小',
    astro: '土星的硬相位压力（对冲/四分/合，按 orb 衰减）',
    evidence: 'structural',
    validated: 'docs/32：宫位维与相位维是两个独立维度',
    condition: 'pressure > 0.4 才计入',
  },
  {
    id: 'ST-05',
    bazi: '官杀大运',
    astro: '土星过境第 4 宫（约 2.45 年窗口）',
    evidence: 'structural',
    validated: 'docs/32 §3.2：两例均落在官杀大运 10 年之内',
    condition: '窗口是大运内的**触发点**，非等价区间（尺度差 4.07 倍）',
  },
  {
    id: 'ST-06',
    bazi: '食伤（我生）',
    astro: '水星 / 天王星',
    evidence: 'structural',
    validated: '仅形式规则（角宫升格为伤官）',
    condition: '基础映射，弱于 ST-01',
  },
  {
    id: 'ST-07',
    bazi: '印（生我）',
    astro: '月亮 / 木星 / 海王星',
    evidence: 'structural',
    validated: '仅形式规则（角宫升格为偏印）',
    condition: '基础映射，弱于 ST-01',
  },
  {
    id: 'ST-08',
    bazi: '财（我克）',
    astro: '金星',
    evidence: 'structural',
    validated: '仅形式规则',
    condition: '基础映射',
  },
  {
    id: 'ST-09',
    bazi: '比劫（同我）',
    astro: '太阳',
    evidence: 'structural',
    validated: '仅形式规则',
    condition: '基础映射',
  },

  // ── 文献型：有出处但无验证 ──
  {
    id: 'TX-01',
    bazi: '12 地支',
    astro: '木星约 12 年周期',
    evidence: 'textual',
    validated: '学界较公认，但误差 1.1%（0.14 年/周期）',
    condition: '只能作"量级参考"，不参与精确推理',
  },
  {
    id: 'TX-02',
    bazi: '60 甲子',
    astro: '3 × 木土会合（59.58 年）',
    evidence: 'textual',
    validated: '本次计算：误差 0.7%，优于 5×木星（1.1%）',
    condition: '近似非恒等，累积会漂移',
  },

  // ── 巧合型：已被证伪，保留记录以防重犯 ──
  {
    id: 'CO-01',
    bazi: '八字冲的数量',
    astro: '四轴相位 / 太阳近四轴',
    evidence: 'coincidence',
    validated: 'docs/33–34：几何恒等 + 共同输入，I(A;B|t)=0',
    condition: '**永久禁用**',
  },
];

/* ══════════ 置信度计算 ══════════ */
/**
 * 最终置信 = 证据基础分 × 验证加成 × 条件满足度
 * 纪律：未经事件验证的 ≤ 0.6（R-B13/R-G16）
 */
export function confidenceOf(entry, ctx = {}) {
  const e = EVIDENCE_BASE[entry.evidence] ?? EVIDENCE_BASE.coincidence;
  let c = e.base;
  // 已机检验证：小幅加成。**上限分证据类型**——恒等类可到 1.0，其余封顶 0.6（R-B13 纪律）
  const cap = entry.evidence === 'identity' ? 1.0 : 0.6;
  if (entry.validated && /机检|12\/12|两例|实测/.test(entry.validated)) c = Math.min(cap, c * 1.05 + 0.02);
  // 条件未满足 ⇒ 归零
  if (ctx.conditionSatisfied === false) c = 0;
  // 未验证的证据类型封顶
  if (entry.evidence !== 'identity') c = Math.min(c, 0.6);
  return Math.round(c * 1000) / 1000;
}

export function tierOf(c) {
  if (c < THRESHOLD.discard) return { tier: 'discard', label: '丢弃', show: false };
  if (c < THRESHOLD.weak) return { tier: 'weak', label: '弱补充', show: true };
  if (c < THRESHOLD.support) return { tier: 'support', label: '补充证据', show: true };
  return { tier: 'identity', label: '恒等', show: true };
}

/* ══════════ 即时评估：给定八字结果 + 星盘，产出补充证据 ══════════ */
const GAN_WX_L = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };

/** 兼容两种星盘形状：computeNatal 给「按名索引的对象」，apiNatal 给「数组（含 name 字段）」 */
function normalizePlanets(chart) {
  const p = chart?.planets;
  if (!p) return {};
  if (Array.isArray(p)) {
    const o = {};
    for (const x of p) if (x?.name) o[x.name] = x;
    return o;
  }
  return p;
}

export function buildSupplement(baziResult, astroChart) {
  const out = [];
  const PLANETS = normalizePlanets(astroChart);
  const push = (entry, ctx, detail) => {
    const c = confidenceOf(entry, ctx);
    const t = tierOf(c);
    if (!t.show) return;
    out.push({ id: entry.id, bazi: entry.bazi, astro: entry.astro, confidence: c, tier: t.tier, tierLabel: t.label, detail, evidence: EVIDENCE_BASE[entry.evidence].label });
  };

  // ── ST-02 / ST-03：土星宫位 → 七杀 / 正官 ──
  const sat = PLANETS['土星'];
  if (sat?.house) {
    const tg = planetTenGod('土星', sat.house);
    const entry = tg.label === '七杀' ? CORRESPONDENCES.find((x) => x.id === 'ST-02')
      : tg.label === '正官' ? CORRESPONDENCES.find((x) => x.id === 'ST-03')
        : CORRESPONDENCES.find((x) => x.id === 'ST-01');
    if (entry) push(entry, { conditionSatisfied: true }, `本命土星 第${sat.house}宫（${tg.mansion}）⇒ ${tg.label}`);
  }

  // ── ST-04：土星相位力量 ──
  const ss = planetStrength('土星', astroChart?.aspects);
  if (ss) {
    const e = CORRESPONDENCES.find((x) => x.id === 'ST-04');
    push(e, { conditionSatisfied: ss.pressure > 0.4 }, `土星硬相位压力 ${ss.pressure}（${ss.polarity}）`);
  }

  // ── ID-01/02：月柱 ⇔ 太阳黄经（恒等，直接给） ──
  const sun = PLANETS['太阳'] || PLANETS['太阳'] || (Array.isArray(astroChart?.planets) ? astroChart.planets.find((x) => x.name === '太阳') : null);
  const monthZhi = baziResult?.pillars?.[1]?.[1];
  if (sun && monthZhi) {
    push(CORRESPONDENCES.find((x) => x.id === 'ID-02'), { conditionSatisfied: true },
      `月支 ${monthZhi} ⇔ 太阳 ${sun.sign} ${sun.deg}°（同为节气划分）`);
  }

  // 按置信度降序
  out.sort((a, b) => b.confidence - a.confidence);

  const sum = out.reduce((a, x) => a + x.confidence, 0);
  // 总置信不叠加成"结论强度"：取最大值 + 计数（避免证据堆叠假象）
  const maxC = out.length ? out[0].confidence : 0;
  return {
    items: out,
    count: out.length,
    maxConfidence: maxC,
    totalConfidence: Math.round(sum * 1000) / 1000,
    display: out.length ? `${out.length} 条 · 最高置信 ${maxC}` : '无可用的对应关系（全部低于丢弃阈值）',
    disclaimer: '以上为**补充参考**，按证据类型给出置信度；最高不超过 0.6（未经事件验证）。它们不改变主结论，也不构成预测。',
  };
}

export function registrySummary() {
  const rows = CORRESPONDENCES.map((e) => {
    const c = confidenceOf(e, {});
    const t = tierOf(c);
    return { id: e.id, evidence: EVIDENCE_BASE[e.evidence].label, bazi: e.bazi, astro: e.astro, confidence: c, tier: t.label, validated: e.validated };
  });
  const byTier = {};
  for (const r of rows) byTier[r.tier] = (byTier[r.tier] ?? 0) + 1;
  return { total: rows.length, byTier, rows: rows.sort((a, b) => b.confidence - a.confidence) };
}
