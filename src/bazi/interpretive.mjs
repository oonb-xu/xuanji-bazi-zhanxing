// Part 10 解释性规则库（六亲 K / 疾病 H / 时间 T）+ 选项感知作答器
//
// 与前一版的区别（这是本轮真正的改进）：前一版靠**手写关键词表**去匹配选项文本，几乎不触发；
// 本版先把每个选项**解析成结构特征**（年份、干支、脏腑词、亲属词、强弱词），再用规则库逐项打分。
// 规则全部显式编号（K-/H-/T-），可人工裁定；每条规则带 `conf`（置信度）与 `support`（支持案例数），
// 由案例反推生成、再由规则验证步骤回填（见 cli-baziqa.mjs --fit / --part10）。
import { compileBazi } from './engine.mjs';

/* ══════════ 领域一：六亲 ══════════ */
/** 六亲定位（10.2.1） */
export const KIN_STAR = {
  男: { 妻: ['正财'], 父: ['偏财'], 母: ['正印'], 继母: ['偏印'], 子: ['正官', '七杀'], 兄: ['比肩', '劫财'] },
  女: { 夫: ['正官'], 情人: ['七杀'], 子: ['食神', '伤官'], 母: ['正印'], 父: ['偏财'], 姐妹: ['比肩', '劫财'] },
};
/** 六亲宫位（10.2.3） */
export const KIN_PALACE = { 祖辈: 0, 父: 0, 母: 1, 父母: 1, 兄弟: 1, 配偶: 2, 妻: 2, 夫: 2, 子: 3, 子女: 3 };

/** 六亲状态判定规则（10.2.2），显式编号 */
export const KIN_RULES = [
  { id: 'K-001', when: (s) => s.starHeavilyHit, then: '该六亲有灾/缘分薄', conf: null, support: 0 },
  { id: 'K-002', when: (s) => s.starChong && s.palaceChong, then: '该六亲早逝或重大变故', conf: null, support: 0 },
  { id: 'K-003', when: (s) => s.starJi, then: '该六亲带来拖累', conf: null, support: 0 },
  { id: 'K-004', when: (s) => s.starYongWeak, then: '该六亲有心无力', conf: null, support: 0 },
  { id: 'K-005', when: (s) => s.starAbsent, then: '该六亲缘薄/缺位', conf: null, support: 0 },
];

/* ══════════ 领域二：疾病 ══════════ */
/** 五行-脏腑映射（10.2.1） */
export const ORGAN_TABLE = {
  木: { organ: ['肝胆', '筋骨', '神经'], over: ['易怒', '偏头痛', '筋痉挛'], under: ['抑郁', '视力', '指甲'], keywords: ['肝胆', '肝', '胆', '筋骨', '神经', '眼', '怒', '中风', '筋'] },
  火: { organ: ['心脏', '小肠', '眼睛'], over: ['心悸', '失眠', '炎症'], under: ['血压低', '贫血', '畏寒'], keywords: ['心', '血', '循环', '失眠', '炎症', '眼', '血压', '小肠'] },
  土: { organ: ['脾胃', '肌肉', '消化'], over: ['肥胖', '糖尿病', '湿'], under: ['消瘦', '食欲', '消化'], keywords: ['脾胃', '脾', '胃', '消化', '肠', '肌', '糖尿', '湿', '食'] },
  金: { organ: ['肺', '大肠', '皮肤'], over: ['咳喘', '便秘', '皮肤'], under: ['免疫', '鼻炎', '感冒'], keywords: ['肺', '呼吸', '气管', '咳', '喘', '鼻', '皮肤', '免疫', '大肠', '感冒'] },
  水: { organ: ['肾', '膀胱', '生殖'], over: ['水肿', '尿频', '肾虚'], under: ['脱发', '腰酸', '生殖'], keywords: ['肾', '泌尿', '膀胱', '生殖', '水肿', '尿', '腰', '耳', '脱发', '透析'] },
};
/** 疾病触发规则（10.2.2/10.2.3） */
export const HEALTH_RULES = [
  { id: 'H-001', when: (s) => s.over && !s.controlled, then: '该五行对应脏腑**亢进**类疾病', conf: null, support: 0 },
  { id: 'H-002', when: (s) => s.weak && s.attacked, then: '该五行对应脏腑**衰退**类疾病', conf: null, support: 0 },
  { id: 'H-003', when: (s) => s.heavyHit, then: '该脏腑急性病/外伤风险', conf: null, support: 0 },
  { id: 'H-004', when: (s) => s.dayBranchHit, then: '整体健康根基不稳', conf: null, support: 0 },
  { id: 'H-005', when: (s) => s.hourPillarHit, then: '晚年健康隐患', conf: null, support: 0 },
];

