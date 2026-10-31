// BaziQA 评测台：本引擎先独立作答 → 与专家（大师）答案比对 → 定位系统失效的规则族
//
// 数据：look-fate/fate_benchmark 的 baziqia_all.json（200 题 / 41 人，多选题，含专家答案）
//       ChenJiangxi/BaziQA 的 celebrity50_zh.json（50 人，含真实出生地/时刻 + 带日期的真实事件）
// ★ 重要限制：baziqia_all 的 birth **没有地点**，真太阳时算不出来 → R-T2 退回民用时并计入告警（不假装算得出）。
//
// 作答方式：**规则驱动**而不是"猜选项" —— 先由八字推出一个画像（用/忌、夫妻宫、脏腑映射、财官强度），
// 再按选项文本的关键词与画像的匹配度打分。所有规则与关键词表都显式写出，便于人工修正。
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBazi } from './engine.mjs';
import { chartState, scoreOptions } from './interpretive.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJ = resolve(HERE, '../..');
export const BAZIQA_MCQ = join(PROJ, 'data', 'baziqa', 'baziqia_all.json');
export const BAZIQA_CELEB = join(PROJ, 'data', 'baziqa', 'celebrity50_zh.json');

/* ── 题类关键词（用于把题目分到可判规则的族） ── */
export const TOPIC_KEYWORDS = {
  财运: ['财', '钱', '富', '投资', '破财', '薪', '收入', '生意', '赚钱'],
  婚恋: ['婚', '妻', '夫', '配偶', '感情', '恋爱', '嫁', '娶', '离'],
  六亲: ['父', '母', '兄', '弟', '姐', '妹', '子', '女', '六亲', '亲'],
  健康: ['病', '疾', '健康', '身体', '癌', '手术', '住院', '伤', '痛'],
  事业: ['事业', '工作', '职', '官', '升', '创', '业', '名', '考', '学'],
  时间: ['哪年', '那年', '何年', '流年', '大运', '几岁', '何时'],
  性格: ['性格', '为人', '脾气', '品性'],
};
export function classifyQuestion(q) {
  let best = '其他', bestN = 0;
  for (const [topic, kws] of Object.entries(TOPIC_KEYWORDS)) {
    const n = kws.filter((k) => q.includes(k)).length;
    if (n > bestN) { best = topic; bestN = n; }
  }
  return best;
}

/* ── 五行→脏腑（中医标准映射，用于健康类） ── */
export const WUXING_ORGAN = {
  金: ['呼吸', '肺', '气', '鼻', '皮'],
  木: ['肝', '胆', '眼', '筋'],
  水: ['泌尿', '肾', '生殖', '耳', '膀胱'],
  火: ['心', '血', '循环', '精神', '神'],
  土: ['消化', '脾', '胃', '肠'],
};

/**
 * 由八字推出「画像」——所有后续作答都基于它，规则显式
 */
export function profile(bazi, gender) {
  const d = bazi.distribution ?? {};
  const wx = ['木', '火', '土', '金', '水'];
  const sorted = [...wx].sort((a, b) => (d[b] ?? 0) - (d[a] ?? 0));
  const star = gender === '女' ? ['正官', '七杀'] : ['正财', '偏财'];
  const wealth = (bazi.shiShenCount?.['正财'] ?? 0) + (bazi.shiShenCount?.['偏财'] ?? 0);
  const power = (bazi.shiShenCount?.['正官'] ?? 0) + (bazi.shiShenCount?.['七杀'] ?? 0);
  const seal = (bazi.shiShenCount?.['正印'] ?? 0) + (bazi.shiShenCount?.['偏印'] ?? 0);
  const output = (bazi.shiShenCount?.['食神'] ?? 0) + (bazi.shiShenCount?.['伤官'] ?? 0);
  return {
    ...bazi, strongest: sorted[0], weakest: sorted[4],
    spouseStar: star, spouseStarCount: star.reduce((a, k) => a + (bazi.shiShenCount?.[k] ?? 0), 0),
    wealth, power, seal, output,
    wealthIsYong: bazi.yong === '金' || bazi.yong === '土' ? null : null,   // 需按十神所属五行判，暂留接口
    spouseHit: (bazi.spouseTypes ?? []).length > 0,
  };
}

