#!/usr/bin/env node
// 重大事项「发生」的拟合：星盘＋八字融合，以**应期排序**为验收目标
//   node cli-eventfit.mjs --run [--n 300] --report reports/eventfit.md
//   node cli-eventfit.mjs --fit [--n 300] [--passes 3]   # 用真实事件年份反向优化权重（训练/测试按人切分）
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEventSet, buildTransitTable, preparePerson, rankYears, summarize, aucOf, fitEventWeights, DEFAULT_EVENT_W, EVENT_FEATURES } from './src/cross/event-fit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

const N = Number(arg('n', 300));
const set = loadEventSet({ limit: N });
if (!set.candidates.length) { console.error('无可用案例（需 AA 级 + 有真实事件年份）'); process.exit(2); }

const t0 = Date.now();
const table = buildTransitTable({ fromYear: 1890, toYear: 2026, stepDays: 20 });
const prep = set.candidates.map((c) => ({ P: preparePerson(c.rec), events: c.events, rec: c.rec }));
P('# 重大事项「发生」拟合 · 星盘＋八字融合');
P('');
P(`数据：${set.total} 条中 **AA（出生证明级）${set.aaCount}** 条 → 其中有真实事件年份 **${prep.length}** 条（取样 ${N}）`);
P(`行运表：外行星（木/土/天/冥）1890–2026 每 10 天一点，全局复用（${Math.round((Date.now() - t0) / 1000)}s）`);
P('');
P('## 任务定义（为什么这样评价）');
P('');
P('- **应期排序**：对每个人，在其 18–70 岁的每一年上打分，看真实事件年份能否被排到前面。');
P('- **负样本 = 同一人的其它年份** → 配对设计，自动控制年龄/时代/寿命等混杂因素。');
P('- 指标：**AUC**（事件年 vs 非事件年的分数比较）、**Top-5 / Top-10 命中率**、**MRR**；');
P('  随机基线：Top-5 ≈ 5/53 = 9.4%，Top-10 ≈ 18.9%，AUC = 0.50。');
P('');

const results = prep.map((p) => rankYears(p.P, p.events, DEFAULT_EVENT_W, table));
const s = summarize(results);
const durT = Date.now() - t0;

P('## 结果（默认权重，未拟合）');
P('');
P('| 指标 | 值 | 随机基线 | 判读 |');
P('|---|---|---|---|');
P(`| 案例数 | ${s.n} | — | — |`);
P(`| 样本对数 | ${s.pairs} | — | — |`);
P(`| **AUC** | **${s.auc === null ? '—' : s.auc.toFixed(4)}** | 0.5000 | ${s.auc > 0.55 ? '**优于随机**' : s.auc > 0.52 ? '略优' : '≈随机'} |`);
P(`| Top-5 命中 | ${(s.hit5 * 100).toFixed(1)}% | ${(s.randomHit5 * 100).toFixed(1)}% | ${s.hit5 > s.randomHit5 * 1.3 ? '优于随机' : '≈随机'} |`);
P(`| Top-10 命中 | ${(s.hit10 * 100).toFixed(1)}% | ${(s.randomHit10 * 100).toFixed(1)}% | ${s.hit10 > s.randomHit10 * 1.3 ? '优于随机' : '≈随机'} |`);
P(`| MRR | ${s.mrr.toFixed(3)} | — | — |`);
P(`| 年份跨度 | ${s.span} 年/人 | — | — |`);
P('');
P(`> 耗时 ${durT}s。**判读纪律**：AUC 0.50 = 无信息；0.55 以上才算有信号；必须与随机基线并列展示。`);

/* 分侧拆解：星盘侧 vs 八字侧 各自单独跑 */
P('');
P('## 分侧拆解（哪一侧真有信号）');
P('');
const sideW = (side) => Object.fromEntries(EVENT_FEATURES.map((k) => [k, (side === 'astro' ? k.startsWith('a_') : k.startsWith('b_')) ? 1 : 0]));
P('| 权重方案 | AUC | Top-5 | Top-10 | MRR |');
P('|---|---|---|---|---|');
for (const [name, W] of [['仅八字侧', sideW('bazi')], ['仅星盘侧', sideW('astro')], ['双侧等权（默认）', DEFAULT_EVENT_W]]) {
  const r = summarize(prep.map((p) => rankYears(p.P, p.events, W, table)));
  P(`| ${name} | **${r.auc === null ? '—' : r.auc.toFixed(4)}** | ${(r.hit5 * 100).toFixed(1)}% | ${(r.hit10 * 100).toFixed(1)}% | ${r.mrr.toFixed(3)} |`);
}

