// 修：fit() 每帧改 canvas 尺寸会清空 WebGL 缓冲 + ResizeObserver 反复触发
import fs from 'node:fs';

/* ① gl-planets.js：resizeGL 同尺寸跳过 + preserveDrawingBuffer */
let g = fs.readFileSync('web/gl-planets.js', 'utf8');
g = g.replace(
  `export function resizeGL(canvas, w, h) {
  if (!gl) return;
  canvas.width = w; canvas.height = h;
  gl.viewport(0, 0, w, h); W = w; H = h;
}`,
  `export function resizeGL(canvas, w, h) {
  if (!gl) return;
  // ★ 尺寸没变就不动（改 canvas.width 会清空 WebGL 缓冲）
  if (canvas.width === w && canvas.height === h && W === w && H === h) return;
  canvas.width = w; canvas.height = h;
  gl.viewport(0, 0, w, h); W = w; H = h;
}`
);
g = g.replace(
  `  const g = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false })
    || canvas.getContext('experimental-webgl', { alpha: true, antialias: true });`,
  `  const g = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true })
    || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });`
);
fs.writeFileSync('web/gl-planets.js', g, 'utf8');
console.log('① gl-planets.js 已修（同尺寸跳过 + preserveDrawingBuffer）');

/* ② fusion3d.js：fit() 只在尺寸真变化时才动 */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');
s = s.replace(
  `  function fit() {
    const r = el.getBoundingClientRect();
    W = Math.max(360, r.width); H = Math.max(380, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);`,
  `  function fit() {
    const r = el.getBoundingClientRect();
    const nW = Math.max(360, r.width), nH = Math.max(380, r.height);
    // ★ 尺寸没变 ⇒ 直接返回（避免每帧清空 WebGL 缓冲）
    if (W === nW && H === nH && cv.width > 0) return;
    W = nW; H = nH;
    DPR = Math.min(window.devicePixelRatio || 1, 2);`
);
fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('② fusion3d.js fit() 已加尺寸守卫');

/* ③ 暴露调试信息 */
s = fs.readFileSync('web/fusion3d.js', 'utf8');
if (!s.includes('__glDebug')) {
  s = s.replace(
    `      drawPlanet({ x: q.x, y: q.y }, q.r, tex, [0.8, 0.8, 0.8], q.spin, q.light, q.name === '太阳' ? 1.5 : 1);
    }
    glDrawQueue.length = 0;`,
    `      drawPlanet({ x: q.x, y: q.y }, q.r, tex, [0.8, 0.8, 0.8], q.spin, q.light, q.name === '太阳' ? 1.5 : 1);
    }
    window.__glDebug = { n: glDrawQueue.length, last: glDrawQueue[0], tex: Object.keys(TEX_CACHE) };
    glDrawQueue.length = 0;`
  );
  fs.writeFileSync('web/fusion3d.js', s, 'utf8');
  console.log('③ 调试钩子已加');
}
