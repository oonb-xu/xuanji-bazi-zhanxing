// 规则精细化挖掘（R-V3）：不是"等试通过"，而是**带参数、带对照、带显著性**的条件规则
//
// 每个维度都是**显式参数化**的（哪颗行星、什么相位、多少 orb、落哪宫、哪个五行/十神、阈值多少），
// 对每个维度同时给出：目标组命中率 / 对照组命中率 / lift / 两比例 z 检验 p / Bonferroni 校正后是否显著 / 样本量。
// 人工修正：输出的 Markdown 表带一列「人工裁定」留给你填，JSON 里对应字段是 null。
import { KEY_POINTS_ORDER, discordantPairs } from './dims.mjs';

const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) {                                    // Abramowitz-Stegun 7.1.26，精度 ~1e-7
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
/** 两比例 z 检验（双侧） */
export function twoProportionP(x1, n1, x2, n2) {
  if (!n1 || !n2) return 1;
  const p1 = x1 / n1, p2 = x2 / n2, p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  return 2 * (1 - normCdf(Math.abs((p1 - p2) / se)));
}

/**
 * 维度定义：全部参数化
 * @returns {Array<{key,group,name,params,pred}>}
 */
export function buildDimensions(fused) {
  const dims = [];
  const add = (key, group, name, params, pred) => dims.push({ key, group, name, params, pred });

  // 1) 相位：每一对行星 × 每一类不和谐相位（含 orb 分级）
  const pairSeen = new Map();
  for (const f of fused) for (const d of f.chart.discordant) {
    const k = `${d.a}|${d.b}|${d.type}`;
    if (!pairSeen.has(k)) pairSeen.set(k, { a: d.a, b: d.b, type: d.type });
  }
  for (const { a, b, type } of discordantPairs(fused).slice(0, 400)) {
    add(`asp:${a}-${b}-${type}`, '相位', `${a}${type}${b}`, { a, b, type, orb: 'any' },
      (x) => x.chart.discordant.some((d) => d.a === a && d.b === b && d.type === type));
    add(`asp:${a}-${b}-${type}:tight`, '相位(精度)', `${a}${type}${b}（orb≤2°）`, { a, b, type, orbMax: 2 },
      (x) => x.chart.discordant.some((d) => d.a === a && d.b === b && d.type === type && d.orb <= 2));
  }
  // 2) 不和谐相位总数分级
  for (const t of [3, 4, 5, 6, 8]) add(`cnt:discordant>=${t}`, '相位计数', `不和谐相位≥${t}`, { threshold: t }, (x) => x.chart.discordantCount >= t);
  // 3) 落宫 / 落座 / 尊贵
  for (const p of KEY_POINTS_ORDER) {
    for (let h = 1; h <= 12; h++) add(`house:${p}@${h}`, '落宫', `${p}落${h}宫`, { planet: p, house: h }, (x) => x.chart.houses[p] === h);
    for (const st of ['庙', '旺', '陷', '落']) add(`dig:${p}:${st}`, '尊贵', `${p}${st}`, { planet: p, state: st }, (x) => x.chart.dignity[p] === st);
    add(`ang:${p}:hard`, '轴相位(R-V6独立维度)', `${p}与上升或天顶成刑/冲`, { planet: p },
      (x) => (x.chart.angleContacts ?? []).some((c) => c.planet === p));
  }
  // 4) 八字：五行/身强/用忌/十神/夫妻宫/关系
  const WX = ['木', '火', '土', '金', '水'];
  for (const w of WX) {
    for (const t of [0, 1, 2, 3]) add(`wx:${w}>=${t}`, '八字五行', `五行${w}≥${t}`, { element: w, threshold: t }, (x) => (x.bazi.distribution?.[w] ?? 0) >= t);
    add(`wx:${w}=0`, '八字五行', `五行${w}缺（=0）`, { element: w, threshold: 0 }, (x) => (x.bazi.distribution?.[w] ?? 0) === 0);
  }
  add('bz:strong', '八字强弱', '身旺', {}, (x) => x.bazi.verdict === '身旺');
  add('bz:weak', '八字强弱', '身弱', {}, (x) => x.bazi.verdict === '身弱');
  for (const w of WX) {
    add(`bz:yong:${w}`, '八字用神', `用神为${w}`, { element: w }, (x) => x.bazi.yong === w);
    add(`bz:ji:${w}`, '八字忌神', `忌神为${w}`, { element: w }, (x) => x.bazi.ji === w);
  }
  const SHI_SHEN = ['正官', '七杀', '正财', '偏财', '正印', '偏印', '食神', '伤官', '比肩', '劫财'];
  for (const s of SHI_SHEN) for (const t of [1, 2, 3]) add(`ss:${s}>=${t}`, '八字十神', `十神${s}≥${t}`, { shiShen: s, threshold: t }, (x) => (x.bazi.shiShenCount?.[s] ?? 0) >= t);
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  for (const z of ZHI) add(`sp:${z}`, '八字夫妻宫', `夫妻宫（日支）为${z}`, { zhi: z }, (x) => x.bazi.spouseZhi === z);
  for (const [k, t] of [['冲', 1], ['刑', 1], ['合', 2], ['害', 1]]) add(`rel:${k}>=${t}`, '八字关系', `原局${k}≥${t}`, { type: k, threshold: t }, (x) => (x.bazi.relationCount?.[k] ?? 0) >= t);
  // 5) 交叉：星盘元素分布 × 八字用忌
  for (const e of ['火', '土', '风', '水']) add(`el:${e}>=3`, '星盘元素', `星盘${e}元素≥3`, { element: e }, (x) => (x.chart.elements?.[e] ?? 0) >= 3);
  for (const e of ['火', '土', '风', '水']) add(`el:miss-${e}`, '星盘元素', `星盘缺${e}元素`, { element: e }, (x) => (x.chart.elements?.[e] ?? 0) === 0);
  return dims;
}

/**
 * 挖掘：目标组 vs 对照组
 * @param target  fused 数组
 * @param control fused 数组
 */
export function mine(target, control, { minSupport = 3, minControl = 20 } = {}) {
  const dims = buildDimensions([...target, ...control].slice(0, 400));
  const rows = [];
  for (const d of dims) {
    let x1 = 0, x2 = 0;
    for (const f of target) { try { if (d.pred(f)) x1++; } catch { /* skip */ } }
    for (const f of control) { try { if (d.pred(f)) x2++; } catch { /* skip */ } }
    if (x1 < minSupport || x2 < minControl) continue;
    const p1 = x1 / target.length, p2 = x2 / control.length;
    const lift = p2 === 0 ? Infinity : p1 / p2;
    const p = twoProportionP(x1, target.length, x2, control.length);
    rows.push({
      key: d.key, group: d.group, name: d.name, params: d.params,
      targetSupport: x1, targetRate: round(p1), controlSupport: x2, controlRate: round(p2),
      lift: lift === Infinity ? 99 : round(lift), p: round(p, 6), verdict: null,
    });
  }
  rows.sort((a, b) => b.lift - a.lift);
  const m = rows.length;
  return rows.map((r) => ({ ...r, pBonferroni: round(Math.min(1, r.p * m), 6), significant: r.p * m < 0.05 }));
}

/** 标签驱动挖掘：以「离婚 / 多婚」等真实结果为目标 */
export function mineLabel(fused, labelKey, { minTarget = 30 } = {}) {
  const [tKey, pred] = {
    divorced: ['离婚', (f) => f.label?.divorced === true],
    'multi-marriage': ['多婚(≥2次)', (f) => (f.label?.marriages ?? 0) >= 2],
    never: ['未婚', (f) => f.label?.marriages === 0],
    // 本轮"换标签"新增：两者都有可用对比度
    stable: ['无离婚(婚姻存续)', (f) => f.label?.stable === true],
    arranged: ['包办婚姻', (f) => f.label?.arranged === true],
  }[labelKey] ?? [];
  if (!pred) throw new Error(`未知标签目标：${labelKey}`);
  const target = fused.filter(pred);
  const control = fused.filter((f) => !pred(f) && f.label);
  if (target.length < minTarget) return { target: tKey, targetN: target.length, controlN: control.length, rows: [], note: `目标组仅 ${target.length} 条，不足 ${minTarget}` };
  return { target: tKey, targetN: target.length, controlN: control.length, rows: mine(target, control, { minSupport: 5, minControl: 50 }) };
}

export function renderRuleTable(mined, { title, targetN, controlN, top = 40 }) {
  const L = [];
  L.push(`### ${title}`);
  L.push(`目标组 **${targetN}** 盘 / 对照组 **${controlN}** 盘｜共检验 **${mined.length}** 个参数化维度，Bonferroni 校正（p×${mined.length}）<0.05 才算显著`);
  L.push('');
  L.push('| 维度(参数) | 组 | 目标命中 | 对照命中 | 命中率 | 对照率 | lift | p | 校正后显著 | **人工裁定** |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of mined.slice(0, top)) {
    L.push(`| ${r.name} | ${r.group} | ${r.targetSupport} | ${r.controlSupport} | ${(r.targetRate * 100).toFixed(1)}% | ${(r.controlRate * 100).toFixed(1)}% | **${r.lift}** | ${r.p} | ${r.significant ? '✓' : '—'} |  |`);
  }
  if (mined.length > top) L.push(`\n（仅列 lift 前 ${top} 条，全量见 JSON）`);
  return L.join('\n');
}

const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
