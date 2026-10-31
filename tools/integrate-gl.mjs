// 集成 WebGL 球体层 + 点击飞向行星（相机 look 目标 + 动画）
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (s.includes('gl-planets')) { console.log('已集成'); process.exit(0); }

/* ① import */
s = s.replace(
  "import { STARS } from '/stars.js';",
  "import { STARS } from '/stars.js';\nimport { initGL, resizeGL, clearGL, loadTexture, drawPlanet } from '/gl-planets.js';"
);

/* ② 纹理表 */
s = s.replace(
  "const PLANET_TG = {",
  `// 真实行星贴图（solarsystemscope 2K → 压缩至 1024×512）
const PLANET_TEX = {
  太阳: '/textures/太阳.jpg', 月亮: '/textures/月亮.jpg', 水星: '/textures/水星.jpg',
  金星: '/textures/金星.jpg', 火星: '/textures/火星.jpg', 木星: '/textures/木星.jpg',
  土星: '/textures/土星.jpg', 天王星: '/textures/天王星.jpg', 海王星: '/textures/海王星.jpg',
};

const PLANET_TG = {`
);

/* ③ 相机加 look 目标 */
s = s.replace(
  "const cam = { yaw: 0.6, pitch: 0.46, dist: 2.05, fov: 62 * D2R, spin: true };",
  "const cam = { yaw: 0.6, pitch: 0.46, dist: 2.05, fov: 62 * D2R, spin: true, look: { x: 0, y: 0, z: 0 } };"
);

/* ④ toCam 减去 look */
s = s.replace(
  `function toCam(p) {
  let { x, y, z } = p;`,
  `function toCam(p) {
  let { x, y, z } = { x: p.x - cam.look.x, y: p.y - cam.look.y, z: p.z - cam.look.z };`
);

/* ⑤ 挂载时创建 GL 层 */
s = s.replace(
  `export function mountFusion3D(el, data) {
  if (!el) return;
  cv = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
  ctx = cv.getContext('2d');`,
  `export function mountFusion3D(el, data) {
  if (!el) return;
  cv = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
  ctx = cv.getContext('2d');

  // ★ WebGL 行星层（叠在 2D 画布之上，只画球体）
  let glCv = el.querySelector('canvas.gl');
  if (!glCv) {
    glCv = document.createElement('canvas');
    glCv.className = 'gl';
    glCv.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none';
    el.appendChild(glCv);
  }
  cv.style.position = 'absolute'; cv.style.inset = '0'; cv.style.zIndex = '1';
  const glOK = initGL(glCv);
  glCv.__ok = glOK;
  if (glOK) {
    for (const [n, url] of Object.entries(PLANET_TEX)) loadTexture(url);
    console.log('[fusion3d] WebGL 行星层已启用');
  } else {
    console.warn('[fusion3d] WebGL 不可用，退回 2D 球体');
  }
  window.__glPlanets = glOK;`
);

/* ⑥ fit() 同步 GL 尺寸 */
s = s.replace(
  `    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);`,
  `    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = el.querySelector('canvas.gl');
    if (g && g.__ok) resizeGL(g, Math.round(W * DPR), Math.round(H * DPR));
    else if (g) { g.width = Math.round(W * DPR); g.height = Math.round(H * DPR); g.style.width = W + 'px'; g.style.height = H + 'px'; }`
);

/* ⑦ 每帧先清 GL */
s = s.replace(
  "  if (!DATA) { requestAnimationFrame(draw); return; }",
  `  if (window.__glPlanets) clearGL();
  if (!DATA) { requestAnimationFrame(draw); return; }`
);

/* ⑧ 行星绘制：优先走 WebGL，并把屏幕坐标记到 globalThis 供 GL 用 */
s = s.replace(
  `      if (st) {
        drawPlanetSphere(sc.x, sc.y, pr * (hot ? 1.10 : 1), st, Math.atan2(H / 2 - sc.y, W / 2 - sc.x), { alpha: 1 });
      } else {`,
  `      if (st) {
        const lightA = Math.atan2(H / 2 - sc.y, W / 2 - sc.x);
        if (window.__glPlanets && !pl.name.startsWith('冥') && !pl.name.startsWith('凯')) {
          // ★ WebGL 纹理球体
          glDrawQueue.push({ x: sc.x, y: sc.y, r: pr * (hot ? 1.12 : 1), name: pl.name, spin: (pl.lon / 40 + performance.now() / 9000) % (Math.PI * 2), light: lightA });
        } else {
          drawPlanetSphere(sc.x, sc.y, pr * (hot ? 1.10 : 1), st, lightA, { alpha: 1 });
        }
      } else {`
);

