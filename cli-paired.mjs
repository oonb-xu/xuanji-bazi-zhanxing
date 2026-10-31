#!/usr/bin/env node
// 成对样本工具台（任务 B/C 的执行入口）
//   node cli-paired.mjs --pillars 丁亥 壬子 癸巳 庚申     # 四柱自洽性机检 + 候选公历日期（只给四柱时用）
//   node cli-paired.mjs --check                          # 校验 data/samples/paired/ 下全部样本（validatePaired）
//   node cli-paired.mjs --align                           # 结构量对齐（alignSample）—— **只做结构，不做预测**
//   node cli-paired.mjs --couple PAIR-0001 PAIR-0002      # 两人的结构耦合度 + ★随机基线
//
// ★ 决策三：全部产出强制 status=hypothesis_under_validation、置信度封顶 0.6，且**只做结论互相比对**。
// ★ R-C3：任何"耦合度/同构率"必须与**随机配对的基线**并列，禁止只报一个数。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** 结构耦合度：两侧拓扑"形状"（关系多重集）的相似度 + 五行节点重合度 */
export function couplingOf(a, b) {
  if (!a || !b) return null;
  const rels = (t) => t.map((x) => x.rel);
  const A = rels(a), B = rels(b);
  // 关系多重集的 Jaccard（含重复计数）
  const count = (arr) => arr.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});
  const ca = count(A), cb = count(B);
  let inter = 0, union = 0;
  for (const k of new Set([...Object.keys(ca), ...Object.keys(cb)])) {
    inter += Math.min(ca[k] ?? 0, cb[k] ?? 0);
    union += Math.max(ca[k] ?? 0, cb[k] ?? 0);
  }
  const jaccard = union ? inter / union : null;
  // 长度差惩罚（避免"都很短"造成的虚高相似）
  const lenPenalty = 1 - Math.abs(A.length - B.length) / Math.max(A.length, B.length, 1);
  const score = jaccard === null ? null : jaccard * lenPenalty;
  return { jaccard, lenPenalty, score: score === null ? null : Math.round(score * 1000) / 1000 };
}

/**
 * 随机基线（R-C3）
 * ★ 首版写成"打乱两侧的边" —— **退化的**：打乱不改变关系的多重集，Jaccard 恒定 ⇒ 基线均值 1±0，毫无意义。
 *   正确零假设 = **「乙的结构换成随机结构」**：保持边数与关系边缘分布，从边缘分布重采样。
 *   （等价于问：甲与乙的相似度，是否高于甲与"一个随机图"的相似度）
 */
