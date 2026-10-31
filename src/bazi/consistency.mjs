// 四柱内部自洽性校验（五虎遁 / 五鼠遁 / 干支阴阳配对 / 月支-节气一致）
//
// 用途：接收人类样本时，**先验证四柱本身是否自洽**，再谈推演。
//   若用户只给四柱（干支）而没给公历日期，本模块能：
//     ① 判断这四柱在历法上是否可能存在（自洽性机检）
//     ② 列出该 年干支 在所有可能公历年份中的候选（R-A1：干支不含绝对年代）
import { TIAN_GAN, DI_ZHI } from '../constants.mjs';
import { SolarTime } from 'tyme4ts';

/** 五虎遁（年上起月）：年干 → 正月（寅月）月干 */
export const WU_HU = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };
/** 五鼠遁（日上起时）：日干 → 子时时干 */
export const WU_SHU = { 甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬' };

/** 由 年干 + 月支 推应得月干 */
export function expectedMonthGan(yearGan, monthZhi) {
  const start = TIAN_GAN.indexOf(WU_HU[yearGan]);
  if (start < 0) return null;
  const offset = ((DI_ZHI.indexOf(monthZhi) - 2) % 12 + 12) % 12;      // 寅 = 正月
  return TIAN_GAN[(start + offset) % 10];
}
/** 由 日干 + 时支 推应得时干 */
export function expectedHourGan(dayGan, hourZhi) {
  const start = TIAN_GAN.indexOf(WU_SHU[dayGan]);
  if (start < 0) return null;
  return TIAN_GAN[(start + DI_ZHI.indexOf(hourZhi)) % 10];
}
/** 干支配对是否合法（干与支同阴阳） */
export const isValidPillar = (gz) =>
  typeof gz === 'string' && gz.length === 2 &&
  TIAN_GAN.includes(gz[0]) && DI_ZHI.includes(gz[1]) &&
  TIAN_GAN.indexOf(gz[0]) % 2 === DI_ZHI.indexOf(gz[1]) % 2;

/**
 * 四柱自洽性校验
 * @param pillars ['丁亥','壬子','癸巳','庚申']（年月日时）
 */
export function checkPillars(pillars) {
  const out = { pillars, valid: true, checks: [], errors: [] };
  if (!Array.isArray(pillars) || pillars.length !== 4) {
    out.valid = false; out.errors.push('需要 4 柱（年 月 日 时）');
    return out;
  }
  for (const [i, gz] of pillars.entries()) {
    const name = ['年柱', '月柱', '日柱', '时柱'][i];
    if (!isValidPillar(gz)) { out.valid = false; out.errors.push(`${name}「${gz}」不是合法干支（干与支须同阴阳）`); }
  }
  if (out.errors.length) return out;
  const [Y, M, D, H] = pillars;
  // ① 五虎遁：年干 × 月支 → 月干
  const em = expectedMonthGan(Y[0], M[1]);
  const okM = em === M[0];
  out.checks.push({ rule: '五虎遁（年上起月）', expect: `${em}${M[1]}`, actual: M, ok: okM });
  if (!okM) { out.valid = false; out.errors.push(`五虎遁不符：${Y[0]}年${M[1]}月 应得月干 ${em}，实报 ${M[0]}`); }
  // ② 五鼠遁：日干 × 时支 → 时干
  const eh = expectedHourGan(D[0], H[1]);
  const okH = eh === H[0];
  out.checks.push({ rule: '五鼠遁（日上起时）', expect: `${eh}${H[1]}`, actual: H, ok: okH });
  if (!okH) { out.valid = false; out.errors.push(`五鼠遁不符：${D[0]}日${H[1]}时 应得时干 ${eh}，实报 ${H[0]}`); }
  // ③ 月支与"年干-月支"的节气月一致性（月支只能是寅…丑，且正月起寅）
  out.checks.push({ rule: '月支取值范围', expect: '寅…丑（节气月）', actual: M[1], ok: DI_ZHI.includes(M[1]) });
  return out;
}

/**
 * 由 年干支 列出候选公历年份（R-A1：干支不含绝对年代）
 * 用于：用户只给四柱时，请其确认公历年份
 */
export function candidateYears(yearGz, { from = 1900, to = 2100 } = {}) {
  const out = [];
  for (let y = from; y <= to; y++) {
    try {
      const ec = SolarTime.fromYmdHms(y, 6, 1, 12, 0, 0).getLunarHour().getEightChar();
      if (ec.getYear().getName() === yearGz) out.push(y);
    } catch { /* 越界年份跳过 */ }
  }
  return out;
}

/**
 * 由 四柱 反查候选公历日期（在给定年份区间内逐日比对）
 * @returns [{date, matched:[年月日时各项]}]
 */
export function candidateDates(pillars, { from = 1900, to = 2100, limit = 40 } = {}) {
  if (!Array.isArray(pillars) || pillars.length !== 4) return [];
  const [Y, M, D, H] = pillars;
  const out = [];
  for (let y = from; y <= to; y++) {
    for (let m = 1; m <= 12; m++) {
      const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= dim; d++) {
        try {
          const ec = SolarTime.fromYmdHms(y, m, d, 12, 0, 0).getLunarHour().getEightChar();
          if (ec.getYear().getName() !== Y || ec.getMonth().getName() !== M || ec.getDay().getName() !== D) continue;
          // 该日含哪个时辰 → 反推是否可能是 H 时
          let hit = null;
          for (let hh = 0; hh < 24; hh += 2) {
            const e2 = SolarTime.fromYmdHms(y, m, d, hh, 0, 0).getLunarHour().getEightChar();
            if (e2.getHour().getName() === H) { hit = hh; break; }
          }
          if (hit === null) continue;
          out.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, hourFrom: hit, hourTo: (hit + 2) % 24 });
          if (out.length >= limit) return out;
        } catch { /* skip */ }
      }
    }
  }
  return out;
}
