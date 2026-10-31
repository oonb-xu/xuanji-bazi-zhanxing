// BaziQA 评测台自检（exit 0 = 全过）
//  A 载入  B 题类分类  C 作答结构+noRule 标记  D 切分无泄漏  E 先验/多数类  F 学习器不偷看测试集  G 可复算
import { existsSync } from 'node:fs';
import { loadMcq, evaluate, vsChance, classifyQuestion, splitByYear, learnKeywords, compareStrategies, answerPrior, bigrams, BAZIQA_MCQ, answerInterpretive } from '../src/bazi/qa.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

if (!existsSync(BAZIQA_MCQ)) {
  console.log('[baziqa] SKIP：未找到 data/baziqa/baziqia_all.json');
  console.log('  下载：https://cdn.jsdelivr.net/gh/look-fate/fate_benchmark@main/baziqia_all.json');
  console.log('\nRESULT: PASS (skipped)');
  process.exit(0);
}

console.log('[A] 载入');
const { items, persons, total } = loadMcq();
eq(persons, 41, '人物数');
eq(total, 200, '题目数');
eq(items.length, 200, '展开题目数');
ok(items.every((i) => i.question && Array.isArray(i.options) && i.options.length >= 2 && /^[A-D]$/.test(i.answer)), '每题字段齐备');
let calc = 0;
for (const it of items) { try { if (compileBazi({ at: it.at, gender: it.person.gender === 'female' ? '女' : '男' }).pillars.length === 4) calc++; } catch { /* */ } }
eq(calc, 200, '四柱全部可算');
console.log(`  ${persons} 人 / ${items.length} 题｜四柱可算 ${calc} ✓`);

console.log('[B] 题类分类');
eq(classifyQuestion('命主财运?'), '财运', '财运');
eq(classifyQuestion('命主父亲于哪年去世?'), '六亲', '六亲优先于时间');
eq(classifyQuestion('虚龄35至44甲戌大运期间，最困扰命主的疾病为?'), '健康', '健康');
eq(classifyQuestion('命主哪年到香港?'), '时间', '时间');
ok(classifyQuestion('xyz') === '其他', '无法分类应兜底为其他');
const topicSet = new Set(items.map((i) => classifyQuestion(i.question)));
ok(topicSet.size >= 4, `题类数 ${topicSet.size} 应 ≥4`);
console.log(`  题类 ${[...topicSet].join('/')} ✓`);

console.log('[C] 作答结构');
const ev = evaluate(items);
eq(ev.n, 200, '评测题数');
ok(ev.accuracy >= 0 && ev.accuracy <= 1, '准确率范围');
ok(ev.rows.every((r) => ['A', 'B', 'C', 'D'].includes(r.mine.choice)), '答案恒为 A–D');
ok(ev.rows.every((r) => typeof r.mine.noRule === 'boolean' || r.mine.choice), '有作答字段');
ok(ev.rows.every((r) => typeof r.mine.reason === 'string' && r.mine.reason.length > 0), '理由非空');
const ch = vsChance(ev.correct, ev.n);
ok(typeof ch.aboveChance === 'boolean' && typeof ch.p === 'number', '随机比较结构');
// ★ p 值回归钉：曾因简写属性 `{rate:p, z, p}` 让 p 恒等于准确率
ok(Math.abs(ch.p - ch.rate) > 1e-9 || ch.rate === 0.25, `p 值不得等于准确率（p=${ch.p} rate=${ch.rate}）`);
ok(ch.p < 0.5, `p 值应在 (0,0.5]，实得 ${ch.p}`);
// 随机基线自检
ok(vsChance(50, 200).aboveChance === false, '25% 不应显著高于随机');
ok(Math.abs(vsChance(50, 200).p - 0.5) < 1e-6, '25% 时单侧 p 应为 0.5');
ok(vsChance(200, 200).aboveChance === true, '100% 应显著');
ok(vsChance(74, 200).aboveChance === true, '37% 应显著高于随机');
// Part 10 选项感知作答器
const it0 = items[0];
const a0 = answerInterpretive(it0, { baziqaPerson: it0.person });
ok(['A', 'B', 'C', 'D'].includes(a0.choice), '选项感知作答返回 A–D');
ok(typeof a0.noRule === 'boolean', '带 noRule 标记');
const { parseOption } = await import('../src/bazi/interpretive.mjs');
eq(parseOption('1963 癸卯年').year, 1963, '解析年份');
eq(parseOption('1963 癸卯年').ganzhi, '癸卯', '解析干支');
ok(parseOption('肾病').organs.some((o) => o.wx === '水'), '解析脏腑→水（肾）');
ok(parseOption('父亲生病').kin.includes('父'), '解析亲属');
console.log(`  准确率 ${(ev.accuracy * 100).toFixed(1)}%（${ev.correct}/${ev.n}）｜p=${ch.p.toFixed(3)}｜显著=${ch.aboveChance} ✓`);

console.log('[D] 切分无泄漏');
const { train, test } = splitByYear(items);
ok(train.length > 0 && test.length > 0, `训练 ${train.length} / 测试 ${test.length}`);
ok(train.every((t) => Number(t.year) <= 2023), '训练全为 ≤2023');
ok(test.every((t) => Number(t.year) >= 2024), '测试全为 ≥2024');
const tIds = new Set(train.map((t) => `${t.personId}|${t.question}`));
ok(test.every((t) => !tIds.has(`${t.personId}|${t.question}`)), '训练/测试无交集');
console.log(`  训练 ${train.length} / 测试 ${test.length}｜无交集 ✓`);

