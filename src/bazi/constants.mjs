// 八字子项目 · 常量真源（规则表 Part 1.1/1.2/1.3、Part 2 藏干表、Part 3 进位表）
import { DI_ZHI, TIAN_GAN, ZHI_WU_XING, GAN_WU_XING, ZHI_YIN_YANG, GAN_YIN_YANG, SHENG, KE } from '../constants.mjs';

export { DI_ZHI, TIAN_GAN, ZHI_WU_XING, GAN_WU_XING, ZHI_YIN_YANG, GAN_YIN_YANG, SHENG, KE };

/** 六冲 */
export const LIU_CHONG = {
  子: '午', 丑: '未', 寅: '申', 卯: '酉', 辰: '戌', 巳: '亥',
  午: '子', 未: '丑', 申: '寅', 酉: '卯', 戌: '辰', 亥: '巳',
};

/** 六合（Part 5.3：合相 0°） */
export const LIU_HE = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
};

/** 相害（Part 5.3：梅花相 150°） */
export const XIANG_HAI = {
  子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅',
  卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉',
};

/** 相刑（Part 5.3：四分相 90°）——简化取通行刑组 */
export const XIANG_XING = {
  子: '卯', 卯: '子',
  寅: '巳', 巳: '申', 申: '寅',
  丑: '戌', 戌: '未', 未: '丑',
  辰: '辰', 午: '午', 酉: '酉', 亥: '亥',
};

/** 三合局（Part 5.3：三分相 120°） */
export const SAN_HE = [
  { zhi: ['申', '子', '辰'], wx: '水' },
  { zhi: ['亥', '卯', '未'], wx: '木' },
  { zhi: ['寅', '午', '戌'], wx: '火' },
  { zhi: ['巳', '酉', '丑'], wx: '金' },
];

/** 天干五合（Part 5.3：合相 0°）+ 合化五行 */
export const GAN_HE = [
  { pair: ['甲', '己'], hua: '土' }, { pair: ['乙', '庚'], hua: '金' },
  { pair: ['丙', '辛'], hua: '水' }, { pair: ['丁', '壬'], hua: '木' },
  { pair: ['戊', '癸'], hua: '火' },
];

/** Part 2 地支藏干表（本气 / 中气 / 余气）——严格照规则表，禁止自行编造 */
export const HIDE_GAN = {
  子: ['癸', null, null],
  丑: ['己', '癸', '辛'],
  寅: ['甲', '丙', '戊'],
  卯: ['乙', null, null],
  辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'],
  午: ['丁', '己', null],
  未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'],
  酉: ['辛', null, null],
  戌: ['戊', '辛', '丁'],
  亥: ['壬', '甲', null],
};

/** Part 2.1 藏干权重 */
export const HIDE_WEIGHT = [1.0, 0.5, 0.2];
export const HIDE_TIER = ['本气', '中气', '余气'];

/** 十干禄位（用于「建禄格」判定） */
export const LU_WANG = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

/** 五虎遁：年干 → 寅月之天干（用于命宫/身宫定干） */
export const WU_HU_DUN = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };

/** Part 3.1 胎元进位表：天干进一位 */
export const GAN_ADV = Object.fromEntries(TIAN_GAN.map((g, i) => [g, TIAN_GAN[(i + 1) % 10]]));
/** Part 3.1 胎元进位表：地支进三位 */
export const ZHI_ADV3 = Object.fromEntries(DI_ZHI.map((z, i) => [z, DI_ZHI[(i + 3) % 12]]));

/**
 * 十神：以日主为参照，判定 target 天干对日主的十神。
 * 同我：比肩(同阴阳)/劫财(异)；我生：食神(同)/伤官(异)；
 * 我克：偏财(同)/正财(异)；克我：七杀(同)/正官(异)；生我：偏印(同)/正印(异)
 */
export function shiShen(dayGan, targetGan) {
  const d = GAN_WU_XING[dayGan], t = GAN_WU_XING[targetGan];
  const same = GAN_YIN_YANG[dayGan] === GAN_YIN_YANG[targetGan];
  if (d === t) return same ? '比肩' : '劫财';
  if (SHENG[d] === t) return same ? '食神' : '伤官';
  if (KE[d] === t) return same ? '偏财' : '正财';
  if (KE[t] === d) return same ? '七杀' : '正官';
  if (SHENG[t] === d) return same ? '偏印' : '正印';
  return '—';
}

export const SHI_SHEN_WX = {
  比肩: '同我', 劫财: '同我',
  食神: '我生', 伤官: '我生',
  偏财: '我克', 正财: '我克',
  七杀: '克我', 正官: '克我',
  偏印: '生我', 正印: '生我',
};

export const zhiIdx = (z) => DI_ZHI.indexOf(z);
export const ganIdx = (g) => TIAN_GAN.indexOf(g);
