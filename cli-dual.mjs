#!/usr/bin/env node
// 双体系独立推理 → 分别分析 → 摩擦检查 → 更新 rule 库
//   node cli-dual.mjs --report reports/dual-inference.md --json data/vedastro/dual-inference.json [--n 1500]
//   node cli-dual.mjs --update-rules        # 把结论写进 rules 证据链（分层抽样，带 ≥3 盘门槛）
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTrainingDb, sampleFused } from './src/vedastro/pipeline.mjs';
import { dualInfer, ASTRO_W, BAZI_W } from './src/cross/dual-signal.mjs';
import { observe, buildLibrary, LIB_PATH } from './src/cross/mapping-library.mjs';
import { twoProportionP } from './src/vedastro/mine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const round = (x) => Math.round(x * 1000) / 1000;   // ★ 必须在使用前声明（曾放在文件末尾 → TDZ 报错，整段静默不执行）
const lines = [];
const P = (s) => { console.log(s); lines.push(s); };

const { records: db, bad } = loadTrainingDb();
if (!db.length) { console.error('缺训练库：先跑 node cli-vedastro.mjs --dump'); process.exit(2); }
const N = Number(arg('n', 1500));
const sample = sampleFused(db, { n: N, seed: 11 });

const rows = sample.map((f) => dualInfer(f)).filter((r) => r.label);
const rate = (arr, p) => (arr.length ? arr.filter(p).length / arr.length : 0);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

P('# 双体系独立推理 · 分别分析 · 摩擦检查');
P('');
P(`样本：本地训练库分层抽样 **${rows.length}** 盘（全库 ${db.length}，坏行 ${bad}）｜口径：占星侧 R-V6 主流西方占星；八字侧真太阳时（R-T2）`);
P('');

/* ── 1. 各体系独立表现 ── */
const TARGETS = [
  ['多婚(≥2次)', (l) => l.marriages >= 2],
  ['无离婚(婚姻存续)', (l) => l.stable === true],
  ['包办婚姻', (l) => l.arranged === true],
];
P('## 1 两个体系**各自独立**的成绩单（未经融合）');
P('');
P('| 目标 | 基线(n) | 占星·凶组 | 占星·吉组 | 占星判别力 | p | 八字·凶组 | 八字·吉组 | 八字判别力 | p |');
P('|---|---|---|---|---|---|---|---|---|---|');
const scoreboard = [];
for (const [name, pred] of TARGETS) {
  const base = rate(rows, (r) => pred(r.label));
  const gA = rows.filter((r) => r.astro.verdict === '凶'), gG = rows.filter((r) => r.astro.verdict === '吉');
  const gB = rows.filter((r) => r.bazi.verdict === '凶'), gB2 = rows.filter((r) => r.bazi.verdict === '吉');
  const aBad = rate(gA, (r) => pred(r.label)), aGood = rate(gG, (r) => pred(r.label));
  const bBad = rate(gB, (r) => pred(r.label)), bGood = rate(gB2, (r) => pred(r.label));
  const nBase = rows.filter((r) => pred(r.label)).length;
  const pA = twoProportionP(Math.round(aBad * gA.length), gA.length, Math.round(aGood * gG.length), gG.length);
  const pB = twoProportionP(Math.round(bBad * gB.length), gB.length, Math.round(bGood * gB2.length), gB2.length);
  const lift = (x) => (base ? (x / base).toFixed(2) : '—');
  scoreboard.push({ name, base, baseN: nBase, aBad, aGood, bBad, bGood,
    aBadN: gA.length, aGoodN: gG.length, bBadN: gB.length, bGoodN: gB2.length,
    astroLift: base ? aBad / base : null, baziLift: base ? bBad / base : null, pAstro: pA, pBazi: pB });
  P(`| ${name} | ${pct(base)}(${nBase}) | ${pct(aBad)}(n${gA.length}) | ${pct(aGood)}(n${gG.length}) | 凶/基=${lift(aBad)} | ${pA.toFixed(3)} | ${pct(bBad)}(n${gB.length}) | ${pct(bGood)}(n${gB2.length}) | 凶/基=${lift(bBad)} | ${pB.toFixed(3)} |`);
}
P('');
P('> 「判别力」= 该组命中率 ÷ 基线。>1 表示该体系判凶的盘确实更常出现该结果。');
P('> 判据：**判别力 < 1.2 视为无判别力**（噪声量级），不要写成结论。');
P('');

