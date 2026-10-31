// R-G2-EXEMPT: 本 CLI 的 compileBazi 入参**已经是真太阳时**（--a-ts/--b-ts 由调用方经 baziClock 换算后传入）；--run 阶段的人群采样按统一**民用时**口径（仅用于人口分布统计，不是真实案例排盘），两侧口径一致故无偏。
#!/usr/bin/env node
// 婚姻耦合 · 动态权重（数据推导，非人为设定）
//   node cli-marriage.mjs --run [--charts 240] [--pairs 800]
//   node cli-marriage.mjs --couple --a "2000-01-01 12:00" --b "2008-07-04 16:45"
//
// ★ 设计（回应用户三点）：
//   ① 动态权重 = 数据推导：`w_dayun = W0 × g(p_struct)`，其中
//      g(p) = 1 − 2·min(p, 1−p)  →  结构性耦合落在人群中位时 g=0（大运权重归零），极端时 g=1。
//      p 是**星盘结构耦合在人群随机配对分布中的百分位**，由星盘库实测得出。
//   ② 星盘 + 八字联合：两侧各自标准化为 z，再按动态权重合成。
//   ③ 话术：不含吉凶、不给"合适/不合适"，只给结构事实 + 区间 + 明确的"磨合缺失"声明（R-G16）。
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { computeNatal } from './src/western/natal.mjs';
import { aspectTopology } from './src/cross/topology.mjs';
import { compileBazi } from './src/bazi/engine.mjs';
import { couplingOf } from './cli-paired.mjs';
import { dayunAlignment } from './cli-dayun-align.mjs';
import { loadVedastro } from './src/vedastro/adapter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEIGHTS_PATH = join(HERE, 'data', 'cross', 'marriage-weights.json');
export const W0 = 0.35;            // 大运权重上限
export const AXES = ['上升', '下降', '天顶', '天底', '北交点', '南交点'];

