// 重大事项「发生」的拟合台：以**应期排序**为评价目标（比吉凶分类更可验证）
//
// 任务定义：给定一个人的命局（星盘+八字），在其成年后每一年上打分，看**真实事件年份**能否被排到前面。
//   · 这是一个 **ranking** 问题，用 AUC / Top-k 命中率 / MRR 评价，天然避开了"分类基线"的争议
//   · 负样本 = 同一人其它年份（person-level 配对，自动控制年龄/时代等混杂）
//   · 特征两侧独立：八字侧用 `yearInteraction`（流年冲合刑害/伏吟/天克地冲），
//     星盘侧用外行星行运与太阳弧到本命四轴/日月的硬相位
//   · 拟合权重 = 用真实事件年份反向优化规则库（延续 Part 10 的 R-Q8 协议）
//
// 数据：VedAstro（**Astro-Databank 的 AA 子集**，15,790/15,807 为出生证明级）
//       + 婚姻/离婚真实年份（真实重大事项，非占星判断）
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eclipticLongitude, angularGap } from '../western/zodiac.mjs';
import { computeNatal } from '../western/natal.mjs';
import { compileBazi } from '../bazi/engine.mjs';
import { yearInteraction, chartState } from '../bazi/interpretive.mjs';
import { loadVedastro, VEDASTRO_CSV } from '../vedastro/adapter.mjs';
import { loadLabels } from '../vedastro/pipeline.mjs';

export const OUTER = ['木星', '土星', '天王星', '冥王星'];
export const ASPECTS = { 0: 1.4, 90: 1.2, 180: 1.3, 45: 0.5, 135: 0.5 };   // 权重按"事件触发"强度

/** 全局行运表：外行星位置只与日期有关 → 全体复用（避免逐人重算） */
export function buildTransitTable({ fromYear = 1890, toYear = 2026, stepDays = 10 } = {}) {
  const table = new Map();
  for (let y = fromYear; y <= toYear; y++) {
    const rows = [];
    for (let d = 0; d < 365; d += stepDays) {
      const date = new Date(Date.UTC(y, 0, 1 + d));
      for (const p of OUTER) rows.push({ planet: p, lon: eclipticLongitude(p, date) });
    }
    table.set(y, rows);
  }
  return table;
}

/* ── 特征（每 (人, 年) 一行） ── */
export const EVENT_FEATURES = [
  'b_chongDay', 'b_chongHour', 'b_chongYear', 'b_chongMonth', 'b_tianKeDiChong', 'b_fuYin', 'b_sanHe', 'b_sanXing',
  'b_isDaYunStart',
  'a_saturnHit', 'a_uranusHit', 'a_plutoHit', 'a_jupiterHit', 'a_hitAngle', 'a_hitLum', 'a_closeOrb',
];

/** 需要预计算：本命盘（星盘）与八字状态 —— 每人一次 */
export function preparePerson(rec) {
  const at = `${rec.date} ${rec.time}`;
  const chart = computeNatal({ at, lng: rec.lon, lat: rec.lat, tz: rec.offsetHours, houseSystem: 'porphyry' });
  const b = compileBazi({ at, gender: rec.gender ?? '男' });
  const st = chartState({ ...b, gender: rec.gender ?? '男' }, rec.gender ?? '男');
  const natal = {};
  for (const k of ['上升', '天顶', '下降', '天底', '太阳', '月亮']) if (chart.planets[k]) natal[k] = chart.planets[k].lon;
  return { rec, chart, bazi: b, state: st, natal, birthYear: Number(rec.date.slice(0, 4)) };
}

/** 八字侧：该年与原局的互动（复用 Part 10 的规则实现） */
export function baziYearFeatures(P, year) {
  const y = yearInteraction(P.state, year);
  const f = Object.fromEntries(EVENT_FEATURES.map((k) => [k, 0]));
  if (y.chongDay) f.b_chongDay = 1;
  if (y.chongHour) f.b_chongHour = 1;
  if (y.chongYear) f.b_chongYear = 1;
  if (y.chongMonth) f.b_chongMonth = 1;
  if (y.tianKeDiChong) f.b_tianKeDiChong = 1;
  if (y.fuYin) f.b_fuYin = 1;
  if (y.sanHe) f.b_sanHe = 1;
  if (y.sanXingSet) f.b_sanXing = 1;
  return { f, y };
}

