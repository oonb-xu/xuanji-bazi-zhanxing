// 凯龙星（Chiron）—— 走 libephemeris 的离线小行星接口（复用优先，不下载星历）
//
// 为什么单独一个模块：主后端是 `mine`（R-W12），它没有凯龙；
//   而 libephemeris 的小行星接口**离线可用**（`calc_asteroid_by_number`），
//   故做成**可选增强**（opt-in），不掺进主后端、不影响既有输出（R-G5）。
//
// ★ 独立校验：本模块同时实现一条**来自 JPL SBDB 轨道根数的开普勒传播**（`keplerianChiron`），
//   与 libephemeris 是两个不同来源 ⇒ 两者互校，差值即误差上界（见 test/verify-chiron.mjs）。
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = join(HERE, '..', '..');
export const PY = join(PROJ, '.venv', 'Scripts', 'python.exe');
const BRIDGE = join(PROJ, 'py', 'chiron.py');
export const CHIRON_NAME = '凯龙';
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];

export const hasChiron = () => existsSync(PY) && existsSync(BRIDGE);

/** JD（UT）→ 凯龙黄经，走 libephemeris（离线小行星接口） */
export function chironLongitude(date) {
  if (!hasChiron()) throw new Error('凯龙桥不可用：缺 .venv 或 py/chiron.py');
  const jd = date.getTime() / 86400000 + 2440587.5;
  const arg = ['--year', String(date.getUTCFullYear()), '--month', String(date.getUTCMonth() + 1),
    '--day', String(date.getUTCDate()), '--hour', String(date.getUTCHours() + date.getUTCMinutes() / 60)];
  const out = execFileSync(PY, [BRIDGE, ...arg], {
    encoding: 'utf8', timeout: 180000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', LIBEPHEMERIS_DATA_DIR: process.env.LIBEPHEMERIS_DATA_DIR ?? join(PROJ, '.ephemeris') },
  });
  const j = JSON.parse(out.trim().split('\n').pop());
  if (!j.ok) throw new Error(`凯龙计算失败：${j.err}`);
  return { lon: j.lon, lat: j.lat, dist: j.dist, jd: j.jd ?? jd, source: 'libephemeris' };
}

/* ══════════ 独立校验源：JPL SBDB 轨道根数 → 开普勒传播 ══════════ */
/** 2060 Chiron 轨道根数（JPL SBDB API，DE441，RMS 0.41″，equinox J2000）
 *  ★ 注意：API 返回的数值只到 **3 位有效数字**（e=0.38、a=13.7、i=6.93、Ω=209、ω=339、M=217），
 *    故本实现存在**系统误差**；其用途是**与 libephemeris 互校**，不作为主值。 */
export const CHIRON_ELEMENTS = {
  epoch: 2461200.5,          // TDB
  a: 13.7, e: 0.38, i: 6.93,
  om: 209, w: 339, ma: 217,  // deg
  period: 18500,             // d
  source: 'JPL SBDB API (sstr=2060), solution date 2026-06-05, DE441, 3 significant figures',
};

