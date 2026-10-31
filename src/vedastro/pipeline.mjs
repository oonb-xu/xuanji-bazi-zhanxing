// VedAstro 数据集 → 星盘＋八字 融合结盘
//
// 星盘侧：mine 后端（astronomy-engine，热带黄道）
// 八字侧：**真太阳时**（R-T2 用户裁定：中国侧一律真太阳时）
// 标签侧：VedAstro 婚姻/离婚数据集（真实记录，非占星判断）——这才是"结果学习"的可信目标
//   https://huggingface.co/datasets/vedastro-org/15000-Famous-People-Marriage-Divorce-Info
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

import { computeNatal } from '../western/natal.mjs';
import { dignityOf } from '../western/dignity.mjs';
import { baziClock } from '../western/truesolar.mjs';
import { compileBazi, splitPillar } from '../bazi/engine.mjs';
import { SIGN_ELEMENT } from '../western/zodiac.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = resolve(HERE, '../..');
export const LABEL_CSV = join(PROJ, 'data', 'vedastro', 'MarriageInfoDataset.csv');

const KEY_POINTS = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
/**
 * R-V6（用户裁定）：筛选计数**只用主流西方占星口径**
 *   · 相位：只取**托勒密主相位中的两个不和谐相位** —— 对冲(180°) 1.0、四分相(90°) 1.0
 *     （半四分 45°/补八分 135° 属少数派/乌拉尼亚系统，梅花 150° 属次要相位 —— 一律**不计入筛选**）
 *   · 端点：**只在十大行星之间** —— 四轴与南北交点**排除**在计数之外
 *     （保留为独立维度，见 chartFeatures.angleContacts）
 * 理由：上一版把四轴纳入计数，导致"高不和谐盘"必然全是轴相位 —— 筛选条件自我实现，A 组无信息量。
 */
export const DISCORDANT = { 对冲: 1.0, 四分相: 1.0 };
/** 主流西方占星的完整相位集（托勒密五主相位）—— 用于对照说明，不用于筛选计数 */
export const PTOLEMAIC = { 合相: 1.0, 六分相: 1.0, 四分相: 1.0, 三分相: 1.0, 对冲: 1.0 };

/* ── 标签 ── */
export function loadLabels(path = LABEL_CSV) {
  if (!existsSync(path)) return new Map();
  const rows = parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true });
  const m = new Map();
  for (const r of rows) {
    let j;
    try { j = JSON.parse(r.Info); } catch { continue; }
    const ms = Array.isArray(j?.marriages) ? j.marriages : [];
    const divorces = ms.filter((x) => x.divorceDate || /Divorce|Dissolution|Separated/i.test(x.outcome ?? ''));
    if (!ms.length) { m.set(r.PartitionKey, { id: r.PartitionKey, marriages: 0, divorces: 0, married: false, divorced: false, types: [], credibility: 'none' }); continue; }
    const types = [...new Set(ms.map((x) => x.type).filter(Boolean))];
    m.set(r.PartitionKey, {
      id: r.PartitionKey,
      marriages: ms.length,
      divorces: divorces.length,
      married: true,
      divorced: divorces.length > 0,
      // 新标签（本轮"换标签"）：婚姻存续（0 次离婚）与包办婚姻 —— 都有可用对比度
      stable: divorces.length === 0,
      arranged: types.includes('Arranged'),
      types,
      credibility: ms.some((x) => x.dataCredibility === 'high') ? 'high' : 'low',
      years: ms.map((x) => Number(String(x.marriageDate ?? '').slice(0, 4))).filter((y) => y > 1800),
    });
  }
  return m;
}