/* ══════════ 领域三：时间应期 ══════════ */
export const TIMING_RULES = [
  { id: 'T-001', when: (s) => s.sanHe, then: '重大事件（婚/迁/变）', conf: null, support: 0 },
  { id: 'T-002', when: (s) => s.chongDay, then: '婚姻动荡/身体变动', conf: null, support: 0 },
  { id: 'T-003', when: (s) => s.chongHour, then: '子女/事业/晚年有变', conf: null, support: 0 },
  { id: 'T-004', when: (s) => s.chongYear, then: '长辈/祖业/根基有变', conf: null, support: 0 },
  { id: 'T-005', when: (s) => s.sanXing, then: '官非/手术/意外', conf: null, support: 0 },
  { id: 'T-006', when: (s) => s.tianKeDiChong, then: '剧烈变动（天克地冲）', conf: null, support: 0 },
  { id: 'T-007', when: (s) => s.fuYin, then: '事件重复或强化（伏吟）', conf: null, support: 0 },
];

/* ── 选项解析：把自由文本选项变成结构特征 ── */
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export function parseOption(text) {
  const t = String(text);
  const year = (t.match(/(1[6-9]\d{2}|20\d{2})/) ?? [])[1];
  const gz = (t.match(/([甲乙丙丁戊己庚辛壬癸])([子丑寅卯辰巳午未申酉戌亥])/) ?? []).slice(1);
  const organs = [], kin = [];
  for (const [wx, o] of Object.entries(ORGAN_TABLE)) for (const k of o.keywords) if (t.includes(k)) organs.push({ wx, kw: k });
  for (const k of ['父', '母', '妻', '夫', '子', '女', '兄', '弟', '姐', '妹', '祖', '配偶', '六亲']) if (t.includes(k)) kin.push(k);
  const strength = {
    over: /暴起暴跌|挥霍|亢|多|旺|巨富|大量/.test(t),
    under: /弱|少|缺|薄|衰|贫|无/.test(t),
    good: /成功|富|安|顺|和|健|助|旺/.test(t),
    bad: /病|灾|亡|逝|离|破|刑|伤|凶|败|困/.test(t),
  };
  return { text: t, year: year ? Number(year) : null, ganzhi: gz.length === 2 ? gz.join('') : null, organs, kin, strength };
}

/* ── 命局状态提取 ── */
export function chartState(bazi, gender) {
  const d = bazi.distribution ?? {};
  const wx = ['木', '火', '土', '金', '水'];
  const sorted = [...wx].sort((a, b) => (d[b] ?? 0) - (d[a] ?? 0));
  const rel = bazi.relationCount ?? {};
  const pillars = bazi.pillars ?? [];
  const branchOf = (i) => (pillars[i] ?? '')[1];
  const sheng = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ke = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const element = {
    strongest: sorted[0], weakest: sorted[4], values: d,
    over: (w) => (d[w] ?? 0) >= 3,
    weak: (w) => (d[w] ?? 0) <= 1,
    controlled: (w) => (d[ke[ke[w]]] ?? 0) >= 2,           // 克它者的克者（有制）
    attacked: (w) => (d[ke[w]] ?? 0) >= 2,                 // 被克
  };
  const spouseZhi = bazi.spouseZhi;
  return {
    ...bazi, ...element, sheng, ke,
    dayBranch: branchOf(2), hourBranch: branchOf(3), yearBranch: branchOf(0), monthBranch: branchOf(1),
    dayBranchHit: (bazi.spouseTypes ?? []).length > 0,
    hourPillarHit: false,
    rel,
  };
}