/** 只保留行星-行星边（四轴随出生时刻漂移，见 R-G15 实测） */
export const planetOnly = (t) => ({ ...t, edges: t.edges.filter((e) => !AXES.some((a) => String(e.step).includes(a))) });
export const pctRank = (sorted, v) => sorted.filter((x) => x <= v).length / sorted.length;
/** g：结构性耦合越接近人群中位，大运权重越低 */
export const gOf = (p) => Math.round((1 - 2 * Math.min(p, 1 - p)) * 1000) / 1000;

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const flag = (k) => process.argv.includes(`--${k}`);
  const L = [];
  const P = (s) => { console.log(s); L.push(s); };

  /* ── 阶段一：从星盘库推导权重 ── */
  if (flag('run') || !existsSync(WEIGHTS_PATH)) {
    const wantCharts = Number(arg('charts', 240)), wantPairs = Number(arg('pairs', 800));
    const { records } = loadVedastro();
    const pool = [];
    for (const r of records) {
      if (pool.length >= wantCharts) break;
      try {
        const ch = computeNatal({ at: `${r.date} ${r.time || '12:00'}`, lng: r.lon, lat: r.lat, tz: r.offsetHours });
        const t = planetOnly(aspectTopology(ch, { maxOrb: 8 }));
        if (t.edges.length >= 5) pool.push({ id: r.id, date: r.date, edges: t.edges });
      } catch { /* skip */ }
    }
    const S = [], D = [];
    const both = [];            // ★ 同一对的 (结构, 大运) —— 求相关必须用同批配对
    for (let i = 0; i < wantPairs; i++) {
      const a = pool[Math.floor(Math.random() * pool.length)], b = pool[Math.floor(Math.random() * pool.length)];
      if (a === b) continue;
      const c = couplingOf(a.edges, b.edges);
      if (c?.score == null) continue;
      S.push(c.score);
      if (D.length < Math.min(wantPairs, 200)) {                       // 大运较贵，限 200 对
        try {
          const ba = compileBazi({ at: `${a.date} 12:00`, gender: '男' });
          const bb = compileBazi({ at: `${b.date} 12:00`, gender: '女' });
          ba.input = { ...(ba.input ?? {}), birthDate: a.date };
          bb.input = { ...(bb.input ?? {}), birthDate: b.date };
          const x = dayunAlignment(ba, bb, { sexA: '男', sexB: '女' });
          if (x.bothFraction != null) { D.push(x.bothFraction); both.push({ s: c.score, d: x.bothFraction }); }
        } catch { /* skip */ }
      }
    }
    S.sort((p, q) => p - q); D.sort((p, q) => p - q);
    const stat = (arr) => {
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
      const q = {};
      for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) {
        q[`p${p * 100}`] = arr[Math.min(arr.length - 1, Math.round(p * (arr.length - 1)))];
      }
      return { mean: Math.round(mean * 1e4) / 1e4, sd: Math.round(sd * 1e4) / 1e4, n: arr.length, q };
    };
    const sS = stat(S), sD = stat(D);
    // ★ 两维度独立性：必须用**同一批配对**求相关（首版按索引错配 ⇒ 假 r=0.847）
    const m = both.length;
    let corr = 0;
    if (m > 10) {
      const mx = both.reduce((s, p) => s + p.s, 0) / m, my = both.reduce((s, p) => s + p.d, 0) / m;
      const cov = both.reduce((s, p) => s + (p.s - mx) * (p.d - my), 0) / m;
      const sx = Math.sqrt(both.reduce((s, p) => s + (p.s - mx) ** 2, 0) / m);
      const sy = Math.sqrt(both.reduce((s, p) => s + (p.d - my) ** 2, 0) / m);
      corr = sx && sy ? cov / (sx * sy) : 0;
    }
    const out = {
      meta: { derivedAt: new Date().toISOString(), charts: pool.length, structPairs: sS.n, dayunPairs: sD.n, corrPairs: both.length, W0, note: '权重由星盘库实测分布导出，非人为设定' },
      structural: sS, dayun: sD,
      correlation: Math.round(corr * 1000) / 1000,
      weightRule: 'w_dayun = W0 × g(p_struct)，g(p)=1−2·min(p,1−p)',
    };
    mkdirSync(dirname(WEIGHTS_PATH), { recursive: true });
    writeFileSync(WEIGHTS_PATH, JSON.stringify(out, null, 1), 'utf8');
    P('# 动态权重 · 数据推导');
    P('');
    P(`样本：星盘 **${pool.length}** 张｜结构耦合 **${sS.n}** 对｜大运对齐 **${sD.n}** 对`);
    P('');
    P('| 维度 | 均值±sd | P5 | P25 | P50 | P75 | P95 |');
    P('|---|---|---|---|---|---|---|');
    for (const [nm, s] of [['星盘结构耦合（仅行星）', sS], ['八字大运同吉比例', sD]]) {
      P(`| ${nm} | ${s.mean}±${s.sd} | ${s.q.p5} | ${s.q.p25} | ${s.q.p50} | ${s.q.p75} | ${s.q.p95} |`);
    }
    P('');
    P(`**两维度相关系数 r = ${out.correlation}** → ${Math.abs(corr) < 0.2 ? '**近似独立**，可作两路独立证据合成' : '存在相关，合成时需去冗余'}`);
    P('');
    P(`**权重规则（写入）**：${out.weightRule}，上限 W0 = ${W0}`);
    P('| 结构耦合百分位 p | g(p) | w_dayun |');
    P('|---|---|---|');
    for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) P(`| ${p} | ${gOf(p)} | **${(W0 * gOf(p)).toFixed(3)}** |`);
    P('');
  }

  /* ── 阶段二：对具体一对算婚姻耦合 ── */
  if (flag('couple')) {
    const W = JSON.parse(readFileSync(WEIGHTS_PATH, 'utf8'));
    const A = arg('a', '2000-01-01 12:00'), B = arg('b', '2008-07-04 16:45');
    const lonA = Number(arg('a-lon', 104.06)), latA = Number(arg('a-lat', 30.67));
    const lonB = Number(arg('b-lon', 105.05)), latB = Number(arg('b-lat', 29.58));
    const bs = arg('b-true-solar') ? null : null;
    const chA = computeNatal({ at: A, lng: lonA, lat: latA, tz: 8 });
    const chB = computeNatal({ at: B, lng: lonB, lat: latB, tz: 8 });
    const tA = planetOnly(aspectTopology(chA, { maxOrb: 8 })), tB = planetOnly(aspectTopology(chB, { maxOrb: 8 }));
    const cpl = couplingOf(tA.edges, tB.edges);
    const pS = pctRank([W.structural.q.p5, W.structural.q.p25, W.structural.q.p50, W.structural.q.p75, W.structural.q.p95], cpl.score);
    const g = gOf(pS), w = Math.round(W0 * g * 1000) / 1000;
    const zS = (cpl.score - W.structural.mean) / W.structural.sd;
    const baziA = compileBazi({ at: arg('a-ts', '2000-01-01 12:00'), gender: '男' });
    const baziB = compileBazi({ at: arg('b-ts', '2000-01-01 12:00'), gender: '女' });
    baziA.input = { ...(baziA.input ?? {}), birthDate: '2007-12-25' };
    baziB.input = { ...(baziB.input ?? {}), birthDate: '2008-07-04' };
    const dy = dayunAlignment(baziA, baziB, { sexA: '男', sexB: '女' });
    const zD = (dy.bothFraction - W.dayun.mean) / W.dayun.sd;
    const M = Math.round(((1 - w) * zS + w * zD) * 1000) / 1000;

    P('# 婚姻耦合（动态权重 · 双系统联合）');
    P('');
    P('## 一、两路证据');
    P('');
    P('| 维度 | 观测 | 人群 | z | 动态权重 |');
    P('|---|---|---|---|---|');
    P(`| 星盘结构耦合（仅行星-行星，不含四轴） | **${cpl.score}** | ${W.structural.mean}±${W.structural.sd} | **${zS.toFixed(2)}** | ${(1 - w).toFixed(3)} |`);
    P(`| 八字大运同吉比例（20–50 岁） | **${(dy.bothFraction * 100).toFixed(1)}%**（${dy.bothCount}/${dy.favourableYears.total} 年） | ${(W.dayun.mean * 100).toFixed(1)}%±${(W.dayun.sd * 100).toFixed(1)}% | **${zD.toFixed(2)}** | **${w.toFixed(3)}** |`);
    P('');
    P(`- 结构耦合百分位 p ≈ **${pS.toFixed(2)}** → g(p) = **${g}** → **w_dayun = ${W0} × ${g} = ${w}**`);
    P(`- **动态权重生效**：结构性越接近人群中位，大运权重越低（本次 w = ${w}）`);
    P('');
    P('## 二、合成指数');
    P('');
    P(`**婚姻耦合指数 M = (1−w)·zS + w·zD = ${M}**`);
    P('');
    P(`> M 是**两个维度相对人群的标准分加权和**，不是概率、不是"合适度"。M 的绝对值只表示"相对随机配对偏离多少 sd"。`);
    P('');
    P('## 三、结构事实（并列，不含判断）');
    P('');
    P('| 项 | A（男） | B（女） |');
    P('|---|---|---|');
    P(`| 四柱 | ${baziA.pillars.join(' ')} | ${baziB.pillars.join(' ')} |`);
    P(`| 日主 | ${baziA.L5_yongJi?.candidates?.dmWx ?? '—'} | ${baziB.L5_yongJi?.candidates?.dmWx ?? '—'} |`);
    P(`| 用神 / 忌神 | ${baziA.L5_yongJi?.yong} / ${baziA.L5_yongJi?.ji} | ${baziB.L5_yongJi?.yong} / ${baziB.L5_yongJi?.ji} |`);
    P(`| 星盘上升 | ${chA.planets['上升'].sign} | ${chB.planets['上升'].sign} |`);
    P(`| 太阳 / 月亮 | ${chA.planets['太阳'].sign} / ${chA.planets['月亮'].sign} | ${chB.planets['太阳'].sign} / ${chB.planets['月亮'].sign} |`);
    P('');
    P('## 四、必须声明的限制（R-G16）');
    P('');
    P('1. **本模型不含"磨合"项** —— 结构是静态先验，关系是动态过程（沟通、投入、共同经历、冲突化解、环境变化）；**静态盘推不出动态过程**。');
    P('2. **所有数字只是"与随机配对偏离多少"，不是关系质量** —— 未经任何真实关系结局校准。');
    P('3. **不给"合适/不合适/吉/凶"结论**；上表是结构事实的并列表述。');
    P('4. 女方出生地已给定（内江 105.05/29.58）、时刻为"16:45 左右"；**上升正卡在天蝎/射手交界（29.32°），±3 分钟即跨星座** ⇒ 任何依赖上升的结论都应视为待确认。');
    P(`5. 状态 \`hypothesis_under_validation\`｜置信度上限 0.6（R-C5/R-B13）。`);

    const rp = arg('report');
    if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
  }
}

if (IS_MAIN) main();
