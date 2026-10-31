#!/usr/bin/env node
// 星盘反推八字引擎 CLI（含生时校正）
//   node cli-rectify.mjs --case data/samples/case001.json [--window 60] [--step 1] [--json out.json] [--report out.md]
//   node cli-rectify.mjs --at "2000-01-01 12:00" --lng 104.06 --lat 30.67 --tz Asia/Shanghai --event 2022:家庭 --event 2024:学业
// Step 5 分支：事件 <3 → 只出原始双盘 + 八字，并提示补事件（不强行校正）
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rectify, baziAfterRectify } from './src/rectify/rectify.mjs';
import { trueSolarTime } from './src/western/truesolar.mjs';
import { computeDual, PRIMARY_BACKEND } from './src/western/backends.mjs';
import { liuNianActivation } from './src/cross/timing.mjs';
import { normalizeCategory } from './src/cross/event-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const flags = (k) => argv.reduce((a, v, i) => (v === `--${k}` ? [...a, argv[i + 1]] : a), []);

/* ── 输入 ── */
let c;
const casePath = arg('case');
if (casePath) {
  const s = JSON.parse(readFileSync(casePath, 'utf8'));
  const b = s.birth_date;
  c = {
    name: s.name, gender: s.gender, date: b.date, time: b.time.length === 4 ? `0${b.time}` : b.time,
    lon: b.birth_place.longitude, lat: b.birth_place.latitude, tzName: b.birth_place.timezone,
    events: (s.life_events ?? []).map((e) => ({ year: e.year, event: e.event, category: normalizeCategory(e.category).category ?? '其他' })),
  };
} else {
  const at = arg('at');
  if (!at) { console.error('需要 --case <sample.json> 或 --at + --event'); process.exit(2); }
  const [date, time] = at.split(' ');
  c = {
    name: arg('name', 'chart'), gender: arg('gender', '男'), date, time,
    lon: Number(arg('lng')), lat: Number(arg('lat')), tzName: arg('tz', 'Asia/Shanghai'),
    events: flags('event').map((s) => {
      const [y, cat] = s.split(':');
      return { year: Number(y), event: `（未命名）${y}`, category: normalizeCategory(cat).category ?? '其他' };
    }),
  };
}

const rows = [];
const P = (s) => { console.log(s); rows.push(s); };

P(`# 星盘反推八字 · ${c.name}`);
P(`- 输入：${c.date} ${c.time}（${c.tzName}）${c.lon}E ${c.lat}N｜性别 ${c.gender}｜事件 ${c.events.length} 条`);
P('');

/* ── Step 0：时间基座（真太阳时 vs 星盘用时，R-T1 分离） ── */
const tst = trueSolarTime({ at: `${c.date} ${c.time}`, lon: c.lon, tzName: c.tzName });
P('## Step 0 时间基座（真太阳时与星盘用时分离 — R-T1）');
P(`- 民用时 ${tst.civilLocal} → UTC ${tst.utc}（时区偏移 ${tst.dstOffsetHours}h，含历史夏令时）`);
P(`- 均时差 ${tst.eotMinutes} 分｜经度修正 ${tst.lonCorrectionMinutes} 分｜合计 **${tst.totalOffsetMinutes} 分** → 真太阳时 **${tst.apparentSolarLocal}**`);
P(`- 时辰：民用 ${tst.shichenCivil} → 真太阳 **${tst.shichenTrue}**${tst.shichenDiffers ? '（**会变，时柱受影响**）' : '（不变）'}`);
P(`- 星盘必须用 \`${tst.chartUtc}\`（民用时→UTC），**不得**用真太阳时——否则经度修正被算两遍，上升/中天会偏一个星座量级`);

/* ── Step 1：双盘 ── */
const dual = computeDual({ at: `${c.date} ${c.time}`, lon: c.lon, lat: c.lat, tzName: c.tzName, name: c.name });
P('');
P('## Step 1 初始星盘（双独立实现）');
P(`- 主后端 **${PRIMARY_BACKEND}**｜kerykeion ${dual.kerykeion ? '已对齐' : `不可用（${dual.keryErr}）`}`);
P(`- 上升 ${dual.mine.planets['上升'].sign}${dual.mine.planets['上升'].deg}°｜天顶 ${dual.mine.planets['天顶'].sign}${dual.mine.planets['天顶'].deg}°`);
if (dual.consistency) P(`- 一致性：Δ星体 ${dual.consistency.maxBodyDelta}°｜Δ上升 ${dual.consistency.angles.asc}°｜硬相位 ${dual.consistency.aspect.covered}/${dual.consistency.aspect.kerykeion}`);