/** 某年干支与原局的互动（T 族） */
export function yearInteraction(state, year) {
  const idx = (year - 4) % 10, zidx = (year - 4) % 12;      // 简化：甲子=1984
  const g = GAN[((idx % 10) + 10) % 10], z = ZHI[((zidx % 12) + 12) % 12];
  const pillars = state.pillars ?? [];
  const zhiOf = (gz) => gz[1], ganOf = (gz) => gz[0];
  const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
  const HE6 = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const hits = [];
  for (const [i, p] of pillars.entries()) {
    const pz = zhiOf(p), pg = ganOf(p);
    if (CHONG[z] === pz) hits.push({ pos: i, type: '冲', with: pz });
    if (HE6[z] === pz) hits.push({ pos: i, type: '合', with: pz });
    if (z === pz) hits.push({ pos: i, type: '伏吟', with: pz });
  }
  // 天克地冲
  const GAN_KE = { 甲: '戊', 乙: '己', 丙: '庚', 丁: '辛', 戊: '壬', 己: '癸', 庚: '甲', 辛: '乙', 壬: '丙', 癸: '丁' };
  for (const [i, p] of pillars.entries()) {
    if (GAN_KE[g] === ganOf(p) && CHONG[z] === zhiOf(p)) hits.push({ pos: i, type: '天克地冲', with: p });
  }
  const chongPos = hits.filter((h) => h.type === '冲' || h.type === '天克地冲').map((h) => h.pos);
  return {
    ganzhi: `${g}${z}`, year, hits,
    sanXing: false,                                        // 需完整三刑表，留接口
    sanHe: hits.some((h) => h.type === '合'),
    chongYear: chongPos.includes(0), chongMonth: chongPos.includes(1),
    chongDay: chongPos.includes(2), chongHour: chongPos.includes(3),
    tianKeDiChong: hits.some((h) => h.type === '天克地冲'),
    fuYin: hits.some((h) => h.type === '伏吟'),
    // 三刑（简化：寅巳申 / 丑戌未 / 子卯）
    sanXingSet: [[3, 5, 9], [1, 10, 7]].some((set) => set.every((zi) => [state.dayBranch, state.hourBranch, state.monthBranch, state.yearBranch, z].some((b) => ZHI.indexOf(b) === zi))),
  };
}

/**
 * 选项感知打分：把每个选项的**结构特征**与命局状态+规则库比对
 * @returns 每个选项的分数与命中规则
 */
export function scoreOptions(state, question, options) {
  const parsed = options.map(parseOption);
  const isTime = /哪年|那年|何年|何时|几岁/.test(question);
  const out = parsed.map((p) => ({ score: 0, rules: [] }));
  for (const [i, p] of parsed.entries()) {
    const add = (v, id) => { out[i].score += v; out[i].rules.push(id); };
    // T 族：年份类选项 → 算该年互动
    if (p.year) {
      const y = yearInteraction(state, p.year);
      if (y.chongDay) add(2.0, 'T-002');
      if (y.chongHour) add(1.5, 'T-003');
      if (y.chongYear) add(1.5, 'T-004');
      if (y.tianKeDiChong) add(2.5, 'T-006');
      if (y.fuYin) add(1.0, 'T-007');
      if (y.sanHe) add(1.0, 'T-001');
      if (y.sanXingSet) add(2.0, 'T-005');
      // 若题干问的是六亲 → 该六亲星的宫位被冲再加权
      for (const k of p.kin) {
        const pal = KIN_PALACE[k];
        if (pal !== undefined && y.hits.some((h) => h.pos === pal && h.type === '冲')) add(1.5, 'T-004@kin');
      }
      if (isTime) add(0.2, 'T-base');
    }
    // H 族：脏腑词 → 看该五行过旺/过弱
    for (const o of p.organs) {
      if (state.over(o.wx) && !state.controlled(o.wx)) add(2.0, 'H-001');
      if (state.weak(o.wx) && state.attacked(o.wx)) add(2.0, 'H-002');
      if (state.weak(o.wx)) add(0.5, 'H-002w');
    }
    // K 族：亲属词 → 看该六亲星
    for (const k of p.kin) {
      const stars = KIN_STAR[state.gender === '女' ? '女' : '男']?.[k] ?? [];
      const cnt = stars.reduce((a, s) => a + (state.shiShenCount?.[s] ?? 0), 0);
      if (cnt === 0) add(1.5, 'K-005');
      if (cnt >= 2) add(0.8, 'K-001');
      const pal = KIN_PALACE[k];
      if (pal !== undefined && state.pillars?.[pal]) {
        const pz = state.pillars[pal][1];
        if (state.dayBranchHit && pal === 2) add(1.5, 'K-002');
      }
    }
    // 强弱词与命局强弱的一致性
    if (p.strength.bad && (state.verdict === '身弱' || state.dayBranchHit)) add(0.5, 'K-003');
    if (p.strength.good && state.verdict === '身旺') add(0.5, 'K-004');
  }
  let best = 0;
  for (let i = 1; i < out.length; i++) if (out[i].score > out[best].score) best = i;
  return { best, letters: ['A', 'B', 'C', 'D'], options: out, parsed, noRule: out[best].score === 0 };
}