/* ── 2. 摩擦检查 ── */
P('## 2 矛盾摩擦处（两体系方向相反）');
P('');
const groups = { '一致': (r) => r.cmp.relation === '一致', '矛盾': (r) => r.cmp.relation === '矛盾', '单侧中性': (r) => r.cmp.relation === '单侧中性', '双中性': (r) => r.cmp.relation === '双中性' };
P('| 关系 | 盘数 | 占比 | 多婚率 | 无离婚率 | 包办率 |');
P('|---|---|---|---|---|---|');
for (const [k, p] of Object.entries(groups)) {
  const g = rows.filter(p);
  P(`| ${k} | ${g.length} | ${pct(g.length / rows.length)} | ${pct(rate(g, (r) => r.label.marriages >= 2))} | ${pct(rate(g, (r) => r.label.stable))} | ${pct(rate(g, (r) => r.label.arranged))} |`);
}
const contra = rows.filter((r) => r.cmp.relation === '矛盾');
const agree = rows.filter((r) => r.cmp.relation === '一致');
const pFric1 = twoProportionP(Math.round(rate(contra, (r) => r.label.marriages >= 2) * contra.length), contra.length, Math.round(rate(agree, (r) => r.label.marriages >= 2) * agree.length), agree.length);
const pFric2 = twoProportionP(Math.round(rate(contra, (r) => r.label.stable) * contra.length), contra.length, Math.round(rate(agree, (r) => r.label.stable) * agree.length), agree.length);
P('');
P(`- 矛盾组 **${contra.length}** 盘（占 ${pct(contra.length / rows.length)}）｜一致组 ${agree.length} 盘（占 ${pct(agree.length / rows.length)}）`);
P(`- 多婚率：矛盾组 ${pct(rate(contra, (r) => r.label.marriages >= 2))} vs 一致组 ${pct(rate(agree, (r) => r.label.marriages >= 2))}｜**p=${pFric1.toFixed(3)}**`);
P(`- 无离婚率：矛盾组 ${pct(rate(contra, (r) => r.label.stable))} vs 一致组 ${pct(rate(agree, (r) => r.label.stable))}｜**p=${pFric2.toFixed(3)}**`);
P('');
P(`> 判读：**p > 0.05 即"矛盾本身不携带信息"** —— 不要拿"两体系打架所以这盘特殊"当结论。`);
P('');
P('### 矛盾样例（各 3 例）');
P('');
P('| ID | 占星 | 占星分 | 八字 | 八字分 | 实际婚姻 |');
P('|---|---|---|---|---|---|');
for (const r of contra.slice(0, 6)) P(`| ${String(r.id).slice(0, 22)} | ${r.astro.verdict} | ${r.astro.score} | ${r.bazi.verdict} | ${r.bazi.score} | 婚${r.label.marriages}离${r.label.divorces}${r.label.arranged ? '·包办' : ''} |`);
P('');

