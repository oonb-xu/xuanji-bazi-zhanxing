#!/usr/bin/env node
// 本命盘生成器 CLI：出生时间 + 经纬度 → 星盘 JSON（Part5/Part6 的标准输入）
//   node cli-natal.mjs --at "1990-05-20 14:30" --lat 39.9 --lon 116.4 --tz 8
//   node cli-natal.mjs --at … --house-system equal --orb 6 --json out.json
import { writeFileSync } from 'node:fs';
import { computeNatal, renderNatal, HOUSE_SYSTEMS } from './src/western/natal.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

const at = arg('at');
if (!at) { console.error('需要 --at "YYYY-MM-DD HH:mm"'); process.exit(2); }
const n = computeNatal({
  at,
  lat: arg('lat') !== null ? Number(arg('lat')) : undefined,
  lon: arg('lon') !== null ? Number(arg('lon')) : undefined,
  tz: arg('tz') !== null ? Number(arg('tz')) : undefined,
  houseSystem: arg('house-system', 'porphyry'),
  orb: arg('orb') !== null ? Number(arg('orb')) : undefined,
});
console.log(renderNatal(n));
console.log(`\n宫位制可选：${HOUSE_SYSTEMS.join(' | ')}`);
const out = arg('json');
if (out) {
  writeFileSync(out, JSON.stringify({ planets: n.planets, aspects: n.aspects.map(({ a, b, type }) => ({ a, b, type })), _angles: n.angles, _cusps: n.cusps, _meta: n.meta, _full: n }, null, 2), 'utf8');
  console.error(`[星盘已写入] ${out}`);
}