/** 开普勒方程解偏近点角（牛顿迭代） */
function solveKepler(M, e) {
  let E = M;
  for (let k = 0; k < 60; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** 由轨道根数算日心黄道 J2000 直角坐标（AU） */
export function keplerianHelio(jdTDB) {
  const el = CHIRON_ELEMENTS;
  const n = 360 / el.period;                                  // deg/day
  const M = ((el.ma + n * (jdTDB - el.epoch)) % 360 + 360) % 360 * Math.PI / 180;
  const e = el.e, a = el.a;
  const E = solveKepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = el.w * Math.PI / 180, om = el.om * Math.PI / 180, i = el.i * Math.PI / 180;
  const cw = Math.cos(w), sw = Math.sin(w), co = Math.cos(om), so = Math.sin(om), ci = Math.cos(i), si = Math.sin(i);
  const x = (co * cw - so * sw * ci) * xv + (-co * sw - so * cw * ci) * yv;
  const y = (so * cw + co * sw * ci) * xv + (-so * sw + co * cw * ci) * yv;
  const z = (sw * si) * xv + (cw * si) * yv;
  return { x, y, z };
}

/**
 * ★★ 框架判定（必须说清，否则会静默错 3.8°）
 * 实测：libephemeris 的 `calc_asteroid_by_number` 与 JPL 根数开普勒传播**只差 0.132°**，
 *   且黄纬 6.614° 接近 Chiron 轨道倾角 6.93° ⇒ 该接口返回的是**日心黄道坐标**，不是地心。
 * 星盘需要**地心**。日心→地心：`r_geo = r_chiron − r_earth`，最大视差 atan(1/15.2) ≈ **3.77°**，
 *   足以跨越星座/宫界 ⇒ **必须转换，不可直接用**。
 * 地球日心黄经由本项目引擎给出（`太阳`地心黄经 + 180°），保证与既有盘**同框架**。
 */
export function helioToGeo(chironHelio, earthHelioLon) {
  const d2r = Math.PI / 180, r2d = 180 / Math.PI;
  const { lon, lat, dist } = chironHelio;
  // 日心黄道直角坐标（黄道面为 xy 平面）
  const cl = lon * d2r, cb = lat * d2r;
  const cx = dist * Math.cos(cb) * Math.cos(cl);
  const cy = dist * Math.cos(cb) * Math.sin(cl);
  const cz = dist * Math.sin(cb);
  // 地球日心位置（黄纬按 0；地球定义在黄道面上，误差 <1″）
  const el = earthHelioLon * d2r;
  const ex = Math.cos(el), ey = Math.sin(el), ez = 0;
  const gx = cx - ex, gy = cy - ey, gz = cz - ez;
  const r = Math.sqrt(gx * gx + gy * gy + gz * gz);
  return {
    lon: ((Math.atan2(gy, gx) * r2d) % 360 + 360) % 360,
    lat: Math.asin(gz / r) * r2d,
    dist: r,
    parallaxApplied: true,
  };
}

/** 仅日心黄经（用于与 libephemeris 互校的量级检查） */
export function keplerianChironHelioLon(jdTDB) {
  const { x, y } = keplerianHelio(jdTDB);
  return ((Math.atan2(y, x) * 180 / Math.PI) % 360 + 360) % 360;
}

/** 黄经 → 星座 */
export const signOf = (lon) => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];
/** 黄经 → 度（星座内） */
export const degInSign = (lon) => Math.round((((lon % 360) + 360) % 360 % 30) * 100) / 100;

/**
 * 把凯龙并入既有星盘（可选增强，R-G5）
 * 不改动 chart 原有字段，只新增 `planets['凯龙']` 与 `chironMeta`
 */
export function attachChiron(chart, date, { eclipticLonOf } = {}) {
  const r = chironLongitude(date);
  // ★ 日心 → 地心（必须；视差实测 0.36–3.46°）
  const sunGeo = typeof eclipticLonOf === 'function' ? eclipticLonOf(date) : null;
  const geo = sunGeo === null ? { lon: r.lon, lat: r.lat, dist: r.dist, parallaxApplied: false }
    : helioToGeo(r, (sunGeo + 180) % 360);
  const lon = ((geo.lon % 360) + 360) % 360;
  const planets = chart.planets ?? {};
  // 宫位：用既有宫头数组（若可得）
  let house = null;
  try {
    const cusps = (chart.cuspsRaw ?? chart.cusps ?? []).map((c) => (typeof c === 'number' ? c : c?.lon)).filter((x) => typeof x === 'number');
    if (cusps.length === 12) {
      for (let k = 0; k < 12; k++) {
        const s = cusps[k], t = cusps[(k + 1) % 12];
        const span = ((t - s) % 360 + 360) % 360;
        const off = ((lon - s) % 360 + 360) % 360;
        if (off < span) { house = k + 1; break; }
      }
    }
  } catch { house = null; }
  return {
    ...chart,
    planets: {
      ...planets,
      [CHIRON_NAME]: {
        sign: signOf(lon), deg: degInSign(lon), lon, house, retro: null, element: null, chiron: true,
        helioLon: r.lon, parallaxDeg: Math.abs(((geo.lon - r.lon) % 360 + 540) % 360 - 180) === 0 ? 0 : Math.abs(((geo.lon - r.lon + 180) % 360) - 180),
      },
    },
    chironMeta: {
      source: r.source, helioLon: r.lon, helioLat: r.lat, dist: r.dist, jd: r.jd,
      geocentric: geo.parallaxApplied, geoLon: lon, geoLat: geo.lat, geoDist: geo.dist,
      houseSource: house ? 'from-cusps' : 'unavailable',
      warning: geo.parallaxApplied ? null : '未做日心→地心转换，视差可达 3.8°（需传 eclipticLonOf）',
    },
  };
}
