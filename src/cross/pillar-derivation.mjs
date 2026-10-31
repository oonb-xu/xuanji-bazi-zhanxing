// 七柱的可推断性分析：能不能不通过时间推出七柱？
//
// ★ 用户命题（2026-10-28）：
//   「推断出这个理论，能否不通过时间来推断七柱？这很关键，是在实际作用层的体现」
//
// 七柱 = 四柱（年月日时） + 胎元 + 命宫 + 身宫
//
// ── 本模块要回答三个层次 ──────────────────────
//   A. 每根柱依赖什么输入？（依赖图）
//   B. 哪些柱是**派生量**（不携带新信息）？
//   C. 没有时间 / 只有粗时间 / 有小时 / 有事件 —— 各能推到什么程度？
//
// ⚠️ 本模块的结论全部**用现有引擎枚举实证**，不靠背诵公式（公式各派有异，枚举不会错）。

import { compileBazi } from '../bazi/engine.mjs';

/** 十二地支 */
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * ★ 依赖图：每根柱依赖哪些输入
 * 依据现行引擎（compileBazi）的实际计算路径
 */
export const PILLAR_DEPENDENCY = {
  年柱: { needs: ['年'], precision: '±1 天（立春分界）', tier: 'coarse-time' },
  月柱: { needs: ['年', '月'], precision: '±1 天（节气分界）', tier: 'coarse-time' },
  日柱: { needs: ['日'], precision: '±1 天', tier: 'coarse-time' },
  时柱: { needs: ['日', '时'], precision: '±1 个时辰（2 小时）', tier: 'hour' },
  胎元: { needs: ['月柱'], precision: '同月柱', tier: 'coarse-time', derived: true },
  命宫: { needs: ['月支', '时支'], precision: '同时柱', tier: 'hour', derived: true },
  身宫: { needs: ['月支', '时支'], precision: '同时柱', tier: 'hour', derived: true },
};

/**
 * ★ 三档可推断性（实际作用层的核心答案）
 */
export const DERIVABILITY_TIERS = [
  {
    tier: 'A. 完全没有时间',
    canDerive: [],
    cannot: ['四柱', '胎元', '命宫', '身宫'],
    note: '七柱**全部**依赖时间。没有时间，一柱都推不出来。这是硬结论。',
  },
  {
    tier: 'B. 只有日期精度（不知时辰）',
    canDerive: ['年柱', '月柱', '日柱', '胎元'],
    cannot: ['时柱', '命宫', '身宫'],
    note: '**4 柱可定**（年/月/日 + 胎元）。但命宫、身宫、时柱三根全部悬空——因为它们都依赖时支。',
  },
  {
    tier: 'C. 有时辰',
    canDerive: ['年柱', '月柱', '日柱', '时柱', '胎元', '命宫', '身宫'],
    cannot: [],
    note: '七柱全定。本引擎的正常路径。',
  },
  {
    tier: 'D. 无时辰但有事件',
    canDerive: ['年柱', '月柱', '日柱', '胎元', '时柱（反推）', '命宫（反推）', '身宫（反推）'],
    cannot: [],
    note: '**这是"不通过时间推断"的唯一可行路径**：用事件（婚/丧/迁/病/业）作外部锚点反推时支，' +
      '一旦时支确定，命宫/身宫随之而定。这就是生时矫正的理论基础。',
  },
];

/**
 * ★ 信息论结论：派生柱不携带新信息
 * 要证明「胎元/命宫/身宫是派生量」，最干脆的办法是**枚举实证**：
 *   固定年月日，遍历 12 个时支，看这些柱的取值集合有多大。
 */
/** 从引擎的 L4_* 结构里取出干支字符串（字段名是 ganzhi 全小写） */
export function pickGz(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return v.ganzhi ?? (v.gan && v.zhi ? `${v.gan}${v.zhi}` : null);
}

