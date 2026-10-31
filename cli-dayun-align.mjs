#!/usr/bin/env node
// 大运契合度（用户新增维度）：20–50 岁之间，两人是否同时走在「喜用神」大运上
//   node cli-dayun-align.mjs --a "1990-03-15 12:00" --a-date 1990-03-15 --a-sex 男 \
//                            --b "1992-08-20 12:00" --b-date 1992-08-20 --b-sex 女 [--baseline 4000]
//
// ★ 为什么加这一维：用户指出「上升权重过高」，且认为"两人同走喜神运"应大幅提升契合度。
//   本模块把该维度**独立量化**，并给出**随机配对基线**（R-C3）——否则"同走喜神运"的稀有度无法解释。
//
// ★ 口径：
//   · 喜用 = 用神 或 **生用神者（喜神）**；忌 = 忌神 或 克用神者
//   · 大运五行取**大运天干**（并给出地支五行作旁证）
//   · 窗口 = 20–50 岁（逐年判定）
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileBazi } from './src/bazi/engine.mjs';
import { daYun } from './src/cross/timing.mjs';
import { baziClock } from './src/western/truesolar.mjs';
import { valence } from './src/bazi/complementarity.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
export const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const _KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
/** 生我者（印） */
const SHENG_ME = Object.fromEntries(Object.entries(SHENG).map(([a, b]) => [b, a]));

/**
 * 某五行在此命局中的吉凶定性
 * ★ 经典口径（首版漏了"克忌神者亦为喜神"，导致两人都是 0/31 的退化结果）：
 *   用神 = 所喜；**喜神 = 生用神者 或 克忌神者**；
 *   忌神 = 所忌；**仇神 = 克用神者 或 生忌神者**；其余为闲神
 */
export function favorability(wx, yong, ji) {
  if (!wx || !yong) return '未知';
  if (wx === yong) return '用神';
  if (wx === ji) return '忌神';
  if (SHENG[wx] === yong) return '喜神';        // 生用神
  if (_KE[wx] === ji) return '喜神';            // ★ 克忌神（首版缺失）
  if (_KE[wx] === yong) return '仇神';          // 克用神
  if (SHENG[wx] === ji) return '仇神';          // 生忌神
  return '闲神';
}
export const isFavorable = (k) => k === '用神' || k === '喜神';

/**
 * ★ 适婚窗口年龄权重（用户裁定，2026-10-22）
 * 命题原文：「在提升适婚年龄的大运权重，比如20-40，这和财富和事业息息相关，
 *          是婚姻的基础，后面大运再差，可由于前期的资本积累，可以面对大运的冲击，
 *          但是如果是在适婚年龄走差运，成婚基本没有可能」
 *
 * 据此设**非对称**权重：
 *   20 岁前 0.2（太早，与成婚无关）
 *   20–24  0.6→0.9（进入窗口）
 *   **24–36  1.0（核心窗口，资本/事业/婚姻同时成型）**
 *   36–42  0.9→0.5（窗口收尾，可承接前期积累）
 *   42–50  0.5→0.2（后期，靠前期资本缓冲 —— 故权重显著低于窗口内）
 */
export function ageWeight(age) {
  if (age < 20) return 0.2;
  if (age < 24) return 0.6 + 0.3 * (age - 20) / 4;
  if (age <= 36) return 1.0;
  if (age <= 42) return 0.9 - 0.4 * (age - 36) / 6;
  if (age <= 50) return 0.5 - 0.3 * (age - 42) / 8;
  return 0.2;
}

/**
 * ★ 适婚窗口统计 + **否决性**判定
 * 用户强调「适婚年龄走差运，成婚基本没有可能」⇒ 不是简单加权，而是**门槛**：
 *   windowFrac < 0.15 → severe（几乎无吉运，成婚阻力极大）
 *   windowFrac < 0.30 → weak（吉运稀薄）
 *   其余 normal
 * 另算「后半程是否可被前期缓冲」：looseAfter = 42 岁后吉运比例 vs 窗口内比例
 */
