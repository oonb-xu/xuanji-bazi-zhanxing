#!/usr/bin/env node
// VedAstro 数据集 → 筛选 → 星盘＋八字融合结盘 → 规则精细化挖掘 → 待人工修正
//   node cli-vedastro.mjs --stats
//   node cli-vedastro.mjs --select 20 --report reports/vedastro-20.md --json data/vedastro/selected-20.json
//   node cli-vedastro.mjs --mine --label divorced --report reports/vedastro-rules.md --json data/vedastro/rule-candidates.json
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadVedastro, datasetStats, VEDASTRO_CSV } from './src/vedastro/adapter.mjs';
import { loadLabels, fuse, selectCharts, controlSample, loadTrainingDb, sampleFused, selectFromFused } from './src/vedastro/pipeline.mjs';
import { mine, mineLabel, renderRuleTable } from './src/vedastro/mine.mjs';

/** 选择挖掘数据源：优先本地训练库（15,807 条，秒级），否则从 CSV 现算 */
function mineSource(records, labels, { n, min, controlN }) {
  const { records: db, bad, path } = loadTrainingDb();
  if (db.length >= 1000) {
    const { selected, pool } = selectFromFused(db, { n, min });
    const exclude = new Set(selected.map((s) => s.id));
    return { selected, control: sampleFused(db, { n: controlN, exclude }), src: `本地训练库 ${db.length} 条（坏行 ${bad}）｜符合条件 ${pool}`, fromDb: true, dbPath: path };
  }
  const { selected, pool } = selectCharts(records, { n, min, labels });
  const exclude = new Set(selected.map((s) => s.id));
  return { selected, control: controlSample(records, { n: controlN, labels, exclude }), src: `CSV 现算｜符合条件 ${pool}`, fromDb: false };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const lines = [];
const P = (s) => { console.log(s); lines.push(s); };

if (!existsSync(VEDASTRO_CSV)) { console.error(`缺数据：${VEDASTRO_CSV}\n先下载：Invoke-WebRequest "https://hf-mirror.com/datasets/vedastro-org/15000-Famous-People-Birth-Date-Location/resolve/main/PersonList-15k.csv" -OutFile data/vedastro/PersonList-15k.csv`); process.exit(2); }

const { records, bad, total } = loadVedastro();
const labels = loadLabels();

if (flag('stats')) {
  const st = datasetStats(records);
  P(`# VedAstro 数据集 · ${st.total}/${total} 条可解析（坏行 ${bad.length}）｜带婚姻标签 ${labels.size}`);
  P('');
  P('| 维度 | 分布 |');
  P('|---|---|');
  P(`| 性别 | ${Object.entries(st.byGender).map(([k, v]) => `${k}:${v}`).join('、')} |`);
  P(`| 出生十年段 | ${Object.entries(st.byDecade).sort().map(([k, v]) => `${k}:${v}`).join('、')} |`);
  P(`| 时差 | ${Object.entries(st.byOffset).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join('、')} |`);
  if (bad.length) P(`| 解析失败 | ${bad.slice(0, 3).map((b) => `${b.row}(${b.err})`).join('、')} 等 |`);
  const withL = records.filter((r) => labels.get(r.id)?.married).length;
  const div = records.filter((r) => labels.get(r.id)?.divorced).length;
  const multi = records.filter((r) => (labels.get(r.id)?.marriages ?? 0) >= 2).length;
  P('');
  P(`- 有婚姻记录 **${withL}** 人｜其中离婚 **${div}**｜多婚（≥2 次）**${multi}**`);
  const out = arg('report'); if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, lines.join('\n'), 'utf8'); }
  process.exit(0);
}

if (flag('select')) {
  const n = Number(arg('select', 20));
  const min = Number(arg('min', 4));
  const { selected, pool } = selectCharts(records, { n, min, labels });
  P(`# 筛选：不和谐相位 ≥${min} 的星盘，按加权分取前 ${n}（符合条件共 ${pool} 盘 / 全量 ${records.length}）`);
  P('');
  P('不和谐相位口径（**R-V6 主流西方占星**）：仅 **对冲 1.0 / 四分相 1.0**，且**两端都是十大行星**；');
  P('四轴与交点**排除**在计数之外（保留为独立维度），半四分/补八分/梅花等少数派或次要相位一律不计入。');
  P(`时间基座（R-T2）：八字一律**真太阳时**；星盘用民用时→显式时差→UT（VedAstro 已按 DST 校正）`);
  P('');
  P('| # | 姓名 | 出生（民用） | 真太阳时 | 偏移 | 不和谐 | 加权分 | 紧相位 | 上升 | 八字四柱 | 日主 | 强弱 | 用/忌 | 婚姻 |');
  P('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  selected.forEach((f, i) => {
    const L = f.label;
    P(`| ${i + 1} | ${f.name.slice(0, 18)} | ${f.birth.date} ${f.birth.time} | ${f.timeBase.trueSolar ? f.timeBase.trueSolar.slice(11) : '—'} | ${f.timeBase.offsetMinutes ?? 0}分 | **${f.chart.discordantCount}** | ${f.chart.discordantScore} | ${f.chart.tightCount} | ${f.chart.asc?.sign ?? '—'}${f.chart.asc?.deg ?? ''}° | ${f.bazi.pillars.join(' ')} | ${f.bazi.dayMaster} | ${f.bazi.verdict} | ${f.bazi.yong}/${f.bazi.ji} | ${L ? (L.marriages === 0 ? '未婚' : `${L.marriages}婚${L.divorces}离`) : '—'} |`);
  });
  P('');
  P('### 不和谐相位明细（前 5 盘）');
  for (const f of selected.slice(0, 5)) {
    P(`- **${f.name}**：${f.chart.discordant.map((d) => `${d.a}${d.type}${d.b}(±${d.orb}°)`).join('、')}`);
  }
  const j = arg('json');
  if (j) { mkdirSync(dirname(j), { recursive: true }); writeFileSync(j, JSON.stringify({ meta: { source: 'VedAstro 15k', min, n, selectedTotal: pool, rule: 'R-V1/R-V2/R-T2' }, selected }, null, 2), 'utf8'); console.error(`[JSON 已写入] ${j}`); }
  const out = arg('report'); if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, lines.join('\n'), 'utf8'); console.error(`[报告已写入] ${out}`); }
  process.exit(0);
}

