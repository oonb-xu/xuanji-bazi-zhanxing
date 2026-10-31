#!/usr/bin/env node
// 两两耦合度经验分布（R-G9）：用真人盘建"人群基线"，替代错误的"从一方边缘分布重采样"
//   node cli-coupling-null.mjs --run [--charts 800] [--pairs 200000]
//
// 为什么需要：实测 CASE-001 夫妇耦合度 0.571，而旧零模型（从甲的边缘分布重采样）给 0.819 ⇒ z=−3.18。
//   但该零模型**天然与甲高度相似**（它就是照甲的分布抽的）⇒ 基线被抬高，"低于随机"是假象。
//   正确问题：**0.571 在"随机两个真人的两两耦合度"分布里处于什么分位？**
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aspectTopology } from './src/cross/topology.mjs';
import { couplingOf } from './cli-paired.mjs';
import { loadVedastro } from './src/vedastro/adapter.mjs';
import { computeNatal } from './src/western/natal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'data', 'cross', 'coupling-null.json');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const L = [];
const P = (s) => { console.log(s); L.push(s); };

const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
const pctRank = (sorted, v) => sorted.filter((x) => x <= v).length / sorted.length;

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const wantCharts = arg('charts', 800), wantPairs = arg('pairs', 200000);
  if (!existsSync(join(HERE, 'data', 'vedastro', 'PersonList-15k.csv'))) { console.error('缺 vedastro 数据'); process.exit(2); }
  const { records } = loadVedastro();
  const tops = [];
  let bad = 0;
  for (const r of records) {
    if (tops.length >= wantCharts) break;
    let ch;
    try { ch = computeNatal({ at: `${r.date} ${r.time || '12:00'}`, lng: r.lon, lat: r.lat, tz: r.offsetHours }); } catch { bad++; continue; }
    const t = aspectTopology(ch, { maxOrb: 8 });
    if (t.edges.length >= 5) tops.push({ id: r.id, edges: t.edges });   // 边太少不具比较意义
  }
  if (tops.length < 50) { console.error(`有效盘太少：${tops.length}`); process.exit(2); }

  // 两两耦合度分布
  const scores = [];
  let n = 0;
  while (n < wantPairs) {
    const i = Math.floor(Math.random() * tops.length), j = Math.floor(Math.random() * tops.length);
    if (i === j) continue;
    const c = couplingOf(tops[i].edges, tops[j].edges);
    if (c?.score !== null && c?.score !== undefined) { scores.push(c.score); n++; }
  }
  scores.sort((a, b) => a - b);
  const obs = Number(arg('observed', 0.571));
  const pr = pctRank(scores, obs);
  // ★ 经验 P 值（直接由零分布计数，不依赖正态近似）
  const nGE = scores.filter((x) => x >= obs).length;
  const nLE = scores.filter((x) => x <= obs).length;
  const pGreater = (nGE + 1) / (scores.length + 1);       // 单侧：观测**高于**随机
  const pLess = (nLE + 1) / (scores.length + 1);          // 单侧：观测**低于**随机
  const pTwo = Math.min(1, 2 * Math.min(pGreater, pLess)); // 双侧

  P('# 两两耦合度经验分布（真人盘人群基线）· R-G9 落实');
  P('');
  P(`样本：**${tops.length}** 张 AA 级名人盘（解析失败 ${bad}）｜随机配对 **${scores.length}** 对｜容许度 ≤8°（R-V6 口径的相位表）`);
  P('');
  P('## 人群分布（随机两个真人）');
  P('');
  P('| 分位 | 耦合度 |');
  P('|---|---|');
  for (const p of [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]) P(`| P${(p * 100).toFixed(0)} | ${quantile(scores, p).toFixed(3)} |`);
  const mu = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mu) ** 2, 0) / scores.length);
  P('');
  P(`**均值 ${mu.toFixed(3)}｜标准差 ${sd.toFixed(3)}｜中位 ${quantile(scores, 0.5).toFixed(3)}**`);
  P('');
  P('## CASE-001 夫妇的耦合度定位');
  P('');
  P('| 项 | 值 |');
  P('|---|---|');
  P(`| 观测耦合度 | **${obs}** |`);
  P(`| 人群分位 | **P${(pr * 100).toFixed(1)}** |`);
  P(`| 相对人群的 z | **${((obs - mu) / sd).toFixed(2)}** |`);
  P(`| **经验 P（观测 ≥ 随机，单侧）** | **${pGreater.toFixed(4)}** |`);
  P(`| **经验 P（观测 ≤ 随机，单侧）** | **${pLess.toFixed(4)}** |`);
  P(`| **经验 P（双侧）** | **${pTwo.toFixed(4)}** |`);
  P(`| 旧零模型（从一方边缘分布重采样）基线 | 0.819（**错误基线**） |`);
  P('');
  P('## 结论（两个零模型的对照）');
  P('');
  P(`- **错误零模型**曾给出 z = −3.18（"显著低于随机"）—— 现已证明那是**基线被抬高**造成的假象：`);
  P(`  该零模型是从**甲的边缘分布**抽样的随机图，天然与甲相似 ⇒ 基线 0.819 远高于真人两两均值 ${mu.toFixed(3)}。`);
  P(`- **正确人群基线**：均值 **${mu.toFixed(3)}**、P95 **${quantile(scores, 0.95).toFixed(3)}**；`);
  P(`  观测 **${obs}** 落在 **P${(pr * 100).toFixed(1)}** ⇒ ${pr > 0.95 ? '**高于人群 95% 分位**（在人群中属于偏相似）' : pr < 0.05 ? '**低于人群 5% 分位**（在人群中属于偏不相似）' : '**落在人群常见区间内（既不出众也不异常）**'}。`);
  P('');
  P(`> ⚠️ 状态 \`hypothesis_under_validation\`｜置信度上限 ${0.6}｜**严禁据此输出关系吉凶**。`);
  P('> n=1 的个案即便落在分位两端，也**不能**推断两人关系的实际性质 —— 本表只建立"人群可比基线"这一工具。');

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    meta: { charts: tops.length, pairs: scores.length, mean: mu, sd, observed: obs, percentile: pr,
      pGreater, pLess, pTwo,
      quantiles: Object.fromEntries([0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99].map((p) => [`p${p * 100}`, quantile(scores, p)])),
      wrongNullBaseline: 0.819, note: 'R-G9：正确零模型 = 随机两个真人的两两分布' },
  }, null, 1), 'utf8');
  console.error(`[结果已写入] ${OUT}`);

  const rp = argv[argv.indexOf('--report') + 1];
  if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
