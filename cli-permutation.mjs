#!/usr/bin/env node
// 置换检验（Permutation Test）：刑/冲相位 与 两端五行相克 的关联是否为真信号
//   node cli-permutation.mjs --run [--charts 500] [--perms 1000]
//
// ★ 零模型（R-C4，必须在正确层级构造）：
//   占星侧的**角度已锁定宫位偏移**（对冲 ⇒ 宫位差 6、四分相 ⇒ 差 3），而五行由宫位决定，
//   所以"克比例"本就由几何决定 ⇒ **不能**拿"随机两个五行"（40%）当零假设。
//   正确的零模型 = **打乱「行星 ↔ 黄经（宫位）」的对应**，保持：
//     · 每张盘的**相位结构**（哪些星成刑/冲）不变
//     · 每张盘**所占宫位的集合**不变
//   只破坏"哪颗星落在哪个宫" ⇒ 若占星信息为真，观测克率应**显著高于**该零分布。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicRelation, wuxingOfLon, impliedOfType } from './src/cross/topology.mjs';
import { loadVedastro } from './src/vedastro/adapter.mjs';
import { computeNatal } from './src/western/natal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'data', 'cross', 'permutation.json');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** R-V6 口径：不和谐相位只算 对冲/四分相，两端都必须是十大行星（轴点/交点不计入） */
export const TEN_PLANETS = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
export const isHard = (type) => type === '对冲' || type === '四分相';

/** 由一张星盘提取「刑/冲 边」的端点黄经（打成平铺数组，供置换使用） */
export function hardEdgeLongitudes(chart) {
  const flat = [];
  const edges = [];
  for (const asp of chart?.aspects ?? []) {
    if (!isHard(asp.type)) continue;
    if (!TEN_PLANETS.includes(asp.a) || !TEN_PLANETS.includes(asp.b)) continue;
    const A = chart.planets?.[asp.a], B = chart.planets?.[asp.b];
    if (!A || !B || A.lon === undefined || B.lon === undefined) continue;
    edges.push([flat.length, flat.length + 1]);
    flat.push(A.lon, B.lon);
  }
  return { flat, edges };
}

/** 克比例（给定端点黄经与配对） */
export function keRate(flat, edges) {
  if (!edges.length) return null;
  let h = 0;
  for (const [i, j] of edges) if (canonicRelation(wuxingOfLon(flat[i]), wuxingOfLon(flat[j])).rel === '克') h++;
  return h / edges.length;
}