/* ── Step 3（校正前八字） ── */
const pre = baziAfterRectify(c, c.time);
P('');
P('## Step 3 八字（校正前）');
P(`- 四柱：${pre.original.pillars.join(' ')}`);
const dist = pre.corrected.L3_distribution.adjusted;
P(`- 五行：${Object.entries(dist).map(([k, v]) => `${k}${v}`).join(' ')}｜${pre.corrected.L3_verdict.verdict}(${pre.corrected.L3_verdict.ratio})｜用 ${pre.corrected.L5_yongJi.yong} 忌 ${pre.corrected.L5_yongJi.ji}`);
P(`- 胎元 ${pre.corrected.L4_taiYuan.ganzhi}｜命宫 ${pre.corrected.L4_mingGong.ganzhi}｜身宫 ${pre.corrected.L4_shenGong.ganzhi}`);

/* ── Step 2：生时校正 ── */
P('');
P('## Step 2 生时校正');
const r = rectify(c, { windowMin: Number(arg('window', 60)), stepMin: Number(arg('step', 1)), orb: Number(arg('orb', 3)) });
let rectJson = null;
let post = pre;
if (!r.ok) {
  P(`- **拒绝执行**：${r.reason}`);
  P(`- 需要：${r.need}`);
  P('- Step 5 分支命中：`IF 用户提供的事件少于3个 → 拒绝执行生时校正，仅输出原始星盘与八字`');
} else {
  P(`- 方法：${r.method}｜${r.window}`);
  P(`- 校正结果：**${r.original_time} → ${r.corrected_time}**（置信 ${r.confidence}）`);
  P(`- 收敛：${r.converged ? '达到 ±5min' : '**未收敛**'}｜95% 平台：${r.plateau.count} 个候选 / ${r.plateau.widthMin} 分钟（${r.plateau.from}–${r.plateau.to}）`);
  P('');
  P('| 候选时刻 | 总分 | 行运 | 太阳弧 | 八字 |');
  P('|---|---|---|---|---|');
  for (const t of r.top) P(`| ${t.time} | **${t.score}** | ${t.parts.transit} | ${t.parts.arc} | ${t.parts.bazi} |`);
  post = baziAfterRectify(c, r.corrected_time);
  P('');
  P(`- 校正后四柱：**${post.corrected.pillars.join(' ')}**`);
  if (post.flags.length) P(`- ${post.flags.join('；')}`);
  P(`- ${post.needHumanReview ? '**需人工复核**（跨日/跨节气）' : '无跨日/跨节气风险'}`);
  P('');
  P('### 事件匹配明细（最佳候选）');
  P('| 年份 | 事件 | 类别 | 主要触发 |');
  P('|---|---|---|---|');
  const byEvent = {};
  for (const ct of r.best.contacts) (byEvent[ct.event] ??= []).push(`${ct.kind === 'transit' ? '行运' : '日弧'}${ct.planet ?? ct.directed}${ct.aspect}本命${ct.natal}(±${ct.orb}°)`);
  for (const e of c.events) P(`| ${e.year} | ${e.event} | ${e.category} | ${(byEvent[e.year] ?? ['—']).slice(0, 3).join('；')} |`);
  rectJson = { original_time: r.original_time, corrected_time: r.corrected_time, confidence: r.confidence, method: r.method, converged: r.converged, plateau: r.plateau, top: r.top };
}

/* ── Step 4：结构化 JSON ── */
const b = r.ok ? post : pre;
const ir = b.corrected;
const pillarsObj = [0, 1, 2, 3].map((i) => ({ stem: ir.pillars[i][0], branch: ir.pillars[i][1] }));
const cross = {};
c.events.forEach((e, i) => {
  const ct = r.ok ? r.best.contacts.filter((x) => x.event === e.year).slice(0, 2) : [];
  const p = ir.pillars.map((gz) => ({ gan: gz[0], zhi: gz[1] }));
  let act = null;
  try { act = liuNianActivation(p, e.year, ir.L4_spouse.zhi); } catch { act = null; }
  cross[`event_${i + 1}`] = {
    year: e.year, event: e.event, category: e.category,
    bazi_trigger: act && act.hits.length ? act.hits.map((x) => `${x.type}${x.with}`).join('/') : '未引动',
    astro_trigger: ct.length ? ct.map((x) => `${x.kind === 'transit' ? '行运' : '日弧'}${x.planet ?? x.directed}${x.aspect}本命${x.natal}`).join('；') : '—',
    match: ct.length > 0 || (act?.activation ?? false),
  };
});

