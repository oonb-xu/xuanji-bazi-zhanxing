#!/usr/bin/env node
// 耦合度逐项拆解（回答"每个细目的得分以及原因"）
//   node cli-coupling-breakdown.mjs --a "2000-01-01 12:00" --a-lon 104.06 --a-lat 30.67 \
//                                   --b "2008-07-04 16:45" --b-lon 105.05 --b-lat 29.58
//
// 耦合度 = Jaccard(关系多重集) × 长度惩罚
//   逐项拆解 = 每种关系（克/生/比和）在 A、B 各多少条边 → min(交集) / max(并集) → Σmin/Σmax
//   "原因" = 每条边具体由**哪两颗行星**产生
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { computeNatal } from './src/western/natal.mjs';
import { aspectTopology } from './src/cross/topology.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RELS = ['克', '生', '比和'];

/** 逐项拆解：返回每个关系类型的计数与 min/max，以及最终算术 */
export function breakdown(topA, topB) {
  const count = (t, r) => t.edges.filter((e) => e.rel === r).length;
  const rows = RELS.map((r) => {
    const a = count(topA, r), b = count(topB, r);
    return { rel: r, a, b, min: Math.min(a, b), max: Math.max(a, b), delta: b - a };
  });
  const nA = topA.edges.length, nB = topB.edges.length;
  const sumMin = rows.reduce((s, x) => s + x.min, 0);
  const sumMax = rows.reduce((s, x) => s + x.max, 0);
  const jaccard = sumMax ? sumMin / sumMax : null;
  const lenPenalty = 1 - Math.abs(nA - nB) / Math.max(nA, nB, 1);
  const score = jaccard === null ? null : jaccard * lenPenalty;
  return { rows, nA, nB, sumMin, sumMax, jaccard, lenPenalty, score: score === null ? null : Math.round(score * 1000) / 1000 };
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const A = arg('a', '2000-01-01 12:00'), B = arg('b', '2008-07-04 16:45');
  const lonA = Number(arg('a-lon', 104.06)), latA = Number(arg('a-lat', 30.67));
  const lonB = Number(arg('b-lon', 105.05)), latB = Number(arg('b-lat', 29.58));
  const orb = Number(arg('orb', 8));
  const L = [];
  const P = (s) => { console.log(s); L.push(s); };

  const chA = computeNatal({ at: A, lng: lonA, lat: latA, tz: 8 });
  const chB = computeNatal({ at: B, lng: lonB, lat: latB, tz: 8 });
  const tA = aspectTopology(chA, { maxOrb: orb });
  const tB = aspectTopology(chB, { maxOrb: orb });
  const bd = breakdown(tA, tB);

  P('# 结构耦合度 · 逐项拆解');
  P('');
  P(`A = ${A} @ (${lonA}, ${latA})｜B = ${B} @ (${lonB}, ${latB})｜容许度 ≤${orb}°｜只计 合(0°)/冲(180°)/刑(90°)（R-V6 口径）`);
  P('');
  P('## 一、算法（三步，可逐步复算）');
  P('');
  P('```');
  P('① 把每张盘的硬相位转成「关系多重集」：每条边的 rel ∈ {克, 生, 比和}');
  P('   克 = 两星所在宫位五行相克；生 = 相生；比和 = 同五行');
  P('② Jaccard = Σ min(A中该关系数, B中该关系数) / Σ max(…)');
  P('③ 长度惩罚 = 1 − |A边数 − B边数| / max(A边数, B边数)');
  P('   耦合度 = ② × ③');
  P('```');
  P('');
  P('## 二、逐项计数（这即是"细目得分"）');
  P('');
  P('| 关系 | A 中边数 | B 中边数 | min（交集） | max（并集） | 该类型对 Jaccard 的贡献 | 差异 |');
  P('|---|---|---|---|---|---|---|');
  for (const r of bd.rows) {
    const contrib = bd.sumMax ? (r.min / bd.sumMax) : 0;
    P(`| **${r.rel}** | ${r.a} | ${r.b} | **${r.min}** | ${r.max} | ${(contrib * 100).toFixed(1)}% | ${r.delta > 0 ? '+' : ''}${r.delta} |`);
  }
  P(`| **合计** | **${bd.nA}** | **${bd.nB}** | **${bd.sumMin}** | **${bd.sumMax}** | **100%** | ${bd.nB - bd.nA} |`);
  P('');
  P('## 三、最终算术');
  P('');
  P('| 步 | 算式 | 结果 |');
  P('|---|---|---|');
  P(`| ① Jaccard | ${bd.sumMin} ÷ ${bd.sumMax} | **${bd.jaccard?.toFixed(4)}** |`);
  P(`| ② 长度惩罚 | 1 − \\|${bd.nA} − ${bd.nB}\\| ÷ ${Math.max(bd.nA, bd.nB)} | **${bd.lenPenalty.toFixed(4)}** |`);
  P(`| ③ **耦合度** | ${bd.jaccard?.toFixed(4)} × ${bd.lenPenalty.toFixed(4)} | **${bd.score}** |`);
  P('');
  // 人群基线
  try {
    const j = JSON.parse(readFileSync(join(HERE, 'data', 'cross', 'coupling-null.json'), 'utf8')).meta;
    const z = j.sd ? (bd.score - j.mean) / j.sd : null;
    const pct = j.quantiles;
    let band = '高于 P75（人群上四分位之外）';
    if (bd.score <= pct.p25) band = '低于 P25（人群下四分位之外）';
    else if (bd.score <= pct.p75) band = '**落在 P25–P75 ⇒ 该指标对此对无区分力**（R-G10）';
    P('| 对照 | 值 |');
    P('|---|---|');
    P(`| 人群均值 ± sd | ${j.mean.toFixed(4)} ± ${j.sd.toFixed(4)}（${j.charts} 盘 × ${j.pairs} 随机对） |`);
    P(`| 人群分位 | P5 ${pct.p5}｜P25 ${pct.p25}｜P50 ${pct.p50}｜P75 ${pct.p75}｜P95 ${pct.p95} |`);
    P(`| **相对人群 z** | **${z === null ? '—' : z.toFixed(2)}** |`);
    P(`| 判定 | ${band} |`);
  } catch { P('> 人群基线缺失（先跑 `npm run coupling:null`）'); }
  P('');
  P('## 四、逐条原因（每条边由哪两颗行星产生）');
  P('');
  for (const [label, top, ch] of [['A', tA, chA], ['B', tB, chB]]) {
    P(`### ${label}：${ch.planets['上升'].sign}上升｜太阳${ch.planets['太阳'].sign}｜月亮${ch.planets['月亮'].sign}｜共 ${top.edges.length} 条边`);
    P('');
    for (const r of RELS) {
      const es = top.edges.filter((e) => e.rel === r);
      if (!es.length) { P(`- **${r}**：0 条`); continue; }
      P(`- **${r}**（${es.length} 条）：${es.map((e) => `${e.step}(${e.aspect}${e.orb}°,${e.from}${r}${e.to})`).join('；')}`);
    }
    P('');
  }
  P('## 五、必须声明的限制');
  P('');
  P('1. **该指标只测"两张盘的关系类型分布有多像"，不测关系质量** —— 没有任何验证过它与现实关系结局的关联（R-E12/R-W13）；');
  P('2. 它受**相位条数**影响：条数接近则长度惩罚≈1，故分数主要由 Jaccard 决定；');
  P('3. **落 P25–P75 中段时不得解读为任何倾向**（R-G10）；本对已给出 z 值，请据此判断而非看分数大小；');
  P('4. 状态 `hypothesis_under_validation`｜置信度上限 **0.6**｜**严禁吉凶断语**。');

  const rp = arg('report');
  if (rp) { const { writeFileSync, mkdirSync } = await import('node:fs'); mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
