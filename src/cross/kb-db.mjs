// Part 8.2 · 跨系统知识库（多集合、只追加事件流）
// 不与 6.7 的映射库重复：`rules` 集合 = 直接消费 data/mapping-library.jsonl（只读 JOIN）；
// 本文件只拥有 8.x 新增的集合：run / correspondence / resonance / proposal / review。
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLibrary, LIB_PATH } from './mapping-library.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const KB_PATH = resolve(HERE, '../../data/kb.jsonl');
export const COLLECTIONS = ['run', 'correspondence', 'resonance', 'proposal', 'review'];

const load = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export function appendKb(doc, path = KB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const rec = { ts: new Date().toISOString(), ...doc };
  appendFileSync(path, JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}

export function loadKb(path = KB_PATH) {
  const events = load(path);
  const by = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  for (const e of events) { if (by[e.collection]) by[e.collection].push(e); else (by[e.collection] = by[e.collection] ?? []).push(e); }
  return { events, by };
}

/** 推演次数（run 事件计数）与下一次的序号 */
export function runCount(path = KB_PATH) {
  return loadKb(path).by.run.length;
}

/**
 * 开一次推演：返回轮次号并落 run 事件
 * @returns {{index:number, isReviewTick:boolean}} index 从 1 开始；每 10 次为复盘轮
 */
export function startRun({ chartId, bazi, astroMeta }, path = KB_PATH) {
  const index = runCount(path) + 1;
  appendKb({ collection: 'run', kind: 'start', index, chartId, bazi, astro: astroMeta ?? null }, path);
  return { index, isReviewTick: index % 10 === 0 };
}

/** 写入本次的十神↔行星对应（幂等键 chartId+planet） */
export function recordCorrespondence(rows, chartId, path = KB_PATH) {
  const seen = new Set(loadKb(path).by.correspondence.map((e) => `${e.chartId}|${e.planet}`));
  let added = 0;
  for (const r of rows) {
    if (seen.has(`${chartId}|${r.planet}`)) continue;
    appendKb({ collection: 'correspondence', chartId, ...r }, path);
    added++;
  }
  return added;
}

/** 写入共振检测结果 */
export function recordResonance({ chartId, patterns, score, level }, path = KB_PATH) {
  return appendKb({ collection: 'resonance', chartId, patterns, score, level }, path);
}

/** 稳定短哈希（djb2）——用于给同一 chartId 下的多条建议生成不同 id */
function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0').slice(0, 8);
}

/**
 * 写入数据库更新建议（8.1 第 2 项）
 * 重要：建议进 proposal 集合、状态 pending-human，**不会**自动写进 jishen_alert / rules
 * id 必须含 entry 的哈希：否则同一 chartId 的多条建议会被去重成一条（曾实际踩到）
 */
export function proposeUpdate({ chartId, target, op, entry, reason, evidence }, path = KB_PATH) {
  const id = `${target}:${op}:${chartId}:${shortHash(String(entry))}`;
  if (loadKb(path).by.proposal.some((e) => e.id === id && e.kind !== 'decision')) return null;
  return appendKb({ collection: 'proposal', id, chartId, target, op, entry, reason, evidence, status: 'pending-human' }, path);
}

/** 人工采纳/驳回一条建议（只追加决策事件，不改历史） */
export function decideProposal(id, decision, note = '', path = KB_PATH) {
  if (!['accepted', 'rejected'].includes(decision)) throw new Error('decision 只能是 accepted|rejected');
  return appendKb({ collection: 'proposal', kind: 'decision', id, decision, note }, path);
}

/** 建议的当前状态（回放决策事件） */
export function listProposals(path = KB_PATH) {
  const map = new Map();
  for (const e of loadKb(path).by.proposal) {
    if (e.kind === 'decision') { const it = map.get(e.id); if (it) { it.status = e.decision; it.decidedAt = e.ts; it.note = e.note; } continue; }
    map.set(e.id, { ...e });
  }
  return [...map.values()];
}

/** 8.2 矛盾复盘：扫描 rules 集合中「有反例 / 证据混杂 / 长期未升级」的条目，标注需人工验证 */
export function contradictionReview({ minRuns = 10, runIndex } = {}, path = KB_PATH) {
  const rules = [...buildLibrary(LIB_PATH).values()];
  const flags = [];
  for (const r of rules) {
    const sup = r.supportCount ?? 0, con = r.contradictCount ?? 0, charts = r.chartCount ?? 0;
    const reasons = [];
    if (con > 0) reasons.push(`有 ${con} 条反例`);
    if (sup > 0 && con > 0) reasons.push('证据混杂（正反并存）');
    if (r.status === 'pending' && sup === 0) reasons.push('零支持（疑似无效条目）');
    if (reasons.length) flags.push({ id: r.id, claim: r.claim, status: r.status, sup, con, charts, reasons });
  }
  const rec = appendKb({
    collection: 'review', kind: 'contradiction-review', runIndex: runIndex ?? runCount(path),
    scanned: rules.length, flagged: flags.length, flags,
    mark: '需人工验证',
  }, path);
  return rec;
}

export function renderKb({ by, events }, { proposals, reviews } = {}) {
  const L = [];
  L.push(`# 跨系统知识库 · ${events.length} 事件`);
  L.push(`| 集合 | 条数 | 说明 |`);
  L.push(`|---|---|---|`);
  const desc = {
    run: '每次推演的开始事件（轮次计数；每 10 轮复盘）',
    correspondence: '八字十神 ↔ 星盘行星 的对应（含庙旺陷落一致性）',
    resonance: '八字冲合害 ↔ 星盘硬相位 的共振检测',
    proposal: '数据库更新建议（pending-human，不自动生效）',
    review: '矛盾复盘（标注「需人工验证」）',
  };
  for (const c of COLLECTIONS) L.push(`| ${c} | ${by[c].length} | ${desc[c]} |`);
  L.push(`| rules（外部） | ${buildLibrary(LIB_PATH).size} | 6.7 映射库（data/mapping-library.jsonl） |`);
  const open = (proposals ?? listProposals()).filter((p) => p.status === 'pending-human');
  if (open.length) {
    L.push('');
    L.push(`## 待人工裁决的更新建议（${open.length}）`);
    L.push('| id | 目标 | 操作 | 内容 | 理由 |');
    L.push('|---|---|---|---|---|');
    for (const p of open.slice(0, 20)) L.push(`| ${p.id} | ${p.target} | ${p.op} | ${p.entry} | ${p.reason} |`);
  }
  const rv = (reviews ?? by.review).slice(-1)[0];
  if (rv && rv.flags?.length) {
    L.push('');
    L.push(`## 最近一次矛盾复盘（第 ${rv.runIndex} 轮，标记「需人工验证」）`);
    for (const f of rv.flags.slice(0, 15)) L.push(`- ${f.claim}（支持 ${f.sup}/反例 ${f.con}/命盘 ${f.charts}）：${f.reasons.join('；')}`);
  }
  return L.join('\n');
}
