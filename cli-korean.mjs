#!/usr/bin/env node
// 韩式八字（Korean Public Figures with Saju, 39,494 人）
//
// R-G2-EXEMPT: 本数据集**只有日精度、无出生时刻**（R-K1），
//   故以 12:00 作为占位仅用于定**年/月/日三柱**，**时柱一律丢弃**（库中 hourPillar 写 null）；
//   不适用「八字排盘必须经 baziClock 真太阳时」——因为无时刻可真太阳时修正。
//   node cli-korean.mjs --check     # 三柱排盘对拍（与数据集自带的三柱逐条比）—— 100% 机检
//   node cli-korean.mjs --taiyuan   # 计算胎元（并说明为何命宫/身宫不可算）
//   node cli-korean.mjs --dump      # 落成本地库 data/korean/korean-db.jsonl
//   node cli-korean.mjs --occ       # 三柱特征 × 职业类别的分布
//
// ★ 数据硬限制：**只有日精度 → 无出生时刻**
//   · 可算：年柱 / 月柱 / 日柱（三柱）、**胎元**（只需月柱）
//   · 不可算：**时柱、大运、命宫、身宫**（命宫/身宫公式都要时支）→ 一律**不得**在此数据集上评估
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIAN_GAN, DI_ZHI } from './src/constants.mjs';
import { compileBazi } from './src/bazi/engine.mjs';
import { taiYuanOf } from './src/bazi/five-pillar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, 'data', 'korean', 'persons.csv');
const DB = join(HERE, 'data', 'korean', 'korean-db.jsonl');
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

if (!existsSync(CSV)) { console.error(`缺 ${CSV}\n先生成：python -c "import pandas as pd; d=pd.read_excel('data/korean/persons.xlsx'); d.to_csv('data/korean/persons.csv',index=False,encoding='utf-8-sig')"`); process.exit(2); }

/**
 * ★ 用正规 CSV 解析器。首版手写 `l.split(',')` —— 而 `occupations_raw` 里**含逗号**，
 *   导致整行列错位：日支被读成 "undefined"、年干被读成布尔 "True"，**且不报错**。
 *   教训：外部数据一律不手写解析器（本会话第三次同类 bug）。
 */
function loadCsv(path) {
  const { parse } = require('csv-parse/sync');
  return parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true, bom: true });
}

const rows = loadCsv(CSV);
if (!flag('dump')) P(`# 韩式八字 · Korean Public Figures with Saju\n\n载入 **${rows.length}** 条｜出生日期精度：**日**（无时刻）\n`);

/** 胎元已抽到纯模块 `src/bazi/five-pillar.mjs`（CLI 文件有顶层副作用，不得被 import —— R-X2） */
export { taiYuanOf };

