// 西方本命盘生成器：出生时间 + 经纬度 → { planets, aspects }（Part5/Part6 的标准输入）
// 复用：astronomy-engine 出地心视黄经（Ecliptic() 已是「当日真黄道」，勿再叠 precession）与 GAST
import { GeoVector, Ecliptic, Body, SiderealTime, e_tilt } from 'astronomy-engine';
import { SIGNS, SIGN_ELEMENT, signOfLon, degInSign, angularGap } from './zodiac.mjs';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const norm360 = (x) => ((x % 360) + 360) % 360;

/** 本命盘用的天体（按规范顺序，顺序即稳定输出顺序——不要动态排序） */
export const NATAL_BODIES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
export const BODY_ENUM = { 太阳: Body.Sun, 月亮: Body.Moon, 水星: Body.Mercury, 金星: Body.Venus, 火星: Body.Mars, 木星: Body.Jupiter, 土星: Body.Saturn, 天王星: Body.Uranus, 海王星: Body.Neptune, 冥王星: Body.Pluto };
/** 相位：角度 → 名称（与规则表 5.3/6.1 用语一致） */
export const ASPECT_DEFS = [
  { name: '合相', angle: 0 }, { name: '六分相', angle: 60 }, { name: '四分相', angle: 90 },
  { name: '三分相', angle: 120 }, { name: '梅花相', angle: 150 }, { name: '对冲', angle: 180 },
];
export const HOUSE_SYSTEMS = ['porphyry', 'equal', 'whole'];

/** 干支/历表无关的纯函数：地心视黄经（度，当日真黄道） */
export function bodyLongitude(name, date) {
  const b = BODY_ENUM[name];
  if (!b) throw new Error(`未支持的天体：${name}`);
  return norm360(Ecliptic(GeoVector(b, date, true)).elon);
}

/** 平交点黄经（Meeus 多项式，T = 自 J2000 的儒略世纪）；真交点可差 ±1.5°（裁定 R-W2） */
export function meanNodeLongitude(date) {
  const T = (date.getTime() / 86400e3 + 2440587.5 - 2451545.0) / 36525;
  const om = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T ** 3) / 467441 - (T ** 4) / 60616000;
  return norm360(om);
}

/** 本地时间字符串（无时区）按给定时差转 UTC
 *  也接受 IANA 时区名（tzName）：此时偏移由 Intl 按**历史真实规则**求（含夏令时）。
 *  由来：与 kerykeion 对拍时发现——中国 1986–1991 实行过夏令时（+9），固定 +8 会整整差 1 小时。
 */
export function toUTC(at, tz, tzName = null) {
  if (at instanceof Date) return at;
  const m = String(at).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) { const d = new Date(at); if (Number.isNaN(d.getTime())) throw new Error(`无法解析时间：${at}`); return d; }
  const [, Y, Mo, D, H, Mi, S, tzMark] = m;
  if (tzMark === 'Z' || /[+-]\d{2}/.test(tzMark ?? '')) return new Date(at.replace(' ', 'T'));
  const wall = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +(S ?? 0));
  if (tzName) {
    let off = tzOffsetHours(tzName, new Date(wall));
    let utc = new Date(wall - off * 3600e3);
    off = tzOffsetHours(tzName, utc);                    // 用求得的 UTC 回代一次，跨 DST 边界更准
    return new Date(wall - off * 3600e3);
  }
  return new Date(Date.UTC(+Y, +Mo - 1, +D, +H - tz, +Mi, +(S ?? 0)));
}

/** 用 Intl 求某 IANA 时区在给定 UTC 时刻的真实偏移（小时，含历史夏令时） */
export function tzOffsetHours(tzName, utcDate) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tzName, timeZoneName: 'longOffset' })
    .formatToParts(utcDate).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const mm = part.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!mm) return 0;                                      // 恰好 'GMT' 即 0
  return (mm[1] === '-' ? -1 : 1) * (Number(mm[2]) + Number(mm[3] ?? 0) / 60);
}

/** 上升与天顶黄经（标准球面公式；φ 为地理纬度） */
export function ascMc(utc, lat, lon) {
  const gast = SiderealTime(utc);                       // 格林尼治视恒星时（小时）
  const lst = gast + lon / 15;                          // 地方视恒星时（小时）
  const ramc = norm360(lst * 15) * D2R;                 // 中天赤经（度→弧度）
  const eps = e_tilt(utc).tobl * D2R;                   // 真黄赤交角
  const phi = lat * D2R;
  const mc = norm360(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * R2D);
  const asc = norm360(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * R2D);
  return { asc, mc, ramc: norm360(ramc * R2D), obliquity: e_tilt(utc).tobl, gastHours: gast };
}

