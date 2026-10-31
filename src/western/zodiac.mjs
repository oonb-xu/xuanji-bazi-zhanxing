// 西方占星侧基础：黄道十二宫、星座主星（庙旺）、互容、黄经换算
// 目的：为 Part 6.3 行运计算与 Part 6.4 互容判定提供最小充分工具，不引入宫位制（无需出生地）
import { GeoVector, Ecliptic, Body } from 'astronomy-engine';

export const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
export const SIGN_ELEMENT = {
  白羊: '火', 狮子: '火', 射手: '火',
  金牛: '土', 处女: '土', 摩羯: '土',
  双子: '风', 天秤: '风', 水瓶: '风',
  巨蟹: '水', 天蝎: '水', 双鱼: '水',
};
/** 现代主星 */
export const RULER_MODERN = {
  白羊: '火星', 金牛: '金星', 双子: '水星', 巨蟹: '月亮', 狮子: '太阳', 处女: '水星',
  天秤: '金星', 天蝎: '冥王星', 射手: '木星', 摩羯: '土星', 水瓶: '天王星', 双鱼: '海王星',
};
/** 传统主星（互容判定用；Uranus/Neptune/Pluto 入主前的古典体系） */
export const RULER_TRADITIONAL = {
  白羊: '火星', 金牛: '金星', 双子: '水星', 巨蟹: '月亮', 狮子: '太阳', 处女: '水星',
  天秤: '金星', 天蝎: '火星', 射手: '木星', 摩羯: '土星', 水瓶: '土星', 双鱼: '木星',
};
/** 凶星 / 吉星（Part 6.1 的「凶星 / 吉星」判据；中性行星单列） */
export const MALEFIC = ['火星', '土星', '冥王星', '天王星', '海王星'];
export const BENEFIC = ['木星', '金星'];
export const NEUTRAL_LUM = ['太阳', '月亮', '水星'];

export const lonOfSignDegree = (sign, deg = 0) => SIGNS.indexOf(sign) * 30 + deg;
export const signOfLon = (lon) => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];
export const degInSign = (lon) => ((lon % 360) + 360) % 360 % 30;
/** 角度差（取 0–180） */
export const angularGap = (a, b) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return d > 180 ? 360 - d : d; };

/** 互容：A 在 B 的主星之座，且 B 在 A 的主星之座（同时检现代与传统主星） */
export function mutualReception(A, B) {
  if (!A?.sign || !B?.sign || !A?.name || !B?.name) return null;
  for (const [label, R] of [['传统主星', RULER_TRADITIONAL], ['现代主星', RULER_MODERN]]) {
    if (R[A.sign] === B.name && R[B.sign] === A.name) return { system: label, aIn: A.sign, bIn: B.sign };
  }
  return null;
}

const BODY = { 太阳: Body.Sun, 月亮: Body.Moon, 水星: Body.Mercury, 金星: Body.Venus, 火星: Body.Mars, 木星: Body.Jupiter, 土星: Body.Saturn, 天王星: Body.Uranus, 海王星: Body.Neptune, 冥王星: Body.Pluto };

/** 地心视黄经（度） */
export function eclipticLongitude(planet, date) {
  const b = BODY[planet];
  if (!b) throw new Error(`未支持的行星：${planet}`);
  return ((Ecliptic(GeoVector(b, date, true)).elon % 360) + 360) % 360;
}

/** 以 12 小时为步长扫描一个公历年内某行星的黄经（用于行运触发年定位） */
export function longitudeSamples(planet, year, stepHours = 24) {
  const out = [];
  const start = Date.UTC(year, 0, 1, 0, 0, 0);
  for (let t = start; t < Date.UTC(year + 1, 0, 1); t += stepHours * 3600e3) out.push({ t: new Date(t), lon: eclipticLongitude(planet, new Date(t)) });
  return out;
}

/** 外行星（土/天/冥）触发本命硬相位的年份检测 */
export const TRANSIT_PLANETS = ['土星', '天王星', '冥王星'];
export const TRANSIT_ASPECTS = { 合相: 0, 对冲: 180, 四分相: 90 };

export function findTransitYears({ natalPlanets, fromYear, toYear, orb = 1 }) {
  const hits = [];
  const natal = Object.entries(natalPlanets)
    .filter(([n, v]) => v && (v.lon !== null && v.lon !== undefined))
    .map(([n, v]) => ({ name: n, lon: v.lon }));
  for (const tp of TRANSIT_PLANETS) {
    for (let y = fromYear; y <= toYear; y++) {
      const samples = longitudeSamples(tp, y);
      for (const [aspName, angle] of Object.entries(TRANSIT_ASPECTS)) {
        for (const np of natal) {
          const target = (np.lon + angle) % 360;
          const near = samples.find((s) => angularGap(s.lon, target) <= orb);
          if (near) hits.push({ year: y, date: near.t.toISOString().slice(0, 10), transit: tp, aspect: aspName, natal: np.name, orb: Math.round(angularGap(near.lon, target) * 100) / 100 });
        }
      }
    }
  }
  // 同年同类去重：保留轨道最接近的一条
  const best = new Map();
  for (const h of hits) {
    const k = `${h.year}|${h.transit}|${h.aspect}|${h.natal}`;
    if (!best.has(k) || best.get(k).orb > h.orb) best.set(k, h);
  }
  return [...best.values()].sort((a, b) => a.year - b.year || a.orb - b.orb);
}
