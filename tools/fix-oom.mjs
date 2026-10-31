// 修 OOM：fit() 小数尺寸导致每帧重建 canvas；并堵住其它无界增长
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (s.includes('OOM-GUARD')) { console.log('已修'); process.exit(0); }

/* ① fit()：尺寸取整 + 严格守卫 + 内存守卫 */
s = s.replace(
  `  function fit() {
    const r = el.getBoundingClientRect();
    const nW = Math.max(360, r.width), nH = Math.max(380, r.height);
    // ★ 尺寸没变 ⇒ 直接返回（避免每帧清空 WebGL 缓冲）
    if (W === nW && H === nH && cv.width > 0) return;
    W = nW; H = nH;
    DPR = Math.min(window.devicePixelRatio || 1, 2);`,
  `  function fit() {
    const r = el.getBoundingClientRect();
    // ★ OOM-GUARD：必须取整！小数会让"尺寸未变"判断永远为假，导致每帧重建 canvas 直至 OOM
    const nW = Math.max(360, Math.round(r.width));
    const nH = Math.max(380, Math.round(r.height));
    if (W === nW && H === nH && cv.width > 0) return;
    W = nW; H = nH;
    DPR = Math.min(window.devicePixelRatio || 1, 2);`
);

/* ② canvas 尺寸也用整数 */
s = s.replace(
  "    cv.width = W * DPR; cv.height = H * DPR;",
  "    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);"
);

/* ③ GL 队列：无论 GL 是否可用都必须清空（否则无界增长） */
s = s.replace(
  `  if (window.__glPlanets && glDrawQueue.length) {`,
  `  if (glDrawQueue.length > 64) glDrawQueue.length = 0;   // 兜底，防无界增长
  if (window.__glPlanets && glDrawQueue.length) {`
);
s = s.replace(
  `    window.__glDebug = { n: glDrawQueue.length, last: glDrawQueue[0], tex: Object.keys(TEX_CACHE) };
    glDrawQueue.length = 0;
  }`,
  `    window.__glDebug = { n: glDrawQueue.length, tex: Object.keys(TEX_CACHE) };
    }
  glDrawQueue.length = 0;   // ★ 无论是否绘制都清空`
);

/* ④ 单一计时器：重复挂载不再叠加 */
s = s.replace(
  "  setInterval(() => { if (cam.spin && !drag && !flyT) cam.yaw += 0.0016; }, 30);",
  `  if (window.__fwSpinTimer) clearInterval(window.__fwSpinTimer);
  window.__fwSpinTimer = setInterval(() => { if (cam.spin && !drag && !flyT) cam.yaw += 0.0016; }, 30);`
);

/* ⑤ 单一 rAF：重复挂载先取消旧的 */
s = s.replace(
  "  requestAnimationFrame(draw);\n  if (window.__fwSpinTimer)",
  `  if (window.__fwRAF) cancelAnimationFrame(window.__fwRAF);
  window.__fwRAF = requestAnimationFrame(draw);
  if (window.__fwSpinTimer)`
);
s = s.replace(
  `  }
  requestAnimationFrame(draw);
}`,
  `  }
  window.__fwRAF = requestAnimationFrame(draw);
}`
);

/* ⑥ 页面隐藏时暂停渲染（省内存/省电） */
s = s.replace(
  "  requestAnimationFrame(draw);\n  setInterval",
  "  requestAnimationFrame(draw);\n  setInterval"
);
if (!s.includes('visibilitychange')) {
  s = s.replace(
    "/* ══════════ 对外挂载 ══════════ */",
    `/* ══════════ 对外挂载 ══════════ */
let _paused = false;
document.addEventListener('visibilitychange', () => { _paused = document.hidden; });`
  );
  s = s.replace(
    "function _drawBody() {\n  if (!ctx) return;",
    "function _drawBody() {\n  if (!ctx) return;\n  if (_paused) return;"
  );
}

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('✅ OOM 修复已应用');
