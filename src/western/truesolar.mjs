// 真太阳时（均时差 + 经度修正 + 历史夏令时）
//
// ★ 最重要的一条技术裁定（R-T1）：**星盘不使用真太阳时**。
//   西方占星要的是「正确的 UT 瞬时 + 地理经度」（经度只用于宫位/上升），
//   若把真太阳时再喂给星盘引擎，等于**把经度修正算了两遍**，上升/中天会整体偏掉。
//   真太阳时只用于**中国侧**（八字时柱、六壬占时）。本模块把两者分开输出并给出差值。
//
// 复用：均时差用 astronomy-engine 自算（太阳时角法），并与 @openfate/true-solar-time 的
// Meeus 实现**对拍**（两个独立实现，实测吻合，见 test/verify-rectify.mjs）。
import { SiderealTime, Ecliptic, GeoVector, Body, e_tilt } from 'astronomy-engine';
import { tzOffsetHours } from './natal.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let meeusEot = null;
try { meeusEot = require('@openfate/true-solar-time').calculateMeeusEquationOfTime; } catch { meeusEot = null; }

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm = (x, m) => { const r = ((x % m) + m) % m; return r; };

/**
 * 均时差（分钟，EoT = 真太阳时 − 平太阳时；正值表示日晷快）
 * 由太阳视时角推：AST = GAST + lon/15 − RA + 12h，LMT = UT + lon/15 ⇒ EoT = GAST − RA + 12h − UT
 */
export function equationOfTime(date, { useMeeus = false } = {}) {
  if (useMeeus && meeusEot) return Number(meeusEot(date));
  const gast = SiderealTime(date);                       // 视恒星时（小时）
  // 太阳视赤经（小时）：由真黄经 + 真黄赤交角换算（与 natal.mjs 同一套坐标，已验证到 0.005°）
  const elon = Ecliptic(GeoVector(Body.Sun, date, true)).elon * D2R;
  const eps = e_tilt(date).tobl * D2R;
  const ra = norm(Math.atan2(Math.sin(elon) * Math.cos(eps), Math.cos(elon)) * R2D / 15, 24);
  const utH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let eot = norm(gast - ra + 12 - utH, 24);
  if (eot > 12) eot -= 24;                                // 归到 ±12h
  return eot * 60;                                        // → 分钟
}

/** 标准时经线（度） */
export const standardMeridian = (tzName, fallbackTz = 8) => {
  const h = tzName ? tzOffsetHours(tzName, new Date()) : fallbackTz;
  return h * 15;
};

/**
 * 真太阳时换算
 * @param at      当地时间 "YYYY-MM-DD HH:mm"（无时区）
 * @param lon     地理经度（东正）
 * @param tzName  IANA 时区名（走历史规则，含夏令时）
 */
export function trueSolarTime({ at, lon, tzName = 'Asia/Shanghai', tz = 8 }) {
  const m = String(at).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) throw new Error(`无法解析时间：${at}`);
  const [, Y, Mo, D, H, Mi] = m.map(Number);
  const wall = Date.UTC(Y, Mo - 1, D, H, Mi);
  const dstOffset = tzName ? tzOffsetHours(tzName, new Date(wall)) : tz;
  const utc = new Date(wall - dstOffset * 3600e3);

  const eotMin = equationOfTime(utc);
  const lmtOffset = tzName ? tzOffsetHours(tzName, utc) : tz;
  const stdMer = lmtOffset * 15;
  const lonCorrMin = (lon - stdMer) * 4;                  // 1° = 4 分钟
  const totalOffsetMin = lonCorrMin + eotMin;             // 相对标准时

  const trueSolar = new Date(utc.getTime() + (lon / 15) * 3600e3 + eotMin * 60e3);
  const civilLocal = new Date(wall);
  // 真太阳时 = UT + 经度/15 + EoT —— 这个量**本身就是当地钟面读数**，不能再叠加时区偏移
  //（第一版多加了 tz 偏移，把当日 16:26 写成了次日 00:26）

  const shichen = (h, mi) => Math.floor((((h + 1) % 24) + mi / 60) / 2) % 12;
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const scC = shichen(civilLocal.getUTCHours(), civilLocal.getUTCMinutes());
  const scT = shichen(trueSolar.getUTCHours(), trueSolar.getUTCMinutes());

  return {
    civilLocal: fmt(civilLocal), utc: utc.toISOString(),
    dstOffsetHours: lmtOffset,
    standardMeridian: stdMer,
    eotMinutes: round(eotMin), lonCorrectionMinutes: round(lonCorrMin), totalOffsetMinutes: round(totalOffsetMin),
    apparentSolarLocal: fmt(trueSolar),
    shichenCivil: ZHI[scC], shichenTrue: ZHI[scT], shichenDiffers: scC !== scT,
    // R-T1：星盘要的是 civilLocal → utc 这个瞬时（经度另算），**不是**真太阳时
    chartUtc: utc.toISOString(),
    note: 'R-T1：星盘用 utc（civilLocal 换算而来，且经度只用于宫位）；真太阳时仅用于中国侧时柱/占时',
  };
}

const fmt = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const round = (x) => Math.round(x * 1000) / 1000;

/**
 * R-T2（用户裁定：所有中国侧一律真太阳时）：给出**喂给八字引擎的钟面时刻**
 * 有经度 → 真太阳时；无经度 → 退回民用时并标记（真太阳时缺经度算不出来，只能退回，必须告警）
 * @returns {{at, usedTrueSolar, offsetMinutes, dayShift, reason}}
 */
export function baziClock({ date, time, lon, tzName = null, tz = null, useTrueSolar = true }) {
  const civil = `${date} ${time.length === 4 ? `0${time}` : time}`;
  if (!useTrueSolar) return { at: civil, usedTrueSolar: false, offsetMinutes: 0, dayShift: false, reason: '显式要求民用时' };
  if (lon === null || lon === undefined) {
    return { at: civil, usedTrueSolar: false, offsetMinutes: 0, dayShift: false, reason: '缺经度，真太阳时无法计算（R-T2 退回民用时，需补经度）' };
  }
  const r = trueSolarTime({ at: civil, lon, tzName, tz: tz ?? 8 });
  return {
    at: r.apparentSolarLocal,
    usedTrueSolar: true,
    offsetMinutes: r.totalOffsetMinutes,
    eotMinutes: r.eotMinutes,
    lonCorrectionMinutes: r.lonCorrectionMinutes,
    dayShift: r.apparentSolarLocal.slice(0, 10) !== civil.slice(0, 10),
    shichen: r.shichenTrue, shichenTrue: r.shichenTrue, shichenCivil: r.shichenCivil, shichenDiffers: r.shichenDiffers,
    civil,
    reason: `真太阳时（经度 ${r.lonCorrectionMinutes} 分 + 均时差 ${r.eotMinutes} 分 = ${r.totalOffsetMinutes} 分）`,
  };
}

export { meeusEot };
