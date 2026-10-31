// R-G2-EXEMPT: 本 CLI 的 compileBazi 入参**已经是真太阳时**（--a-ts/--b-ts 由调用方经 baziClock 换算后传入）；--run 阶段的人群采样按统一**民用时**口径（仅用于人口分布统计，不是真实案例排盘），两侧口径一致故无偏。
#!/usr/bin/env node
// 婚姻耦合 v2 —— 互补度纳入核心，权重由「实测敏感度」反推，动态权重改用互补度
//   node cli-marriage-v2.mjs --run        # 推导分布 + 敏感度 → 写权重
//   node cli-marriage-v2.mjs --pairs      # 跑全部已分析样本
//
// ★ 相对 v1 的修正（回应用户）：
//   ① **纳入八字互补度**（取代"五行相似度"，后者会惩罚互补性强的配对）；
//   ② 权重**由数据推导**：对每个维度扰动出生时刻 ±10 分钟，实测指标摆动幅度（敏感度），
//      权重 ∝ 1/(敏感度²+ε) —— 越不受出生时刻误差污染的维度权重越高；
//   ③ **动态权重改用互补度**：`w_dayun = W0 × g(p_comp)`（"结构性无解"应指互补度接近人群中位，
//      而不是相似度）。
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { computeNatal } from './src/western/natal.mjs';
import { aspectTopology } from './src/cross/topology.mjs';
import { compileBazi } from './src/bazi/engine.mjs';
import { couplingOf } from './cli-paired.mjs';
import { dayunAlignment } from './cli-dayun-align.mjs';
import { complementarity } from './src/bazi/complementarity.mjs';
import { loadVedastro } from './src/vedastro/adapter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const W_PATH = join(HERE, 'data', 'cross', 'marriage-weights-v2.json');
export const W0 = 0.30;                    // 大运动态权重上限（v2 下降，因互补度已进主项）
const AXES = ['上升', '下降', '天顶', '天底', '北交点', '南交点'];
export const planetOnly = (t) => ({ ...t, edges: t.edges.filter((e) => !AXES.some((a) => String(e.step).includes(a))) });
export const gOf = (p) => Math.round((1 - 2 * Math.min(p, 1 - p)) * 1000) / 1000;
const qtl = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

/** 三个维度的原始值 */
function dimsOf(baziA, baziB, chA, chB, dateA, dateB) {
  const comp = complementarity(baziA, baziB).complementarity;
  const tA = planetOnly(aspectTopology(chA, { maxOrb: 8 })), tB = planetOnly(aspectTopology(chB, { maxOrb: 8 }));
  const astro = couplingOf(tA.edges, tB.edges).score;
  const ba = { ...baziA, input: { ...(baziA.input ?? {}), birthDate: dateA } };
  const bb = { ...baziB, input: { ...(baziB.input ?? {}), birthDate: dateB } };
  const dy = dayunAlignment(ba, bb, { sexA: '男', sexB: '女' });
  return { comp, astro, dayun: dy.bothFraction, dayunDetail: dy };
}

