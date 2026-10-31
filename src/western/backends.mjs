// 西方星盘后端注册表 —— 双独立实现并存
//   mine       ：src/western/natal.mjs（astronomy-engine 血统；porphyry/equal/whole）
//   kerykeion  ：py/kerykeion_chart.py 桥接（libephemeris / Swiss Ephemeris 血统；Placidus）
// 两者输出**同一 schema**，下游（Part5/6/8、样本采集）只认这一个形状。
// 设计裁定 R-W10/R-W11：不追求逐宫一致，只要求「星体黄经一致 + 四轴一致 + 各制不变量成立」。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeNatal } from './natal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJ = resolve(HERE, '../..');
export const PY = join(PROJ, '.venv', 'Scripts', 'python.exe');
export const BRIDGE = join(PROJ, 'py', 'kerykeion_chart.py');
const TMP = join(PROJ, '.tmp');

export const BACKENDS = ['mine', 'kerykeion'];
export const PRIMARY_BACKEND = 'mine';        // R-W12：主后端

/** kerykeion 后端是否可用（venv + 桥接脚本都在） */
export const hasKerykeion = () => existsSync(PY) && existsSync(BRIDGE);

const angDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** 统一入口：后端名 + 出生参数 → 统一 schema 星盘 */
export function computeChart(backend, input) {
  if (backend === 'mine') {
    const n = computeNatal({ ...input, houseSystem: input.houseSystem ?? 'porphyry' });
    return { backend: 'mine', planets: n.planets, aspects: n.aspects.map(({ a, b, type, orb }) => ({ a, b, type, orb })), angles: n.angles, anglesRaw: n.anglesRaw, cusps: n.cusps, meta: { ...n.meta, houseSystem: n.meta.houseSystem, source: 'astronomy-engine' } };
  }
  if (backend === 'kerykeion') {
    if (!hasKerykeion()) throw new Error('kerykeion 后端不可用：缺少 .venv 或 py/kerykeion_chart.py');
    // 时区：优先 IANA 名；只有数值时差时用 Etc/GMT∓n（**符号是反的**：Etc/GMT-8 = UTC+8）；
    // 半时区（如 +5:30）无法用 Etc/GMT 表达 → 明确报错，绝不默认成 Asia/Shanghai（那会静默算错时间）
    let tz = input.tzName;
    if (!tz) {
      const off = input.tz;
      if (typeof off !== 'number') throw new Error('kerykeion 需要 tzName 或数值 tz');
      if (!Number.isInteger(off)) throw new Error(`kerykeion 无法表达非整点时差 ${off}h（需 IANA 时区名）`);
      tz = `Etc/GMT${off >= 0 ? '-' : '+'}${Math.abs(off)}`;
    }
    const [d, hm] = String(input.at).split(' ');
    const [Y, Mo, D] = d.split('-').map(Number);
    const [H, Mi] = (hm ?? '12:00').split(':').map(Number);
    mkdirSync(TMP, { recursive: true });
    const out = join(TMP, `be-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`);
    try {
      execFileSync(PY, [BRIDGE, '--name', input.name ?? 'chart', '--year', String(Y), '--month', String(Mo), '--day', String(D),
        '--hour', String(H), '--minute', String(Mi), '--lng', String(input.lon ?? input.lng), '--lat', String(input.lat),
        '--tz', tz, '--houses-system', input.kerykeionHouses ?? 'P', '--json', out],
      { stdio: ['ignore', 'ignore', 'pipe'], timeout: 300000, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', LIBEPHEMERIS_DATA_DIR: process.env.LIBEPHEMERIS_DATA_DIR ?? join(PROJ, '.ephemeris') } });
      const j = JSON.parse(readFileSync(out, 'utf8'));
      return { backend: 'kerykeion', planets: j.planets, aspects: j.aspects, angles: j.angles, cusps: j.cusps, meta: { ...j.meta, source: 'libephemeris' }, skippedAspectBodies: j.skippedAspectBodies };
    } finally { rmSync(out, { force: true }); }
  }
  throw new Error(`未知星盘后端：${backend}（可选 ${BACKENDS.join('/')}）`);
}

const BODIES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
export const HARD_ASPECTS = new Set(['对冲', '四分相', '梅花相']);

/**
 * 双盘采集 + 一致性核验
 * @returns {{mine, kerykeion, consistency, ok}}
 */
export function computeDual(input, { orb = 12 } = {}) {
  const mine = computeChart('mine', { ...input, orb: input.orb ?? 6 });
  let kerykeion = null, keryErr = null;
  if (hasKerykeion()) {
    try { kerykeion = computeChart('kerykeion', input); } catch (e) { keryErr = `${e.name}: ${e.message}`.slice(0, 200); }
  } else keryErr = 'kerykeion 后端未安装（.venv 缺失）';

  let consistency = null;
  if (kerykeion) {
    const perBody = BODIES.map((b) => ({
      body: b,
      mineLon: mine.planets[b]?.lon ?? null, keryLon: kerykeion.planets[b]?.lon ?? null,
      deltas: (mine.planets[b]?.lon != null && kerykeion.planets[b]?.lon != null) ? Math.round(angDiff(mine.planets[b].lon, kerykeion.planets[b].lon) * 10000) / 10000 : null,
      signMatch: mine.planets[b]?.sign === kerykeion.planets[b]?.sign,
    }));
    const angles = {
      asc: Math.round(angDiff(mine.angles.asc, kerykeion.angles.asc) * 10000) / 10000,
      mc: Math.round(angDiff(mine.angles.mc, kerykeion.angles.mc) * 10000) / 10000,
    };
    const key = (a) => `${[a.a, a.b].sort().join('|')}|${a.type}`;
    const mineWide = new Set(computeChart('mine', { ...input, orb }).aspects.map(key));
    const kHard = kerykeion.aspects.filter((a) => HARD_ASPECTS.has(a.type));
    const covered = kHard.filter((a) => mineWide.has(key(a)));
    const maxBodyDelta = Math.max(...perBody.map((x) => x.deltas ?? 0));
    consistency = {
      perBody,
      angles,
      maxBodyDelta,
      aspect: { kerykeion: kHard.length, covered: covered.length, rate: kHard.length ? covered.length / kHard.length : 1, missing: kHard.filter((a) => !mineWide.has(key(a))).map((a) => `${a.a}${a.type}${a.b}`) },
      thresholds: { bodyDelta: 0.05, angleDelta: 0.15, aspectRate: 0.8 },
    };
    consistency.pass = maxBodyDelta <= 0.05 && angles.asc <= 0.15 && angles.mc <= 0.15 && consistency.aspect.rate >= 0.8
      && perBody.every((x) => x.signMatch !== false);
  }
  return { mine, kerykeion, consistency, keryErr, ok: !kerykeion ? null : consistency.pass };
}

export { angDiff };
