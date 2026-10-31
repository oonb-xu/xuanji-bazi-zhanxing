// 做功用库（补缺口 #2）——「库能不能做功」的成败判定 + 量级
//
// 为什么需要这一层：ten-gods.kuGong() 只标库的角色（用神库/忌神库/比劫库/闲库），
// 回答不了杨炎高频的「这个库**做不做得动**」。做功要有两个条件之一：
//   ① 库被**冲开**（辰戌/丑未）——库门被撞开，所藏之干才能出而用事
//   ② 库被**合开**（六合）——合起而引动
//   ③ 库中藏干**透出**天干（含日干）——不透则只是「有库无量」
// 且角色必须是用神库/比劫库（根），忌神库与闲库再热闹也不做功（恒 false）。
//
// ★ 标度纪律（跨标度替换硬闸）：POS_W / CANG 一律取自 dag.mjs 这一套藏干标度，
//   **绝不读 bazi.L3_distribution** —— 那是引擎内部另一套（含合冲修正的）分布标度，
//   两套数值不可互换；直接替换会静默改变 workScore 的量级语义。
import { KU, kuGong } from './ten-gods.mjs';
import { CANG, POS_W, CHONG, LIUHE, GAN_WX } from './dag.mjs';

const POS_NAME = ['年', '月', '日', '时'];
const r3 = (x) => Math.round(x * 1000) / 1000;

/** 做功权重（集中一处，便于回归钉逐项对账） */
export const WORK_W = {
  touGan: 0.5,   // 每个透出藏干
  chong: 0.8,    // 冲开
  he: 0.4,       // 合开
  benUseful: 1.0,// 本气藏干为用神/日主（根）
  posW: 0.25,    // × POS_W[pos]
};

/** 量级分档（闭集：微/小/中/大；<1 / 1–2.5 / 2.5–4 / >4） */
export function magnitudeOf(totalScore) {
  const t = Number(totalScore);
  if (!Number.isFinite(t) || t < 1) return '微';
  if (t < 2.5) return '小';
  if (t <= 4) return '中';
  return '大';
}

/** 角色是否为可做功的角色（沿用 kuGong 口径：用神库 或 比劫库/根） */
export const isWorkRole = (role) => role === '用神库' || String(role).startsWith('比劫库');

/**
 * 做功用库：对四支中每个四库（辰戌丑未）判「冲/合开」与「透干」，给出可做功与量级。
 * @param bazi compileBazi() 的产物（只用 pillars 与 L5_yongJi）
 * @param yong 用神五行；缺省读 bazi.L5_yongJi.yong
 * @param ji   忌神五行；缺省读 bazi.L5_yongJi.ji
 * @returns {kus:[{zhi,ku,role,openedBy,touGan,canWork,workScore}], totalScore, verdict, magnitude}
 */
export function zuoGong(bazi, yong, ji) {
  const yj = bazi?.L5_yongJi ?? {};
  const y = yong ?? yj.yong ?? null;
  const j = ji ?? yj.ji ?? null;
  const pillars = (bazi?.pillars ?? []).slice(0, 4);
  if (pillars.length !== 4) throw new Error('zuoGong 需要 4 柱');
  const gans = pillars.map((p) => p[0]);
  const zhis = pillars.map((p) => p[1]);
  const dmWx = GAN_WX[pillars[2][0]];
  // ★ 角色口径直接复用 kuGong（同一函数、同一角色优先级），本文件不再重写一份
  const kRoles = kuGong(bazi, y, j);
  let kc = 0;
  const kus = [];
  zhis.forEach((zhi, i) => {
    const ku = KU[zhi];
    if (!ku) return;
    const kg = kRoles[kc++] ?? { role: '闲库' };
    // 冲开 / 合开（只看**其它三支**，自支不算）
    let chong = false, he = false;
    zhis.forEach((z, k) => {
      if (k === i) return;
      if (CHONG[zhi] === z) chong = true;
      if (LIUHE[zhi] === z) he = true;
    });
    const openedBy = [];
    if (chong) openedBy.push('冲');
    if (he) openedBy.push('合');
    // 透干：本库各藏干是否出现在四柱天干（含日干）
    const touGan = (CANG[zhi] ?? []).filter((g) => gans.includes(g));
    // 本气藏干是否为用神，或为日主五行（根）
    const benWx = GAN_WX[(CANG[zhi] ?? [])[0]];
    const benUseful = benWx === y || benWx === dmWx;
    const posW = POS_W[POS_NAME[i]] ?? 0;
    const workScore = r3(
      touGan.length * WORK_W.touGan
      + (chong ? WORK_W.chong : 0)
      + (he ? WORK_W.he : 0)
      + (benUseful ? WORK_W.benUseful : 0)
      + posW * WORK_W.posW
    );
    // 忌神库 / 闲库恒 false（角色先决）
    const canWork = isWorkRole(kg.role) && (openedBy.length > 0 || touGan.length > 0);
    kus.push({ zhi, ku, role: kg.role, openedBy, touGan, canWork, workScore });
  });
  const totalScore = r3(kus.reduce((a, x) => a + x.workScore, 0));
  return {
    kus,
    totalScore,
    verdict: totalScore > 0 ? '做功' : '未做功',
    magnitude: magnitudeOf(totalScore),
  };
}