/** 供 10.5 输出：规则库清单（含置信度与支持案例，由 --generate/--validate 回填） */
export function ruleCatalog() {
  const rows = [];
  for (const r of KIN_RULES) rows.push({ domain: '六亲', id: r.id, when: String(r.when).slice(0, 60), then: r.then, conf: r.conf, support: r.support });
  for (const r of HEALTH_RULES) rows.push({ domain: '疾病', id: r.id, when: String(r.when).slice(0, 60), then: r.then, conf: r.conf, support: r.support });
  for (const r of TIMING_RULES) rows.push({ domain: '时间', id: r.id, when: String(r.when).slice(0, 60), then: r.then, conf: r.conf, support: r.support });
  return rows;
}

/* ══════════ 反向优化：用专家答案拟合规则权重（有监督，训练/测试分离） ══════════ */
/**
 * 把一个选项展开成**规则激活特征向量**。每个特征 = 一条规则是否被该选项触发。
 * 权重就是"该规则值多少分" —— 拟合权重 = 用大师的修正结论反向修 rule 库。
 */
export const FEATURE_NAMES = [
  'T-002_chongDay', 'T-003_chongHour', 'T-004_chongYear', 'T-006_tianKeDiChong', 'T-007_fuYin',
  'T-001_sanHe', 'T-005_sanXing', 'kinPalaceChong',
  'H-001_organOver', 'H-002_organWeakAttacked', 'H-002w_organWeak',
  'K-005_kinAbsent', 'K-001_kinMany', 'K-002_kinPalaceChong',
  'hasYear', 'hasGanzhi', 'isTimeQ', 'qKin', 'qOrgan', 'qWealth',
  'biasA', 'biasB', 'biasC', 'biasD',
];

export function optionFeatures(state, question, text, idx) {
  const p = parseOption(text);
  const isTime = /哪年|那年|何年|何时|几岁/.test(question);
  const f = Object.fromEntries(FEATURE_NAMES.map((k) => [k, 0]));
  if (p.year) {
    const y = yearInteraction(state, p.year);
    if (y.chongDay) f['T-002_chongDay'] = 1;
    if (y.chongHour) f['T-003_chongHour'] = 1;
    if (y.chongYear) f['T-004_chongYear'] = 1;
    if (y.tianKeDiChong) f['T-006_tianKeDiChong'] = 1;
    if (y.fuYin) f['T-007_fuYin'] = 1;
    if (y.sanHe) f['T-001_sanHe'] = 1;
    if (y.sanXingSet) f['T-005_sanXing'] = 1;
    for (const k of p.kin) { const pal = KIN_PALACE[k]; if (pal !== undefined && y.hits.some((h) => h.pos === pal && h.type === '冲')) f.kinPalaceChong = 1; }
  }
  for (const o of p.organs) {
    if (state.over(o.wx) && !state.controlled(o.wx)) f['H-001_organOver'] = 1;
    if (state.weak(o.wx) && state.attacked(o.wx)) f['H-002_organWeakAttacked'] = 1;
    if (state.weak(o.wx)) f['H-002w_organWeak'] = 1;
  }
  for (const k of p.kin) {
    const stars = KIN_STAR[state.gender === '女' ? '女' : '男']?.[k] ?? [];
    const cnt = stars.reduce((a, s) => a + (state.shiShenCount?.[s] ?? 0), 0);
    if (cnt === 0) f['K-005_kinAbsent'] = 1;
    if (cnt >= 2) f['K-001_kinMany'] = 1;
    const pal = KIN_PALACE[k];
    if (pal === 2 && state.dayBranchHit) f['K-002_kinPalaceChong'] = 1;
  }
  if (p.year) f.hasYear = 1;
  if (p.ganzhi) f.hasGanzhi = 1;
  if (isTime) f.isTimeQ = 1;
  if (p.kin.length) f.qKin = 1;
  if (p.organs.length) f.qOrgan = 1;
  if (/财|富|钱|投资|生意/.test(question)) f.qWealth = 1;
  f[['biasA', 'biasB', 'biasC', 'biasD'][idx]] = 1;
  return f;
}