/* ⑨ 在 draw() 末尾把队列送去 GL */
s = s.replace(
  "  /* ── 状态提示 ── */",
  `  /* ── 把排好序的球体送给 WebGL（远到近） ── */
  if (window.__glPlanets && glDrawQueue.length) {
    glDrawQueue.sort((a, b) => a.depth - b.depth);
    for (const q of glDrawQueue) {
      const tex = TEX_CACHE[q.name];
      drawPlanet({ x: q.x, y: q.y }, q.r, tex, [0.8, 0.8, 0.8], q.spin, q.light, q.name === '太阳' ? 1.5 : 1);
    }
    glDrawQueue.length = 0;
  }

  /* ── 状态提示 ── */`
);

/* ⑩ 队列与纹理缓存 */
s = s.replace(
  "let hover = null, drag = false, lastX = 0, lastY = 0, flyT = 0;",
  `let hover = null, drag = false, lastX = 0, lastY = 0, flyT = 0;
const glDrawQueue = [];
const TEX_CACHE = {};
let flyAnim = null;`
);

/* ⑪ 纹理加载完成后填入缓存 */
s = s.replace(
  "    for (const [n, url] of Object.entries(PLANET_TEX)) loadTexture(url);",
  `    for (const [n, url] of Object.entries(PLANET_TEX)) {
      loadTexture(url).then((t) => { if (t) TEX_CACHE[n] = t; });
    }`
);

/* ⑫ ★ 点击行星 → 飞过去 */
s = s.replace(
  `      const h = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (h?.kind === 'planet') showPlanetPanel(el, h.pl);
      else { const p = el.querySelector('.planet-panel'); if (p) p.classList.remove('open'); }`,
  `      const h = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (h?.kind === 'planet') {
        showPlanetPanel(el, h.pl);
        flyToPlanet(h.pl);                       // ★ 相机拉近到该行星
      } else {
        const p = el.querySelector('.planet-panel');
        if (p) p.classList.remove('open');
      }`
);

/* ⑬ flyToPlanet 实现 */
s = s.replace(
  "/* ══════════ 交互 ══════════ */",
  `/** ★ 相机飞向某颗行星：把 look 移到它身上，并拉近 */
function flyToPlanet(pl) {
  if (typeof pl.lon !== 'number') return;
  const target = mul(eclToVec(pl.lon), PLANET_RING_R);
  const fromLook = { ...cam.look };
  const fromDist = cam.dist;
  const toDist = 0.30;            // 拉近到很近（球会占满画面）
  const t0 = performance.now();
  const DUR = 900;
  cam.spin = false;
  if (flyAnim) cancelAnimationFrame(flyAnim);
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / DUR);
    const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOutQuad
    cam.look.x = fromLook.x + (target.x - fromLook.x) * k;
    cam.look.y = fromLook.y + (target.y - fromLook.y) * k;
    cam.look.z = fromLook.z + (target.z - fromLook.z) * k;
    cam.dist = fromDist + (toDist - fromDist) * k;
    if (t < 1) flyAnim = requestAnimationFrame(step);
    else flyAnim = null;
  };
  flyAnim = requestAnimationFrame(step);
}

/* ══════════ 交互 ══════════ */`
);

/* ⑭ 复位按钮也复位 look */
s = s.replace(
  "else if (k === 'reset') { cam.yaw = 0.6; cam.pitch = 0.46; cam.dist = 2.05; }",
  "else if (k === 'reset') { cam.yaw = 0.6; cam.pitch = 0.46; cam.dist = 2.05; cam.look = { x: 0, y: 0, z: 0 }; if (flyAnim) { cancelAnimationFrame(flyAnim); flyAnim = null; } cam.spin = true; }"
);

/* ⑮ 命中检测：look 偏移下也准 */
s = s.replace(
  "    const s = proj(mul(eclToVec(pl.lon), PLANET_RING_R));",
  "    const s = proj(mul(eclToVec(pl.lon), PLANET_RING_R));"
);

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('WebGL 层 + 飞行动画已集成');
