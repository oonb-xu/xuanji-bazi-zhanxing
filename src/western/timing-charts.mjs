// 占星时序盘（R-W13）：行运 / 次限 / 三限 / 太阳返照 / 月亮返照 / 太阳弧 / 法达 / 小限
//
// 用户裁定：**占星机制降级 —— 不再参与事件预测，只作「心理八字」的补充**。
//   故本模块的定位是**描述性时序工具**（描述心理/主题演化），不产出"某年必然发生某事"的断言。
//   所有盘都给出可复算的数值，供人工裁定与后续实证（不得直接当结论）。
import { eclipticLongitude } from './zodiac.mjs';
import { computeNatal } from './natal.mjs';

const D2R = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;

/* ══════════ 1 法达（Firdaria）—— 纯表，波斯/中世纪主期限法 ══════════ */
/** 昼生（日间盘）顺序；夜生从月亮起 */
export const FIRDARIA_DAY = [
  { planet: '太阳', years: 10 }, { planet: '金星', years: 8 }, { planet: '水星', years: 13 },
  { planet: '月亮', years: 9 }, { planet: '土星', years: 11 }, { planet: '木星', years: 12 }, { planet: '火星', years: 7 },
];
export const FIRDARIA_NIGHT = [
  { planet: '月亮', years: 9 }, { planet: '土星', years: 11 }, { planet: '木星', years: 12 },
  { planet: '火星', years: 7 }, { planet: '太阳', years: 10 }, { planet: '金星', years: 8 }, { planet: '水星', years: 13 },
];
/** 节点（北交/南交）在法达里通常接在火星之后各 3 年（流派不一，标注为可选） */
export const FIRDARIA_NODES = [{ planet: '北交点', years: 3 }, { planet: '南交点', years: 3 }];

/** 定法达主期与子期（子期按固定顺序从主星起，各占主期 1/7） */
export function firdaria(birthAt, age, { isDay = null, includeNodes = true } = {}) {
  const natal = computeNatal({ at: birthAt, lng: 0, lat: 0, tz: 0 });
  const day = isDay ?? (() => {                       // 无 sect 时按太阳在地平线上近似判断
    const sun = natal.planets['太阳']?.house ?? 10;
    return sun >= 7 && sun <= 12;
  })();
  const seq = [...(day ? FIRDARIA_DAY : FIRDARIA_NIGHT)];
  if (includeNodes) seq.push(...FIRDARIA_NODES);
  let t = 0;
  for (const p of seq) {
    if (age < t + p.years) {
      const within = age - t;
      const subLen = p.years / 7;
      const order = seq.map((x) => x.planet);
      const i = order.indexOf(p.planet);
      const subPlanets = [...order.slice(i), ...order.slice(0, i)].slice(0, 7);
      const subIdx = Math.min(6, Math.floor(within / subLen));
      return { sect: day ? '昼' : '夜', period: p.planet, periodYears: p.years, periodStart: t, within: round2(within), sub: subPlanets[subIdx], subIndex: subIdx, subPlanets };
    }
    t += p.years;
  }
  return { sect: day ? '昼' : '夜', period: null, note: `超出法达总年数 ${t}` };
}

/* ══════════ 2 小限（Annual Profection）—— 纯算术 ══════════ */
export const SIGN_RULER = { 白羊: '火星', 金牛: '金星', 双子: '水星', 巨蟹: '月亮', 狮子: '太阳', 处女: '水星', 天秤: '金星', 天蝎: '火星', 射手: '木星', 摩羯: '土星', 水瓶: '土星', 双鱼: '木星' };
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];

/** 小限：满 N 岁（第 N+1 个年头）行进到本命上升起的第 N 宫 */
export function profection(natalAscSign, age) {
  const i = SIGNS.indexOf(natalAscSign);
  if (i < 0) return null;
  const sign = SIGNS[(i + age) % 12];
  return { age, house: (age % 12) + 1, sign, lordOfYear: SIGN_RULER[sign] };
}

/* ══════════ 3 次限 / 三限（推运）══════════ */
/** 次限：1 天 = 1 年（Secondary Progression） */
export const secondaryProgressed = (birthAt, ageYears) => shiftDate(birthAt, ageYears * 1);
/** 三限：1 天 = 1 月（Tertiary；流派不一，此处用 30.4375 天/月并标注） */
export const tertiaryProgressed = (birthAt, ageYears) => shiftDate(birthAt, ageYears * 30.4375);