/** 十二宫头（porphyry 四分仪等分 / equal 等宫 / whole 整宫） */
export function houseCusps(houseSystem, asc, mc) {
  if (houseSystem === 'equal') return Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30));
  if (houseSystem === 'whole') {
    const start = Math.floor(norm360(asc) / 30) * 30;
    return Array.from({ length: 12 }, (_, i) => norm360(start + i * 30));
  }
  // porphyry：把 天顶→上升 与 上升→天底 两段黄道弧各分三等份
  const q1 = norm360(asc - mc);          // 天顶 → 上升（含 11、12 宫）
  const q2 = norm360(mc + 180 - asc);    // 上升 → 天底（含 2、3 宫）
  const c = new Array(12).fill(0);
  c[0] = asc;                            // 1 宫头 = 上升
  c[9] = mc;                             // 10 宫头 = 天顶
  c[3] = norm360(mc + 180);              // 4 宫头 = 天底
  c[6] = norm360(asc + 180);             // 7 宫头 = 下降
  c[10] = norm360(mc + q1 / 3); c[11] = norm360(mc + (2 * q1) / 3);
  c[1] = norm360(asc + q2 / 3); c[2] = norm360(asc + (2 * q2) / 3);
  c[4] = norm360(c[10] + 180); c[5] = norm360(c[11] + 180);
  c[7] = norm360(c[1] + 180); c[8] = norm360(c[2] + 180);
  return c;
}

/** 黄经落在第几宫（1..12） */
export function houseOf(lon, cusps) {
  const L = norm360(lon);
  for (let i = 0; i < 12; i++) {
    const a = cusps[i], b = cusps[(i + 1) % 12];
    if (a <= b ? (L >= a && L < b) : (L >= a || L < b)) return i + 1;
  }
  return 1;
}

/** 逆行判定（与 12 小时后比较；太阳/月亮/交点不判逆） */
function isRetro(name, utc) {
  if (name === '太阳' || name === '月亮') return false;
  const a = bodyLongitude(name, utc);
  const b = bodyLongitude(name, new Date(utc.getTime() + 12 * 3600e3));
  return norm360(b - a) > 180;
}

/** 相位容许度（裁定 R-W4：日月 8°，四轴/交点 6°，其余 6°） */
export function orbFor(a, b, base = 6) {
  return (a === '太阳' || a === '月亮') && (b === '太阳' || b === '月亮') ? 8
    : (a === '上升' || b === '上升' || a.endsWith('交点') || b.endsWith('交点')) ? base
      : base;
}

/**
 * 主入口
 * @param {{at:string|Date, lat?:number, lon?:number, tz?:number, houseSystem?:string, orb?:number, bodies?:string[]}} o
 * @returns {{planets:Object, aspects:Array, angles:Object, cusps:number[], meta:Object}} —— planets/aspects 即 Part5/6 的标准输入
 */
