#!/usr/bin/env node
// 用法：
//   node cli.mjs --at "2026-10-02 10:30" [--matter "问事业"] [--json out.json]
//   node cli.mjs --yuejiang 辰 --shichen 巳 --rizhi 己酉 [--daynight 昼]
import { writeFileSync } from 'node:fs';
import { compile } from './src/daliuren.mjs';
import { render } from './src/render.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};

const input = {
  at: arg('at'), matter: arg('matter'),
  yueJiang: arg('yuejiang'), shiChen: arg('shichen'), riGanZhi: arg('rizhi'), dayNight: arg('daynight'),
};

if (!input.at && !(input.yueJiang && input.shiChen && input.riGanZhi)) {
  console.error('需要 --at "YYYY-MM-DD HH:mm" 或 --yuejiang/--shichen/--rizhi');
  process.exit(2);
}

const r = compile(input);
const text = render(r);
console.log(text);
const out = arg('json');
if (out) { writeFileSync(out, JSON.stringify(r, null, 2), 'utf8'); console.error(`[IR 已写入] ${out}`); }