/* ── 各题类的作答规则：返回对每个选项的加分（关键词命中） ── */
export function answerByTopic(p, question, options) {
  const score = options.map(() => 0);
  const kw = (i, list) => { for (const k of list) if (options[i].includes(k)) score[i] += 1; };
  const all = (list) => options.forEach((_, i) => kw(i, list));
  const topic = classifyQuestion(question);
  const jiWx = p.ji, jiOrgan = (WUXING_ORGAN[jiWx] ?? []);
  const strongStar = p.wealth >= 2 ? '财' : p.power >= 2 ? '官' : p.output >= 2 ? '食伤' : p.seal >= 2 ? '印' : null;

  if (topic === '健康') all(jiOrgan);                                   // 忌神五行 → 对应脏腑
  if (topic === '财运') {
    if (p.wealth >= 2 && p.yong !== '水') all(['合作', '富', '成功', '财源广']);
    if (p.wealth >= 3) all(['暴起暴跌', '挥霍', '多方']);
    if (p.wealth === 0) all(['打工', '守财', '普通']);
    if (p.wealth >= 1 && p.wealth <= 2) all(['稳定', '小康', '衣食']);
  }
  if (topic === '婚恋') {
    if (p.spouseHit) all(['波折', '离', '晚婚', '不顺', '多次']);
    else all(['恩爱', '顺利', '稳定', '和谐', '白头']);
    if (p.spouseStarCount === 0) all(['晚婚', '不婚', '独身']);
    if (p.spouseStarCount >= 3) all(['多次', '桃花', '外遇', '再婚']);
  }
  if (topic === '六亲') {
    if (p.strongest === '金') all(['父', '长']);
    if (p.seal >= 2) all(['母', '受母', '长辈助']);
  }
  if (topic === '事业') {
    if (p.power >= 2) all(['官', '升', '职', '领导', '公职']);
    if (p.output >= 2) all(['技术', '自由', '创', '艺']);
    if (p.seal >= 2) all(['学', '文', '研究', '教育']);
    if (p.wealth >= 2) all(['商', '生意', '财']);
  }
  if (topic === '性格') all([p.strongest === '金' ? '刚' : p.strongest === '木' ? '仁' : p.strongest === '水' ? '智' : p.strongest === '火' ? '急' : '稳']);
  return { score, topic };
}

const LETTER = ['A', 'B', 'C', 'D'];
/** 本引擎独立作答：返回 {choice, topic, reason} */
export function answer(item, { baziqaPerson }) {
  const gender = baziqaPerson.gender === 'female' ? '女' : '男';
  const b = item.bazi ?? compileBazi({ at: item.at, gender });
  const p = profile(b, gender);
  const { score, topic } = answerByTopic(p, item.question, item.options);
  let best = 0;
  for (let i = 1; i < score.length; i++) if (score[i] > score[best]) best = i;
  const tied = score.filter((x) => x === score[best]).length > 1;
  return {
    choice: LETTER[best], topic,
    ruleHit: score[best],
    tied,
    reason: `画像 用${p.yong}/忌${p.ji}｜身${b.L3_verdict?.verdict}｜财${p.wealth}官${p.power}印${p.seal}食伤${p.output}｜夫妻宫${p.spouseZhi}${p.spouseHit ? '(受制)' : ''}`,
  };
}

/**
 * Part 10 选项感知作答器：解析选项结构特征 → 用解释性规则库打分
 * 与 answer() 的区别：不看手写关键词表，而是把选项里的**年份/干支/脏腑/亲属**解析出来再判
 */
export function answerInterpretive(item, { baziqaPerson }) {
  const gender = baziqaPerson.gender === 'female' ? '女' : '男';
  const b = item.bazi ?? compileBazi({ at: item.at, gender });
  const st = chartState({ ...b, gender }, gender);
  const r = scoreOptions(st, item.question, item.options);
  return {
    choice: r.letters[r.best], topic: classifyQuestion(item.question),
    ruleHit: r.options[r.best].score, tied: false,
    noRule: r.noRule,
    rules: r.options[r.best].rules,
    reason: `用${b.L5_yongJi?.yong}/忌${b.L5_yongJi?.ji}｜身${b.L3_verdict?.verdict}｜命中规则 ${r.options[r.best].rules.join(',') || '无'}`,
  };
}