export function marriageWindow(pairs) {
  const inWin = pairs.filter((p) => p.age >= 20 && p.age <= 40);
  const core = pairs.filter((p) => p.age >= 24 && p.age <= 36);
  const late = pairs.filter((p) => p.age > 40);
  const f = (arr) => (arr.length ? arr.filter((p) => p.both).length / arr.length : null);
  const windowFrac = f(inWin), coreFrac = f(core), lateFrac = f(late);
  // 加权（适婚窗口主导）
  let wsum = 0, wboth = 0;
  for (const p of pairs) { const w = ageWeight(p.age); wsum += w; if (p.both) wboth += w; }
  const weighted = wsum ? wboth / wsum : null;
  let veto = 'normal', note = '';
  if (windowFrac !== null && windowFrac < 0.15) { veto = 'severe'; note = '适婚窗口内几乎无共同吉运 ⇒ 成婚阻力极大（否决性）'; }
  else if (windowFrac !== null && windowFrac < 0.30) { veto = 'weak'; note = '适婚窗口内共同吉运稀薄 ⇒ 成婚窗口收窄'; }
  else note = '适婚窗口内有可用吉运';
  // 前期资本积累能否缓冲后期
  let buffer = null;
  if (windowFrac !== null && lateFrac !== null) {
    buffer = lateFrac < windowFrac - 0.15 ? '后期转弱（前期积累可缓冲）'
      : lateFrac > windowFrac + 0.15 ? '后期转强（先苦后甜）' : '前后相近';
  }
  const r3 = (x) => (x === null ? null : Math.round(x * 1000) / 1000);
  return {
    windowFraction: r3(windowFrac), coreFraction: r3(coreFrac), lateFraction: r3(lateFrac),
    weightedFraction: r3(weighted), veto, note, buffer,
    counts: { window: inWin.length, core: core.length, late: late.length },
  };
}

/** 逐岁判定某命在 20–50 岁的吉凶运（取大运天干）— **扶抑框架** */
export function yearJudgements(bazi, gender, { from = 20, to = 50 } = {}) {
  const birth = new Date(bazi.input?.birthDate ?? bazi.input?.date ?? bazi.meta?.birthDate ?? Date.now());
  const dyObj = daYun(bazi.pillars, birth, gender);
  const steps = dyObj?.steps ?? [];
  const yong = bazi.L5_yongJi?.yong ?? null, ji = bazi.L5_yongJi?.ji ?? null;
  const verdict = bazi.L3_verdict?.verdict ?? null;
  const strong = verdict === '身旺' ? true : verdict === '身弱' ? false : undefined;
  const rooted = bazi.L3_verdict?.rooted ?? true;
  const dmWx = GAN_WX[bazi.pillars[2]?.[0]] ?? null;
  const out = [];
  for (let age = from; age <= to; age++) {
    const step = steps.find((d) => age >= d.startAge && age <= d.endAge) ?? steps[steps.length - 1];
    const gz = step?.ganzhi ?? null;
    const wx = gz ? GAN_WX[gz[0]] : null;
    // ★ 关键修正：用**扶抑框架**的 valence，而不是旧的"生用神者=喜神"二元逻辑
    //   （旧逻辑会把"水生木(用神)"的水判为喜神，却忽略身弱时水是克身的官杀 —— 实测丙火女被误判）
    const v = valence(wx, dmWx, strong, rooted, yong, ji);
    const fav = v >= 1.5 ? '用神级' : v > 0 ? '喜神' : v === 0 ? '闲神' : v === -1 ? '仇神' : '忌神级';
    out.push({ age, ganZhi: gz, wx, v, fav, favorable: v > 0 });
  }
  return { yong, ji, strong, rooted, dmWx, steps, years: out, favourableYears: out.filter((x) => x.favorable).length, totalYears: out.length };
}