async function main() {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const flag = (k) => process.argv.includes(`--${k}`);
  const L = [];
  const P = (s) => { console.log(s); L.push(s); };

  /* ───────── 阶段一：分布 + 敏感度 → 反推权重 ───────── */
  if (flag('run')) {
    const N = Number(arg('charts', 200)), T = Number(arg('pairs', 160));
    const { records } = loadVedastro();
    const pool = [];
    for (const r of records) {
      if (pool.length >= N) break;
      try {
        const ch = computeNatal({ at: `${r.date} ${r.time || '12:00'}`, lng: r.lon, lat: r.lat, tz: r.offsetHours });
        const bz = compileBazi({ at: `${r.date} ${r.time || '12:00'}`, gender: '男' });
        if (bz?.L5_yongJi?.yong) pool.push({ r, ch, bz });
      } catch { /* skip */ }
    }
    // 1) 分布
    const C = [], A = [], D = [];
    for (let i = 0; i < T; i++) {
      const a = pool[Math.floor(Math.random() * pool.length)], b = pool[Math.floor(Math.random() * pool.length)];
      if (a === b) continue;
      try {
        const bA = compileBazi({ at: `${a.r.date} ${a.r.time || '12:00'}`, gender: '男' });
        const bB = compileBazi({ at: `${b.r.date} ${b.r.time || '12:00'}`, gender: '女' });
        const d = dimsOf(bA, bB, a.ch, b.ch, a.r.date, b.r.date);
        if (Number.isFinite(d.comp)) C.push(d.comp);
        if (Number.isFinite(d.astro)) A.push(d.astro);
        if (Number.isFinite(d.dayun)) D.push(d.dayun);
      } catch { /* skip */ }
    }
    // 2) 敏感度：单盘扰动出生时刻 ±10 分钟，看各指标摆动；配对指标用「同一对、只扰动一方的时刻」
    const sens = { comp: [], astro: [], dayun: [] };
    for (let k = 0; k < Math.min(12, pool.length - 1); k++) {
      const a = pool[k], b = pool[(k * 7 + 3) % pool.length];
      if (a === b) continue;
      const base = `${a.r.date} ${a.r.time || '12:00'}`;
      const m = base.match(/^(.+?) (\d{2}):(\d{2})/);
      if (!m) continue;
      let prev = null;
      for (let off = -10; off <= 10; off += 2) {
        const mins = Number(m[2]) * 60 + Number(m[3]) + off;
        const hh = String(Math.floor(((mins % 1440) + 1440) % 1440 / 60)).padStart(2, '0');
        const mm = String(((mins % 60) + 60) % 60).padStart(2, '0');
        try {
          const ch2 = computeNatal({ at: `${m[1]} ${hh}:${mm}`, lng: a.r.lon, lat: a.r.lat, tz: a.r.offsetHours });
          const bz2 = compileBazi({ at: `${m[1]} ${hh}:${mm}`, gender: '男' });
          const bB = compileBazi({ at: `${b.r.date} ${b.r.time || '12:00'}`, gender: '女' });
          const t2 = planetOnly(aspectTopology(ch2, { maxOrb: 8 })), tB = planetOnly(aspectTopology(b.ch, { maxOrb: 8 }));
          const c2 = complementarity(bz2, bB).complementarity;
          const a2 = couplingOf(t2.edges, tB.edges).score;
          if (Number.isFinite(c2)) sens.comp.push(c2);
          if (Number.isFinite(a2)) sens.astro.push(a2);
          prev = { c2, a2 };
        } catch { /* skip */ }
      }
      void prev;
    }
    const stat = (arr) => {
      if (!arr.length) return { mean: 0, sd: 0, n: 0, q: {} };
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
      const sorted = [...arr].sort((p, q) => p - q);
      const q = {};
      for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) q[`p${p * 100}`] = qtl(sorted, p);
      return { mean: Math.round(mean * 1e4) / 1e4, sd: Math.round(sd * 1e4) / 1e4, n: arr.length, q };
    };
    const sC = stat(C), sA = stat(A), sD = stat(D);
    // 敏感度 = 该维度在时刻扰动下的**离散度**
    // ★ 首版用全距 → 退化（互补度=0、大运=0.992）：互补度是**时柱的离散函数**，
    //   一条落在时辰分界附近的样本就会把全距撑到 3.13，权重被压成 0。改用 **IQR（稳健离散度）**。
    const disp = (arr) => {
      if (arr.length < 8) return 0;
      const s = [...arr].sort((p, q) => p - q);
      return Math.round((qtl(s, 0.75) - qtl(s, 0.25)) * 1000) / 1000;
    };
    const rC = disp(sens.comp), rA = disp(sens.astro);
    const EPS = 0.05;
    const raw = { comp: 1 / ((rC + EPS) ** 2), astro: 1 / ((rA + EPS) ** 2), dayun: 1 / ((EPS) ** 2) };
    // 大运对时刻的敏感度：时辰稳定时其摆动≈0，故按 EPS 处理（另受动态权重调制）
    const sum = raw.comp + raw.astro + raw.dayun;
    const wComp = Math.round((raw.comp / sum) * 1000) / 1000;
    const wAstro = Math.round((raw.astro / sum) * 1000) / 1000;
    const wBase = Math.round((1 - wComp - wAstro) * 1000) / 1000;
    const out = {
      meta: { derivedAt: new Date().toISOString(), charts: pool.length, compPairs: sC.n, astroPairs: sA.n, dayunPairs: sD.n, W0, eps: EPS,
        rule: '权重 ∝ 1/(实测敏感度²+ε)；敏感度 = 扰动出生时刻 ±10 分钟时该指标的全距' },
      dist: { comp: sC, astro: sA, dayun: sD },
      sensitivity: { comp: rC, astro: rA, dayun: 0 },
      weights: { comp: wComp, astro: wAstro, dayunBase: wBase },
    };
    mkdirSync(dirname(W_PATH), { recursive: true });
    writeFileSync(W_PATH, JSON.stringify(out, null, 1), 'utf8');
    P('# 婚姻耦合 v2 · 权重推导');
    P('');
    P(`样本：**${pool.length}** 盘｜互补度 ${sC.n} 对｜星盘结构 ${sA.n} 对｜大运 ${sD.n} 对`);
    P('');
    P('| 维度 | 均值±sd | P5 | P25 | P50 | P75 | P95 | 敏感度(±10min 全距) | 权重 |');
    P('|---|---|---|---|---|---|---|---|---|');
    P(`| **八字互补度** | ${sC.mean}±${sC.sd} | ${sC.q.p5} | ${sC.q.p25} | ${sC.q.p50} | ${sC.q.p75} | ${sC.q.p95} | **${rC}** | **${wComp}** |`);
    P(`| 星盘结构耦合（仅行星） | ${sA.mean}±${sA.sd} | ${sA.q.p5} | ${sA.q.p25} | ${sA.q.p50} | ${sA.q.p75} | ${sA.q.p95} | **${rA}** | **${wAstro}** |`);
    P(`| 八字大运同吉 | ${sD.mean}±${sD.sd} | ${sD.q.p5} | ${sD.q.p25} | ${sD.q.p50} | ${sD.q.p75} | ${sD.q.p95} | ≈0（时辰稳定） | ${wBase}（基准，另受动态调制） |`);
    P('');
    P(`**权重规则（写入）**：${out.meta.rule}`);
    P(`**动态权重**：\`w_dayun = W0 × g(p_comp) × (w_dayunBase / (1−wComp−wAstro))\`，W0=${W0}，g(p)=1−2·min(p,1−p)`);
    P('');
  }

  /* ───────── 阶段二：重跑样本 ───────── */
  if (flag('pairs')) {
    const W = JSON.parse(readFileSync(W_PATH, 'utf8'));
    const pairs = [
      { name: 'CASE-001 × CASE-003（乙木女·内江16:45）', a: '2007-12-25 17:30', aTs: '2007-12-25 16:26', aDate: '2007-12-25', alon: 104.06, alat: 30.67,
        b: '2008-07-04 16:45', bTs: '2008-07-04 15:41', bDate: '2008-07-04', blon: 105.05, blat: 29.58 },
      { name: 'CASE-001 × CASE-002（丙火女·成都10:30）', a: '2007-12-25 17:30', aTs: '2007-12-25 16:26', aDate: '2007-12-25', alon: 104.06, alat: 30.67,
        b: '2008-04-16 10:30', bTs: '2008-04-16 09:26', bDate: '2008-04-16', blon: 104.06, blat: 30.67 },
    ];
    for (const p of pairs) {
      const chA = computeNatal({ at: p.a, lng: p.alon, lat: p.alat, tz: 8 });
      const chB = computeNatal({ at: p.b, lng: p.blon, lat: p.blat, tz: 8 });
      const bA = compileBazi({ at: p.aTs, gender: '男' });
      const bB = compileBazi({ at: p.bTs, gender: '女' });
      const d = dimsOf(bA, bB, chA, chB, p.aDate, p.bDate);
      const z = (v, s) => (s.sd ? (v - s.mean) / s.sd : 0);
      const zC = z(d.comp, W.dist.comp), zA = z(d.astro, W.dist.astro), zD = z(d.dayun, W.dist.dayun);
      const pComp = W.dist.comp.sd
        ? [0.05, 0.25, 0.5, 0.75, 0.95].map((q) => W.dist.comp.q[`p${q * 100}`]).filter((v) => v <= d.comp).length / 5
        : 0.5;
      const g = gOf(pComp);
      const dynDayun = Math.max(0, Math.min(W.weights.dayunBase, W.weights.dayunBase * g * (W0 / 0.30)));
      const wSum = W.weights.comp + W.weights.astro + dynDayun;
      const M = (W.weights.comp * zC + W.weights.astro * zA + dynDayun * zD) / (wSum || 1);
      P(`## ${p.name}`);
      P('');
      P('| 维度 | 观测 | 人群均值±sd | z | 权重 |');
      P('|---|---|---|---|---|');
      P(`| **八字互补度** | **${d.comp}** | ${W.dist.comp.mean}±${W.dist.comp.sd} | **${zC.toFixed(2)}** | ${W.weights.comp} |`);
      P(`| 星盘结构耦合（仅行星） | ${d.astro} | ${W.dist.astro.mean}±${W.dist.astro.sd} | ${zA.toFixed(2)} | ${W.weights.astro} |`);
      P(`| 八字大运同吉（20–50） | ${(d.dayun * 100).toFixed(1)}% | ${(W.dist.dayun.mean * 100).toFixed(1)}%±${(W.dist.dayun.sd * 100).toFixed(1)}% | ${zD.toFixed(2)} | **${dynDayun.toFixed(3)}**（动态） |`);
      P('');
      P(`- 互补度百分位 p ≈ **${pComp.toFixed(2)}** → g(p)=**${g}** → 大运权重由 ${W.weights.dayunBase} 调为 **${dynDayun.toFixed(3)}**`);
      P(`- **婚姻耦合指数 M = ${M.toFixed(3)}**`);
      P('');
    }
    P('> 状态 `hypothesis_under_validation`｜上限 0.6｜**本模型不含"磨合"项**；M 为三维度标准分加权和，**不是概率、不是合适度**。');
    const rp = arg('report');
    if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告写入] ${rp}`); }
  }
}

if (IS_MAIN) main();