export function couplingBaseline(a, b, { iters = 2000, rnd = Math.random } = {}) {
  if (!a || !b || !a.length) return null;
  const marginal = a.map((x) => x.rel);                        // 用甲的边缘分布作零模型的语言
  const nulls = [];
  for (let i = 0; i < iters; i++) {
    const fake = Array.from({ length: b.length }, (_, k) => ({ from: '木', to: '火', rel: marginal[Math.floor(rnd() * marginal.length)], step: `n${k}` }));
    const r = couplingOf(a, fake);
    if (r?.score !== null && r?.score !== undefined) nulls.push(r.score);
  }
  if (!nulls.length) return null;
  const mu = nulls.reduce((x, y) => x + y, 0) / nulls.length;
  const sd = Math.sqrt(nulls.reduce((x, y) => x + (y - mu) ** 2, 0) / nulls.length);
  return { mean: Math.round(mu * 1000) / 1000, sd: Math.round(sd * 1000) / 1000, iters: nulls.length, degenerate: sd === 0 };
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  /* ── 四柱自洽性机检 ── */
  if (flag('pillars') || argv.filter((x) => !x.startsWith('--')).length === 4) {
    const { checkPillars, candidateYears, candidateDates } = await import('./src/bazi/consistency.mjs');
    const ps = argv.filter((x) => !x.startsWith('--')).slice(0, 4);
    P('# 四柱自洽性机检（五虎遁 / 五鼠遁 / 干支阴阳）');
    P('');
    P(`输入：**${ps.join(' ')}**（年 月 日 时）`);
    P('');
    const r = checkPillars(ps);
    P('| 校验项 | 期望 | 实报 | 结果 |');
    P('|---|---|---|---|');
    for (const c of r.checks) P(`| ${c.rule} | ${c.expect} | ${typeof c.actual === 'string' ? c.actual : c.actual.join('')} | ${c.ok ? '✅' : '❌'} |`);
    P('');
    P(`**总体：${r.valid ? '✅ 四柱自洽（历法上可能存在）' : '❌ 不自洽'}**`);
    if (r.errors.length) { P(''); for (const e of r.errors) P(`- ⚠️ ${e}`); }
    P('');
    P('## 候选公历年份（R-A1：干支不含绝对年代）');
    P('');
    const ys = candidateYears(ps[0], { from: 1900, to: 2100 });
    P(`年干支 **${ps[0]}** 在 1900–2100 内对应：**${ys.join('、')}**`);
    P('');
    P('## 候选公历日期（四柱全匹配，1900 年起）');
    P('');
    const ds = candidateDates(ps, { from: 1900, to: 2100, limit: 12 });
    if (!ds.length) P('- 区间内**无**完全匹配的四柱 → 需用户确认公历年份（可能早于 1900）');
    else {
      P('| 候选日期 | 该日含此四柱的时辰区间 |');
      P('|---|---|');
      for (const d of ds) P(`| ${d.date} | ${String(d.hourFrom).padStart(2, '0')}:00–${String(d.hourTo).padStart(2, '0')}:00 |`);
      P('');
      P(`> 共 ${ds.length} 个候选（上限 12）—— **干支每 60 天循环，必须由用户确认出生年月**（R-A1）。`);
    }
    P('');
    P('## 你还需要补的字段（Schema 强制 required）');
    P('');
    P('| 字段 | 为什么必须 |');
    P('|---|---|');
    P('| `birth.date`（公历年月日） | 四柱反推不唯一（见上） |');
    P('| `birth.time`（**精确到分**）+ `timePrecision` | 星盘四轴需要分钟级；unknown 则时柱不可用 |');
    P('| `birth.place` + `lon` + `lat` | **星盘必须有经纬度**（四柱完全不含地点） |');
    P('| `birth.tzOffsetHours`（+ `tzName`） | 历史时差/夏令时（R-W8） |');
    P('| `divination.*`（占问时刻+地点+事项） | 六壬起课必需；若本次无占问，可留空并说明 |');
    P('| `feedback.*`（结果+应期+可信度） | 验证必需 |');
  }

  /* ── 样本校验 ── */
  const { validatePaired, alignSample, loadPaired, STATUS, CONFIDENCE_CAP } = await import('./src/cross/paired.mjs');
  if (flag('check')) {
    const list = loadPaired();
    P('# 成对样本校验报告');
    P('');
    P(`目录：\`data/samples/paired/\`｜样本数 **${list.length}**｜强制状态 \`${STATUS}\`｜置信度上限 **${CONFIDENCE_CAP}**`);
    P('');
    if (!list.length) P('> 目录为空。请按 `data/samples/paired-example.json` 填写后放入。');
    for (const s of list) {
      const e = validatePaired(s);
      P(`## ${s.sampleId ?? '（无编号）'} — ${e.length ? '❌ 未通过' : '✅ 通过'}`);
      P('');
      if (e.length) { for (const x of e) P(`- ⚠️ ${x}`); P(''); }
      else {
        P(`- 出生：${s.birth.date} ${s.birth.time}（${s.birth.timePrecision}）@ ${s.birth.place} (${s.birth.lon}, ${s.birth.lat}) tz${s.birth.tzOffsetHours}`);
        P(`- 占问：${s.divination.date} ${s.divination.time} @ ${s.divination.place}｜${s.divination.category}｜${s.divination.question}`);
        P(`- 反馈：${s.feedback.outcome}｜应期 ${s.feedback.outcomeDate ?? '—'}｜可信度 ${s.feedback.reliability}`);
        P('');
      }
    }
  }
  if (flag('align')) {
    const list = loadPaired();
    P('# 结构量对齐（只做结构，不做预测）');
    P('');
    for (const s of list) {
      const r = await alignSample(s);
      if (!r.ok) { P(`## ${s.sampleId} — ❌ 未通过校验，跳过`); for (const x of r.errors) P(`- ${x}`); P(''); continue; }
      P(`## ${r.sampleId}`);
      P('');
      P(`- 六柱：${r.sixPillars.year} ${r.sixPillars.month} ${r.sixPillars.day}（日干 ${r.sixPillars.riGan}）｜月将 ${r.sixPillars.yueJiang ?? '—'}｜占时 ${r.sixPillars.zhanShi ?? '—'}｜真太阳时 ${r.sixPillars.usedTrueSolar ? '已用' : '未用'}`);
      P(`- 星盘：上升 ${r.natal?.asc ?? '—'}｜太阳 ${r.natal?.sunSign ?? '—'}`);
      P(`- 六壬拓扑：\`${r.topologies.liuren?.signature ?? '—'}\`｜型 ${r.topologies.liuren?.label ?? '—'}`);
      P(`- 星盘拓扑：\`${r.topologies.astro?.signature ?? '—'}\`｜型 ${r.topologies.astro?.label ?? '—'}`);
      P(`- 形状是否相同：**${r.alignment.sameShape === null ? '无法判定' : r.alignment.sameShape ? '是' : '否'}**（${r.alignment.basis}）`);
      P(`- 状态：\`${r.status}\`｜置信度 ${r.confidence.capped}（原始 ${r.confidence.raw}）｜可入正式库：${r.confidence.writable ? '是' : '**否**'}`);
      P('');
    }
    P(`> ⚠️ ${STATUS}：真实事件验证前不得升级置信度（R-C5）；本表**不含任何预测或吉凶断语**。`);
  }
  /* ── 结构耦合度（含随机基线，R-C3）── */
  if (flag('couple')) {
    const ids = argv.slice(argv.indexOf('--couple') + 1).filter((x) => !x.startsWith('--'));
    const list = loadPaired();
    const picked = ids.map((id) => list.find((s) => s.sampleId === id)).filter(Boolean);
    P('# 结构耦合度（两人之间，仅结构比对）');
    P('');
    if (picked.length < 2) P(`> 需要两个已入库样本（当前匹配到 ${picked.length} 个）。`);
    else {
      const { aspectTopology } = await import('./src/cross/topology.mjs');
      const { computeNatal } = await import('./src/western/natal.mjs');
      const tops = picked.map((s) => {
        const ch = computeNatal({ at: `${s.birth.date} ${s.birth.time}`, lng: s.birth.lon, lat: s.birth.lat, tz: s.birth.tzOffsetHours });
        return aspectTopology(ch, { maxOrb: 8 });
      });
      const c = couplingOf(tops[0].edges, tops[1].edges);
      const base = couplingBaseline(tops[0].edges, tops[1].edges, { iters: 2000 });
      P('| 项 | 值 |');
      P('|---|---|');
      P(`| 甲拓扑型 / 边数 | ${tops[0].label} / ${tops[0].edges.length} |`);
      P(`| 乙拓扑型 / 边数 | ${tops[1].label} / ${tops[1].edges.length} |`);
      P(`| 关系多重集 Jaccard | ${c.jaccard?.toFixed(3)} |`);
      P(`| 长度惩罚 | ${c.lenPenalty.toFixed(3)} |`);
      P(`| **耦合度** | **${c.score}** |`);
      P(`| **随机基线（2000 次打乱）** | 均值 **${base.mean}**，标准差 ${base.sd} |`);
      P('');
      const z = base.sd ? (c.score - base.mean) / base.sd : 0;
      P(`**相对随机的偏离 z = ${z.toFixed(2)}** → ${Math.abs(z) < 1.96 ? '**与随机无异（不构成"耦合"）**' : '偏离随机，但需更大样本复核'}`);
      P('');
      P(`> ⚠️ 状态 \`${STATUS}\`｜置信度上限 ${CONFIDENCE_CAP}｜**严禁据此输出吉凶断语**。`);
      P('> 单对样本的"耦合度"不具有统计意义（n=1）；本表只把**方法论**跑通，供数据积累后复用。');
    }
  }

  const rp = argv[argv.indexOf('--report') + 1];
  if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
