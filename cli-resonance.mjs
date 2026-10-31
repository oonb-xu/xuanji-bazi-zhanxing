#!/usr/bin/env node
// Part 11 修正版 · 事件共振匹配（Event Resonance Matching）
//   node cli-resonance.mjs --run        # 跑共振检验
//
// ★ 修正指令1 落地：**彻底不做「占问日 ↔ 出生日」的时间映射**。
//   核心原则（用户定稿）：占问日提供的是**社会事件的当下切片**，星盘提供的是**个体的先天物理底盘**，
//   **两者不存在直接的时间映射**。⇒ 改为「**事件共振匹配**」：按**事项类别**配对，做**结构对比**而非日期对比。
//
// ★ 可机检的共振口径（唯一有共同时空坐标的一层）：
//   六壬侧的**月将 = 太阳过宫**，名人侧的**本命太阳** —— 两者都是「太阳黄经」，
//   而黄经 → 地支 → 五行 是本项目 L2 盘面层已有的映射 ⇒ **两侧可以放在同一个五行坐标上比较**。
//   这是 R-W14 唯一承认的恒等层，也正好是"天文物理约束"的落地形式。
//
// ★ 修正指令3 落地：无「天文物理约束」或「双重事件验证」的跨系统配对，**置信度强制封顶 0.6**。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eclipticLongitude } from './src/western/zodiac.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, 'data', 'liuren', 'cases.jsonl');
const VED = join(HERE, 'data', 'vedastro', 'PersonList-15k.csv');
const OUT = join(HERE, 'data', 'cross', 'resonance.json');
const argv = process.argv.slice(2);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/* ── 修正指令3：置信度硬闸 ── */
export const CONFIDENCE_CAP = 0.6;
/**
 * 跨系统配对的置信度闸门
 * @param raw 原始置信度（0–1）
 * @param hasAstroConstraint 是否有**天文物理约束**（月将↔太阳黄经 这类可独立验算的约束）
 * @param hasDualEventWitness 是否有**双重事件验证**（两侧各自独立的事件证据）
 */
export function gateConfidence(raw, { hasAstroConstraint = false, hasDualEventWitness = false } = {}) {
  const blocked = !hasAstroConstraint && !hasDualEventWitness;
  const capped = blocked ? Math.min(raw, CONFIDENCE_CAP) : raw;
  return {
    raw, capped, blocked,
    writable: !blocked && capped > CONFIDENCE_CAP,   // ★ 被封顶的配对**严禁**写入正式案例库
    reason: blocked ? '缺天文物理约束且无双事件验证 → 封顶 0.6，禁入正式库' : '通过（有独立约束）',
  };
}

/* ── 黄经 → 地支 → 五行（L2 盘面层既有映射） ── */
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
/** 黄经 → 地盘支：L = 270 + 30i ⇒ i = ((L − 270)/30) mod 12 */
export const zhiOfLongitude = (L) => ZHI[Math.round(((L - 270) / 30 + 1200)) % 12];
export const wuxingOfLongitude = (L) => ZHI_WX[zhiOfLongitude(L)];

/* ── 事项类别归一（六壬侧） ── */
export function categoryOfMatter(matter) {
  const m = String(matter ?? '');
  if (/前程|赴任|应试|武试|省试|功名|科举|迁转|谋动/.test(m)) return '事业功名';
  if (/婚姻|婚|妻|娶/.test(m)) return '婚恋';
  if (/财|求财|生意/.test(m)) return '财运';
  if (/病|疾/.test(m)) return '疾病';
  if (/宅|家宅|迁居/.test(m)) return '家宅';
  if (/讼|官|狱|罪/.test(m)) return '官讼';
  if (/行人|逃亡|失物|盗/.test(m)) return '寻人失物';
  if (/终身|命/.test(m)) return '终身格局';
  return '其他';
}