/* ── 星盘特征 ── */
export function chartFeatures(rec) {
  const chart = computeNatal({ at: `${rec.date} ${rec.time}`, lng: rec.lon, lat: rec.lat, tz: rec.offsetHours, houseSystem: 'porphyry' });
  const discordant = [], angleContacts = [];
  for (const a of chart.aspects) {
    const w = DISCORDANT[a.type];
    if (!w) continue;
    const aIsP = KEY_POINTS.includes(a.a), bIsP = KEY_POINTS.includes(a.b);
    // R-V6：只有两端都是十大行星才计入筛选计数；四轴/交点单独归入 angleContacts
    if (aIsP && bIsP) discordant.push({ a: a.a, b: a.b, type: a.type, orb: Math.round((a.orb ?? 0) * 100) / 100, weight: w, tight: (a.orb ?? 9) <= 2 });
    else if ((aIsP && ['上升', '天顶'].includes(a.b)) || (bIsP && ['上升', '天顶'].includes(a.a))) {
      const planet = aIsP ? a.a : a.b, angle = aIsP ? a.b : a.a;
      angleContacts.push({ planet, angle, type: a.type, orb: Math.round((a.orb ?? 0) * 100) / 100, tight: (a.orb ?? 9) <= 2 });
    }
  }
  const score = discordant.reduce((s, x) => s + x.weight, 0);
  const elements = {};
  for (const p of KEY_POINTS) { const e = chart.planets[p]?.element; if (e) elements[e] = (elements[e] ?? 0) + 1; }
  const dignity = {};
  for (const p of KEY_POINTS) if (chart.planets[p]?.sign) dignity[p] = dignityOf(p, chart.planets[p].sign).state;
  const houses = {};
  for (const p of KEY_POINTS) { const h = chart.planets[p]?.house; if (h) houses[p] = h; }
  // 全部相位索引（含三分/六分等主相位）——双体系独立推理需要软相位，训练库必须带上
  const aspectIndex = chart.aspects
    .filter((a) => KEY_POINTS.includes(a.a) && KEY_POINTS.includes(a.b))
    .map((a) => `${a.a}|${a.b}|${a.type}`);
  const planets = {};
  for (const p of [...KEY_POINTS, '上升', '天顶', '下降', '天底']) {
    const q = chart.planets[p];
    if (q) planets[p] = { sign: q.sign, deg: q.deg, house: q.house ?? null, lon: q.lon };
  }
  return {
    discordant, discordantCount: discordant.length, discordantScore: Math.round(score * 100) / 100,
    angleContacts, angleContactCount: angleContacts.length,
    tightCount: discordant.filter((x) => x.tight).length,
    asc: chart.planets['上升'], mc: chart.planets['天顶'],
    elements, dignity, houses, planets, aspectIndex,
    byType: discordant.reduce((a, x) => ({ ...a, [x.type]: (a[x.type] ?? 0) + 1 }), {}),
  };
}

/* ── 八字特征（真太阳时） ── */
export function baziFeatures(rec) {
  const clock = baziClock({ date: rec.date, time: rec.time, lon: rec.lon, tz: rec.offsetHours });
  const b = compileBazi({ at: clock.at, gender: rec.gender ?? '男' });
  const shiShenCount = {};
  for (const s of Object.values(b.L2_shiShen ?? {})) {
    const list = Array.isArray(s) ? s : [s];
    for (const x of list) if (x && typeof x === 'string') shiShenCount[x] = (shiShenCount[x] ?? 0) + 1;
  }
  const rel = b.L4_relations ?? {};
  return {
    clock, pillars: b.pillars, dayMaster: b.dayMaster,
    distribution: b.L3_distribution.adjusted, verdict: b.L3_verdict.verdict, ratio: b.L3_verdict.ratio,
    yong: b.L5_yongJi.yong, ji: b.L5_yongJi.ji,
    spouseZhi: b.L4_spouse.zhi, spouseTypes: b.L4_spouse.types,
    taiYuan: b.L4_taiYuan.ganzhi, mingGong: b.L4_mingGong.ganzhi, shenGong: b.L4_shenGong.ganzhi,
    patterns: b.L4_patterns?.labels ?? [],
    shiShenCount,
    relationCount: { 冲: (rel.chong ?? []).length, 合: (rel.he ?? []).length, 刑: (rel.xing ?? []).length, 害: (rel.hai ?? []).length },
  };
}

