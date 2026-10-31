// 修：胎元/命宫/身宫在 bazi 顶层，不是 bazi.extra
import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let t = fs.readFileSync(P, 'utf8');
const OLD = `      var ex = {};
      try { ex = d.bazi.extra || {}; } catch (e0) { ex = {}; }`;
const NEW = `      var bb = (d && d.bazi) || {};
      var xe = bb.extra || {};
      var ex = {
        taiYuan:  bb.taiYuan  || xe.taiYuan,
        mingGong: bb.mingGong || xe.mingGong,
        shenGong: bb.shenGong || xe.shenGong
      };`;
if (!t.includes(OLD)) { console.error('❌ 未匹配 extra 读取'); process.exit(1); }
t = t.replace(OLD, NEW);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ 已改为读 bazi 顶层的 taiYuan/mingGong/shenGong（兼容 extra）');