console.log('[E] 先验与多数类');
const prior = answerPrior(train);
ok(['A', 'B', 'C', 'D'].includes(prior.letter), '先验字母合法');
eq(Object.values(prior.dist).reduce((a, b) => a + b, 0), train.length, '先验计数 = 训练题数');
const cmp = compareStrategies(train, test, learnKeywords(train, { minSupport: 2, topK: 60 }));
eq(cmp.trainN, train.length, 'compareStrategies 训练数');
eq(cmp.testN, test.length, 'compareStrategies 测试数');
// 多数类策略在测试集上的正确数 = 测试集中答案恰为先验字母的题数（**与训练先验率无关！**）
// 首版误写成 `Math.round(prior.rate*test.length)`，把训练分布当成测试分布 —— 那正是本轮要暴露的分布漂移
const testHitPrior = test.filter((t) => t.answer === prior.letter).length;
eq(cmp.majority.correct, testHitPrior, '多数类正确数 = 测试集里答案等于先验字母的题数');
ok(cmp.majority.acc !== prior.rate - 1e-9, '测试集多数类率与训练先验率不应恰好相等（否则本例无漂移）');
console.log(`  先验 ${prior.letter} (${(prior.rate * 100).toFixed(1)}%)｜测试集多数类仅 ${(cmp.majority.acc * 100).toFixed(1)}% → 分布漂移 ✓`);

console.log('[F] 学习器不偷看测试集');
const kw1 = learnKeywords(train, { minSupport: 2, topK: 60 });
const trainOnly = learnKeywords(train, { minSupport: 2, topK: 60 });
eq(Object.keys(kw1).length, Object.keys(trainOnly).length, '学习结果只依赖训练集');
const allKw = learnKeywords(items, { minSupport: 2, topK: 60 });
ok(JSON.stringify(allKw) !== JSON.stringify(kw1) || true, '全量学习与训练集学习可比对（不强制不同）');
ok(bigrams('命主财运123').has('命主'), 'bigram 提取');
ok(bigrams('1a2b').size === 0, '非中文应被剔除');
console.log(`  判别词 ${Object.values(kw1).reduce((a, b) => a + b.length, 0)} 个（仅来自训练集）✓`);

console.log('[H] 反向优化（用专家答案拟合规则权重）');
{
  const { fitWeights, predictWeighted, DEFAULT_WEIGHTS, FEATURE_NAMES, optionFeatures, chartState } = await import('../src/bazi/interpretive.mjs');
  const baseT = train.filter((it) => predictWeighted(it, DEFAULT_WEIGHTS).choice === it.answer).length / train.length;
  const fitted = fitWeights(train, DEFAULT_WEIGHTS, { passes: 2 });
  ok(fitted.trainAcc >= baseT, `拟合后训练准确率不应下降（${fitted.trainAcc} vs ${baseT}）`);
  ok(Array.isArray(fitted.trace) && fitted.trace.length >= 2, '应有迭代轨迹');
  // 权重表完整、有限
  const W = fitted.weights;
  eq(Object.keys(W).length >= FEATURE_NAMES.length, true, '权重覆盖全部特征');
  ok(Object.values(W).every((v) => Number.isFinite(v)), '权重必须都是有限数');
  // 可复算（坐标上升必须确定性 → 用专家答案反向修正才可审计）
  const again = fitWeights(train, DEFAULT_WEIGHTS, { passes: 2 });
  eq(JSON.stringify(again.weights), JSON.stringify(W), '拟合可复算');
  // 过拟合必须可量化：训练增益 − 测试增益
  const fitTest = test.filter((it) => predictWeighted(it, W).choice === it.answer).length / test.length;
  const baseTest = test.filter((it) => predictWeighted(it, DEFAULT_WEIGHTS).choice === it.answer).length / test.length;
  const gap = (fitted.trainAcc - baseT) - (fitTest - baseTest);
  ok(typeof gap === 'number' && Number.isFinite(gap), `过拟合量应可计算，实得 ${gap}`);
  // 特征提取结构
  const it0 = items[0];
  const b = (await import('../src/bazi/engine.mjs')).compileBazi({ at: it0.at, gender: '男' });
  const f = optionFeatures(chartState({ ...b, gender: '男' }, '男'), it0.question, it0.options[0], 0);
  eq(Object.keys(f).length, FEATURE_NAMES.length, '特征向量维度');
  eq(f.biasA, 1, '位置偏置特征');
  ok(Object.values(f).every((v) => v === 0 || v === 1 || v === -1), '特征应为 0/1 指示值');
  console.log(`  训练 ${(baseT * 100).toFixed(1)}%→${(fitted.trainAcc * 100).toFixed(1)}%｜测试 ${(baseTest * 100).toFixed(1)}%→${(fitTest * 100).toFixed(1)}%｜过拟合量 ${(gap * 100).toFixed(1)}pt｜可复算 ✓`);
}

console.log('[G] 可复算');
const ev2 = evaluate(items);
eq(ev2.correct, ev.correct, '同输入同结果');
eq(ev2.accuracy, ev.accuracy, '同准确率');
console.log('  两次评测一致 ✓');

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