/* ── 3. 结论与规则候选 ── */
P('## 3 结论与规则候选（供人工裁定）');
P('');
P('| # | 体系 | 规则（参数化） | 判别力 | 判定 | **人工裁定** |');
P('|---|---|---|---|---|---|');
let i = 0;
const rules = [];
for (const s of scoreboard) {
  for (const [sys, lift] of [['占星', s.astroLift], ['八字', s.baziLift]]) {
    if (lift == null) continue;
    i++;
    const verdict = lift >= 1.2 ? '有判别力' : lift <= 0.85 ? '反向' : '无判别力';
    const claim = `${sys}侧判「凶」的盘，${s.name}发生率高于基线（lift ${lift.toFixed(2)}）`;
    rules.push({ id: `D${i}`, system: sys, target: s.name, claim, lift: round(lift), base: round(s.base), cohort: sys === '占星' ? 'astro=凶' : 'bazi=凶', verdict, manual: null });
    P(`| D${i} | ${sys} | ${claim} | ${lift.toFixed(2)} | ${verdict} |  |`);
  }
}
P('');
P('### 参数表（可直接改数再重跑）');
P('');
P('| 占星侧参数 | 分值 | 八字侧参数 | 分值 |');
P('|---|---|---|---|');
const ak = Object.entries(ASTRO_W), bk = Object.entries(BAZI_W);
for (let j = 0; j < Math.max(ak.length, bk.length); j++) P(`| ${ak[j]?.[0] ?? ''} | ${ak[j]?.[1] ?? ''} | ${bk[j]?.[0] ?? ''} | ${bk[j]?.[1] ?? ''} |`);
P('');
P('> 改分值的正确姿势：改 `src/cross/dual-signal.mjs` 里的 `ASTRO_W` / `BAZI_W` 常量，重跑本命令。');
P('> 这是"我人工修正"的直接接口 —— 不需要改代码逻辑，只改数字。');

/* ── 4. 更新 rule 库 ── */
if (flag('update-rules')) {
  let written = 0;
  for (const r of rules) {
    if (r.lift < 1.0) continue;                        // 只把有正向迹象的写进库
    const cohort = rows.filter((x) => (r.system === '占星' ? x.astro.verdict === '凶' : x.bazi.verdict === '凶')).slice(0, 20);
    const ctrl = rows.filter((x) => (r.system === '占星' ? x.astro.verdict !== '凶' : x.bazi.verdict !== '凶')).slice(0, 10);
    for (const x of cohort) { observe({ claim: r.claim, from: `双体系:${r.id}`, to: r.target, chartId: x.id, supports: true, note: `lift=${r.lift}` }, LIB_PATH); written++; }
    for (const x of ctrl) { observe({ claim: r.claim, from: `双体系:${r.id}`, to: r.target, chartId: x.id, supports: false, note: '对照组' }, LIB_PATH); written++; }
  }
  const lib = buildLibrary(LIB_PATH);
  P('');
  P('## 4 rule 库更新');
  P('');
  P('| 规则 | 目标 | 状态 | 支持/反例/盘数 |');
  P('|---|---|---|---|');
  for (const r of rules) {
    const it = lib.get(`双体系:${r.id}→${r.target}`);
    if (it) P(`| ${r.id} · ${r.system} | ${r.target} | ${it.status} | ${it.supportCount ?? 0}/${it.contradictCount ?? 0}/${it.chartCount ?? 0} |`);
  }
  P('');
  P(`写入 ${written} 条证据（每条规则：凶组 20 + 对照组 10 分层抽样）｜rules 库现共 ${lib.size} 条`);
  P('> 说明：证据用**分层抽样**而非全量，是为了让既有「≥3 盘且 0 反例 → verified」门槛有意义且库不膨胀；');
  P('> 完整统计以本报告为准，库内只承载"可被下游消费的规则状态"。');
}

const j = arg('json');
if (j) { mkdirSync(dirname(j), { recursive: true }); writeFileSync(j, JSON.stringify({ meta: { n: rows.length, source: db.length, seed: 11, ruleVersion: 'R-V7' }, scoreboard, rules, friction: { 一致: agree.length, 矛盾: contra.length }, params: { astro: ASTRO_W, bazi: BAZI_W } }, null, 2), 'utf8'); console.error(`[JSON 已写入] ${j}`); }
const rp = arg('report');
if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, lines.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
