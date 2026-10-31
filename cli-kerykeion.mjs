#!/usr/bin/env node
// kerykeion 后端 CLI：用 kerykeion 出盘 → 喂给本引擎的 Part5/6/8
//   node cli-kerykeion.mjs --at "2007-12-25 17:30" --lng 104.06 --lat 30.67 --tz Asia/Shanghai
//   node cli-kerykeion.mjs --at … --pillars "丁亥 壬子 癸巳 庚申" --report out.md --json out.json
// 说明：kerykeion 只做**星盘**；八字部分仍由本引擎计算（可 --pillars 显式给，或由 --at 反推四柱）。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileBazi } from './src/bazi/engine.mjs';
import { renderBazi } from './src/bazi/render.mjs';
import { calibrate, renderCalibration } from './src/cross/calibration.mjs';
import { friction, renderFriction } from './src/cross/friction.mjs';
import { runDbDiscovery, renderDbDiscovery } from './src/cross/db-discovery.mjs';
import { discover, renderDiscovery } from './src/cross/discovery.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, '.venv', 'Scripts', 'python.exe');
const BRIDGE = join(HERE, 'py', 'kerykeion_chart.py');
const TMP = join(HERE, '.tmp');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);

const at = arg('at');
if (!at) { console.error('需要 --at "YYYY-MM-DD HH:mm"'); process.exit(2); }
if (!existsSync(PY) || !existsSync(BRIDGE)) {
  console.error('未找到 kerykeion 环境。安装：\n  python -m venv .venv\n  .venv/Scripts/python -m pip install kerykeion');
  process.exit(3);
}

const [d, hm] = String(at).split(' ');
const [Y, Mo, D] = d.split('-').map(Number);
const [H, Mi] = (hm ?? '12:00').split(':').map(Number);
const lng = Number(arg('lng', 116.4074));
const lat = Number(arg('lat', 39.9042));
const tzName = arg('tz', 'Asia/Shanghai');
const houses = arg('houses-system', 'P');

mkdirSync(TMP, { recursive: true });
const chartPath = join(TMP, `kerykeion-${Date.now()}.json`);
try {
  execFileSync(PY, [BRIDGE, '--name', arg('name', 'chart'), '--year', String(Y), '--month', String(Mo), '--day', String(D),
    '--hour', String(H), '--minute', String(Mi), '--lng', String(lng), '--lat', String(lat),
    '--tz', tzName, '--houses-system', houses, '--json', chartPath],
  { stdio: ['ignore', 'ignore', 'inherit'], timeout: 300000, env: { ...process.env, PYTHONIOENCODING: 'utf-8', LIBEPHEMERIS_DATA_DIR: process.env.LIBEPHEMERIS_DATA_DIR ?? join(HERE, '.ephemeris') } });
} catch (e) { console.error(`kerykeion 桥接失败：${e.message}`); process.exit(3); }

const chart = JSON.parse(readFileSync(chartPath, 'utf8'));
rmSync(chartPath, { force: true });
const astro = { planets: chart.planets, aspects: chart.aspects.map(({ a, b, type }) => ({ a, b, type })) };

// 八字：显式给四柱，或由同一时刻反推
const pillarsArg = arg('pillars');
const bazi = pillarsArg
  ? compileBazi({ pillars: pillarsArg.split(/[\s,]+/).filter(Boolean) })
  : compileBazi({ at: at.replace('T', ' '), gender: arg('gender', '男') });
const chartId = `${bazi.pillars.join('')}-${chart.planets['太阳']?.sign ?? 'x'}-kery`;

const cal = calibrate(bazi, astro);
const fr = friction(bazi, astro);
const p8 = flag('no-kb') ? { skipped: true, reason: '--no-kb' }
  : runDbDiscovery({ bazi, astroInput: astro, frictionResult: fr, chartId, write: !flag('no-write') });
const d67 = discover({ bazi, astroInput: astro, friction: fr, write: false, chartId });

const out = [
  `# kerykeion 后端全链条 · ${chartId}`,
  `- kerykeion ${chart.kerykeionVersion}｜${chart.meta.housesSystem}(${chart.meta.housesSystemId})｜${chart.meta.zodiacType}｜UTC ${chart.meta.utc}`,
  `- 地点 ${chart.meta.lat}N ${chart.meta.lng}E｜时区 ${chart.meta.tz}｜JD ${chart.meta.julianDay}`,
  `- 上升 ${chart.planets['上升'].sign}${chart.planets['上升'].deg}°　天顶 ${chart.planets['天顶']?.sign ?? '—'}`,
  chart.meta.ephemerisWarnings ? `- ⚠ 星历告警：${JSON.stringify(chart.meta.ephemerisWarnings).slice(0, 300)}` : '',
  '',
  '| 天体 | 星座 | 度数 | 宫位 | 逆行 |', '|---|---|---|---|---|',
  ...Object.entries(chart.planets).map(([k, v]) => `| ${k} | ${v.sign} | ${v.deg}° | ${v.house ?? '—'} | ${v.retro ? 'R' : ''} |`),
  '',
  `## kerykeion 相位（${chart.aspects.length} 条，白名单内）`,
  chart.aspects.map((a) => `${a.a}${a.type}${a.b}${a.orb != null ? `(±${a.orb}°)` : ''}`).join('　'),
  Object.keys(chart.skippedAspectBodies ?? {}).length
    ? `\n> 已跳过本引擎不计算的天体：${Object.entries(chart.skippedAspectBodies).map(([k, v]) => `${k}×${v}`).join('、')}`
    : '',
  '', '---', '', renderBazi(bazi), renderCalibration(cal, bazi), renderFriction(fr, bazi),
  renderDiscovery(d67), renderDbDiscovery(p8),
].filter((x) => x !== '').join('\n');

console.log(out);
const md = arg('report');
if (md) { writeFileSync(md, out, 'utf8'); console.error(`[报告已写入] ${md}`); }
const j = arg('json');
if (j) { writeFileSync(j, JSON.stringify({ backend: 'kerykeion', chart, bazi: { pillars: bazi.pillars, verdict: bazi.L3_verdict, yongJi: bazi.L5_yongJi }, calibration: cal, friction: fr, part8: p8 }, null, 2), 'utf8'); console.error(`[IR 已写入] ${j}`); }