/** 卡方检验（分类×分类） */
export function chiSquare(table) {
  if (!Array.isArray(table) || !table.length || !Array.isArray(table[0]) || !table[0].length) {
    return { chi2: 0, df: 0, p: 1, empty: true };
  }
  const rows = table.length, cols = table[0].length;
  const rs = table.map((r) => r.reduce((a, b) => a + b, 0));
  const cs = table[0].map((_, j) => table.reduce((a, r) => a + r[j], 0));
  const n = rs.reduce((a, b) => a + b, 0);
  if (!n) return { chi2: 0, df: 0, p: 1 };
  let chi2 = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const e = (rs[i] * cs[j]) / n;
    if (e > 0) chi2 += (table[i][j] - e) ** 2 / e;
  }
  const df = (rows - 1) * (cols - 1);
  // 卡方尾概率（Wilson–Hilferty 近似，df≥1）
  const z = df > 0 ? (Math.cbrt(chi2 / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df)) : 0;
  const p = 0.5 * erfc(z / Math.SQRT2);
  return { chi2, df, p: Math.max(0, Math.min(1, p)) };
}
/** 互补误差函数（Numerical Recipes 连分式近似）—— 写成系数数组，避免深嵌套括号出错 */
const ERFC_C = [1.00002368, 0.37409196, 0.09678418, -0.18628806, 0.27886807, -1.13520398, 1.48851587, -0.82215223, 0.17087277];
const erfc = (x) => {
  const t = 1 / (1 + 0.5 * Math.abs(x));
  let poly = 0;
  for (let i = ERFC_C.length - 1; i >= 0; i--) poly = (poly + ERFC_C[i]) * t;
  const y = t * Math.exp(-x * x - 1.26551223 + poly);
  return x >= 0 ? y : 2 - y;
};

