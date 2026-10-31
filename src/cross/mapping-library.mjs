// Part 6.7.5 跨系统映射库（append-only JSONL，事件溯源；禁止就地改写既有事件）
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LIB_PATH = resolve(HERE, '../../data/mapping-library.jsonl');

/** 6.7.2 已知映射基础表：作为 basis 事件入库（只入一次） */
export const BASIS = [
  ['太阳', '胎元 / 命宫', '灵魂核心剧本、先天根基'],
  ['月亮', '身宫 / 印星', '情绪防御、安全感来源'],
  ['上升', '年柱 / 命宫', '人格面具、外在行动方式'],
  ['水星', '食伤 / 印星', '思维、表达、信息处理'],
  ['金星', '财星 / 比劫', '爱、审美、资源交换'],
  ['火星', '七杀 / 羊刃', '行动力、攻击性、性驱力'],
  ['木星', '食伤 / 印星', '扩张、贵人、信仰'],
  ['土星', '正官 / 七杀', '规则、压力、边界'],
  ['天王星', '食伤 / 偏印', '创新、突变、反叛'],
  ['海王星', '偏印 / 印星', '灵性、幻灭、消融'],
  ['冥王星', '七杀 / 偏财', '权力、深渊、控制'],
  ['北交点', '用神 / 通关用神', '今生进化方向'],
  ['南交点', '忌神 / 业力', '前世习气、舒适区'],
  ['12宫位', '四柱 + 命宫胎元', '人生十二领域'],
];

export function loadEvents(path = LIB_PATH) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export function appendEvent(ev, path = LIB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(ev) + '\n', 'utf8');
  return ev;
}

const idOf = (from, to) => `${from}→${to}`;

/** 回放事件流 → 当前映射状态 */
export function buildLibrary(path = LIB_PATH) {
  const events = loadEvents(path);
  const map = new Map();
  for (const e of events) {
    if (e.kind === 'claim') {
      map.set(e.id, { id: e.id, claim: e.claim, from: e.from, to: e.to, mean: e.mean ?? null, seed: !!e.seed, evidence: [], status: 'pending', createdAt: e.ts });
    } else if (e.kind === 'evidence') {
      const it = map.get(e.id);
      if (it) it.evidence.push({ ts: e.ts, chartId: e.chartId, supports: e.supports, note: e.note ?? null });
    } else if (e.kind === 'verdict') {
      const it = map.get(e.id);
      if (it) { it.status = e.status; it.verdictReason = e.reason; it.verdictAt = e.ts; }
    }
  }
  // 由证据自动升级状态（裁定 R-D3：≥3 张不同命盘支持且 0 反对 → verified；出现反对 → contradicted）
  // 同一 chartId 重复观察只保留最后一次（避免重复跑同一张盘虚增支持数）
  for (const it of map.values()) {
    const byChart = new Map();
    for (const e of it.evidence) byChart.set(e.chartId, e);
    it.evidence = [...byChart.values()];
    const charts = new Set(it.evidence.map((x) => x.chartId));
    const sup = it.evidence.filter((x) => x.supports === true).length;
    const con = it.evidence.filter((x) => x.supports === false).length;
    if (it.status !== 'verified' && it.status !== 'contradicted') {
      if (con > 0) it.status = 'contradicted';
      else if (sup >= 3 && charts.size >= 3) it.status = 'verified';
      else it.status = 'pending';
    }
    it.supportCount = sup; it.contradictCount = con; it.chartCount = charts.size;
  }
  return map;
}

/** 首次使用时把 basis 表入库 */
export function ensureBasis(path = LIB_PATH) {
  const map = buildLibrary(path);
  let added = 0;
  for (const [from, to, mean] of BASIS) {
    const id = idOf(from, to);
    if (map.has(id)) continue;
    appendEvent({ kind: 'claim', id, claim: `${from} ↔ ${to}`, from, to, mean, seed: true, ts: new Date().toISOString() }, path);
    added++;
  }
  return added;
}

/** 记录一次命盘观察（同一 chartId 重复调用不会重复计数由状态推导处理） */
export function observe({ claim, from, to, mean, chartId, supports, note }, path = LIB_PATH) {
  const id = idOf(from, to);
  const map = buildLibrary(path);
  if (!map.has(id)) appendEvent({ kind: 'claim', id, claim, from, to, mean, ts: new Date().toISOString() }, path);
  appendEvent({ kind: 'evidence', id, chartId, supports, note: note ?? null, ts: new Date().toISOString() }, path);
  return buildLibrary(path).get(id);
}

export function listLibrary({ status } = {}, path = LIB_PATH) {
  const all = [...buildLibrary(path).values()];
  return (status ? all.filter((x) => x.status === status) : all).sort((a, b) => (b.supportCount ?? 0) - (a.supportCount ?? 0) || a.id.localeCompare(b.id));
}

export function renderLibrary(items) {
  if (!items.length) return '（映射库为空）';
  const L = ['| 映射 | 状态 | 支持/反对/命盘数 | 说明 |', '|---|---|---|---|'];
  for (const i of items) {
    const tag = { verified: '✅ 已验证', pending: '⏳ 待验证', contradicted: '❌ 被证伪' }[i.status] ?? i.status;
    L.push(`| ${i.claim} | ${tag} | ${i.supportCount ?? 0}/${i.contradictCount ?? 0}/${i.chartCount ?? 0} | ${i.mean ?? ''}${i.seed ? '（基础表）' : ''} |`);
  }
  return L.join('\n');
}