function shiftDate(at, days) {
  const m = String(at).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) throw new Error(`无法解析：${at}`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  d.setUTCDate(d.getUTCDate() + Math.floor(days));
  const frac = days - Math.floor(days);
  d.setUTCMinutes(d.getUTCMinutes() + Math.round(frac * 1440));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/* ══════════ 4 太阳返照 / 月亮返照（求回归瞬时 —— 二分法，可复算） ══════════ */
/**
 * 求某年后（或月后）太阳/月亮回到本命黄经的**首次**瞬时
 * ★ 首版逻辑有缺陷：发现 flo>0 就把窗口向前挪，结果窗口里可能含**两次穿越**，
 *   而 `flo*fhi>0` 会误判"无穿越"（月亮返照实测返回 null）。改为**步进扫描首次变号再二分**。
 */
export function findReturn(body, natalLon, after, withinDays = 3, stepDays = 0.25) {
  const f = (t) => { const d = ((eclipticLongitude(body, new Date(t)) - natalLon) % 360 + 360) % 360; return d > 180 ? d - 360 : d; };
  const step = stepDays * 86400e3;
  const t0 = after.getTime() - withinDays * 86400e3;            // ★ 双向：返照瞬时可能落在目标日**之前**（逐年漂移）
  const end = after.getTime() + withinDays * 86400e3;
  const crossings = [];
  let prevT = t0, prevF = f(prevT);
  for (let t = prevT + step; t <= end + 1; t += step) {
    const fv = f(t);
    if (prevF * fv <= 0) {
      let lo = prevT, hi = t, flo = prevF;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2, fm = f(mid);
        if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
      }
      crossings.push((lo + hi) / 2);
    }
    prevT = t; prevF = fv;
  }
  if (!crossings.length) return null;                          // 窗口内确无穿越 → 如实返回 null
  return new Date(crossings.reduce((a, b) => (Math.abs(b - after.getTime()) < Math.abs(a - after.getTime()) ? b : a)));
}

/** 太阳返照盘（某年） */
export function solarReturn(birth, year, { lng = 0, lat = 0, tz = 0 } = {}) {
  const natal = computeNatal({ at: birth, lng, lat, tz });
  const sunLon = natal.planets['太阳'].lon;
  const approx = new Date(Date.UTC(year, birthMonth(birth) - 1, birthDay(birth)));
  const t = findReturn('太阳', sunLon, approx, 3);
  if (!t) return null;
  const at = isoLocal(t, tz);
  return { kind: 'solar-return', year, at, chart: computeNatal({ at, lng, lat, tz }) };
}
/** 月亮返照盘（某月起） */
export function lunarReturn(birth, afterDate, { lng = 0, lat = 0, tz = 0 } = {}) {
  const natal = computeNatal({ at: birth, lng, lat, tz });
  const moonLon = natal.planets['月亮'].lon;
  const t = findReturn('月亮', moonLon, afterDate, 2);
  if (!t) return null;
  const at = isoLocal(t, tz);
  return { kind: 'lunar-return', at, chart: computeNatal({ at, lng, lat, tz }) };
}

/* ══════════ 5 太阳弧（已有实现，此处统一口径）══════════ */
export const solarArc = (ageYears) => round2(ageYears * 0.985647);

/** 汇总某人某年的全部时序盘（描述性，不含任何"必发生"断言） */
export function timingCharts(birth, age, { lng = 0, lat = 0, tz = 0, year = null } = {}) {
  const natal = computeNatal({ at: birth, lng, lat, tz });
  const y = year ?? (Number(birth.slice(0, 4)) + age);
  return {
    age, year,
    firdaria: firdaria(birth, age),
    profection: profection(natal.planets['上升'].sign, age),
    secondary: { at: secondaryProgressed(birth, age) },
    tertiary: { at: tertiaryProgressed(birth, age) },
    solarArc: solarArc(age),
    solarReturn: solarReturn(birth, y, { lng, lat, tz }),
    lunarReturn: lunarReturn(birth, new Date(Date.UTC(y, 0, 1)), { lng, lat, tz }),
    natalAscSign: natal.planets['上升'].sign,
  };
}

const round2 = (x) => Math.round(x * 100) / 100;
const birthMonth = (s) => Number(s.slice(5, 7));
const birthDay = (s) => Number(s.slice(8, 10));
function isoLocal(d, tz) {
  const x = new Date(d.getTime() + tz * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getUTCFullYear()}-${p(x.getUTCMonth() + 1)}-${p(x.getUTCDate())} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
}