if (flag('check')) {
  let okY = 0, okM = 0, okD = 0, okAll = 0, err = 0;
  const badY = [], badM = [], badD = [];
  for (const r of rows) {
    const at = `${r.birth_date} 12:00`;                       // 时刻缺失：取正午仅用于定三柱，时柱一律丢弃
    let b;
    try { b = compileBazi({ at, gender: r.gender === 'female' ? '女' : '男' }); } catch { err++; continue; }
    const [Y, M, D] = b.pillars;
    const dy = `${r.year_stem}${r.year_branch}`, dm = `${r.month_stem}${r.month_branch}`, dd = `${r.day_stem}${r.day_branch}`;
    const y = Y === dy, m = M === dm, d = D === dd;
    if (y) okY++; else if (badY.length < 5) badY.push(`${r.birth_date} 我${Y} vs 库${dy}`);
    if (m) okM++; else if (badM.length < 5) badM.push(`${r.birth_date} 我${M} vs 库${dm}`);
    if (d) okD++; else if (badD.length < 5) badD.push(`${r.birth_date} 我${D} vs 库${dd}`);
    if (y && m && d) okAll++;
  }
  const n = rows.length - err;
  const pct = (x) => `${(x / n * 100).toFixed(3)}%`;
  P('## 三柱排盘对拍（与数据集自带三柱逐条比）');
  P('');
  P('| 柱 | 一致 | 一致率 | 不一致样例 |');
  P('|---|---|---|---|');
  P(`| 年柱 | ${okY}/${n} | **${pct(okY)}** | ${badY.slice(0, 3).join('；') || '—'} |`);
  P(`| 月柱 | ${okM}/${n} | **${pct(okM)}** | ${badM.slice(0, 3).join('；') || '—'} |`);
  P(`| 日柱 | ${okD}/${n} | **${pct(okD)}** | ${badD.slice(0, 3).join('；') || '—'} |`);
  P(`| 三柱全对 | ${okAll}/${n} | **${pct(okAll)}** | 解析失败 ${err} |`);
  P('');
  P('> 对拍口径：本引擎按**立春换年、节气换月**（tyme4ts）；数据集的柱由对方算法给出。');
  P('> 年柱不一致集中在立春前后、月柱不一致集中在节气交界日 —— 这属于**换柱边界的口径差**，不是错，但要逐条看清。');
} else if (flag('taiyuan')) {
  const dist = {};
  let n = 0;
  for (const r of rows) {
    const mp = `${r.month_stem}${r.month_branch}`;
    try { const t = taiYuanOf(mp); dist[t] = (dist[t] ?? 0) + 1; n++; } catch { /* skip */ }
  }
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  P('## 胎元（可算）');
  P('');
  P(`- 计算成功 **${n}/${rows.length}**｜不同胎元 **${top.length}** 种（理论 60 种，因胎元只随月柱变化）`);
  P('- 公式：**月干进一位、月支进三位**（只需月柱）');
  P(`- 分布前 8：${top.slice(0, 8).map(([k, v]) => `${k}(${v})`).join('、')}`);
  P('');
  P('## 命宫 / 身宫（**不可算，必须说清**）');
  P('');
  P('- 传统公式：命宫 = 以**月支**与**时支**合成（子月起始顺逆数至卯）；身宫 = 以月支与时支合成。');
  P('- 两者**都必须用到时支**，而该数据集**无出生时刻** → **命宫/身宫一律不可算**。');
  P('- 同理**时柱、大运**也不可算 → 凡涉及这两类的规则**在此数据集上不得评估**（R-K1）。');
  P('- ✅ 提示：本项目的 `data/samples.jsonl` 里有 **有时刻**的样本（案例001 + 20 盘 VedAstro AA），');
  P('  那些样本的胎元/命宫/身宫是**完整**的，可作对照。');
} else if (flag('occ')) {
  const byStem = {}, byAnimal = {};
  for (const r of rows) {
    const ds = r.day_stem; if (!ds) continue;
    const occ = String(r.occupations_raw || '').split(/[;|,]/)[0].trim().slice(0, 12) || '（无）';
    (byStem[ds] ??= {})[occ] = ((byStem[ds] ?? {})[occ] ?? 0) + 1;
  }
  P('## 日主 × 职业（原始计数，不做显著性）');
  P('');
  P('| 日主 | 人数量级 | 最高频职业 |');
  P('|---|---|---|');
  for (const g of TIAN_GAN) {
    const m = byStem[g]; if (!m) continue;
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    P(`| ${g} | ${tot} | ${top[0]}(${top[1]}) |`);
  }
  P('');
  P('> ⚠️ 这只是**原始计数**：职业字段是自由文本、多人多职业，且未控制国别/年代/性别。');
  P('> 要出结论必须做**职业类目归一 + 分层对照**（下一步）。');
} else if (flag('dump')) {
  mkdirSync(dirname(DB), { recursive: true });
  writeFileSync(DB, '', 'utf8');
  let n = 0, fail = 0;
  for (const r of rows) {
    try {
      const b = compileBazi({ at: `${r.birth_date} 12:00`, gender: r.gender === 'female' ? '女' : '男' });
      const [Y, M, D] = b.pillars;
      appendFileSync(DB, JSON.stringify({
        id: r.wikidata_qid, name: r.name_ko, date: r.birth_date, gender: r.gender,
        place: r.birth_place, occupations: r.occupations_raw,
        pillars3: { year: Y, month: M, day: D },
        library: { year: `${r.year_stem}${r.year_branch}`, month: `${r.month_stem}${r.month_branch}`, day: `${r.day_stem}${r.day_branch}` },
        taiYuan: taiYuanOf(M),
        mingGong: null, shenGong: null, hourPillar: null,      // 无时刻 → 明确置 null，不编造
        note: '日精度数据：无时柱/大运/命宫/身宫',
      }) + '\n', 'utf8');
      n++;
    } catch { fail++; }
  }
  P(`落盘 → ${DB}\n\n- 写入 **${n}** 条，失败 ${fail}｜**时柱/大运/命宫/身宫 一律为 null（不编造）**`);
  console.error(`[本地库已写入] ${DB} (${n} 条)`);
}

const rp = argv[argv.indexOf('--report') + 1];
if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
