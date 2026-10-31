// kerykeion 交叉验证：把 kerykeion（Swiss Ephemeris 血统）与本引擎 src/western/natal.mjs 对拍
// 环境缺失时**优雅跳过**（exit 0 + SKIP），保证 `npm test` 在无 Python 的机器上仍绿。
// 对拍口径：
//   · 星体黄经 —— 与宫位制无关，直接比（容差 0.05°）
//   · 星座名   —— 必须完全相同
//   · 上升/天顶 —— 球面公式，容差 0.15°
//   · 宫位     —— **不直接比**（kerykeion 默认 Placidus，本引擎默认 porphyry），只比「上升/天顶/宫头递增」等不变量
//   · 相位     —— 比硬相位（对冲/四分相/梅花相）集合的交集率
import { execFileSync } from 'node:child_process';
import { F } from './_fixtures.mjs';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeNatal } from '../src/western/natal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = resolve(HERE, '..');
const PY = join(PROJ, '.venv', 'Scripts', 'python.exe');
const BRIDGE = join(PROJ, 'py', 'kerykeion_chart.py');
// 注意：本机沙箱下 **Python 子进程不能写系统 %TEMP%**（PermissionError 13），
// 临时产物一律落在工程内的 .tmp/
const TMP = join(PROJ, '.tmp');

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const angDiff = (a, b) => {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
};
/** 时区：优先用 IANA 名（kerykeion 需要地区库）；偏移量兜底用 Etc/GMT∓n（注意符号是反的） */
const TZ_OF = { 8: 'Asia/Shanghai', 9: 'Asia/Tokyo', 0: 'UTC', '-5': 'America/New_York' };
const tzName = (off) => TZ_OF[off] ?? `Etc/GMT${off >= 0 ? '-' : '+'}${Math.abs(off)}`;

if (!existsSync(PY) || !existsSync(BRIDGE)) {
  console.log('[kerykeion] SKIP：未找到 .venv 或桥接脚本。');
  console.log('  安装：python -m venv .venv && .venv/Scripts/python -m pip install kerykeion');
  console.log(fails === 0 ? '\nRESULT: PASS (skipped)' : `\nRESULT: FAIL (${fails})`);
  process.exit(0);
}

/** 调用桥接脚本，拿回本引擎 schema 的星盘 */
function kerykeionChart({ name, at, lng, lat, tz = 8, houses = 'P' }) {
  const [d, hm] = String(at).split(' ');
  const [Y, Mo, D] = d.split('-').map(Number);
  const [H, Mi] = (hm ?? '12:00').split(':').map(Number);
  mkdirSync(TMP, { recursive: true });
  const out = join(TMP, `kery-${name}-${houses}-${Date.now()}.json`);
  try {
    execFileSync(PY, [BRIDGE, '--name', name, '--year', String(Y), '--month', String(Mo), '--day', String(D),
      '--hour', String(H), '--minute', String(Mi), '--lng', String(lng), '--lat', String(lat),
      '--tz', tzName(tz), '--houses-system', houses, '--json', out],
    { stdio: ['ignore', 'ignore', 'pipe'], timeout: 300000, encoding: 'utf8' });
    return JSON.parse(readFileSync(out, 'utf8'));
  } catch (e) {
    fails++;
    console.log(`  x 桥接失败（${name}/house=${houses}）：${String(e.stderr ?? e.message).split('\n').filter((l) => /Error|error/.test(l)).slice(-2).join(' | ')}`);
    return { planets: {}, aspects: [], angles: {}, cusps: [], meta: {} };
  } finally { rmSync(out, { force: true }); }
}

const CASES = [
  { name: '案例001', at: F.T7, lng: 104.06, lat: 30.67, tz: 8 },   // 用户给的案例（成都）
  { name: '1990上海', at: '1990-05-20 14:30', lng: 121.47, lat: 31.23, tz: 8 },  // ★ 中国 1986–91 夏令时
  { name: '新月', at: '2024-01-11 19:57', lng: 116.4, lat: 39.9, tz: 8 },        // 新月（日月合相）
];

console.log('[kerykeion] 版本与后端');
const first = kerykeionChart(CASES[0]);
console.log(`  kerykeion ${first.kerykeionVersion}｜${first.meta.housesSystem}｜${first.meta.zodiacType}｜JD ${first.meta.julianDay}`);
ok(first.planets['太阳'].sign === '摩羯', `案例001 太阳应为摩羯，实得 ${first.planets['太阳'].sign}`);
ok(first.planets['太阳'].house === 7, `案例001 太阳应在 7 宫，实得 ${first.planets['太阳'].house}`);
ok(first.planets['月亮'].sign === '巨蟹', `案例001 月亮应为巨蟹，实得 ${first.planets['月亮'].sign}`);