const out = {
  case_id: `R-${c.date.replace(/-/g, '')}-${String(c.time).replace(':', '')}`,
  input_events: c.events.map((e) => ({ year: e.year, event: e.event, category: e.category })),
  time_base: {
    civil: tst.civilLocal, utc: tst.utc,
    tst: { eot_minutes: tst.eotMinutes, lon_correction_minutes: tst.lonCorrectionMinutes, apparent_solar: tst.apparentSolarLocal, shichen_civil: tst.shichenCivil, shichen_true: tst.shichenTrue, shichen_differs: tst.shichenDiffers },
    note: tst.note,
  },
  rectification: rectJson ?? { original_time: c.time, corrected_time: null, confidence: '未执行', method: '拒绝（事件不足）', reason: r.reason },
  star_chart: Object.fromEntries(Object.entries(dual.mine.planets).map(([k, v]) => [k, { sign: v.sign, house: v.house ?? null, degree: v.deg, longitude: v.lon, retrograde: !!v.retro }])),
  star_chart_meta: { backend: PRIMARY_BACKEND, houses: dual.mine.meta.houseSystem, utc: dual.mine.meta.utc, asc: dual.mine.angles.asc, mc: dual.mine.angles.mc, consistency: dual.consistency ?? null },
  bazi: {
    year: pillarsObj[0], month: pillarsObj[1], day: pillarsObj[2], hour: pillarsObj[3],
    taiyuan: ir.L4_taiYuan.ganzhi, minggong: ir.L4_mingGong.ganzhi, shengong: ir.L4_shenGong.ganzhi,
    day_master: ir.dayMaster, verdict: ir.L3_verdict.verdict, ratio: ir.L3_verdict.ratio,
    distribution: ir.L3_distribution.adjusted, yongJi: ir.L5_yongJi,
    changed_by_rectification: b.changed, flags: b.flags, need_human_review: b.needHumanReview,
  },
  cross_validation: cross,
  warnings: [
    ...(r.ok ? [] : ['事件不足 3 条，已按 Step 5 拒绝生时校正']),
    ...(dual.kerykeion ? [] : ['kerykeion 后端不可用，仅有主后端星盘']),
    ...(r.ok && !r.converged ? ['生时校正未收敛到 ±5min，需追加事件'] : []),
    ...(tst.shichenDiffers ? ['真太阳时导致时辰变化，时柱口径需确认（R-T2 待裁定）'] : []),
  ],
};

P('');
P('## Step 4 结构化输出（JSON）');
const jsonText = JSON.stringify(out, null, 2);
P('```json');
P(jsonText.length > 3500 ? `${jsonText.slice(0, 3500)}\n... (完整见 --json)` : jsonText);
P('```');

const jp = arg('json');
if (jp) { writeFileSync(jp, jsonText, 'utf8'); console.error(`[JSON 已写入] ${jp}`); }
const rp = arg('report');
if (rp) { writeFileSync(rp, rows.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }

/* ── Step 6：数据闭环 ── */
if (!flag('no-log')) {
  const dbDir = join(HERE, 'data', 'cases');
  mkdirSync(dbDir, { recursive: true });
  const line = `\n## ${out.case_id} · ${c.name}（${new Date().toISOString().slice(0, 16)}）\n`
    + `- 输入：${c.date} ${c.time} @${c.lon}E,${c.lat}N｜事件 ${c.events.length} 条\n`
    + `- 真太阳时偏移 ${tst.totalOffsetMinutes} 分（时辰 ${tst.shichenCivil}→${tst.shichenTrue}）\n`
    + `- 校正：${r.ok ? `${r.original_time}→${r.corrected_time}｜${r.confidence}｜平台 ${r.plateau.widthMin}min` : '未执行（事件不足）'}\n`
    + `- 八字：${ir.pillars.join(' ')}${b.needHumanReview ? '（需人工复核）' : ''}\n`
    + `- 事件匹配：${Object.values(cross).map((v) => `${v.year}:${v.match ? '命中' : '未命中'}`).join(' ')}\n`
    + `- 参数：window=${arg('window', 60)}min step=${arg('step', 1)}min orb=${arg('orb', 3)}° weights=transit0.5/arc0.3/bazi0.2\n`;
  const file = join(dbDir, 'case_db.md');
  if (!existsSync(file)) writeFileSync(file, '# 案例库（Step 6 数据闭环，只追加）\n', 'utf8');
  appendFileSync(file, line, 'utf8');
  console.error(`[案例已追加] ${file}`);
}
