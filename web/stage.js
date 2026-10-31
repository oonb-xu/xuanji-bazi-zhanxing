// 中西合璧圆盘 · 可交互 3D 舞台
//   外圈：十二地支（中国·金）
//   中圈：十二星座（西洋·青）
//   内环：行星位置（青点）
//   核心：太极 + 八卦
// 交互：拖拽旋转 / 鼠标视差倾斜 / 悬停显示中西对应 / 滚轮缩放
// 零依赖：Canvas 2D + CSS 3D

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const GUA = ['乾', '坎', '艮', '震', '巽', '离', '坤', '兑'];

// 六壬地盘口径：地支 i ↔ 黄经 270 + 30i（项目已机检 12/12 一致）
const zhiLon = (i) => (270 + 30 * i) % 360;
const signLon = (i) => i * 30;

// 行星黄经（由 app.js 在拿到星盘后注入）
let PLANETS = [];
export function setPlanets(list) {
  // list: [{name, lon, sign}] 或 apiNatal 的 planets 数组
  PLANETS = (list ?? [])
    .filter((p) => p && typeof p.lon === 'number' && p.name && !['上升', '天顶', '下降', '天底', '北交点', '南交点'].includes(p.name))
    .map((p) => ({ name: p.name, lon: ((p.lon % 360) + 360) % 360 }));
}

/* ══════════ 状态 ══════════ */
const state = {
  rot: 0,          // 圆盘自转角（弧度）
  tilt: 62,        // 倾斜角（度）—— 62° 接近参考里的俯视地面透视
  zoom: 1,
  spin: false,      // 自动缓慢旋转
  drag: false,
  lastX: 0, lastY: 0,
  hover: null,     // {kind:'zhi'|'sign'|'planet', i, name, lon}
  mouseX: 0, mouseY: 0,
};

let canvas = null, ctx = null, W = 0, H = 0, cx = 0, cy = 0, R = 0;

function fit() {
  const wrap = canvas?.parentElement;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  W = Math.max(320, rect.width);
  H = Math.max(360, rect.height);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2;
  cy = H / 2 + 26;
  R = Math.min(W, H) * 0.42 * state.zoom;
}

/* ══════════ 投影：极坐标 → 屏幕（带倾斜） ══════════ */
const tiltRad = () => (state.tilt * Math.PI) / 180;
function project(lonDeg, radius, extra = 0) {
  const a = ((lonDeg + state.rot) * Math.PI) / 180;
  const t = tiltRad();
  // 圆盘平面内的坐标
  const px = Math.cos(a) * (radius + extra);
  const py = Math.sin(a) * (radius + extra);
  // 绕 X 轴倾斜 → 后面的压扁
  const sy = py * Math.cos(t);
  const depth = py * Math.sin(t);          // 用于远近（越小越远）
  return { x: cx + px, y: cy + sy, depth };
}

