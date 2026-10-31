// 性能修复：页面不可见时完全停止渲染 + 限制到 30fps
// 根因：fusion3d 与 stage 两个 rAF 循环无条件常驻 60fps，即使不在对应页面
import fs from 'node:fs';

/* ══════════ ① fusion3d.js ══════════ */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');
let changed = [];

// 1) 模块级状态
if (!s.includes('let _hostEl')) {
  s = s.replace(
    'let _paused = false;',
    `let _paused = false;
// ★ PERF：宿主元素与帧节流
let _hostEl = null;
let _lastT = 0;
const FRAME_MS = 33;          // ≈30fps，足够顺滑且省一半算力`
  );
  changed.push('模块状态');
}

// 2) mount 时记录宿主
if (!s.includes('_hostEl = el;')) {
  s = s.replace(
    'export function mountFusion3D(el, data) {\n  if (!el) return;',
    'export function mountFusion3D(el, data) {\n  if (!el) return;\n  _hostEl = el;   // ★ PERF：用于可见性判断'
  );
  changed.push('记录宿主');
}

// 3) _drawBody 开头加可见性 + 节流守卫
if (!s.includes('PERF-GUARD')) {
  s = s.replace(
    'function _drawBody() {\n  if (!ctx) return;\n  if (_paused) return;',
    `function _drawBody() {
  if (!ctx) return;
  if (_paused) return;

  /* ★ PERF-GUARD：不可见就不画（切页 / 滚出视口 / 被隐藏）*/
  if (!_hostEl || !_hostEl.isConnected) return;
  if (_hostEl.offsetParent === null) return;            // 所在 page 非 active，或被 display:none
  const _rc = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
  if (_rc && (_rc.width === 0 || _rc.bottom < -80 || _rc.top > window.innerHeight + 80)) return;
  /* ★ 帧节流到 ~30fps */
  const _now = performance.now();
  if (_now - _lastT < FRAME_MS) return;
  _lastT = _now;`
  );
  changed.push('可见性守卫+节流');
}

fs.writeFileSync('web/fusion3d.js', s, 'utf8');

/* ══════════ ② stage.js（hero 圆盘）══════════ */
let st = fs.readFileSync('web/stage.js', 'utf8');

if (!st.includes('PERF-GUARD')) {
  // 找到 draw 函数体开头（兼容几种写法）
  const patterns = [
    ['function draw() {\n  if (!ctx) return;', 'function draw() {\n  if (!ctx) return;\n  /* ★ PERF-GUARD：hero 隐藏时不画 */\n  if (_heroEl && _heroEl.offsetParent === null) { requestAnimationFrame(draw); return; }\n  if (_pausedFrame) { requestAnimationFrame(draw); return; }'],
    ['function frame() {\n  if (!ctx) return;', 'function frame() {\n  if (!ctx) return;\n  /* ★ PERF-GUARD */\n  if (_heroEl && _heroEl.offsetParent === null) { requestAnimationFrame(frame); return; }\n  if (_pausedFrame) { requestAnimationFrame(frame); return; }'],
  ];
  let hit = false;
  for (const [from, to] of patterns) {
    if (st.includes(from)) { st = st.replace(from, to); hit = true; break; }
  }
  if (hit) {
    // 加模块级变量（放在第一个 requestAnimationFrame 之前）
    if (!st.includes('let _heroEl')) {
      st = st.replace('requestAnimationFrame(', 'let _heroEl = document.querySelector("#stage-hero");\nlet _pausedFrame = false;\ndocument.addEventListener("visibilitychange", () => { _pausedFrame = document.hidden; });\n\nrequestAnimationFrame(');
    }
    changed.push('stage hero 守卫');
  } else {
    changed.push('⚠️ stage draw 锚点未匹配（跳过）');
  }
}

fs.writeFileSync('web/stage.js', st, 'utf8');

console.log('改动：', changed.join(' / '));

/* ══════════ 校验 ══════════ */
const f2 = fs.readFileSync('web/fusion3d.js', 'utf8');
const st2 = fs.readFileSync('web/stage.js', 'utf8');
const checks = [
  ['fusion3d 有 _hostEl', f2.includes('let _hostEl')],
  ['fusion3d 有 PERF-GUARD', f2.includes('PERF-GUARD')],
  ['fusion3d 有帧节流', f2.includes('FRAME_MS')],
  ['stage 有 _heroEl 或已跳过', st2.includes('_heroEl') || changed.some((c) => c.includes('跳过'))],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '⚠️', k); if (!v) bad++; }
