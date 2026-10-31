// 修 stage.js 被破坏的 PERF-GUARD 段（声明被插进了 if 块内部）
import fs from 'node:fs';
let s = fs.readFileSync('web/stage.js', 'utf8');

const BROKEN = `function draw() {
  if (!ctx) return;
  /* ★ PERF-GUARD：hero 隐藏时不画 */
  if (_heroEl && _heroEl.offsetParent === null) { let _heroEl = document.querySelector("#stage-hero");
const _forcedOffStage = /[?&]off=1/.test(location.search);
let _pausedFrame = false;
document.addEventListener("visibilitychange", () => { _pausedFrame = document.hidden; });

requestAnimationFrame(draw); return; }
  if (_pausedFrame) { requestAnimationFrame(draw); return; }`;

const FIXED = `/* ★ PERF：hero 可见性 / 暂停 / 全局关闭 —— 必须在模块级声明 */
const _heroEl = document.querySelector("#stage-hero");
const _forcedOffStage = /[?&]off=1/.test(location.search);
let _pausedFrame = false;
document.addEventListener("visibilitychange", () => { _pausedFrame = document.hidden; });

function draw() {
  if (!ctx) return;
  /* ★ PERF-GUARD：关掉动画 / hero 隐藏 / 页面不可见 ⇒ 不画 */
  if (_forcedOffStage) return;
  if (_heroEl && _heroEl.offsetParent === null) { requestAnimationFrame(draw); return; }
  if (_pausedFrame) { requestAnimationFrame(draw); return; }`;

if (s.includes(BROKEN)) {
  s = s.replace(BROKEN, FIXED);
  fs.writeFileSync('web/stage.js', s, 'utf8');
  console.log('✅ stage.js PERF-GUARD 已修（声明提到模块级）');
} else if (s.includes('const _heroEl = document.querySelector("#stage-hero");')) {
  console.log('已修过');
} else {
  console.error('❌ 未匹配到损坏段，需人工检查');
  const i = s.indexOf('function draw()');
  console.log(JSON.stringify(s.slice(i, i + 420)));
  process.exit(1);
}

/* 校验：声明必须在 function draw 之前，且 draw 内不再有 let _heroEl */
const after = fs.readFileSync('web/stage.js', 'utf8');
const iDecl = after.indexOf('const _heroEl');
const iDraw = after.indexOf('function draw()');
const inDraw = after.slice(iDraw, iDraw + 800).includes('let _heroEl');
console.log('校验：');
console.log(' ', iDecl >= 0 && iDecl < iDraw ? '✅' : '❌', '声明在 draw 之前');
console.log(' ', !inDraw ? '✅' : '❌', 'draw 内无重复声明');
console.log(' ', after.includes('if (_forcedOffStage) return;') ? '✅' : '❌', 'off=1 开关存在');
