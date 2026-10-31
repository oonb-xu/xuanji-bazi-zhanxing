// 应期 / 引动（单元3）：流年干支 → 星（十神）× 宫（四柱宫位）→ 事件时间
//
// 口径与约束（与单元1/2 解耦，独立验收）：
//   · 只依赖**原局四柱** + **流年干支**（yearGanZhi）机算；不吃 compileBazi 的 meta/用忌/主会话上下文
//   · 星 = 流年天干的十神（tenGod，带阴阳）；宫 = 四柱宫位（就地小表 PALACE，口径同单元1，但不 import 单元1/2 文件）
//   · 引动 = 流年支与原局四支**逐支**判 冲/合/刑；每对只取一个关系，优先级 冲 > 合 > 刑；同支不判刑（自刑不在本表）
//   · 评分 = Σ(冲 0.8 / 合 0.4 / 刑 0.5)，逐宫累加
//   · 事件类型为**闭集** {'婚姻','子女','事业','财运'}，不新增类别
import { yearGanZhi } from '../cross/timing.mjs';
import { tenGod } from './ten-gods.mjs';
import { CHONG, LIUHE, XING3, CANG, GAN_WX } from './dag.mjs';

/** 四柱宫位（口径同单元1：年祖上、月父母、日支夫妻、时支子女） */
export const PALACE = [
  { idx: 0, pos: '年', name: '祖上宫' },
  { idx: 1, pos: '月', name: '父母宫' },
  { idx: 2, pos: '日', name: '夫妻宫' },
  { idx: 3, pos: '时', name: '子女宫' },
];

/** 事件类型闭集（输出顺序固定，保证可复现） */
export const EVENT_TYPES = ['婚姻', '子女', '事业', '财运'];

/** 引动权重：冲最烈、刑次之、合最缓（逐宫累加，不封顶） */
export const HIT_WEIGHT = { 冲: 0.8, 合: 0.4, 刑: 0.5 };

/** 五行相克（仅用于由日主五行反推财/官杀五行，避免复制十神名表） */
const WX_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
/** 「事业」只看流年干是否为官杀（十神名，带阴阳） */
const GUAN_TG = new Set(['正官', '七杀']);

/**
 * 流年支对某一原局支的引动关系。
 * 优先级：冲 > 合 > 刑；无关返回 null。
 * 同支不算刑（XING3 是「组内两两」，自刑另表，不在本单元口径）。
 * @param {string} dayZhi 原局支
 * @param {string} yearZhi 流年支
 * @returns {'冲'|'合'|'刑'|null}
 */
export function yearRelation(dayZhi, yearZhi) {
  if (CHONG[dayZhi] === yearZhi) return '冲';
  if (LIUHE[dayZhi] === yearZhi) return '合';
  if (dayZhi !== yearZhi && XING3.some((g) => g.includes(dayZhi) && g.includes(yearZhi))) return '刑';
  return null;
}

/**
 * 财官所坐支：柱天干（日干除外）+ 支中藏干，五行属财/官杀者为「财官所坐/所藏」。
 * 日干是日主本身，不作星；藏干同属「星」（盲派星宫分层含藏干）。
 * @returns {{idx:number, zhi:string, palace:string, kinds:string[]}[]}
 */
export function caiGuanSeats(pillars) {
  const dm = pillars[2][0];
  const dmWx = GAN_WX[dm];
  if (!dmWx) throw new Error(`yingQi：无法解析日干「${dm}」`);
  const caiWx = WX_KE[dmWx];
  const guanWx = Object.keys(WX_KE).find((wx) => WX_KE[wx] === dmWx);
  const seats = [];
  pillars.forEach((p, i) => {
    const stems = i === 2 ? [] : [p[0]];       // 日干=日主，不是财/官星
    stems.push(...(CANG[p[1]] ?? []));          // 支中藏干也是星
    const kinds = [...new Set(stems
      .map((g) => GAN_WX[g])
      .map((wx) => (wx === caiWx ? '财' : wx === guanWx ? '官杀' : null))
      .filter(Boolean))];
    if (kinds.length) seats.push({ idx: i, zhi: p[1], palace: PALACE[i].name, kinds });
  });
  return seats;
}