const WX5 = ['木', '火', '土', '金', '水'];
/** 由频数表算归一化五行画像（按 WX5 顺序） */
const profile = (m) => WX5.map((w) => (m[w] ?? 0));

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  if (!existsSync(CASES)) { console.error(`缺 ${CASES}`); process.exit(2); }
  const cases = readFileSync(CASES, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

  /* ── 侧 A：六壬课例（65 例）—— 事项类别 × 月将五行 ── */
  const body = { 六壬: { catWx: {}, cats: [], tab: null }, 占星: { catWx: {}, cats: [], tab: null } };
  const catOf = {};
  for (const c of cases) {
    const cat = categoryOfMatter(c.matter);
    const wx = ZHI_WX[c.yueJiang];
    if (!wx) continue;
    (catOf[cat] ??= {})[wx] = ((catOf[cat] ?? {})[wx] ?? 0) + 1;
  }
  const cats6 = Object.keys(catOf);
  const tab6 = cats6.map((k) => profile(catOf[k]));
  const test6 = chiSquare(tab6);

  /* ── 侧 B：名人星盘 —— 事件类别 × 本命太阳五行 ── */
  // 事件类别用 VedAstro 的真实婚姻记录：有离婚 = 婚变；仅结婚 = 婚稳
  let ved = null;
  if (existsSync(VED)) {
    // ★ 用已验证的 `loadVedastro()`（15,807 条）而非自己解析 CSV/time —— 首版误用 `parseStdTime` 的接口，15807 条全失败
    const { loadVedastro } = await import('./src/vedastro/adapter.mjs');
    const { loadLabels } = await import('./src/vedastro/pipeline.mjs');
    const { records } = loadVedastro();
    const labels = loadLabels();
    const catWx = {};
    let n = 0, bad = 0;
    for (const r of records) {
      if (n >= 3000) break;
      let lon;
      try {
        const [Y, M, D] = r.date.split('-').map(Number);
        const [hh, mm] = (r.time || '12:00').split(':').map(Number);
        const utc = new Date(Date.UTC(Y, M - 1, D, hh || 12, mm || 0) - r.offsetHours * 3600e3);
        lon = eclipticLongitude('太阳', utc);
      } catch { bad++; continue; }
      const wx = wuxingOfLongitude(lon);
      const lab = labels.get(r.id);
      const ev = lab && lab.years && lab.years.length ? '有婚史' : '无婚史';
      (catWx[ev] ??= {})[wx] = ((catWx[ev] ?? {})[wx] ?? 0) + 1;
      n++;
    }
    const catsA = Object.keys(catWx);
    ved = { n, bad, catWx, tab: catsA.map((k) => profile(catWx[k])), cats: catsA, test: chiSquare(catsA.map((k) => profile(catWx[k]))) };
  }

  /* ── 报告 ── */
  P('# Part 11 修正版 · 事件共振匹配 检验报告');
  P('');
  P('## 口径（修正指令1 落地）');
  P('');
  P('**不做任何「占问日 ↔ 出生日」的时间映射。** 核心原则：占问日 = 社会事件的当下切片；星盘 = 个体的先天物理底盘。');
  P('改为按**事项类别**配对，做**结构对比**：');
  P('');
  P('两侧唯一的共同时空坐标 = **太阳黄经**（六壬侧「月将 = 太阳过宫」；名人侧「本命太阳」）→');
  P('经 **L2 盘面层**映射 `黄经 → 地支 → 五行`，两侧落在同一五行坐标上。这是 R-W14 唯一承认的恒等层。');
  P('');
  P('## 侧 A：六壬课例（事项类别 × 月将五行）');
  P('');
  P(`参与课例：**${cases.length}**｜事项类别 **${cats6.length}** 类`);
  P('');
  P('| 事项类别 | 木 | 火 | 土 | 金 | 水 | 合计 |');
  P('|---|---|---|---|---|---|---|');
  for (const [i, k] of cats6.entries()) P(`| ${k} | ${tab6[i].join(' | ')} | ${tab6[i].reduce((a, b) => a + b, 0)} |`);
  P('');
  P(`**卡方检验**：χ² = ${test6.chi2.toFixed(2)}，df = ${test6.df}，**p = ${test6.p.toFixed(4)}** → ${test6.p < 0.05 ? '⚠️ 显著' : '**不显著（月将五行与事项类别无关联）**'}`);
  P('');
  if (ved) {
    P('## 侧 B：名人星盘（婚史 × 本命太阳五行）');
    P('');
    P(`取样 **${ved.n}** 人（解析失败 ${ved.bad}）｜类别：${ved.cats.join('、')}`);
    P('');
    P('| 婚史 | 木 | 火 | 土 | 金 | 水 | 合计 |');
    P('|---|---|---|---|---|---|---|');
    for (const [i, k] of ved.cats.entries()) P(`| ${k} | ${ved.tab[i].join(' | ')} | ${ved.tab[i].reduce((a, b) => a + b, 0)} |`);
    P('');
    P(`**卡方检验**：χ² = ${ved.test.chi2.toFixed(2)}，df = ${ved.test.df}，**p = ${ved.test.p.toFixed(4)}** → ${ved.test.p < 0.05 ? '⚠️ 显著' : '**不显著（太阳五行与婚史无关联）**'}`);
    P('');
  }
  P('## 修正指令3：置信度硬闸');
  P('');
  const demo = [
    ['跨系统配对（无天文约束、无双事件验证）', 0.9],
    ['有天文物理约束（月将↔太阳黄经 可独立验算）', 0.9],
    ['有双重事件验证', 0.9],
  ];
  P('| 情形 | 原始置信度 | 闸门后 | 可写入正式库 |');
  P('|---|---|---|---|');
  for (const [name, raw] of demo) {
    const g = gateConfidence(raw, { hasAstroConstraint: name.includes('天文'), hasDualEventWitness: name.includes('双重') });
    P(`| ${name} | ${raw} | **${g.capped}** | ${g.writable ? '✅' : '❌ 禁入'} |`);
  }
  P('');
  P(`> **R-B13**：跨系统配对若缺「天文物理约束」或「双重事件验证」，置信度**强制封顶 ${CONFIDENCE_CAP}**，`);
  P('> **严禁写入正式案例库**。');
  P('');
  P('## 检验结论');
  P('');
  const anySig = test6.p < 0.05 || (ved && ved.test.p < 0.05);
  P(anySig ? '- 至少一侧显著 → 需进一步核查（可能是多重比较假阳性）' : '- **两侧均不显著** → **事件共振匹配在本数据上未检出正结果**（与 R-E12/R-W13 的既有结论一致）');
  P('');
  P('**必须说清的口径限制**：');
  P('1. 侧 A 仅 65 例、8 类 → **功效极低**（每格期望频数常 <5），"不显著"**不能**当作"不存在"的证据；');
  P('2. 侧 B 用的是「婚史有无」而非"事件年份结构"，与六壬事项类别**并非同一层级**的对象；');
  P('3. 两侧回答的是不同问题（占问切片 vs 先天底盘），**共振本就不该表现为统计相关** —— 这正是修正指令1 的核心原则。');

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ meta: { cases: cases.length, cats6, test6, ved: ved && { n: ved.n, cats: ved.cats, test: ved.test }, cap: CONFIDENCE_CAP }, catWx6: catOf, catWxVed: ved?.catWx ?? null }, null, 1), 'utf8');
  console.error(`[共振结果已写入] ${OUT}`);

  const rp = argv[argv.indexOf('--report') + 1];
  if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