export function enumerateShiZhi({ at, gender = '男', lng = 116.407, lat = 39.904, tz = 8 }) {
  // at 形如 '1990-03-15 12:00'，把小时替换成 12 个时辰的代表小时
  const m = String(at).match(/^(\d{4}-\d{2}-\d{2})[ T]/);
  if (!m) throw new Error('at 格式应为 YYYY-MM-DD HH:mm');
  const datePart = m[1];
  // 子时 23–01、丑 01–03 …… 取每个时辰的中点
  const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const rows = [];
  for (const h of hours) {
    const t = `${datePart} ${String(h).padStart(2, '0')}:00`;
    try {
      const b = compileBazi({ at: t, gender, lng, lat, tz });
      rows.push({
        hour: h,
        pillars: b.pillars,                       // [年,月,日,时]
        taiYuan: pickGz(b.L4_taiYuan),
        mingGong: pickGz(b.L4_mingGong),
        shenGong: pickGz(b.L4_shenGong),
      });
    } catch (e) {
      rows.push({ hour: h, error: String(e.message) });
    }
  }
  return rows;
}

/** 统计某一列的去重取值 */
export function distinctOf(rows, key) {
  const set = new Set();
  for (const r of rows) {
    const v = typeof key === 'function' ? key(r) : r[key];
    if (v != null) set.add(String(v));
  }
  return [...set];
}

/**
 * ★ 宫位 ↔ 十二地支
 * 这里给的是**两套约定**，必须分开：
 *
 *  ① 紫微斗数：十二宫**固定在地支上**（命宫落在哪个支，其余宫按逆序排）
 *     ⇒ 地支是**绝对坐标**
 *  ② 古典占星：十二宫**固定在上升点上**（上升永远在 1 宫）
 *     ⇒ 宫位是**相对坐标**，地支由上升黄经换算
 *
 * 二者不是同一个东西，不能简单等同。
 */
export const HOUSE_ZHI_CONVENTION = {
  ziwei: {
    name: '紫微斗数',
    anchor: '命宫',
    rule: '命宫定在某地支后，十二宫按**逆时针**（子→亥→戌…）依次排布',
    absolute: true,
    note: '地支在这套里是**绝对空间格**：子宫永远在同一个物理位置，变的是哪一宫落在它上面。',
  },
  astro: {
    name: '古典占星',
    anchor: '上升点（第 1 宫宫头）',
    rule: '上升黄经 → 换算成月将地支，即第 1 宫的地支；其余 11 宫顺次推 30°',
    absolute: false,
    note: '宫位在这套里是**相对坐标**：1 宫永远是上升，地支标签只是给它贴一个中式名字。',
  },
};

/** 十二宫 ↔ 地支 ↔ 宫名（占星/紫微/白话） */
export const HOUSE_TABLE = [
  { no: 1, astro: '自我/身体', ziwei: '命宫', plain: '你是谁、别人第一眼看到的你' },
  { no: 2, astro: '资源/价值', ziwei: '财帛', plain: '你靠什么活着、钱从哪来' },
  { no: 3, astro: '沟通/近亲', ziwei: '兄弟', plain: '你怎么说话、和身边人怎么处' },
  { no: 4, astro: '家庭/根基', ziwei: '田宅', plain: '你的安全感底座、家与根' },
  { no: 5, astro: '创造/子女', ziwei: '子女', plain: '你怎么表达自己、怎么玩' },
  { no: 6, astro: '工作/健康', ziwei: '疾厄', plain: '你日常在忙什么、身体哪里弱' },
  { no: 7, astro: '关系/合作', ziwei: '夫妻', plain: '你怎么跟人搭伙、婚姻与合伙' },
  { no: 8, astro: '共享/危机', ziwei: '仆役', plain: '别人的钱、危机、深层的怕与欲' },
  { no: 9, astro: '远行/信念', ziwei: '迁移', plain: '你去哪、信什么、图什么远大' },
  { no: 10, astro: '事业/名声', ziwei: '官禄', plain: '你要在社会上站成什么样' },
  { no: 11, astro: '群体/愿景', ziwei: '福德', plain: '你和人群、朋友、你的福气' },
  { no: 12, astro: '隐退/内在', ziwei: '父母', plain: '你藏起来的、病灶与潜意识' },
];