/** 入参归一：接受 bazi.pillars（字符串数组）或裸四柱数组；非法干支直接报错，不静默跳过 */
function normalizePillars(bazi) {
  const arr = Array.isArray(bazi) ? bazi : bazi?.pillars;
  if (!Array.isArray(arr) || arr.length !== 4) {
    throw new Error('yingQi：需要 4 柱（bazi.pillars 字符串数组，或 4 个干支字符串）');
  }
  return arr.map((p, i) => {
    const gz = typeof p === 'string' ? p : `${p?.gan ?? ''}${p?.zhi ?? ''}`;
    if (gz.length !== 2 || !GAN_WX[gz[0]] || !CHONG[gz[1]]) {
      throw new Error(`yingQi：第${i + 1}柱「${gz}」不是合法干支`);
    }
    return gz;
  });
}

/**
 * 应期：逐年判流年星（十神）与宫位引动，按 score 降序返回。
 * @param bazi compileBazi 结果（只需 bazi.pillars），或裸四柱数组
 * @param {{fromYear?:number, years?:number, topN?:number}} opts
 * @returns {{fromYear:number,toYear:number,years:number,dayMaster:string,dayMasterWx:string,
 *   caiGuanSeats:object[],hits:object[],topYears:object[]}}
 */
export function yingQi(bazi, opts = {}) {
  const pillars = normalizePillars(bazi);
  const dm = pillars[2][0];
  const dmWx = GAN_WX[dm];
  const fromYear = Number.isInteger(opts.fromYear) ? opts.fromYear : new Date().getFullYear();
  const years = Number.isInteger(opts.years) && opts.years > 0 ? opts.years : 10;
  const topN = Number.isInteger(opts.topN) && opts.topN > 0 ? opts.topN : 5;
  const seats = caiGuanSeats(pillars);
  const seatIdx = new Set(seats.map((s) => s.idx));

  const hits = [];
  for (let y = fromYear; y < fromYear + years; y++) {
    const ganzhi = yearGanZhi(y);
    const tg = tenGod(ganzhi[0], dm);
    const rels = [];
    pillars.forEach((p, i) => {
      const rel = yearRelation(p[1], ganzhi[1]);
      if (rel) rels.push({ idx: i, rel, weight: HIT_WEIGHT[rel] });
    });
    // 浮点累加后取两位（0.8/0.4/0.5 的二进制和会有尾差，score 需可复现比较）
    const score = Math.round(rels.reduce((s, r) => s + r.weight, 0) * 100) / 100;
    const palaceTriggered = rels.map((r) => PALACE[r.idx].name);

    const types = [];
    if (rels.some((r) => r.idx === 2)) types.push('婚姻');                       // 夫妻宫命中
    if (rels.some((r) => r.idx === 3)) types.push('子女');                       // 时支命中
    if (rels.some((r) => (r.rel === '冲' || r.rel === '合') && seatIdx.has(r.idx))) types.push('财运'); // 冲/合财官所坐支
    if (GUAN_TG.has(tg)) types.push('事业');                                     // 流年干为官杀

    hits.push({
      year: y,
      ganzhi,
      starTriggered: tg,
      palaceTriggered,
      eventTypes: EVENT_TYPES.filter((e) => types.includes(e)),
      score,
    });
  }

  hits.sort((a, b) => b.score - a.score || a.year - b.year);
  const topYears = hits.filter((h) => h.score > 0).slice(0, topN);
  return {
    fromYear,
    toYear: fromYear + years - 1,
    years,
    dayMaster: dm,
    dayMasterWx: dmWx,
    caiGuanSeats: seats,
    hits,
    topYears,
  };
}