export function computeNatal(o) {
  const tz = o.tz ?? 8;                                  // 裁定 R-W3：默认 +8（东八区）
  // 经度同时接受 lon / lng / longitude ——曾经只认 `lon`，调用方传 `lng` 时**静默退回默认北京经度**，
  // 导致排盘与 kerykeion 差出十几度（与 kerykeion 对拍时暴露，裁定 R-W7）
  const lon = o.lon ?? o.lng ?? o.longitude;
  if (lon === undefined && (o.lng !== undefined || o.longitude !== undefined)) throw new Error('经度参数解析异常');
  const lat = o.lat ?? o.latitude ?? 39.9042;
  const lonV = lon ?? 116.4074;                           // 未提供时用北京占位（R-W5）
  const utc = toUTC(o.at, tz, o.tzName ?? null);
  const houseSystem = o.houseSystem ?? 'porphyry';        // 裁定 R-W1：默认 porphyry
  if (!HOUSE_SYSTEMS.includes(houseSystem)) throw new Error(`未知宫位制：${houseSystem}`);
  const orb = o.orb ?? 6;
  const bodies = o.bodies ?? NATAL_BODIES;
  const lonFinal = lonV;

  const { asc, mc, ramc, obliquity, gastHours } = ascMc(utc, lat, lonFinal);
  const cRaw = houseCusps(houseSystem, asc, mc);   // 内部用未取整值算宫位，避免取整后跨宫
  const cusps = cRaw;

  const planets = {};
  for (const n of bodies) {
    const L = bodyLongitude(n, utc);
    planets[n] = { sign: signOfLon(L), deg: Math.round(degInSign(L) * 100) / 100, house: houseOf(L, cRaw), lon: Math.round(L * 1000) / 1000, retro: isRetro(n, utc), element: SIGN_ELEMENT[signOfLon(L)] };
  }
  const north = meanNodeLongitude(utc);
  planets['北交点'] = { sign: signOfLon(north), deg: Math.round(degInSign(north) * 100) / 100, house: houseOf(north, cRaw), lon: Math.round(north * 1000) / 1000, retro: true, element: SIGN_ELEMENT[signOfLon(north)] };
  planets['南交点'] = { sign: signOfLon(north + 180), deg: Math.round(degInSign(north + 180) * 100) / 100, house: houseOf(north + 180, cRaw), lon: Math.round(norm360(north + 180) * 1000) / 1000, retro: true, element: SIGN_ELEMENT[signOfLon(north + 180)] };
  // 四轴（上升/天顶/下降/天底）与南北交点都参与相位——四轴与行星的相位是占星实务的有效信息。
  // 与 kerykeion 对拍时暴露出：只算上升会让它的四轴/交点相位无处对应（覆盖率虚低）。
  planets['上升'] = { sign: signOfLon(asc), deg: Math.round(degInSign(asc) * 100) / 100, house: 1, lon: Math.round(asc * 1000) / 1000, retro: false, element: SIGN_ELEMENT[signOfLon(asc)] };
  planets['天顶'] = { sign: signOfLon(mc), deg: Math.round(degInSign(mc) * 100) / 100, house: 10, lon: Math.round(mc * 1000) / 1000, retro: false, element: SIGN_ELEMENT[signOfLon(mc)] };
  planets['下降'] = { sign: signOfLon(asc + 180), deg: Math.round(degInSign(asc + 180) * 100) / 100, house: 7, lon: Math.round(norm360(asc + 180) * 1000) / 1000, retro: false, element: SIGN_ELEMENT[signOfLon(asc + 180)] };
  planets['天底'] = { sign: signOfLon(mc + 180), deg: Math.round(degInSign(mc + 180) * 100) / 100, house: 4, lon: Math.round(norm360(mc + 180) * 1000) / 1000, retro: false, element: SIGN_ELEMENT[signOfLon(mc + 180)] };

  const aspectBodies = [...bodies, '上升', '天顶', '下降', '天底', '北交点', '南交点'];
  const lonRaw = Object.fromEntries(Object.entries(planets).map(([k, v]) => [k, norm360(
    k === '上升' ? asc : k === '天顶' ? mc : k === '下降' ? asc + 180 : k === '天底' ? mc + 180
      : k === '北交点' ? north : k === '南交点' ? north + 180 : bodyLongitude(k, utc))]));
  const aspects = [];
  for (let i = 0; i < aspectBodies.length; i++) {
    for (let j = i + 1; j < aspectBodies.length; j++) {
      const a = aspectBodies[i], b = aspectBodies[j];
      const gap = angularGap(lonRaw[a], lonRaw[b]);
      const allow = orbFor(a, b, orb);
      let best = null;
      for (const d of ASPECT_DEFS) {
        const diff = Math.abs(gap - d.angle);
        if (diff <= allow && (!best || diff < best.diff)) best = { type: d.name, diff };
      }
      if (best) aspects.push({ a, b, type: best.type, orb: Math.round(best.diff * 100) / 100, exact: Math.round(gap * 100) / 100 });
    }
  }

  return {
    planets, aspects,
    angles: { asc: Math.round(asc * 100) / 100, mc: Math.round(mc * 100) / 100, ramc: Math.round(ramc * 100) / 100, obliquity: Math.round(obliquity * 10000) / 10000, gastHours: Math.round(gastHours * 1e5) / 1e5 },
    anglesRaw: { asc, mc, ramc, obliquity, gastHours },
    cusps: cusps.map((c) => Math.round(c * 100) / 100),
    cuspsRaw: cRaw,
    meta: { at: String(o.at), tz, utc: utc.toISOString(), lat, lon: lonFinal, tzName: o.tzName ?? null, houseSystem, orb, bodies: bodies.length + 3, nodeType: 'mean' },
  };
}

/** 可读摘要 */
export function renderNatal(n) {
  const L = [];
  L.push(`# 本命盘 · ${n.meta.at}（tz+${n.meta.tz}）→ UTC ${n.meta.utc}`);
  L.push(`- 地点 ${n.meta.lat}°N ${n.meta.lon}°E｜宫位制 ${n.meta.houseSystem}｜容许度 ${n.meta.orb}°｜交点 ${n.meta.nodeType}`);
  L.push(`- 上升 ${n.planets['上升'].sign}${n.planets['上升'].deg}°  天顶 ${signOfLon(n.angles.mc)}${degInSign(n.angles.mc).toFixed(2)}°  RAMC ${n.angles.ramc}°  黄赤交角 ${n.angles.obliquity}°`);
  L.push('');
  L.push('| 天体 | 星座 | 度数 | 宫位 | 元素 | 逆行 |');
  L.push('|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(n.planets)) L.push(`| ${k} | ${v.sign} | ${v.deg}° | ${v.house} | ${v.element} | ${v.retro ? 'R' : ''} |`);
  L.push('');
  L.push(`## 相位（${n.aspects.length} 条）`);
  L.push(n.aspects.map((a) => `${a.a}${a.type}${a.b}(±${a.orb}°)`).join('　'));
  return L.join('\n');
}
