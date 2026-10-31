#!/usr/bin/env node
// 基于外部数据库跑 Part 1–8 全链条 + 数据权重 + rule 库修正
//   node cli-db.mjs --db data/records/xxx.json [--report out.md] [--json out.json] [--apply] [--no-write]
//   --apply：把本次 Part8 产出的 pending-human 建议按「用户指令」批量采纳（并写决策事件，可追溯）
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { auditDb, astroFromDb, baziFromDb } from './src/cross/ingest.mjs';
import { computeWeights, renderWeights } from './src/cross/weights.mjs';
import { renderBazi } from './src/bazi/render.mjs';
import { calibrate, renderCalibration } from './src/cross/calibration.mjs';
import { friction, renderFriction } from './src/cross/friction.mjs';
import { timeline, renderTimeline } from './src/cross/timing.mjs';
import { discover, renderDiscovery } from './src/cross/discovery.mjs';
import { runDbDiscovery, renderDbDiscovery } from './src/cross/db-discovery.mjs';
import { buildLibrary } from './src/cross/mapping-library.mjs';
import { loadKb, listProposals, decideProposal } from './src/cross/kb-db.mjs';
import { validateDivinationInput, describeInterface } from './src/divination/input.mjs';
import { compile as compileLiuRen } from './src/daliuren.mjs';
import { render as renderLiuRen } from './src/render.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);

// 架构 ARCH-3：占课接口独立，命盘 DB 不含六壬数据，也就不会强跑六壬
if (flag('divination-schema')) { console.log(JSON.stringify(describeInterface(), null, 2)); process.exit(0); }
let liuRen = null;
const divPath = arg('divination');
if (divPath) {
  const raw = JSON.parse(readFileSync(divPath, 'utf8'));
  const v = validateDivinationInput(raw);
  if (!v.ok) { console.error(`Divination_Input 校验失败：\n- ${v.errors.join('\n- ')}`); process.exit(2); }
  liuRen = { source: divPath, input: v, ir: compileLiuRen(v.normalized) };
}

const dbPath = arg('db');
if (!dbPath) { console.error('需要 --db <path>（外部数据库 JSON）'); process.exit(2); }
const db = JSON.parse(readFileSync(dbPath, 'utf8'));

/* ── 1. 对拍 ── */
const audit = auditDb(db);
const ir = audit.ir;
const astro = audit.astro;
const chartId = `${ir.pillars.join('')}-${astro?.planets?.['太阳']?.sign ?? 'x'}`;

/* ── 2. 权重 ── */
const libStats = Object.fromEntries([...buildLibrary().entries()]);
const W = computeWeights(audit, libStats);

/* ── 3. Part 1–4（八字本体） ── */
const p4 = renderBazi(ir);

/* ── 4. Part 5（交叉修正） ── */
const cal = calibrate(ir, astro);

/* ── 5. Part 6（摩擦引擎 + 时间线） ── */
const fr = friction(ir, astro);
const tl = timeline(ir, astro, { fromYear: Number(arg('from-year')) || undefined });

/* ── 6. Part 6.7（自发掘） + Part 8（数据库自发掘） ── */
const d67 = discover({ bazi: ir, astroInput: astro, friction: fr, write: !flag('no-write'), chartId });
const p8 = flag('no-kb') ? { skipped: true, reason: '--no-kb' } : runDbDiscovery({ bazi: ir, astroInput: astro, frictionResult: fr, chartId, write: !flag('no-write') });

/* ── 7. rule 库修正 ── */
let applied = [];
if (flag('apply')) {
  const pending = listProposals().filter((p) => p.status === 'pending-human' && p.chartId === chartId);
  for (const p of pending) {
    decideProposal(p.id, 'accepted', '用户指令：每次推演后修正 rule 库', undefined);
    applied.push(p);
  }
}

/* ── 8. 组装报告 ── */
const L = [];
L.push(`# Part 1–8 全链条推演 · ${chartId}`);
L.push(`- 数据来源：\`${dbPath}\`（${db.meta?.description ?? ''} v${db.meta?.version ?? '?'}）`);
L.push(`- 对拍：共 ${audit.total} 条 → 一致 **${audit.summary.一致}** ｜冲突 **${audit.summary.冲突}** ｜人工锁定 ${audit.summary.人工锁定} ｜不可对拍 ${audit.summary.不可对拍}`);
L.push(`- 说明：本引擎无紫微斗数模块，紫微段与部分神煞、大运评级按「外部输入」登记并计权，不参与对拍判定。`);
L.push('');
L.push('## 【对拍明细】');
L.push('| path | DB 声称 | 引擎计算 | 状态 | 备注 |');
L.push('|---|---|---|---|---|');
for (const it of audit.items) L.push(`| ${it.path} | ${String(it.claim).slice(0, 22)} | ${it.engine === null ? '—' : String(it.engine).slice(0, 22)} | ${it.status === '一致' ? '✓' : it.status === '冲突' ? '⚠ 冲突' : '·'} ${it.status} | ${it.note ?? ''} |`);
L.push(renderWeights(W));
L.push('');
L.push('---');
L.push('');
L.push(p4);
L.push(renderCalibration(cal, ir));
L.push(renderFriction(fr, ir));
L.push(renderTimeline(tl));
L.push(renderDiscovery(d67));
L.push(renderDbDiscovery(p8));
if (liuRen) {
  L.push('');
  L.push('---');
  L.push('');
  L.push(`# 附：大六壬占课（独立接口 Divination_Input · 与命盘 DB 解耦）`);
  L.push(`- 来源：\`${liuRen.source}\`｜月将模式：${liuRen.input.yueJiangMode}${liuRen.input.warning ? `（${liuRen.input.warning}）` : ''}`);
  L.push(`- 事由：${liuRen.input.meta.question ?? '未填'}`);
  L.push('');
  L.push(renderLiuRen(liuRen.ir));
}
if (audit.overrides?.length) {
  L.push('');
  L.push('## 【人工锁定层（架构师裁定）】');
  L.push('| 字段 | 引擎派生值 | 锁定值 | 裁定 | 影响 |');
  L.push('|---|---|---|---|---|');
  for (const o of audit.overrides) L.push(`| ${o.path} | ${o.before} | **${o.after}** | ${o.ruling} | ${o.kind === 'score' ? '已重跑强弱与用忌神' : '已重算十神'} |`);
}
if (applied.length) {
  L.push('');
  L.push('## 【rule 库修正记录】');
  L.push(`- 本次采纳 ${applied.length} 条（依据：用户指令；决策事件已写入 \`data/kb.jsonl\`，可追溯）`);
  for (const p of applied) L.push(`  - ${p.target} ← ${p.entry}（${p.reason}）`);
  L.push(`- rules 集合（6.7 映射库）当前 ${buildLibrary().size} 条；证据由 \`observe()\` 追加，结论仍受 ≥3 盘门槛约束`);
}

const report = L.join('\n');
console.log(report);
const out = arg('json');
if (out) writeFileSync(out, JSON.stringify({ audit: { summary: audit.summary, items: audit.items, total: audit.total }, weights: W.rows, part8: p8, applied }, null, 2), 'utf8');
const md = arg('report') ?? `examples/report-db-${basename(dbPath, '.json')}.md`;
writeFileSync(md, report, 'utf8');
console.error(`[报告已写入] ${md}`);