/** 星盘侧：该年外行星行运到本命四轴/日月的硬相位 + 太阳弧 */
export function astroYearFeatures(P, year, table) {
  const f = Object.fromEntries(EVENT_FEATURES.map((k) => [k, 0]));
  const rows = table.get(year) ?? [];
  const anglePts = ['上升', '天顶', '下降', '天底', '太阳', '月亮'].filter((k) => P.natal[k] !== undefined);
  for (const r of rows) {
    for (const pt of anglePts) {
      const d = angularGap(r.lon, P.natal[pt]);
      let w = 0;
      if (d <= 2) w = ASPECTS[0]; else if (Math.abs(d - 90) <= 2) w = ASPECTS[90]; else if (Math.abs(d - 180) <= 2) w = ASPECTS[180];
      if (!w) continue;
      const key = r.planet === '土星' ? 'a_saturnHit' : r.planet === '天王星' ? 'a_uranusHit' : r.planet === '冥王星' ? 'a_plutoHit' : 'a_jupiterHit';
      f[key] = 1;
      if (['上升', '天顶', '下降', '天底'].includes(pt)) f.a_hitAngle = 1;
      if (['太阳', '月亮'].includes(pt)) f.a_hitLum = 1;
      if (d <= 1 || Math.abs(d - 90) <= 1 || Math.abs(d - 180) <= 1) f.a_closeOrb = 1;
    }
  }
  // 太阳弧：本命点 + 年龄×0.9856°，与本命四轴的硬相位
  const arc = (year - P.birthYear) * 0.985647;
  if (arc > 0) {
    for (const src of ['太阳', '月亮', '金星', '火星', '水星']) {
      if (P.chart.planets[src] === undefined) continue;
      const moved = P.chart.planets[src].lon + arc;
      for (const pt of ['上升', '天顶', '下降', '天底']) {
        if (P.natal[pt] === undefined) continue;
        const d = angularGap(moved, P.natal[pt]);
        if (d <= 1.5 || Math.abs(d - 90) <= 1.5 || Math.abs(d - 180) <= 1.5) { f.a_hitAngle = 1; if (d <= 1.5) f.a_closeOrb = 1; }
      }
    }
  }
  return f;
}

export const DEFAULT_EVENT_W = Object.fromEntries(EVENT_FEATURES.map((k) => [k, k.startsWith('a_') ? 1.0 : 1.0]));

const scoreOf = (f, W) => EVENT_FEATURES.reduce((a, k) => a + (W[k] ?? 0) * (f[k] ?? 0), 0);

/** 对一个人：给出成年后各年的分数，以及真实事件年份的排名 */
export function rankYears(P, eventYears, W, table, { fromAge = 18, toAge = 70 } = {}) {
  const years = [];
  for (let y = P.birthYear + fromAge; y <= P.birthYear + toAge; y++) {
    const bf = baziYearFeatures(P, y).f;
    const af = astroYearFeatures(P, y, table);
    const f = { ...bf, ...af };
    years.push({ year: y, score: scoreOf(f, W), isEvent: eventYears.has(y) });
  }
  const sorted = [...years].sort((a, b) => b.score - a.score);
  const eventYearsArr = [...eventYears].filter((y) => y >= P.birthYear + fromAge && y <= P.birthYear + toAge);
  if (!eventYearsArr.length) return null;
  const ranks = eventYearsArr.map((y) => sorted.findIndex((x) => x.year === y) + 1);
  return { years, sorted, eventYears: eventYearsArr, ranks, bestRank: Math.min(...ranks), top5: ranks.some((r) => r <= 5), top10: ranks.some((r) => r <= 10), mrr: 1 / Math.min(...ranks) };
}

/** AUC：事件年分数 vs 非事件年分数（配对式，天然控制个体差异） */
export function aucOf(rows) {
  let pos = 0, neg = 0, wins = 0.5 * 0;
  const all = [];
  for (const r of rows) {
    const P = r.years.filter((x) => x.isEvent).map((x) => x.score);
    const N = r.years.filter((x) => !x.isEvent).map((x) => x.score);
    for (const p of P) for (const n of N) { all.push(p > n ? 1 : p === n ? 0.5 : 0); }
    pos += P.length; neg += N.length;
  }
  const s = all.reduce((a, b) => a + b, 0);
  return { auc: all.length ? s / all.length : null, pos, neg, pairs: all.length };
}