/** 融合结盘 */
export function fuse(rec, labels = null) {
  const chart = chartFeatures(rec);
  const bazi = baziFeatures(rec);
  const label = labels?.get(rec.id) ?? null;
  return {
    id: rec.id, name: rec.name, gender: rec.gender,
    birth: { date: rec.date, time: rec.time, offsetHours: rec.offsetHours, lon: rec.lon, lat: rec.lat, place: rec.place },
    timeBase: {
      civil: `${rec.date} ${rec.time}`,
      trueSolar: bazi.clock.usedTrueSolar ? bazi.clock.at : null,
      offsetMinutes: bazi.clock.offsetMinutes, shichenDiffers: bazi.clock.shichenDiffers ?? false,
      dayShift: bazi.clock.dayShift ?? false, fallback: bazi.clock.usedTrueSolar ? null : bazi.clock.reason,
    },
    chart, bazi, label,
    // 交叉特征：星盘×八字的结合点
    cross: {
      ascSign: chart.asc?.sign ?? null, ascElement: chart.asc?.element ?? null,
      dayMasterElement: bazi.distribution ? null : null,
      yongElement: bazi.yong, jiElement: bazi.ji,
      spouseHouseSign: chart.houses ? (chart.asc?.sign ? null : null) : null,
      discordantToSpouse: chart.discordant.filter((x) => x.a === '金星' || x.b === '金星' || x.a === '月亮' || x.b === '月亮').length,
      // 五行与星盘元素的对齐度：八字忌神五行 vs 星盘元素缺失
      elementGap: (() => { const miss = ['火', '土', '风', '水'].filter((e) => !chart.elements[e]); return miss; })(),
    },
  };
}

/**
 * 筛选：不和谐相位 ≥ min 的盘，按加权分排序取前 n
 * R-V2：计数口径固定为「至少一端是十大行星」的刑/冲/梅花/半四分/补八分
 */
export function selectCharts(records, { n = 20, min = 4, labels = null } = {}) {
  const scored = [];
  for (const r of records) {
    try {
      const f = fuse(r, labels);
      if (f.chart.discordantCount >= min) scored.push(f);
    } catch { /* 单条失败不影响整体 */ }
  }
  scored.sort((a, b) => b.chart.discordantScore - a.chart.discordantScore || b.chart.discordantCount - a.chart.discordantCount);
  return { selected: scored.slice(0, n), pool: scored.length };
}

/** 对照样本：随机抽 n 条（与筛选条件无关），用于算 lift */
export function controlSample(records, { n = 800, seed = 42, labels = null, exclude = new Set() } = {}) {
  const rnd = mulberry32(seed);
  const pool = records.filter((r) => !exclude.has(r.id));
  const picked = [];
  const used = new Set();
  while (picked.length < Math.min(n, pool.length)) {
    const i = Math.floor(rnd() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    try { picked.push(fuse(pool[i], labels)); } catch { /* skip */ }
  }
  return picked;
}

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ── 本地训练库（全量融合落盘后的读写） ── */
export const TRAINING_DB = join(PROJ, 'data', 'vedastro', 'training-db.jsonl');

/** 读训练库（一行一条融合记录）。坏行跳过并计数，不静默吞掉。 */
export function loadTrainingDb(path = TRAINING_DB) {
  if (!existsSync(path)) return { records: [], bad: 0, path };
  let bad = 0;
  const records = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch { bad++; }
  }
  return { records, bad, path };
}

/** 从融合记录直接取样（对照组用；无需再算盘） */
export function sampleFused(fused, { n = 800, seed = 42, exclude = new Set() } = {}) {
  const rnd = mulberry32(seed);
  const pool = fused.filter((f) => !exclude.has(f.id) && f.chart?.discordant);
  const picked = [], used = new Set();
  while (picked.length < Math.min(n, pool.length)) {
    const i = Math.floor(rnd() * pool.length);
    if (used.has(i)) continue;
    used.add(i); picked.push(pool[i]);
  }
  return picked;
}

/** 从融合记录里按同一口径筛选（与 selectCharts 等价，省去重算） */
export function selectFromFused(fused, { n = 20, min = 4 } = {}) {
  const scored = fused.filter((f) => (f.chart?.discordantCount ?? 0) >= min);
  scored.sort((a, b) => b.chart.discordantScore - a.chart.discordantScore || b.chart.discordantCount - a.chart.discordantCount);
  return { selected: scored.slice(0, n), pool: scored.length };
}