if (flag('dump')) {
  // 全量融合落盘 → 本地训练库（以后训练直接用；可断点续跑）
  const { appendFileSync, readFileSync: rf, statSync } = await import('node:fs');
  const out = arg('dump', 'data/vedastro/training-db.jsonl');
  mkdirSync(dirname(out), { recursive: true });
  const done = new Set();
  if (existsSync(out)) for (const l of rf(out, 'utf8').split('\n')) { if (!l.trim()) continue; try { done.add(JSON.parse(l).id); } catch { /* 半行忽略 */ } }
  // --force：整库重写。**特征或标签口径变更后必须用**，否则旧记录会让新字段读成 undefined（曾因此把
  // stable/arranged 全读成 0%、aspectIndex 读成空数组 —— 静默错误）
  if (flag('force') && existsSync(out)) { writeFileSync(out, '', 'utf8'); done.clear(); }
  const todo = records.filter((r) => !done.has(r.id));
  P(`# 全量融合落盘 → ${out}`);
  P(`- 总记录 ${records.length}｜已存在 ${done.size}｜本次待写 ${todo.length}`);
  P('- 每条含：出生（真太阳时偏移）＋星盘特征（主口径：十大行星间 冲/刑，R-V6）＋八字四柱与五行＋标签');
  let n = 0, fail = 0;
  const t0 = Date.now();
  for (const r of todo) {
    try { appendFileSync(out, JSON.stringify(fuse(r, labels)) + '\n', 'utf8'); n++; }
    catch { fail++; }
    if (n % 2000 === 0 && n) console.error(`  ...已写 ${n}/${todo.length}（${Math.round((Date.now() - t0) / 1000)}s）`);
  }
  P(`- 完成：写入 **${n}** 条，失败 ${fail}｜耗时 ${Math.round((Date.now() - t0) / 1000)}s｜文件 ${(statSync(out).size / 1048576).toFixed(1)} MB`);
  P('- 用途：以后训练的本地底库。规则挖掘（`--mine`）从这份库抽样，不再重复解析 CSV。');
  process.exit(fail ? 4 : 0);
}

if (flag('ingest')) {
  // 把筛选出的案例**全部写入本地库**（data/samples.jsonl + 单案例快照 + rules 证据）
  const n = Number(arg('ingest', 20));
  const min = Number(arg('min', 4));
  const { selected, pool } = selectCharts(records, { n, min, labels });
  const { collectSample } = await import('./src/cross/sample.mjs');
  const { toSampleInput } = await import('./src/vedastro/adapter.mjs');
  P(`# 接入本地库：${selected.length} 个筛选案例（不和谐相位 ≥${min}，按加权分取前 ${n}；符合条件 ${pool} 盘）`);
  P('');
  P('| # | 姓名 | 本地 ID | 真太阳时 | 日柱是否跨日 | 事件数 | 双盘一致 | rules 证据 |');
  P('|---|---|---|---|---|---|---|---|');
  let okN = 0, failN = 0;
  for (const [i, f] of selected.entries()) {
    const rec = records.find((r) => r.id === f.id);
    // 事件：用标签里的真实婚姻/离婚年份（类别固定「婚恋」）——这是数据集自带的真实事件，不是我编的
    const L = labels.get(f.id);
    const evs = [];
    for (const y of (L?.years ?? [])) evs.push({ year: y, event: '结婚', category: '婚恋' });
    const input = toSampleInput(rec, { lifeEvents: evs });
    try {
      const s = collectSample(input, { houseSystem: 'porphyry' });
      const rulesHit = (s.rules ?? []).filter((x) => x.status === 'support' || x.status === 'contradict').length;
      okN++;
      P(`| ${i + 1} | ${f.name.slice(0, 16)} | ${s.id} | ${s.timeBase?.usedTrueSolar ? s.timeBase.at.slice(11) : '民用时'} | ${s.timeBase?.dayShift ? '**是**' : '否'} | ${evs.length} | ${s.consistencyOk === null ? '降级' : s.consistencyOk ? '✓' : '✗'} | ${rulesHit} |`);
    } catch (e) {
      failN++;
      P(`| ${i + 1} | ${f.name.slice(0, 16)} | 失败 | — | — | ${evs.length} | — | ${String(e.message).slice(0, 60)} |`);
    }
  }
  P('');
  P(`写入本地：**成功 ${okN} / 失败 ${failN}** → \`data/samples.jsonl\` + \`data/samples/<S-id>.json\``);
  P('');
  P('> 时间基座：八字一律真太阳时（R-T2）；星盘用民用时→显式时差→UT（VedAstro 时差已按 DST 校正）。');
  P('> 事件来自 VedAstro 婚姻数据集里的真实结婚年份（类别「婚恋」），非人工编造。');
  const out = arg('report'); if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, lines.join('\n'), 'utf8'); console.error(`[报告已写入] ${out}`); }
  process.exit(failN ? 4 : 0);
}