/* ── 载入 ── */
export function loadMcq(path = BAZIQA_MCQ) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const items = [];
  for (const P of j.persons) {
    const bt = P.birth;
    const at = `${bt.year}-${String(bt.month).padStart(2, '0')}-${String(bt.day).padStart(2, '0')} ${String(bt.hour).padStart(2, '0')}:${String(bt.minute ?? 0).padStart(2, '0')}`;
    for (const q of P.questions ?? []) {
      items.push({ personId: P.person_id, person: P, at, question: q.question, options: q.options, answer: String(q.answer).trim().slice(0, 1), contest: P.contest, year: P.year });
    }
  }
  return { items, persons: j.persons.length, total: j.total_questions };
}

/** 评测：总体 + 分题类 + 随机基线（4 选 1 = 25%） */
export function evaluate(items, { strategy = 'interpretive' } = {}) {
  const rows = items.map((it) => {
    let a;
    try { a = strategy === 'interpretive' ? answerInterpretive(it, { baziqaPerson: it.person }) : answer(it, { baziqaPerson: it.person }); }
    catch (e) { a = { choice: null, topic: '错误', reason: e.message, ruleHit: 0, tied: false, noRule: true }; }
    return { ...it, mine: a, correct: a.choice === it.answer };
  });
  const acc = (arr) => (arr.length ? arr.filter((r) => r.correct).length / arr.length : 0);
  const byTopic = {};
  for (const r of rows) { (byTopic[r.mine.topic] ??= []).push(r); }
  const topics = Object.entries(byTopic).map(([t, arr]) => ({ topic: t, n: arr.length, acc: acc(arr), correct: arr.filter((r) => r.correct).length })).sort((a, b) => b.n - a.n);
  const dist = {};
  for (const r of rows) dist[r.mine.choice ?? '—'] = (dist[r.mine.choice ?? '—'] ?? 0) + 1;
  return { n: rows.length, accuracy: acc(rows), correct: rows.filter((r) => r.correct).length, topics, choiceDist: dist, rows };
}

/** 二项检验：本引擎正确数 vs 随机基线 25% 的显著性（正态近似） */
export function vsChance(correct, n, p0 = 0.25) {
  const p = correct / n, se = Math.sqrt(p0 * (1 - p0) / n);
  const z = (p - p0) / se;
  const erf = (x) => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const pv = 1 - 0.5 * (1 + erf(z / Math.SQRT2));
  // ★ 这里曾写成 `{ rate: p, z, p }` —— 简写属性把 p 又指回**准确率**，导致报告的 p 值恒等于准确率
  //   （aboveChance 用的是 pv 所以是对的，只有 p 字段错）→ 已修为 p: pv，并在自检里钉住
  return { rate: p, z: Math.round(z * 100) / 100, p: pv, aboveChance: pv < 0.05 };
}

export { LETTER };

