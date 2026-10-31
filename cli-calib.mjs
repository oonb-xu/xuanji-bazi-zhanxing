#!/usr/bin/env node
// Part 11 · 古籍年份校准（干支锚点 → 公历候选 → 天文/历法多重约束过滤）
//   node cli-calib.mjs --cases             # 对《大六壬断案》全部案例做校准，输出候选集
//   node cli-calib.mjs --cases --from 1000 --to 1300
//
// ★ 设计前提（与规格 §11.3 的两处关键差异，见 docs/22）：
//   1. **日干支唯一化是错的**：日干支每 60 天循环一次，单凭日干支无法定日期。
//      真正把候选压到「每 60 年 1 个」的是 **年干支 + 月将（天文约束）+ 日干支** 三者的合取 ——
//      其中**月将把日期限制在某个中气区间内（约 30 天）**，而 30 天窗口内一个给定日干支最多出现一次。
//   2. **古籍年份仍不可"唯一化"**：60 年一循环的歧义必须靠**外部史料**（人物生卒/活动年代）消解，
//      本工具**只输出候选集与约束满足情况，不替史料下判断**。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SolarTime } from 'tyme4ts';
import { governingZhongQi, yueJiangFromQi, shiChenOf } from './src/daliuren.mjs';
import { compileFromGanZhi } from './src/daliuren.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, 'data', 'liuren', 'cases.jsonl');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** 取某公历日的 (年干支, 月干支, 日干支, 时干支) */
export function ganzhiOf(y, m, d, hh = 12) {
  const ec = SolarTime.fromYmdHms(y, m, d, hh, 0, 0).getLunarHour().getEightChar();
  const g = (x) => x.getName();
  return { year: g(ec.getYear()), month: g(ec.getMonth()), day: g(ec.getDay()), hour: g(ec.getHour()) };
}

/** 月将 → 所属中气（月将 = 太阳过宫；午将 ⇒ 大暑后） */
export const YUE_JIANG_TO_QI = { 戌: '春分', 酉: '谷雨', 申: '小满', 未: '夏至', 午: '大暑', 巳: '处暑', 辰: '秋分', 卯: '霜降', 寅: '小雪', 丑: '冬至', 子: '大寒', 亥: '雨水' };

/**
 * 校准一例：枚举候选公历日期
 * 约束：① 年干支相符 ② 月将相符（= 落在该月将对应的中气区间内）③ 日干支相符
 */
export function calibrate(c, { from = 1000, to = 1300 } = {}) {
  const out = { case: c, candidates: [], rejected: [] };
  const qi = YUE_JIANG_TO_QI[c.yueJiang];
  if (!qi) { out.rejected.push(`未知月将「${c.yueJiang}」`); return out; }
  for (let y = from; y <= to; y++) {
    // 快速筛：该年立春后的年干支是否相符
    if (ganzhiOf(y, 6, 1).year !== c.yearGz) continue;
    // 在该年逐日找：月将相符 + 日干支相符（一年 366 天，成本可接受）
    for (let m = 1; m <= 12; m++) {
      const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= dim; d++) {
        const date = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
        let curQi;
        try { curQi = governingZhongQi(date); } catch { continue; }
        if (curQi !== qi) continue;                      // ② 月将约束（天文）
        const gz = ganzhiOf(y, m, d);
        if (gz.day !== c.dayGz) continue;                // ③ 日干支
        // ① 年干支（立春后口径）
        if (gz.year !== c.yearGz) continue;
        out.candidates.push({
          date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          year: y, ganzhi: gz, zhongQi: curQi, yueJiang: c.yueJiang,
          zhanShiCandidates: shiChenOf(12).name,          // 占时需时辰，日精度下只能给"该日时支表"
        });
      }
    }
  }
  return out;
}

/** ★ R-X2：CLI 主体必须用"是否主模块"守卫，否则 `import { ganzhiOf }` 会把整个 CLI 重跑一遍
 *  （本文件首版就犯了这个错 —— 规则写下来还不等于会遵守，所以要做成代码级守卫） */