console.log('[kerykeion] 逐体黄经 / 四轴 vs 本引擎（星体容差 0.05°、四轴 0.15°）');
const BODIES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
for (const c of CASES) {
  const K = kerykeionChart(c);
  // ★ 关键：把我的引擎也切到 IANA 时区名，两边都用历史真实规则（含 DST）
  const M = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: c.tz, tzName: tzName(c.tz), houseSystem: 'porphyry' });
  ok(K.meta.utc.slice(0, 19) === M.meta.utc.slice(0, 19), `${c.name} UTC 不一致：kerykeion=${K.meta.utc} 本引擎=${M.meta.utc}`);
  const deltas = [];
  for (const b of BODIES) {
    const k = K.planets[b], m = M.planets[b];
    ok(!!k && !!m, `${c.name} ${b} 缺失`);
    if (!k || !m) continue;
    const d = angDiff(k.lon, m.lon);
    deltas.push(d);
    ok(k.sign === m.sign, `${c.name} ${b} 星座不一致：kerykeion=${k.sign} 本引擎=${m.sign}（Δ${d.toFixed(3)}°）`);
    ok(d < 0.05, `${c.name} ${b} 黄经差 ${d.toFixed(3)}° ≥ 0.05°`);
  }
  const ascD = angDiff(K.angles.asc, M.angles.asc);
  const mcD = angDiff(K.angles.mc, M.angles.mc);
  ok(ascD < 0.15, `${c.name} 上升差 ${ascD.toFixed(3)}°`);
  ok(mcD < 0.15, `${c.name} 天顶差 ${mcD.toFixed(3)}°`);
  console.log(`  ${c.name}：UTC ${M.meta.utc.slice(11, 16)}｜星体最大 Δ${Math.max(...deltas).toFixed(4)}°｜上升 Δ${ascD.toFixed(4)}°｜天顶 Δ${mcD.toFixed(4)}°`);
}

console.log('[kerykeion] 相位：kerykeion 的硬相位应被本引擎全部覆盖');
// 两边默认容许度不同（kerykeion 偏宽），故比较时把本引擎放到 orb=12 覆盖其口径，
// 检验的是**相位类型判定**而不是容许度策略；orb 差异本身作为设计差异单独列出。
for (const c of CASES) {
  const K = kerykeionChart(c);
  const M = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: c.tz, tzName: tzName(c.tz), orb: 12 });
  const Mstrict = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: c.tz, tzName: tzName(c.tz), orb: 6 });
  const key = (a) => `${[a.a, a.b].sort().join('|')}|${a.type}`;
  const HARD = new Set(['对冲', '四分相', '梅花相']);
  const ks = K.aspects.filter((a) => HARD.has(a.type));
  const msWide = new Set(M.aspects.map(key));
  const covered = ks.filter((a) => msWide.has(key(a)));
  const rate = ks.length ? covered.length / ks.length : 1;
  ok(rate >= 0.8, `${c.name} 覆盖率 ${(rate * 100).toFixed(0)}% < 80%（未覆盖：${ks.filter((a) => !msWide.has(key(a))).map((a) => `${a.a}${a.type}${a.b}`).join('、')}）`);
  console.log(`  ${c.name}：kerykeion 硬相位 ${ks.length} 条 → 本引擎(orb12) 覆盖 ${covered.length}（${(rate * 100).toFixed(0)}%）｜本引擎 orb6 检出 ${Mstrict.aspects.filter((a) => HARD.has(a.type)).length} 条`);
}

console.log('[kerykeion] 宫位不可比性说明（设计差异，不算失败）');
const Kp = kerykeionChart(CASES[0], 'P');
const Ke = kerykeionChart(CASES[0], 'A');
console.log(`  Placidus 1宫头 ${Kp.cusps[0].toFixed(2)}° / 10宫头 ${Kp.cusps[9].toFixed(2)}°`);
console.log(`  Equal    1宫头 ${Ke.cusps[0].toFixed(2)}° / 10宫头 ${Ke.cusps[9].toFixed(2)}°`);
ok(Math.abs(Kp.cusps[0] - Ke.cusps[0]) < 1e-6, '两制上升点应相同');
const M0 = computeNatal({ at: CASES[0].at, lng: CASES[0].lng, lat: CASES[0].lat, tz: CASES[0].tz, houseSystem: 'porphyry' });
ok(angDiff(M0.cuspsRaw[0], Kp.cusps[0]) < 0.15, 'porphyry 1宫头应等于 kerykeion 上升');
ok(angDiff(M0.cuspsRaw[9], Kp.cusps[9]) < 0.15, 'porphyry 10宫头应等于 kerykeion 天顶（10宫头）');
console.log(`  本引擎 porphyry 1宫头 ${M0.cuspsRaw[0].toFixed(2)}° / 10宫头 ${M0.cuspsRaw[9].toFixed(2)}° → 与 kerykeion 四轴一致，宫内有口径差`);

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