/* ══════════ 数据驱动优化：字符 bigram 关键词学习（带训练/测试切分，防自欺） ══════════ */
/** 中文字符 2-gram（免分词器的权宜特征） */
export function bigrams(s) {
  const t = String(s).replace(/[^\u4e00-\u9fa5]/g, '');
  const out = new Set();
  for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** 训练集上按题类学判别词：correct 选项里常见、wrong 选项里罕见的 bigram */
export function learnKeywords(train, { minSupport = 2, topK = 60 } = {}) {
  const byTopic = {};
  for (const it of train) {
    const topic = classifyQuestion(it.question);
    (byTopic[topic] ??= []).push(it);
  }
  const out = {};
  for (const [topic, arr] of Object.entries(byTopic)) {
    const cnt = { c: {}, w: {} };
    for (const it of arr) {
      for (const [i, opt] of it.options.entries()) {
        const letter = LETTER2[i];
        const bag = bigrams(opt);
        for (const g of bag) {
          if (letter === it.answer) cnt.c[g] = (cnt.c[g] ?? 0) + 1;
          else cnt.w[g] = (cnt.w[g] ?? 0) + 1;
        }
      }
    }
    const scored = Object.keys(cnt.c)
      .filter((g) => cnt.c[g] >= minSupport)
      .map((g) => ({ g, lift: (cnt.c[g] + 1) / (cnt.w[g] + 1), c: cnt.c[g], w: cnt.w[g] ?? 0 }))
      .filter((x) => x.lift > 1.2)
      .sort((a, b) => b.lift - a.lift || b.c - a.c)
      .slice(0, topK);
    out[topic] = scored.map((x) => x.g);
  }
  return out;
}

const LETTER2 = ['A', 'B', 'C', 'D'];

/** 用学到的关键词给选项打分 */
export function answerLearned(item, kw) {
  const topic = classifyQuestion(item.question);
  const list = kw[topic] ?? kw['其他'] ?? [];
  const score = item.options.map((opt) => {
    const bag = bigrams(opt);
    return list.reduce((a, g) => a + (bag.has(g) ? 1 : 0), 0);
  });
  let best = 0;
  for (let i = 1; i < score.length; i++) if (score[i] > score[best]) best = i;
  return { choice: LETTER2[best], score: score[best], spread: Math.max(...score) - Math.min(...score), topic };
}

/** 按 contest 年份切分（2021–2023 训练 / 2024–2025 测试），避免同人同年泄漏 */
export function splitByYear(items) {
  const train = items.filter((it) => Number(it.year) <= 2023);
  const test = items.filter((it) => Number(it.year) >= 2024);
  return { train, test };
}

/** 训练集答案字母先验（多数类基线）—— 用于规则未命中时的兜底，取代"永远选 A"这个退化行为 */
export function answerPrior(train) {
  const cnt = { A: 0, B: 0, C: 0, D: 0 };
  for (const it of train) if (cnt[it.answer] !== undefined) cnt[it.answer]++;
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return { letter: best[0], dist: cnt, rate: train.length ? best[1] / train.length : 0.25 };
}

/** 在给定切分上评测「手写规则 / 学习关键词 / 两者取并」三路，并给出与随机的比较 */
export function compareStrategies(train, test, kw) {
  const prior = answerPrior(train);
  const run = (fn) => {
    let ok = 0, noRule = 0;
    const picks = {};
    for (const it of test) {
      let a;
      try { a = fn(it); } catch { a = { choice: 'A', noRule: true }; }
      if (a.noRule) noRule++;
      picks[a.choice] = (picks[a.choice] ?? 0) + 1;
      if (a.choice === it.answer) ok++;
    }
    return { correct: ok, n: test.length, acc: test.length ? ok / test.length : 0, noRule, picks };
  };
  const handFn = (it) => {
    const g = it.person.gender === 'female' ? '女' : '男';
    const b = compileBazi({ at: it.at, gender: g });
    const p = profile(b, g);
    const { score, topic } = answerByTopic(p, it.question, it.options);
    let best = 0; for (let i = 1; i < score.length; i++) if (score[i] > score[best]) best = i;
    const max = score[best];
    return { choice: LETTER2[best], topic, noRule: max === 0, score: max };
  };
  const hand = run(handFn);
  const learned = run((it) => {
    const a = answerLearned(it, kw);
    return { ...a, noRule: a.score === 0 };
  });
  const both = run((it) => {
    const g = it.person.gender === 'female' ? '女' : '男';
    const b = compileBazi({ at: it.at, gender: g });
    const p = profile(b, g);
    const { score } = answerByTopic(p, it.question, it.options);
    const l = answerLearned(it, kw);
    const merged = score.map((v, i) => v * 2 + (LETTER2[i] === l.choice ? 1 : 0));
    let best = 0; for (let i = 1; i < merged.length; i++) if (merged[i] > merged[best]) best = i;
    return { choice: LETTER2[best], noRule: Math.max(...score) === 0 && l.score === 0 };
  });
  // ★ 优化项：规则命中就用规则；未命中改用**训练集先验**（而不是退化的"永远 A"）
  const handPrior = run((it) => {
    const h = handFn(it);
    return h.noRule ? { choice: prior.letter, noRule: true, fallback: true } : h;
  });
  const majority = run(() => ({ choice: prior.letter, noRule: true }));
  return { hand, learned, both, handPrior, majority, prior, trainN: train.length, testN: test.length };
}