/* ══════════ 绘制 ══════════ */
function drawGrid() {
  // ★ 深空：无网格、无星点，只保留一层极淡的中心辉光（背景渐变已由 CSS 提供）
  return;
  // 透视地面网格（模仿参考里的科技地面）
  ctx.save();
  const horizon = cy + R * 0.62;
  const lines = 14;
  ctx.strokeStyle = 'rgba(0,229,255,0.085)';
  ctx.lineWidth = 1;
  // 横向
  for (let i = 0; i <= lines; i++) {
    const f = i / lines;
    const y = horizon + Math.pow(f, 2.2) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 纵向（向消失点收拢）
  const vpx = cx, vpy = horizon - R * 0.35;
  for (let i = -lines; i <= lines; i++) {
    const x = cx + (i / lines) * W * 1.2;
    ctx.beginPath();
    ctx.moveTo(vpx, vpy);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();
}

function ring(radius, opts) {
  const { color, width = 1, dash = null, alpha = 1 } = opts;
  const t = tiltRad();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, Math.cos(t));
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke();
  ctx.restore();
}

function tick(lonDeg, r1, r2, color, w = 1, alpha = 1) {
  const t = tiltRad();
  const a = ((lonDeg + state.rot) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, Math.cos(t));
  ctx.beginPath();
  ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
  ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

function label(text, lonDeg, radius, opts) {
  const { color, size = 13, bold = false, alpha = 1 } = opts;
  const p = project(lonDeg, radius);
  // 远近：depth > 0 表示在"前面"，加亮
  const front = p.depth > 0;
  ctx.save();
  ctx.globalAlpha = alpha * (front ? 1 : 0.55);
  ctx.fillStyle = color;
  ctx.font = `${bold ? 700 : 500} ${size}px "Noto Sans SC", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = front ? 8 : 0;
  ctx.fillText(text, p.x, p.y);
  ctx.restore();
}

function taji(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, Math.cos(tiltRad()));
  // 外
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,14,20,0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,87,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  // 阴阳
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, -Math.PI / 2, Math.PI / 2);
  ctx.arc(0, r * 0.41, r * 0.41, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(0, -r * 0.41, r * 0.41, Math.PI / 2, -Math.PI / 2);
  ctx.fillStyle = 'rgba(255,196,87,0.22)'; ctx.fill();
  // 两个小点
  ctx.beginPath(); ctx.arc(0, -r * 0.41, r * 0.11, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,196,87,0.75)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, r * 0.41, r * 0.11, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,229,255,0.75)'; ctx.fill();
  ctx.restore();
}

/* ★ PERF：hero 可见性 / 暂停 / 全局关闭 —— 必须在模块级声明 */
const _heroEl = document.querySelector("#stage-hero");
const _forcedOffStage = /[?&]off=1/.test(location.search);
let _pausedFrame = false;
document.addEventListener("visibilitychange", () => { _pausedFrame = document.hidden; });

function draw() {
  if (!ctx) return;
  /* ★ PERF-GUARD：关掉动画 / hero 隐藏 / 页面不可见 ⇒ 不画 */
  if (_forcedOffStage) return;
  if (_heroEl && _heroEl.offsetParent === null) { requestAnimationFrame(draw); return; }
  if (_pausedFrame) { requestAnimationFrame(draw); return; }
  ctx.clearRect(0, 0, W, H);

  drawGrid();

  // 地面倒影辉光
  // ★ 深空：三层星云
  const g = ctx.createRadialGradient(cx * 0.7, cy * 0.6, 0, cx * 0.7, cy * 0.6, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(40,90,190,0.20)');
  g.addColorStop(0.5, 'rgba(20,50,120,0.07)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(cx * 1.5, cy * 1.4, 0, cx * 1.5, cy * 1.4, Math.max(W, H) * 0.6);
  g2.addColorStop(0, 'rgba(140,60,170,0.15)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  // ── 圈层 ──
  ring(R * 1.00, { color: 'rgba(255,196,87,0.42)', width: 1.4 });
  ring(R * 0.88, { color: 'rgba(255,196,87,0.22)', width: 1, dash: [2, 6] });
  ring(R * 0.76, { color: 'rgba(0,229,255,0.42)', width: 1.2 });
  ring(R * 0.62, { color: 'rgba(0,229,255,0.20)', width: 1, dash: [2, 6] });
  ring(R * 0.34, { color: 'rgba(255,196,87,0.30)', width: 1 });

  // ── 外圈：十二地支 + 刻度 ──
  for (let i = 0; i < 12; i++) {
    const lon = zhiLon(i);
    const hot = state.hover?.kind === 'zhi' && state.hover.i === i;
    tick(lon, R * 0.88, R * 1.0, hot ? '#ffd479' : 'rgba(255,196,87,0.5)', hot ? 2.4 : 1);
    label(ZHI[i], lon, R * 1.09, { color: hot ? '#ffd479' : '#c9a227', size: hot ? 22 : 18, bold: true });
  }

  // ── 中圈：十二星座 + 刻度 ──
  for (let i = 0; i < 12; i++) {
    const lon = signLon(i);
    const hot = state.hover?.kind === 'sign' && state.hover.i === i;
    tick(lon, R * 0.62, R * 0.76, hot ? '#5ef1ff' : 'rgba(0,229,255,0.45)', hot ? 2.4 : 1);
    label(SIGNS[i], lon + 15, R * 0.69, { color: hot ? '#5ef1ff' : '#3aa3b8', size: hot ? 15 : 13 });
  }

  // ── 内环：行星 ──
  const placedLabels = [];
  for (const p of PLANETS) {
    const hot = state.hover?.kind === 'planet' && state.hover.name === p.name;
    const dot = project(p.lon, R * 0.86);
    const front = dot.depth > 0;
    ctx.save();
    ctx.globalAlpha = front ? 1 : 0.4;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, hot ? 6 : 3.6, 0, Math.PI * 2);
    ctx.fillStyle = hot ? '#ffffff' : '#5ef1ff';
    ctx.shadowColor = '#5ef1ff';
    ctx.shadowBlur = hot ? 16 : 9;
    ctx.fill();
    // 连到内环的引线
    const inner = project(p.lon, R * 0.34);
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(dot.x, dot.y);
    ctx.strokeStyle = hot ? 'rgba(94,241,255,0.5)' : 'rgba(0,229,255,0.13)';
    ctx.lineWidth = hot ? 1.4 : 0.8;
    ctx.stroke();
    ctx.restore();
    if (hot || front) {
      // 去重：与已放置的标签屏幕距离太近就沿半径外推，仍冲突则丢弃
      const cand = project(p.lon, R * 0.94);
      let placed = false;
      for (const tryR of [0.94, 1.02, 1.10]) {
        const q = project(p.lon, R * tryR);
        const clash = placedLabels.some((L) => Math.hypot(L.x - q.x, L.y - q.y) < 26);
        if (!clash) {
          placedLabels.push(q);
          label(p.name, p.lon, R * tryR, { color: hot ? '#ffffff' : 'rgba(148,230,255,0.8)', size: hot ? 13 : 11 });
          placed = true;
          break;
        }
      }
      if (!placed && hot) {
        // 高亮项无论如何都要显示
        label(p.name, p.lon, R * 1.10, { color: '#ffffff', size: 13 });
      }
    }
  }

  // ── 核心：八卦环 + 太极 ──
  for (let i = 0; i < 8; i++) {
    label(GUA[i], i * 45 + 22.5, R * 0.25, { color: 'rgba(255,196,87,0.55)', size: 13, bold: true });
  }
  taji(cx, cy, R * 0.16);

  requestAnimationFrame(draw);
}

/* ══════════ 交互 ══════════ */
function hitTest(mx, my) {
  // 把鼠标位置反投影到圆盘平面，判断落在哪个扇区
  const t = tiltRad();
  const dx = mx - cx;
  const dy = (my - cy) / Math.cos(t);
  const dist = Math.hypot(dx, dy);
  if (dist < R * 0.05 || dist > R * 1.2) return null;
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI;       // -180..180
  ang = ((ang - state.rot) % 360 + 360) % 360;          // 去掉自转
  // 行星优先
  for (const p of PLANETS) {
    const d = Math.abs(((ang - p.lon + 540) % 360) - 180);
    if (d < 6 && dist > R * 0.8 && dist < R * 1.0) return { kind: 'planet', name: p.name, lon: p.lon };
  }
  if (dist > R * 0.88 && dist < R * 1.16) {
    const i = Math.round(ang / 30) % 12;
    return { kind: 'zhi', i, name: ZHI[i], lon: zhiLon(i) };
  }
  if (dist > R * 0.56 && dist < R * 0.82) {
    const i = Math.floor(ang / 30) % 12;
    return { kind: 'sign', i, name: SIGNS[i], lon: signLon(i) };
  }
  return null;
}

function tooltipText(h) {
  if (!h) return '';
  if (h.kind === 'zhi') {
    return `地支 ${h.name}　·　黄经 ${h.lon.toFixed(0)}°　·　对应 ${SIGNS[Math.floor(h.lon / 30)]}`;
  }
  if (h.kind === 'sign') {
    return `星座 ${h.name}（${h.lon}°–${h.lon + 30}°）　·　叠加地支 ${ZHI[Math.round(((h.lon - 270 + 360) % 360) / 30) % 12]}`;
  }
  if (h.kind === 'planet') {
    return `${h.name}　·　黄经 ${h.lon.toFixed(1)}°　·　落 ${SIGNS[Math.floor(h.lon / 30)]} ${(h.lon % 30).toFixed(1)}°`;
  }
  return '';
}

export function mountStage(el) {
  if (!el) return;
  canvas = el.querySelector('canvas') ?? document.createElement('canvas');
  if (!canvas.parentElement) el.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const tip = el.querySelector('.stage-tip');

  fit();
  new ResizeObserver(fit).observe(el);
  requestAnimationFrame(draw);

  // 自动缓慢旋转
  setInterval(() => { if (state.spin && !state.drag) state.rot += 0.12; }, 30);

  canvas.addEventListener('pointerdown', (e) => {
    state.drag = true; state.lastX = e.clientX; state.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointerup', (e) => {
    state.drag = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { }
    canvas.style.cursor = 'grab';
  });
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    state.mouseX = mx; state.mouseY = my;
    if (state.drag) {
      state.rot += (e.clientX - state.lastX) * 0.4;
      // 上下拖动改倾斜（限制 30–80 度）
      state.tilt = Math.max(30, Math.min(80, state.tilt + (e.clientY - state.lastY) * 0.15));
      state.lastX = e.clientX; state.lastY = e.clientY;
      state.hover = null;
      if (tip) tip.style.opacity = 0;
      return;
    }
    const h = hitTest(mx, my);
    state.hover = h;
    if (tip) {
      if (h) {
        tip.textContent = tooltipText(h);
        tip.style.opacity = 1;
        tip.style.left = Math.min(W - 260, Math.max(8, mx + 14)) + 'px';
        tip.style.top = Math.max(8, my - 34) + 'px';
      } else tip.style.opacity = 0;
    }
    canvas.style.cursor = h ? 'pointer' : 'grab';
  });
  canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return; e.preventDefault();
    state.zoom = Math.max(0.6, Math.min(1.6, state.zoom - e.deltaY * 0.0008));
    fit();
  }, { passive: false });
  canvas.style.cursor = 'grab';

  // 控制按钮
  el.querySelectorAll('[data-stage]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.stage;
      if (act === 'spin') { state.spin = !state.spin; btn.classList.toggle('on', state.spin); }
      if (act === 'reset') { state.rot = 0; state.tilt = 62; state.zoom = 1; fit(); }
      if (act === 'flat') { state.tilt = 30; }
      if (act === 'top') { state.tilt = 78; }
    });
  });
}

export { state as stageState };
