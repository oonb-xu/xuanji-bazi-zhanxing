// 紧急：自动降频保护 + 默认关闭自转 + 提供 ?off=1 关闭全部动画
// 目的：即使某台机器渲染很慢，也不会把主线程占满导致"点不动"
import fs from 'node:fs';

/* ══════════ ① fusion3d：自适应帧率 + 关闭默认自转 ══════════ */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');
let changed = [];

// 1) 自适应降频：帧耗时过长就自动降档
if (!s.includes('AUTO-DEGRADE')) {
  s = s.replace(
    'const FRAME_MS = 33;          // ≈30fps，足够顺滑且省一半算力',
    `/* ★ AUTO-DEGRADE：帧耗时过长就自动降频，避免主线程被占满导致"点不动" */
let _frameBudget = 33;        // 初始 30fps
let _slowStreak = 0;
const _forcedOff = /[?&]off=1/.test(location.search);`
  );
  s = s.replace(
    `  /* ★ 帧节流到 ~30fps */
  const _now = performance.now();
  if (_now - _lastT < FRAME_MS) return;
  _lastT = _now;`,
    `  /* ★ 帧节流（自适应）*/
  const _now = performance.now();
  if (_now - _lastT < _frameBudget) return;
  const _dt = _now - _lastT;
  _lastT = _now;

  /* ★ AUTO-DEGRADE：连续慢帧就降档，最快降到 8fps */
  if (_dt > 100) { _slowStreak++; } else { _slowStreak = Math.max(0, _slowStreak - 1); }
  if (_slowStreak > 8 && _frameBudget < 125) {
    _frameBudget = Math.min(125, _frameBudget * 1.6);
    _slowStreak = 0;
    try { console.info('[fusion3d] 渲染偏慢，自动降频到 ' + Math.round(1000 / _frameBudget) + 'fps'); } catch (e) {}
  }`
  );
  changed.push('自适应降频');
}

// 2) 默认不自转（省算力；用户需要时再点「自转」）
s = s.replace(
  'const cam = { yaw: 0.6, pitch: 0.46, dist: 2.05, fov: 62 * D2R, spin: true, look: { x: 0, y: 0, z: 0 } };',
  'const cam = { yaw: 0.6, pitch: 0.46, dist: 2.05, fov: 62 * D2R, spin: false, look: { x: 0, y: 0, z: 0 } };   // ★ 默认不自转（省算力）'
);

// 3) ?off=1 彻底停掉动画循环
if (!s.includes('_forcedOff)) return;')) {
  s = s.replace(
    'function _drawBody() {\n  if (!ctx) return;\n  if (_paused) return;',
    'function _drawBody() {\n  if (!ctx) return;\n  if (_forcedOff) return;   // ?off=1 关闭动画\n  if (_paused) return;'
  );
  changed.push('?off=1 开关');
}

fs.writeFileSync('web/fusion3d.js', s, 'utf8');

/* ══════════ ② stage.js（hero）：默认不自转 ══════════ */
let st = fs.readFileSync('web/stage.js', 'utf8');
st = st.replace('spin: true', 'spin: false');
st = st.replace(
  'let _heroEl = document.querySelector("#stage-hero");',
  'let _heroEl = document.querySelector("#stage-hero");\nconst _forcedOffStage = /[?&]off=1/.test(location.search);'
);
st = st.replace(
  'if (_heroEl && _heroEl.offsetParent === null) { requestAnimationFrame(draw); return; }',
  'if (_forcedOffStage) return;\n  if (_heroEl && _heroEl.offsetParent === null) { requestAnimationFrame(draw); return; }'
);
fs.writeFileSync('web/stage.js', st, 'utf8');

console.log('改动：', changed.join(' / '));

/* ══════════ 校验 ══════════ */
const f = fs.readFileSync('web/fusion3d.js', 'utf8');
const g = fs.readFileSync('web/stage.js', 'utf8');
const checks = [
  ['自适应降频', f.includes('AUTO-DEGRADE') && f.includes('_frameBudget')],
  ['默认不自转', f.includes('spin: false')],
  ['?off=1 开关', f.includes('_forcedOff')],
  ['hero 默认不自转', /spin:\s*false/.test(g)],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