/* 拟合 */
if (flag('fit')) {
  // 按人切分（奇数/偶数索引），避免同一人出现在训练与测试
  const train = prep.filter((_, i) => i % 2 === 0), test = prep.filter((_, i) => i % 2 === 1);
  const baseT = summarize(train.map((p) => rankYears(p.P, p.events, DEFAULT_EVENT_W, table))).auc;
  const baseS = summarize(test.map((p) => rankYears(p.P, p.events, DEFAULT_EVENT_W, table))).auc;
  const t1 = Date.now();
  const fit = fitEventWeights(train, DEFAULT_EVENT_W, { passes: Number(arg('passes', 3)), table });
  const fitT = summarize(train.map((p) => rankYears(p.P, p.events, fit.weights, table))).auc;
  const fitS = summarize(test.map((p) => rankYears(p.P, p.events, fit.weights, table))).auc;
  const baseS5 = summarize(test.map((p) => rankYears(p.P, p.events, DEFAULT_EVENT_W, table)));
  const fitS5 = summarize(test.map((p) => rankYears(p.P, p.events, fit.weights, table)));
  P('');
  P('## 用真实事件年份反向优化权重（R-Q8 协议：按人切分）');
  P('');
  P(`训练 ${train.length} 人 / 测试 ${test.length} 人（**按人奇偶切分，无泄漏**）｜拟合耗时 ${Math.round((Date.now() - t1) / 1000)}s`);
  P('');
  P('| 集合 | 默认权重 AUC | **拟合后 AUC** | 变化 |');
  P('|---|---|---|---|');
  P(`| 训练集（${train.length} 人，参与拟合） | ${baseT.toFixed(4)} | **${fitT.toFixed(4)}** | ${((fitT - baseT) > 0 ? '+' : '') + ((fitT - baseT) * 10000).toFixed(0)}bp |`);
  P(`| **测试集（${test.length} 人，未参与）** | ${baseS.toFixed(4)} | **${fitS.toFixed(4)}** | ${((fitS - baseS) > 0 ? '+' : '') + ((fitS - baseS) * 10000).toFixed(0)}bp |`);
  P('');
  P(`过拟合量（训练增益 − 测试增益）= **${(((fitT - baseT) - (fitS - baseS)) * 10000).toFixed(0)}bp**`);
  P(`测试集 Top-5：${(baseS5.hit5 * 100).toFixed(1)}% → ${(fitS5.hit5 * 100).toFixed(1)}%（随机 ${(baseS5.randomHit5 * 100).toFixed(1)}%）`);
  P('');
  P('### 拟合出的特征权重（= 被真实事件反向修正后的规则库）');
  P('');
  P('| 特征 | 侧 | 默认 | **拟合** | 变化 |');
  P('|---|---|---|---|---|');
  for (const k of EVENT_FEATURES) {
    const b = DEFAULT_EVENT_W[k] ?? 0, w = fit.weights[k] ?? 0;
    P(`| ${k} | ${k.startsWith('a_') ? '星盘' : '八字'} | ${b} | **${w}** | ${w === b ? '—' : (w > b ? '+' : '') + (w - b).toFixed(1)} |`);
  }
  P('');
  P(`拟合轨迹：${fit.trace.map((t) => `pass${t.pass}=${t.auc}`).join(' → ')}`);
  const j = arg('json', 'data/rules/event-weights.json');
  mkdirSync(dirname(j), { recursive: true });
  writeFileSync(j, JSON.stringify({ meta: { n: prep.length, trainN: train.length, testN: test.length, baseT, fitT, baseS, fitS, overfitBp: (fitT - baseT - (fitS - baseS)) * 10000, metrics: s }, weights: fit.weights, trace: fit.trace }, null, 2), 'utf8');
  console.error(`[权重已写入] ${j}`);
}

const rp = arg('report');
if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