/** 两人 20–50 岁「同时吉」的年份比例（核心新指标） */
export function dayunAlignment(baziA, baziB, opts = {}) {
  const A = yearJudgements(baziA, opts.sexA ?? '男', opts);
  const B = yearJudgements(baziB, opts.sexB ?? '女', opts);
  const pairs = A.years.map((a, i) => ({ age: a.age, A: a, B: B.years[i], both: a.favorable && B.years[i].favorable }));
  const both = pairs.filter((p) => p.both).length;
  const frac = pairs.length ? both / pairs.length : null;
  const win = marriageWindow(pairs);
  return {
    yongJi: { A: { yong: A.yong, ji: A.ji }, B: { yong: B.yong, ji: B.ji } },
    favourableYears: { A: A.favourableYears, B: B.favourableYears, total: pairs.length },
    bothCount: both, bothFraction: frac === null ? null : Math.round(frac * 1000) / 1000,
    // ★ 适婚窗口指标（新增，不破坏旧字段）
    window: win,
    pairs,
    crossNote: {
      Auyong_eq_Bji: A.yong === B.ji, Buyong_eq_Aji: B.yong === A.ji,
      Auyong_eq_BdmWx: baziA.L5_yongJi?.yong === baziB.L5_yongJi?.candidates?.dmWx,
      Buyong_eq_AdmWx: baziB.L5_yongJi?.yong === baziA.L5_yongJi?.candidates?.dmWx,
    },
  };
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const A = arg('a', '1990-03-15 12:00'), B = arg('b', '1992-08-20 12:00');
  const aDate = arg('a-date', '1990-03-15'), bDate = arg('b-date', '1992-08-20');
  const sexA = arg('a-sex', '男'), sexB = arg('b-sex', '女');
  const nb = Number(arg('baseline', 4000));
  const L = [];
  const P = (s) => { console.log(s); L.push(s); };

  const baziA = compileBazi({ at: A, gender: sexA });
  const baziB = compileBazi({ at: B, gender: sexB });
  // 给 daYun 提供出生 Date
  baziA.input = { ...(baziA.input ?? {}), birthDate: aDate };
  baziB.input = { ...(baziB.input ?? {}), birthDate: bDate };
  const r = dayunAlignment(baziA, baziB, { sexA, sexB });

  P('# 大运契合度（20–50 岁）');
  P('');
  P('| 项 | A（男） | B（女） |');
  P('|---|---|---|');
  P(`| 四柱 | ${baziA.pillars.join(' ')} | ${baziB.pillars.join(' ')} |`);
  P(`| 用神 | **${r.yongJi.A.yong}** | **${r.yongJi.B.yong}** |`);
  P(`| 忌神 | **${r.yongJi.A.ji}** | **${r.yongJi.B.ji}** |`);
  P(`| 20–50 岁中吉运年数 | ${r.favourableYears.A} / ${r.favourableYears.total} | ${r.favourableYears.B} / ${r.favourableYears.total} |`);
  P('');
  P(`## **两人同时走吉运：${r.bothCount} / ${r.favourableYears.total} 年 = ${(r.bothFraction * 100).toFixed(1)}%**`);
  P('');
  P('## 交叉检查（用神/忌神互见）');
  P('');
  P('| 检查 | 结果 |');
  P('|---|---|');
  P(`| A 的用神 = B 的忌神？ | ${r.crossNote.Auyong_eq_Bji ? '**是**（相悖）' : '否'} |`);
  P(`| B 的用神 = A 的忌神？ | ${r.crossNote.Buyong_eq_Aji ? '**是**（相悖）' : '否'} |`);
  P(`| A 的用神 = B 的日主五行？ | ${r.crossNote.Auyong_eq_BdmWx ? '**是**（互相补益）' : '否'} |`);
  P(`| B 的用神 = A 的日主五行？ | ${r.crossNote.Buyong_eq_AdmWx ? '**是**' : '否'} |`);
  P('');
  if (nb > 0) {
    // 随机配对基线：从 VedAstro 抽盘，看"同时吉运"比例的分布
    const { loadVedastro } = await import('./src/vedastro/adapter.mjs');
    let recs = null;
    try { recs = loadVedastro().records; } catch { recs = null; }
    if (recs && recs.length > 100) {
      const base = [];
      const N = Math.min(nb, recs.length);
      for (let i = 0; i < N; i++) {
        const r1 = recs[Math.floor(Math.random() * recs.length)];
        const r2 = recs[Math.floor(Math.random() * recs.length)];
        if (r1 === r2) continue;
        try {
          const b1 = compileBazi({ at: `${r1.date} ${r1.time || '12:00'}`, gender: '男' });
          const b2 = compileBazi({ at: `${r2.date} ${r2.time || '12:00'}`, gender: '女' });
          b1.input = { ...(b1.input ?? {}), birthDate: r1.date };
          b2.input = { ...(b2.input ?? {}), birthDate: r2.date };
          const x = dayunAlignment(b1, b2, { sexA: '男', sexB: '女' });
          if (x.bothFraction !== null) base.push(x.bothFraction);
        } catch { /* skip */ }
      }
      if (base.length > 50) {
        base.sort((p, q) => p - q);
        const mu = base.reduce((s, v) => s + v, 0) / base.length;
        const sd = Math.sqrt(base.reduce((s, v) => s + (v - mu) ** 2, 0) / base.length) || 1e-9;
        const z = (r.bothFraction - mu) / sd;
        const pct = base.filter((v) => v <= r.bothFraction).length / base.length;
        P('## 随机配对基线（R-C3）');
        P('');
        P('| 项 | 值 |');
        P('|---|---|');
        P(`| 随机异配对数 | ${base.length} |`);
        P(`| 基线均值 ± sd | **${(mu * 100).toFixed(2)}% ± ${(sd * 100).toFixed(2)}%** |`);
        P(`| P5 / P50 / P95 | ${(base[Math.floor(base.length * 0.05)] * 100).toFixed(1)}% / ${(base[Math.floor(base.length * 0.5)] * 100).toFixed(1)}% / ${(base[Math.floor(base.length * 0.95)] * 100).toFixed(1)}% |`);
        P(`| **本对 ${(r.bothFraction * 100).toFixed(1)}% 的分位** | **P${(pct * 100).toFixed(1)}** |`);
        P(`| **相对基线 z** | **${z.toFixed(2)}** |`);
        P('');
        P(`**判读**：${z > 1.96 ? '**显著高于随机**（两人同走吉运的比例异常高）' : z < -1.96 ? '显著低于随机' : '**与随机无异** —— 不能作为"契合度高"的证据'}`);
      }
    } else P('> 基线：VedAstro 数据不可用，跳过');
  }
  P('');
  P('## 逐年明细（A/B 各自吉凶 + 是否同时吉）');
  P('');
  P('| 年龄 | A 大运 | A 五行 | A 判 | B 大运 | B 五行 | B 判 | 同时吉 |');
  P('|---|---|---|---|---|---|---|---|');
  for (const p of r.pairs) P(`| ${p.age} | ${p.A.ganZhi} | ${p.A.wx} | ${p.A.fav} | ${p.B.ganZhi} | ${p.B.wx} | ${p.B.fav} | ${p.both ? '**是**' : '—'} |`);
  P('');
  P('> 状态 `hypothesis_under_validation`｜置信度上限 **0.6**｜**严禁吉凶断语**（R-C5/R-B13）。');
  P('> 口径：喜用 = 用神 或 生用神者（喜神）；大运五行取**天干**。');

  const rp = arg('report');
  if (rp) { const { writeFileSync, mkdirSync } = await import('node:fs'); mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
