#!/usr/bin/env node
// BaziQA 评测 CLI：本引擎独立作答 → 与专家答案比对 → 失效规则族定位 → 优化迭代
//   node cli-baziqa.mjs --run [--report reports/baziqa.md]
//   node cli-baziqa.mjs --errors [--topic 健康]     # 逐题看我的答案/专家答案/理由
//   node cli-baziqa.mjs --plan                      # 排盘覆盖与时间基座告警
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMcq, evaluate, vsChance, classifyQuestion, BAZIQA_CELEB, splitByYear, learnKeywords, compareStrategies } from './src/bazi/qa.mjs';
import { compileBazi } from './src/bazi/engine.mjs';
import { baziClock } from './src/western/truesolar.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

if (!existsSync(join(HERE, 'data', 'baziqa', 'baziqia_all.json'))) {
  console.error('缺 BaziQA 数据：\ndata/baziqa/baziqia_all.json\n下载（jsDelivr 镜像）：\n  https://cdn.jsdelivr.net/gh/look-fate/fate_benchmark@main/baziqia_all.json');
  process.exit(2);
}

const { items, persons, total } = loadMcq();
const ev = evaluate(items);

if (flag('run') || argv.length === 0) {
  const ch = vsChance(ev.correct, ev.n);
  P('# BaziQA 评测：本引擎 vs 专家（大师）答案');
  P('');
  P(`数据：\`baziqia_all.json\`（${persons} 人 / ${total} 题，多选题，专家答案）`);
  P('');
  P('## 总成绩');
  P('');
  P('| 指标 | 值 |');
  P('|---|---|');
  P(`| 题数 | ${ev.n} |`);
  P(`| 本引擎答对 | **${ev.correct}** |`);
  P(`| 准确率 | **${(ch.rate * 100).toFixed(1)}%** |`);
  P(`| 随机基线（4选1） | 25.0% |`);
  P(`| 二项检验 z / p | ${ch.z} / ${ch.p.toFixed(4)} |`);
  P(`| 是否显著高于随机 | ${ch.aboveChance ? '✓ 是' : '✗ **否**'} |`);
  P(`| 选项分布 | ${Object.entries(ev.choiceDist).map(([k, v]) => `${k}:${v}`).join(' ')} |`);
  P('');
  P('## 分题类（定位失效规则族）');
  P('');
  P('| 题类 | 题数 | 答对 | 准确率 | 判读 |');
  P('|---|---|---|---|---|');
  for (const t of ev.topics) {
    const mark = t.n < 5 ? '样本少' : t.acc > 0.25 ? '高于随机' : '≈/低于随机';
    P(`| ${t.topic} | ${t.n} | ${t.correct} | ${(t.acc * 100).toFixed(1)}% | ${mark} |`);
  }
  P('');
  P('## 排盘与时间基座（可机检部分）');
  P('');
  let noPlace = 0, okBazi = 0, errN = 0;
  for (const it of items.slice(0, 200)) {
    try { const b = compileBazi({ at: it.at, gender: it.person.gender === 'female' ? '女' : '男' }); if (b.pillars.length === 4) okBazi++; } catch { errN++; }
  }
  P(`- 四柱可算比例：**${okBazi}/${items.length}**（失败 ${errN}）`);
  P('- ⚠ **baziqia_all 的出生信息没有地点** → 真太阳时无法计算，R-T2 在此数据集上**只能退回民用时**');
  P('  （本引擎不会假装算得出；celebrity50 那份有 place，可做真太阳时）');
  P('');
  P('> 判读纪律：**4 选 1 的随机基线是 25%**。若准确率不显著高于 25%，');
  P('> 正确结论是「本引擎的规则层尚不具备答题能力」，而不是"某些题蒙对了"。');
  P('> 这暴露的是**缺少解释性规则库**（六亲/疾病/事件年份），不是排盘错误 —— 排盘另见 --plan。');
} else if (flag('errors')) {
  const topic = arg('topic');
  const rows = ev.rows.filter((r) => !r.correct && (!topic || r.mine.topic === topic));
  P(`# 错题（${rows.length} 条${topic ? ` · ${topic}` : ''}）`);
  P('');
  P('| # | 人物 | 题类 | 我的答案 | 专家 | 我的理由 | 题目 |');
  P('|---|---|---|---|---|---|---|');
  for (const [i, r] of rows.slice(0, 40).entries()) {
    P(`| ${i + 1} | ${r.personId.slice(0, 16)} | ${r.mine.topic} | ${r.mine.choice}${r.mine.tied ? '(并列)' : ''} | **${r.answer}** | ${r.mine.reason.slice(0, 60)} | ${r.question.slice(0, 30)} |`);
  }
  P('');
  const wrongTop = {};
  for (const r of rows) wrongTop[r.mine.topic] = (wrongTop[r.mine.topic] ?? 0) + 1;
  P(`**错题最多的题类**：${Object.entries(wrongTop).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join('、')}`);
} else if (flag('plan')) {
  P('# 排盘与时间基座检查');
  P('');
  P(`## baziqia_all（${persons} 人，无地点）`);
  P('');
  P('| 人物 | 性别 | 出生（民用） | 四柱 | 真太阳时 | 告警 |');
  P('|---|---|---|---|---|---|');
  for (const it of items.slice(0, 12)) {
    const g = it.person.gender === 'female' ? '女' : '男';
    const clock = baziClock({ date: it.at.slice(0, 10), time: it.at.slice(11), lon: null, tz: 8, tzName: null });
    const b = compileBazi({ at: it.at, gender: g });
    P(`| ${it.personId.slice(0, 14)} | ${g} | ${it.at} | ${b.pillars.join(' ')} | — | ${clock.usedTrueSolar ? '' : clock.reason} |`);
  }
  P('');
  if (existsSync(BAZIQA_CELEB)) {
    const CELEB = JSON.parse(readFileSync(BAZIQA_CELEB, 'utf8'));
    P(`## celebrity50（${CELEB.length} 人，**含出生地** → 可真太阳时）`);
    P('');
    P('| 姓名 | 出生地 | 时刻 | 精确? | 四柱 |');
    P('|---|---|---|---|---|');
    let withPlace = 0, approx = 0, okN = 0;
    for (const c of CELEB) {
      const b = c.profile?.birth ?? {};
      if (b.place) withPlace++;
      if (b.approximate) approx++;
      try {
        const at = `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')} ${String(b.hour ?? 12).padStart(2, '0')}:${String(b.minute ?? 0).padStart(2, '0')}`;
        const r = compileBazi({ at, gender: c.profile?.gender === 'female' ? '女' : '男' });
        okN++;
        if (c.name.length < 26) P(`| ${c.name} | ${(b.place ?? '').slice(0, 18)} | ${at.slice(11)} | ${b.approximate ? '近似' : '精确'} | ${r.pillars.join(' ')} |`);
      } catch { /* skip */ }
    }
    P('');
    P(`- 有出生地 **${withPlace}/${CELEB.length}**｜时刻为近似 **${approx}**｜四柱可算 **${okN}**`);
    P('- 该份数据可用于：真太阳时（需地名→经纬度）、以及 **categories 里的带日期真实事件 → 流年引动对拍**');
  }
} else if (flag('learn')) {
  const { train, test } = splitByYear(items);
  const kw = learnKeywords(train, { minSupport: 2, topK: 60 });
  const cmp = compareStrategies(train, test, kw);
  const chOf = (r) => vsChance(r.correct, r.n);
  P('# BaziQA 优化：数据驱动关键词学习（训练/测试按年份切分）');
  P('');
  P(`切分：训练 = 2021–2023（**${cmp.trainN}** 题）｜测试 = 2024–2025（**${cmp.testN}** 题，**只用它评成绩**）`);
  P('特征：中文字符 2-gram（免分词器）；学习判据 = correct 选项出现率 / wrong 选项出现率的 lift > 1.2 且支持度 ≥2');
  P('');
  P('| 策略 | 测试准确率 | 答对/题数 | 与随机(25%)比 | 无规则命中 | 选项分布 |');
  P('|---|---|---|---|---|---|');
  for (const [name, r] of [['手写规则（基线，未命中默认 A）', cmp.hand], ['学习关键词', cmp.learned], ['两者并（权重 2:1）', cmp.both], ['**规则 + 未命中用训练集先验**', cmp.handPrior], ['纯多数类（对照）', cmp.majority]]) {
    const ch = chOf(r);
    P(`| ${name} | **${(r.acc * 100).toFixed(1)}%** | ${r.correct}/${r.n} | z=${ch.z} p=${ch.p.toFixed(4)} ${ch.aboveChance ? '✓' : '✗'} | ${r.noRule} | ${Object.entries(r.picks).map(([k, v]) => `${k}:${v}`).join(' ')} |`);
  }
  P('');
  P(`- 训练集答案先验：**${cmp.prior.letter}**（${Object.entries(cmp.prior.dist).map(([k, v]) => `${k}:${v}`).join(' ')}，占 ${(cmp.prior.rate * 100).toFixed(1)}%）`);
  P(`- 基线策略的 78/80「无规则命中」说明：**瓶颈是覆盖率不是正确率** —— 规则几乎不触发，之前 98% 选 A 是退化行为`);
  P('');
  P(`### 自动学到的判别词（各题类前 8；共 ${Object.values(kw).reduce((a, b) => a + b.length, 0)} 个）`);
  P('');
  P('| 题类 | 判别词（2-gram） |');
  P('|---|---|');
  for (const [t, list] of Object.entries(kw)) P(`| ${t} | ${list.slice(0, 8).join(' ') || '—'} |`);
  P('');
  P('> ⚠️ 纪律：① 测试集**从未参与学习**；② 样本仅 200 题（测试集更小），置信区间很宽，**不要**把 1–2 个百分点的差别当结论；');
  P('> ③ 2-gram 学到的词可能只是"某个人的题目措辞"，属措辞偏置而非命理知识 —— 这正是需要人工裁定过滤的地方。');
} else if (flag('fit')) {
  // ★ 用专家答案（大师的人工修正结论）**反向拟合规则权重**
  const { train, test } = splitByYear(items);
  const { fitWeights, predictWeighted, weightTable, DEFAULT_WEIGHTS } = await import('./src/bazi/interpretive.mjs');
  const baseTrain = train.filter((it) => predictWeighted(it, DEFAULT_WEIGHTS).choice === it.answer).length / train.length;
  const baseTest = test.filter((it) => predictWeighted(it, DEFAULT_WEIGHTS).choice === it.answer).length / test.length;
  const t0 = Date.now();
  const { weights, trainAcc, trace } = fitWeights(train, DEFAULT_WEIGHTS, { passes: Number(arg('passes', 3)) });
  const fittedTest = test.filter((it) => predictWeighted(it, weights).choice === it.answer).length / test.length;
  const allFitted = items.filter((it) => predictWeighted(it, weights).choice === it.answer).length;
  const allBase = items.filter((it) => predictWeighted(it, DEFAULT_WEIGHTS).choice === it.answer).length;
  P('# 用大师的人工修正结论反向优化 rule 库（规则权重拟合）');
  P('');
  P('做法：把每条规则变成一个**特征**（该规则是否被该选项触发），权重 = 该规则值多少分；');
  P('用**训练集（2021–2023）的专家答案**做坐标上升拟合，**测试集（2024–2025）只看不调**。');
  P('');
  P('| 集合 | 手写权重（Part 10 初始） | **拟合后权重** | 变化 |');
  P('|---|---|---|---|');
  P(`| 训练集（${train.length} 题，参与拟合） | ${(baseTrain * 100).toFixed(1)}% | **${(trainAcc * 100).toFixed(1)}%** | ${((trainAcc - baseTrain) * 100).toFixed(1)}pt |`);
  P(`| **测试集（${test.length} 题，未参与拟合）** | ${(baseTest * 100).toFixed(1)}% | **${(fittedTest * 100).toFixed(1)}%** | ${((fittedTest - baseTest) * 100).toFixed(1)}pt |`);
  P(`| 全量 ${items.length} 题 | ${allBase} (${(allBase / items.length * 100).toFixed(1)}%) | **${allFitted} (${(allFitted / items.length * 100).toFixed(1)}%)** | ${((allFitted - allBase) / items.length * 100).toFixed(1)}pt |`);
  P('');
  P(`拟合过程：${trace.map((t) => `pass${t.pass}=${(t.acc * 100).toFixed(1)}%`).join(' → ')}｜耗时 ${Math.round((Date.now() - t0) / 1000)}s`);
  P('');
  P('## 拟合出的规则权重（这就是被反向修正后的 rule 库）');
  P('');
  P('| 特征（规则） | 领域 | 初始权重 | **拟合权重** | 变化 |');
  P('|---|---|---|---|---|');
  for (const r of weightTable(weights)) {
    const b = DEFAULT_WEIGHTS[r.feature] ?? 0;
    const d = r.weight - b;
    P(`| ${r.feature} | ${r.domain} | ${b} | **${r.weight}** | ${d === 0 ? '—' : (d > 0 ? '+' : '') + d} |`);
  }
  P('');
  P('> 判读：权重为 **0 = 该规则对这批专家答案毫无判别力**（应废弃或重写）；');
  P('> 权重为**负 = 该规则方向反了**（规则写反了，这是最有价值的修正信号）；');
  P('> `biasA..D` 是选项位置偏置 —— 它拟合出非零值说明**答案位置本身携带信号**。');
  P('> ⚠️ 训练/测试差距即过拟合量：两者差距越大，越不能采信训练集的提升。');
  const j = arg('json', 'data/rules/interpretive-weights.json');
  mkdirSync(dirname(j), { recursive: true });
  writeFileSync(j, JSON.stringify({ meta: { fitOn: 'train 2021-2023', nTrain: train.length, nTest: test.length, baseTrain, trainAcc, baseTest, fittedTest, allBase, allFitted }, weights, table: weightTable(weights), trace }, null, 2), 'utf8');
  console.error(`[权重已写入] ${j}`);
} else if (flag('part10')) {
  const { ruleCatalog } = await import('./src/bazi/interpretive.mjs');
  P('# Part 10 规则库清单');
  P('');
  P('| 领域 | 规则编号 | 触发条件 | 结论 |');
  P('|---|---|---|---|');
  for (const r of ruleCatalog()) P(`| ${r.domain} | ${r.id} | ${r.when} | ${r.then} |`);
} else {
  console.log(`BaziQA 评测台
  node cli-baziqa.mjs --run                    # 我的答案 vs 专家答案 + 分题类
  node cli-baziqa.mjs --errors [--topic 健康]  # 错题明细（定位失效规则族）
  node cli-baziqa.mjs --plan                   # 排盘与时间基座检查`);
  process.exit(0);
}

const rp = arg('report');
if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