/** Fisher–Yates（就地，可注入随机源以便复算） */
function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 置换检验主函数（纯函数，可复算：传入固定 rnd） */
export function permutationTest(charts, { perms = 1000, rnd = Math.random } = {}) {
  const allFlat = [], allEdges = [];
  for (const c of charts) { allEdges.push(...c.edges); const base = allFlat.length; for (const [i, j] of c.edges) { /* 保留每盘结构 */ } }
  // 按盘分别置换（保持"每盘所占宫位集合"不变）
  const obs = (() => { let h = 0, n = 0; for (const c of charts) { const r = keRate(c.flat, c.edges); if (r !== null) { h += r * c.edges.length; n += c.edges.length; } } return n ? h / n : null; })();
  let ge = 0, sum = 0, sq = 0;
  const nullRates = [];
  for (let t = 0; t < perms; t++) {
    let h = 0, n = 0;
    for (const c of charts) {
      const shuffled = shuffle([...c.flat], rnd);          // ★ 打乱「行星 ↔ 黄经」对应
      const r = keRate(shuffled, c.edges);
      if (r !== null) { h += r * c.edges.length; n += c.edges.length; }
    }
    const rate = n ? h / n : null;
    nullRates.push(rate);
    if (rate >= obs) ge++;
    sum += rate; sq += rate * rate;
  }
  const mu = sum / perms, sd = Math.sqrt(Math.max(0, sq / perms - mu * mu));
  return {
    observed: obs, nEdges: charts.reduce((a, c) => a + c.edges.length, 0), nCharts: charts.length,
    perms, nullMean: mu, nullSd: sd,
    pOneSided: (ge + 1) / (perms + 1),                       // 加一修正，避免 p=0
    z: sd > 0 ? (obs - mu) / sd : 0,
    nullQuantiles: quantiles(nullRates),
  };
}
const quantiles = (a) => { const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { p2_5: q(0.025), p50: q(0.5), p97_5: q(0.975) }; };

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const wantCharts = arg('charts', 500), perms = arg('perms', 1000);
  const { records } = loadVedastro();
  const charts = [];
  let bad = 0;
  for (const r of records) {
    if (charts.length >= wantCharts) break;
    let ch;
    try { ch = computeNatal({ at: `${r.date} ${r.time || '12:00'}`, lng: r.lon, lat: r.lat, tz: r.offsetHours }); } catch { bad++; continue; }
    const e = hardEdgeLongitudes(ch);
    if (e.edges.length) charts.push(e);
  }
  const t0 = Date.now();
  const res = permutationTest(charts, { perms });
  const ms = Date.now() - t0;

  P('# 置换检验：刑/冲相位 × 两端五行相克');
  P('');
  P('## 零模型（R-C4：必须在正确层级构造）');
  P('');
  P('**打乱「行星 ↔ 黄经（宫位）」的对应**，保持每张盘的**相位结构**与**所占宫位集合**不变。');
  P('不采用"随机两个五行 = 40%"这一朴素基线 —— 因为**角度已锁定宫位偏移**（对冲差 6 宫、四分相差 3 宫）。');
  P('');
  P('| 项 | 值 |');
  P('|---|---|');
  P(`| 样本盘数 | **${res.nCharts}**（解析失败 ${bad}） |`);
  P(`| 刑/冲边数（R-V6 口径：仅对冲/四分相 × 十大行星） | **${res.nEdges}** |`);
  P(`| 置换次数 | **${res.perms}** |`);
  P(`| 耗时 | ${(ms / 1000).toFixed(1)}s |`);
  P('');
  P('## 结果');
  P('');
  P('| 项 | 值 |');
  P('|---|---|');
  P(`| **观测克比例** | **${(res.observed * 100).toFixed(3)}%** |`);
  P(`| 零分布均值 | ${(res.nullMean * 100).toFixed(3)}% |`);
  P(`| 零分布标准差 | ${(res.nullSd * 100).toFixed(4)}% |`);
  P(`| **置换 P 值（单侧）** | **${res.pOneSided.toFixed(4)}** |`);
  P(`| 偏离零分布 z | **${res.z.toFixed(2)}** |`);
  P(`| 零分布 2.5% / 50% / 97.5% 分位 | ${(res.nullQuantiles.p2_5 * 100).toFixed(2)}% / ${(res.nullQuantiles.p50 * 100).toFixed(2)}% / ${(res.nullQuantiles.p97_5 * 100).toFixed(2)}% |`);
  P('');
  const sig = res.pOneSided < 0.05;
  P('## 判定（按你的执行标准）');
  P('');
  P(sig
    ? `**P = ${res.pOneSided.toFixed(4)} < 0.05 → 存在真实的「星盘结构张力」**（观测克率 ${(res.observed * 100).toFixed(2)}% 高于零分布）。`
    : `**P = ${res.pOneSided.toFixed(4)} > 0.05 → 这是几何噪声**：观测克率 ${(res.observed * 100).toFixed(2)}% 与零分布均值 ${(res.nullMean * 100).toFixed(2)}% 无显著差异。\n\n⇒ **该模块立刻降级为「几何验证器」**，不再作为命理信号源（按你的指令执行）。`);
  P('');
  P(`> 对比参考：朴素基线（随机两个五行相克）为 40.000%，`);
  P(`> 而**正确零模型**的均值为 ${(res.nullMean * 100).toFixed(3)}% —— 两者相差 ${Math.abs(res.nullMean * 100 - 40).toFixed(2)} 个百分点，`);
  P('> 这正是此前"z=3.80 假显著"的来源：**基线选错，不是信息**。');

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ meta: { ...res, sig, naiveBaseline: 0.4, verdict: sig ? 'real_structure_tension' : 'geometry_noise_downgrade_to_validator' } }, null, 1), 'utf8');
  console.error(`[置换结果已写入] ${OUT}`);

  const rp = argv[argv.indexOf('--report') + 1];
  if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