/* ══════════ 融合策略 v2（R-E11 修订）：路由 + 互补，不再等权相加 ══════════
 * 用户裁定：① 两系统分开跑；② 互相补充缺失的结论；③ **占星无法推算健康，健康类不让占星跑**
 * 依据：古典占星看的是"体质倾向"而非疾病诊断，而八字的五行-脏腑映射有明确规则表 ——
 *       让占星跑健康只会灌噪声（user 明确要求）。
 */
export const SIDE_CAPABILITY = {
  健康: { bazi: true, astro: false },
  其他: { bazi: true, astro: true },
};
export const capabilityOf = (category) => SIDE_CAPABILITY[category] ?? { bazi: true, astro: true };

/** 事件类别特征（**联合拟合**用：一套权重覆盖所有类别，靠这些特征区分，而不是按类别各拟合一套） */
export const CATEGORY_FEATURES = ['c_婚恋', 'c_健康', 'c_事业', 'c_财运', 'c_六亲', 'c_迁移', 'c_官非', 'c_意外', 'c_其他'];
export function categoryFeatures(category) {
  const f = Object.fromEntries(CATEGORY_FEATURES.map((k) => [k, 0]));
  const key = `c_${category}`;
  if (f[key] !== undefined) f[key] = 1; else f.c_其他 = 1;
  return f;
}

const _mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const _std = (a) => { if (a.length < 2) return 1; const m = _mean(a); return Math.sqrt(_mean(a.map((x) => (x - m) ** 2))) || 1; };

/**
 * 融合应期排序 v2
 * ① 两侧**各自**算逐年原始分；② **侧内 z 归一**（消除量纲差）；
 * ③ 按 `SIDE_CAPABILITY` **路由**（无能力的侧不参与）；④ **互补**：某年一侧"无话可说"（无特征触发）时，
 *    该年只由另一侧定分，**不做平均** —— 这正是"把互相缺失的结论补上"的落地。
 */
export function rankYearsRouted(P, eventsWithCat, W, table, { fromAge = 18, toAge = 70, defaultCat = '婚恋' } = {}) {
  const eventMap = new Map();
  for (const e of eventsWithCat) eventMap.set(typeof e === 'number' ? e : e.year, typeof e === 'number' ? defaultCat : (e.category ?? defaultCat));
  const years = [];
  for (let y = P.birthYear + fromAge; y <= P.birthYear + toAge; y++) {
    const bf = baziYearFeatures(P, y).f;
    const af = astroYearFeatures(P, y, table);
    const cat = eventMap.get(y) ?? null;
    years.push({ year: y, bf, af, cf: categoryFeatures(cat ?? defaultCat), cat, isEvent: eventMap.has(y) });
  }
  const wB = (f) => EVENT_FEATURES.filter((k) => k.startsWith('b_')).reduce((a, k) => a + (W[k] ?? 0) * (f[k] ?? 0), 0);
  const wA = (f) => EVENT_FEATURES.filter((k) => k.startsWith('a_')).reduce((a, k) => a + (W[k] ?? 0) * (f[k] ?? 0), 0);
  const wC = (f) => CATEGORY_FEATURES.reduce((a, k) => a + (W[k] ?? 0) * (f[k] ?? 0), 0);
  for (const r of years) {
    r.rawB = wB(r.bf); r.rawA = wA(r.af); r.rawC = wC(r.cf);
    r.fireB = Object.values(r.bf).some((v) => v); r.fireA = Object.values(r.af).some((v) => v);
  }
  const mB = _mean(years.map((r) => r.rawB)), zB = _std(years.map((r) => r.rawB));
  const mA = _mean(years.map((r) => r.rawA)), zA = _std(years.map((r) => r.rawA));
  for (const r of years) {
    r.nB = (r.rawB - mB) / zB; r.nA = (r.rawA - mA) / zA;
    const cap = capabilityOf(r.cat ?? defaultCat);
    const parts = [];
    if (cap.bazi && r.fireB) parts.push({ v: r.nB, w: W._wB ?? 1 });
    if (cap.astro && r.fireA) parts.push({ v: r.nA, w: W._wA ?? 1 });
    if (!parts.length) { r.fused = r.nB * 0.5 + r.nA * 0.5; r.mode = '两侧沉默'; }
    else { r.fused = parts.reduce((a, p) => a + p.v * p.w, 0) / parts.reduce((a, p) => a + p.w, 0) + r.rawC; r.mode = [cap.bazi && r.fireB ? '八字' : null, cap.astro && r.fireA ? '占星' : null].filter(Boolean).join('+') + (parts.length === 1 ? '(单侧互补)' : ''); }
  }
  const sorted = [...years].sort((a, b) => b.fused - a.fused);
  const evYears = years.filter((r) => r.isEvent).map((r) => r.year);
  if (!evYears.length) return null;
  const ranks = evYears.map((y) => sorted.findIndex((x) => x.year === y) + 1);
  return { years, sorted, eventYears: evYears, ranks, bestRank: Math.min(...ranks), top5: ranks.some((r) => r <= 5), top10: ranks.some((r) => r <= 10), mrr: 1 / Math.min(...ranks) };
}