const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
if (!existsSync(CASES)) { console.error(`缺 ${CASES}`); process.exit(2); }
const all = readFileSync(CASES, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const from = Number(arg('from', 1000)), to = Number(arg('to', 1300));

if (argv.includes('--cases') || argv.length === 0) {
  const withYear = all.filter((c) => c.yearGz && c.yueJiang && c.dayGz);
  const results = [];
  let uniq = 0, zero = 0;
  for (const c of withYear) {
    const r = calibrate(c, { from, to });
    results.push(r);
    if (r.candidates.length === 1) uniq++;
    if (r.candidates.length === 0) zero++;
  }
  P('# Part 11 · 古籍年份校准报告');
  P('');
  P(`扫描区间：**${from}–${to}**（${to - from + 1} 年）｜参与校准课例：**${withYear.length}**（须同时有 年干支 + 月将 + 日干支）`);
  P('');
  P('## 校准原理（与规格 §11.3 的差异见 docs/22）');
  P('');
  P('三重约束合取：**年干支**（60 年一遇）×  **月将 = 太阳过宫**（把日期限制在该中气区间，约 30 天）×  **日干支**（60 日一遇）');
  P('→ 30 天窗口内一个给定日干支最多出现一次 ⇒ **每 60 年恰好 1 个候选**。');
  P('');
  P('## 结果');
  P('');
  P('| 指标 | 值 |');
  P('|---|---|');
  P(`| 参与校准课例 | ${withYear.length} |`);
  P(`| 候选数 = 1（区间内唯一） | **${uniq}** |`);
  P(`| 候选数 = 0（约束无解 → 需查） | **${zero}** |`);
  P(`| 每例平均候选数 | ${(results.reduce((a, r) => a + r.candidates.length, 0) / (results.length || 1)).toFixed(2)} |`);
  P('');
  P('## 逐例候选（前 25）');
  P('');
  P('| 事由 | 年干支 | 月将 | 日干支 | 候选公历日期 | 候选数 |');
  P('|---|---|---|---|---|---|');
  for (const r of results.filter((x) => x.candidates.length).slice(0, 25)) {
    const c = r.case;
    P(`| 占${c.matter} | ${c.yearGz} | ${c.yueJiang} | ${c.dayGz} | ${r.candidates.map((x) => x.date).join('、')} | ${r.candidates.length} |`);
  }
  P('');
  P('## 约束无解的课例（前 15）');
  P('');
  P('> 无解意味着：**年干支 + 月将 + 日干支 三者在扫描区间内不共存** —— 可能是古本传抄误字、或该年干支不在区间内。');
  P('');
  for (const r of results.filter((x) => !x.candidates.length).slice(0, 15)) {
    P(`- 占${r.case.matter}｜${r.case.yearGz}年${r.case.month}月${r.case.dayGz}日${r.case.yueJiang}将${r.case.zhanShi}时｜集${r.case.collection}行${r.case.line}`);
  }
  P('');
  P('## ⚠️ 残留歧义（必须说清）');
  P('');
  P('**古籍年份仍无法唯一确定。** 每 60 年一个候选，而《断案》为宋人辑录、多数案例无绝对年代标注。');
  P('消解歧义只能靠**外部史料**（邵彦和生卒与活动年代、案例中的人物/官职/事件），');
  P('**本工具不替史料下判断** —— 输出候选集，由人工按史料裁定。');
  P('');
  P('已知史料约束（供人工裁定用）：邵彦和为北宋人，活动于**哲宗—高宗**年间；');
  P('则其课例的「戊申年」候选 **1068 / 1128** 二者之一（前者在其青年、后者在其晚年）。');
  const rp = arg('report', 'reports/part11-calib.md');
  mkdirSync(dirname(rp), { recursive: true });
  writeFileSync(rp, L.join('\n'), 'utf8');
  console.error(`[报告已写入] ${rp}`);
  const jp = arg('json', 'data/liuren/calibrated-years.json');
  mkdirSync(dirname(jp), { recursive: true });
  writeFileSync(jp, JSON.stringify({ meta: { from, to, n: withYear.length, uniq, zero }, results }, null, 1), 'utf8');
  console.error(`[候选集已写入] ${jp}`);
}
}

if (IS_MAIN) main();