/** 默认权重 = Part 10 手写规则的价值（作为拟合起点，不是终点） */
export const DEFAULT_WEIGHTS = {
  'T-002_chongDay': 2.0, 'T-003_chongHour': 1.5, 'T-004_chongYear': 1.5, 'T-006_tianKeDiChong': 2.5,
  'T-007_fuYin': 1.0, 'T-001_sanHe': 1.0, 'T-005_sanXing': 2.0, kinPalaceChong: 1.5,
  'H-001_organOver': 2.0, 'H-002_organWeakAttacked': 2.0, 'H-002w_organWeak': 0.5,
  'K-005_kinAbsent': 1.5, 'K-001_kinMany': 0.8, 'K-002_kinPalaceChong': 1.5,
  hasYear: 0.2, hasGanzhi: 0, isTimeQ: 0, qKin: 0, qOrgan: 0, qWealth: 0,
  biasA: 0, biasB: 0, biasC: 0, biasD: 0,
};

const _cache = new Map();
function featsFor(it) {
  if (_cache.has(it)) return _cache.get(it);
  const g = it.person.gender === 'female' ? '女' : '男';
  // ★ 必须传对象：若误传字符串，`input.at` 会取到 String.prototype.at（原生函数）
  const b = compileBazi2({ at: it.at, gender: g });
  const st = chartState({ ...b, gender: g }, g);
  const out = it.options.map((o, i) => optionFeatures(st, it.question, o, i));
  _cache.set(it, out);
  return out;
}
let compileBazi2 = compileBazi;   // 注入编译器（避免循环依赖）

/** 用给定权重作答 */
export function predictWeighted(it, W) {
  const fs = featsFor(it);
  const sc = fs.map((f) => FEATURE_NAMES.reduce((a, k) => a + (W[k] ?? 0) * f[k], 0));
  let best = 0;
  for (let i = 1; i < sc.length; i++) if (sc[i] > sc[best]) best = i;
  return { choice: ['A', 'B', 'C', 'D'][best], scores: sc };
}

const accOf = (items, W) => items.filter((it) => predictWeighted(it, W).choice === it.answer).length / items.length;

/**
 * 坐标上升：逐个特征在网格上试权重，只接受**训练集准确率提升**的改动（正则：至少多答对 1 题）
 * 目标函数 = 训练集准确率 —— 即"向大师的修正结论靠齐"
 */
export function fitWeights(train, base = DEFAULT_WEIGHTS, { grid = [-3, -2, -1, 0, 0.5, 1, 1.5, 2, 3, 4], passes = 3 } = {}) {
  const W = { ...base };
  let best = accOf(train, W);
  const trace = [{ pass: 0, acc: round4(best) }];
  for (let p = 1; p <= passes; p++) {
    let changed = false;
    for (const k of FEATURE_NAMES) {
      const orig = W[k] ?? 0;
      let localBest = best, localVal = orig;
      for (const v of grid) {
        if (v === orig) continue;
        W[k] = v;
        const a = accOf(train, W);
        if (a > localBest + 1e-12) { localBest = a; localVal = v; }
      }
      W[k] = localVal;
      if (localVal !== orig) changed = true;
      best = localBest;
    }
    trace.push({ pass: p, acc: round4(best), changed });
    if (!changed) break;
  }
  return { weights: W, trainAcc: best, trace };
}

/** 导出权重表（供人工裁定：每个数字就是一条规则的价值） */
export function weightTable(W) {
  return FEATURE_NAMES.map((k) => ({
    feature: k, weight: W[k] ?? 0, domain: k.startsWith('T-') ? '时间' : k.startsWith('H-') ? '疾病' : k.startsWith('K-') ? '六亲' : k.startsWith('bias') ? '选项位置' : '问题类型',
    rule: k,
  }));
}

const round4 = (x) => Math.round(x * 10000) / 10000;