/** 汇总评价 */
export function summarize(results) {
  const rs = results.filter(Boolean);
  if (!rs.length) return { n: 0 };
  const a = aucOf(rs);
  const hit5 = rs.filter((r) => r.top5).length / rs.length;
  const hit10 = rs.filter((r) => r.top10).length / rs.length;
  const mrr = rs.reduce((x, r) => x + r.mrr, 0) / rs.length;
  const span = rs[0].years.length;
  return { n: rs.length, auc: a.auc, pairs: a.pairs, hit5, hit10, mrr, randomHit5: (5 / span), randomHit10: (10 / span), span };
}

/** 坐标上升拟合（延续 R-Q8：训练集拟合、测试集只看） */
export function fitEventWeights(trainPrep, base = DEFAULT_EVENT_W, { grid = [-1, 0, 0.5, 1, 1.5, 2, 3], passes = 3, table } = {}) {
  const evalAcc = (W) => {
    const rs = trainPrep.map((p) => rankYears(p.P, p.events, W, table));
    return summarize(rs).auc ?? 0;
  };
  const W = { ...base };
  let best = evalAcc(W);
  const trace = [{ pass: 0, auc: round4(best) }];
  for (let p = 1; p <= passes; p++) {
    let changed = false;
    for (const k of EVENT_FEATURES) {
      const orig = W[k] ?? 0;
      let lb = best, lv = orig;
      for (const v of grid) {
        if (v === orig) continue;
        W[k] = v;
        const a = evalAcc(W);
        if (a > lb + 1e-9) { lb = a; lv = v; }
      }
      W[k] = lv;
      if (lv !== orig) changed = true;
      best = lb;
    }
    trace.push({ pass: p, auc: round4(best), changed });
    if (!changed) break;
  }
  return { weights: W, trainAuc: best, trace };
}

/** 载入：AA（出生证明级）+ 有真实重大事项年份 */
export function loadEventSet({ requireAA = true, limit = null } = {}) {
  if (!existsSync(VEDASTRO_CSV)) throw new Error('缺 data/vedastro/PersonList-15k.csv');
  const { records } = loadVedastro();
  const labels = loadLabels();
  // ★ AA 计数必须**全量扫一遍**：若在收集候选时才累加，`--limit` 会截断计数（曾报出 172/977/1353 三个数）
  let aa = 0;
  for (const r of records) if (r.rodden === 'AA') aa++;
  const out = [];
  let noEv = 0;
  for (const r of records) {
    if (requireAA && r.rodden !== 'AA') continue;
    const lab = labels.get(r.id);
    if (!lab) continue;
    const years = new Set([...(lab.years ?? [])]);
    if (!years.size) { noEv++; continue; }
    out.push({ rec: r, events: years, label: lab });
    if (limit && out.length >= limit) break;
  }
  return { candidates: out, aaCount: aa, noEvent: noEv, total: records.length };
}

const round4 = (x) => Math.round(x * 10000) / 10000;
