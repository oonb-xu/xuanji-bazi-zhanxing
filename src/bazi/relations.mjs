// 八字 · 原局内部关系检测（Part 6.1 八字侧的判据来源）
import { LIU_CHONG, LIU_HE, XIANG_HAI, XIANG_XING, SAN_HE, GAN_HE, GAN_WU_XING, KE, DI_ZHI } from './constants.mjs';

const POS = ['年', '月', '日', '时'];

/** 天干相克（不含相合） */
const ganKe = (a, b) => (KE[GAN_WU_XING[a]] === GAN_WU_XING[b] || KE[GAN_WU_XING[b]] === GAN_WU_XING[a]) && !GAN_HE.some((g) => g.pair.includes(a) && g.pair.includes(b));

/** 地支关系：冲/合/刑/害 */
export const zhiRelation = (a, b) => {
  const out = [];
  if (LIU_CHONG[a] === b) out.push('冲');
  if (LIU_HE[a] === b) out.push('合');
  if (XIANG_XING[a] === b) out.push(a === b ? '自刑' : '刑');
  if (XIANG_HAI[a] === b) out.push('害');
  return out;
};

/**
 * 扫描原局四柱的所有两两关系，并识别「天克地冲」与「天干相克」。
 * @returns {{ zhi:Array, gan:Array, chong:boolean, xing:boolean, hai:boolean, he:boolean, tianKeDiChong:Array, xingSet:Array, sanHe:Array }}
 */
export function intraRelations(pillars) {
  const zhi = [], gan = [], tianKeDiChong = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const A = pillars[i], B = pillars[j];
      const rels = zhiRelation(A.zhi, B.zhi);
      for (const r of rels) zhi.push({ type: r, a: A.zhi, b: B.zhi, from: POS[i], to: POS[j] });
      const hua = GAN_HE.find((g) => g.pair.includes(A.gan) && g.pair.includes(B.gan));
      if (hua) gan.push({ type: '五合', a: A.gan, b: B.gan, hua: hua.hua, from: POS[i], to: POS[j] });
      if (ganKe(A.gan, B.gan)) gan.push({ type: '相克', a: A.gan, b: B.gan, from: POS[i], to: POS[j] });
      if (rels.includes('冲') && ganKe(A.gan, B.gan)) tianKeDiChong.push({ a: A.zhi, b: B.zhi, ga: A.gan, gb: B.gan, from: POS[i], to: POS[j] });
    }
  }
  const sanHe = SAN_HE.filter((s) => s.zhi.every((z) => pillars.some((p) => p.zhi === z))).map((s) => ({ zhi: s.zhi, hua: s.wx }));
  const has = (t) => zhi.some((z) => z.type === t);
  return {
    zhi, gan, sanHe, tianKeDiChong,
    chong: has('冲'), xing: has('刑') || has('自刑'), hai: has('害'), he: has('合'),
    chongZhi: [...new Set(zhi.filter((z) => z.type === '冲').flatMap((z) => [z.a, z.b]))],
    xingZhi: [...new Set(zhi.filter((z) => z.type === '刑' || z.type === '自刑').flatMap((z) => [z.a, z.b]))],
    heZhi: [...new Set(zhi.filter((z) => z.type === '合').flatMap((z) => [z.a, z.b]))],
  };
}

/** 某支是否被原局合化（合走 → 冲不动）：该支参与六合，或属于已成局的三合局 */
export function isHarmonized(z, rel) {
  if (rel.heZhi.includes(z)) return true;
  return (rel.sanHe ?? []).some((s) => s.zhi.includes(z));
}

/** 天德贵人表（按月支）——通行表，见 docs/04 裁定 R-D1 */
export const TIAN_DE = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
/** 月德贵人表（按月支三合局 → 阳干）——通行表 */
export const YUE_DE = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' };

/**
 * 贵人兜底检测（Part 6.4 第三项）
 * @param pillars 四柱
 * @param guiRenZhi 天乙贵人两支（来自大六壬规则表 Step 2）
 * @param targetZhi 受冲/受刑之支
 */
export function nobleRelief(pillars, guiRenZhi, targetZhi) {
  const hits = [];
  if (targetZhi && guiRenZhi.includes(targetZhi)) hits.push(`天乙贵人在受制之支 ${targetZhi}`);
  const yueGan = TIAN_DE[pillars[1].zhi], yueDe = YUE_DE[pillars[1].zhi];
  for (const p of pillars) {
    if (p.gan === yueGan || p.zhi === yueGan) hits.push(`天德贵人（${yueGan}）在${p.gan}${p.zhi}`);
    if (p.gan === yueDe || p.zhi === yueDe) hits.push(`月德贵人（${yueDe}）在${p.gan}${p.zhi}`);
  }
  return { hit: hits.length > 0, hits: [...new Set(hits)], tianDe: yueGan, yueDe };
}

export { DI_ZHI };