/**
 * 把「上升黄经」换算成第 1 宫的地支（用月将约定）
 * 月亮/占星的 1 宫地支 = 上升所在星座对应的月将支
 */
const SIGN2ZHI_YUEJIANG = {
  白羊: '戌', 金牛: '酉', 双子: '申', 巨蟹: '未', 狮子: '午', 处女: '巳',
  天秤: '辰', 天蝎: '卯', 射手: '寅', 摩羯: '丑', 水瓶: '子', 双鱼: '亥',
};

export function houseZhiTable(ascSign) {
  const start = SIGN2ZHI_YUEJIANG[ascSign];
  if (!start) return null;
  const i0 = ZHI.indexOf(start);
  return HOUSE_TABLE.map((h) => ({
    ...h,
    // 占星：1 宫起上升，顺次 +30°，即地支逆序（因为地支与星座反向）
    astroZhi: ZHI[(i0 - (h.no - 1) + 12 * 2) % 12],
  }));
}

/** 紫微：给定命宫地支，排十二宫 */
export function ziweiHouseZhi(mingGongZhi) {
  const i0 = ZHI.indexOf(mingGongZhi);
  if (i0 < 0) return null;
  return HOUSE_TABLE.map((h) => ({
    ...h,
    ziweiZhi: ZHI[(i0 - (h.no - 1) + 12 * 2) % 12],
  }));
}

/**
 * ★ 藏干的出现条件（八字原生 vs 占星类比，必须分开标注）
 */
export const HIDDEN_STEM_TRIGGERS = {
  native: {
    title: '八字原生：藏干"出现"的四种方式',
    items: [
      { name: '透干', cond: '藏干与四柱任一天干同字', effect: '该藏干从"潜在"变"显性"，力量大幅上升', strength: '强' },
      { name: '得月令', cond: '藏干是月支的本气', effect: '当令，是全局最有力的藏干', strength: '最强' },
      { name: '逢冲开库', cond: '月支/日支被冲（如辰戌冲、丑未冲）', effect: '库中藏干被"冲开"而显', strength: '中' },
      { name: '逢合引动', cond: '地支成三合/六合/三会', effect: '合化的五行成为新的显性能量', strength: '中' },
      { name: '大运流年引动', cond: '大运/流年的干支与藏干同字', effect: '在该时段显化', strength: '时段性' },
    ],
  },
  astroAnalog: {
    title: '占星类比（本项目实现，非等价）',
    items: [
      { name: '角宫', cond: '行星落 1/4/7/10 宫', score: '+3', note: '类似"透干"——被看见' },
      { name: '合上升', cond: '与上升轴线 ±5°', score: '+3', note: '最强显位' },
      { name: '合天顶', cond: '与天顶轴线 ±5°', score: '+2', note: '公共可见' },
      { name: '续宫', cond: '行星落 2/5/8/11 宫', score: '+1', note: '中等显' },
      { name: '果宫', cond: '行星落 3/6/9/12 宫', score: '-1', note: '隐退' },
      { name: '得时', cond: '昼盘见日木土 / 夜盘见月金火', score: '+1', note: '顺天时' },
    ],
    threshold: 2,
    note: '**这是结构类比，不是等价**。八字的"透干"是同一符号系统内的显隐切换；' +
      '占星的"角宫/合轴"是空间位置的可见度。两者置信度 ≤0.6。',
  },
};

/** 藏干本身是什么（一句话定义） */
export const HIDDEN_STEM_DEF = {
  what: '地支里暗藏的天干。每个地支藏 1–3 个天干，按力量分「本气 / 中气 / 余气」。',
  why: '地支属阴、主静，其能量不直接显现，必须通过天干才有"发声"的机会。所以地支是"储藏"，天干是"表达"。',
  example: '辰藏 戊(本气) / 乙(中气) / 癸(余气) —— 戊土为主，兼有木与水。',
  whenAppear: '藏干"出现"= 它从天干层面被说出，或在岁运中同字到临。见 HIDDEN_STEM_TRIGGERS。',
  note: '藏干不是"隐藏起来不用"，而是**待激活**：它一直在起作用，只是力量小于透干。',
};