if (flag('mine')) {
  const { selected, control, src } = mineSource(records, labels, { n: Number(arg('select', 20)), min: Number(arg('min', 4)), controlN: Number(arg('control', 800)) });

  P('# 规则精细化挖掘（VedAstro 数据集）');
  P('');
  P('> 说明：每个维度都**带参数**（哪颗行星 / 什么相位 / orb 上限 / 落哪宫 / 哪个五行十神 / 阈值多少），');
  P('> 并给出目标组与**对照组**的命中率、lift、两比例 z 检验 p 值与 Bonferroni 校正。');
  P('> 最后两列留给**人工裁定**——这是"实战学习"的接口，不是自动结论。');
  P('');
  const struct = mine(selected, control, { minSupport: 3, minControl: 20 });
  P(renderRuleTable(struct, { title: `A. 结构共现：高不和谐相位盘（${selected.length}）vs 随机对照（${control.length}）`, targetN: selected.length, controlN: control.length, top: 30 }));
  P('');

  const labelKey = arg('label', 'divorced');
  const { records: dbRecords, bad: dbBad, path: dbPath } = loadTrainingDb();
  const big = (dbRecords.length && !flag('from-csv'))
    ? sampleFused(dbRecords, { n: Number(arg('sample', 1500)), seed: 7 })
    : controlSample(records, { n: Number(arg('sample', 1500)), seed: 7, labels });
  P(`> 样本来源：${dbRecords.length && !flag('from-csv') ? `本地训练库 \`${dbPath}\`（${dbRecords.length} 条，坏行 ${dbBad}）` : 'CSV 现算'}`);
  P('');
  const lab = mineLabel(big, labelKey);
  if (lab.rows.length) {
    P(renderRuleTable(lab.rows, { title: `B. 标签驱动：${lab.target}（${lab.targetN}）vs 其余（${lab.controlN}）`, targetN: lab.targetN, controlN: lab.controlN, top: 30 }));
  } else P(`B. 标签驱动：${lab.note}`);
  P('');
  P('### 判读纪律');
  P('1. **A 组不是预测**：目标组是按"不和谐相位多"筛出来的，A 只回答"这种盘还有什么共性"，不能推出吉凶。');
  P('2. **B 组才贴近结果**：标签来自真实婚姻记录（VedAstro 数据集，high credibility），但 1500 人里离婚样本量有限，lift<1.3 基本是噪声。');
  P('3. **多重比较**：一次检验几百个维度，看 `校正后显著` 列；只勾 ✓ 的才值得进入人工裁定。');
  P('4. **因果方向**：这是观察性关联，不是因果；印度占星与西方占星体系不同（VedAstro 是恒星黄道/Lahiri，本引擎星盘是**热带**），跨体系迁移需谨慎。');

  const j = arg('json');
  if (j) { mkdirSync(dirname(j), { recursive: true }); writeFileSync(j, JSON.stringify({ meta: { source: 'VedAstro', labelKey, selected: selected.length, control: control.length, sample: big.length, dimsA: struct.length, dimsB: lab.rows.length }, structure: struct, label: lab }, null, 2), 'utf8'); console.error(`[JSON 已写入] ${j}`); }
  const out = arg('report'); if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, lines.join('\n'), 'utf8'); console.error(`[报告已写入] ${out}`); }
  process.exit(0);
}

console.log(`VedAstro 管线 · 数据 ${records.length} 条（坏行 ${bad.length}）｜标签 ${labels.size} 条
  node cli-vedastro.mjs --stats
  node cli-vedastro.mjs --select 20 [--min 4] --report reports/vedastro-20.md --json data/vedastro/selected-20.json
  node cli-vedastro.mjs --mine [--label divorced|multi-marriage|never] [--sample 1500] --report reports/vedastro-rules.md --json data/vedastro/rule-candidates.json`);
