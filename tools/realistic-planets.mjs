// 真实感行星渲染：球体光照 + 明暗交界 + 边缘光 + 木星条纹 + 土星环 + 太阳日冕
// 零依赖 canvas 2D：用径向渐变伪造球面光照
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (!s.includes('PLANET_STYLE')) {
  /* ① 行星外观参数表 */
  s = s.replace(
    "const PLANET_TG = {",
    `// 行星外观：颜色 / 相对半径 / 特殊处理
const PLANET_STYLE = {
  太阳:   { light: '#FFF7C8', mid: '#FFC42E', dark: '#C4610A', r: 2.05, corona: true,  band: 0 },
  月亮:   { light: '#F4F4F0', mid: '#C9C9C3', dark: '#6E6E68', r: 1.05, craters: true, band: 0 },
  水星:   { light: '#D9D3C8', mid: '#9A938A', dark: '#4A453E', r: 0.62, craters: true, band: 0 },
  金星:   { light: '#FFF3C9', mid: '#E3CE8E', dark: '#8A7333', r: 0.92, haze: true,  band: 0 },
  火星:   { light: '#F0A472', mid: '#C1440E', dark: '#5E1E06', r: 0.72, cap: true,    band: 0 },
  木星:   { light: '#F1E4C3', mid: '#C9AE7C', dark: '#6B5330', r: 1.55, band: 7, spot: true },
  土星:   { light: '#F7ECC9', mid: '#D8C48C', dark: '#6E5B2C', r: 1.32, ring: true,   band: 4 },
  天王星: { light: '#D6FBFF', mid: '#7DE3E8', dark: '#2A6E77', r: 1.02, ringThin: true },
  海王星: { light: '#A9C4FF', mid: '#4166F5', dark: '#13246E', r: 0.98, band: 2 },
  冥王星: { light: '#E2D3BD', mid: '#B39B7E', dark: '#4A3C2C', r: 0.45, band: 0 },
  凯龙:   { light: '#D8E8F0', mid: '#8FA8B8', dark: '#3A4A55', r: 0.34, band: 0 },
};

const PLANET_TG = {`
  );
  console.log('① 行星外观表已加');

  /* ② 球体渲染函数（插在 txt 之前） */
  s = s.replace(
    "function txt(str, x, y,",
    `/** 画一个带光照的真实感星球
 *  @param lightDir 光来向的角度（世界中心=太阳方向）
 */
function drawPlanetSphere(x, y, r, style, lightDir, { alpha = 1, label = '' } = {}) {
  if (r < 0.6) return;
  const st = style;
  ctx.save();
  ctx.globalAlpha = alpha;

  // ── 土星/天王星的环（先画后半）──
  if (st.ring || st.ringThin) {
    const rw = st.ring ? r * 1.95 : r * 1.5;
    const rh = rw * 0.26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lightDir + 0.4);
    for (const pass of ['back', 'front']) {
      if (pass === 'front') { /* 前半留到球体后画 */ }
    }
    // 后半（先画，会被球体盖住一部分）
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = st.ring ? 'rgba(226,208,160,0.45)' : 'rgba(160,240,250,0.28)';
    ctx.lineWidth = Math.max(1.4, r * 0.34);
    ctx.shadowColor = st.ring ? 'rgba(226,208,160,0.5)' : 'rgba(160,240,250,0.4)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  // ── 太阳日冕 ──
  if (st.corona) {
    const g0 = ctx.createRadialGradient(x, y, r * 0.7, x, y, r * 3.4);
    g0.addColorStop(0, 'rgba(255,196,64,0.55)');
    g0.addColorStop(0.35, 'rgba(255,150,30,0.18)');
    g0.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.save(); ctx.fillStyle = g0;
    ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, PI * 2); ctx.fill(); ctx.restore();
  }

  // ── 球体本体（光从 lightDir 方向来 ⇒ 高光偏移到光源侧）──
  const lx = x + Math.cos(lightDir) * r * 0.42;
  const ly = y + Math.sin(lightDir) * r * 0.42;
  const g = ctx.createRadialGradient(lx, ly, r * 0.05, x, y, r * 1.02);
  g.addColorStop(0, st.light);
  g.addColorStop(0.42, st.mid);
  g.addColorStop(0.82, st.dark);
  g.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2);
  ctx.fillStyle = g; ctx.fill();

  // ── 条纹（木星/土星/海王星）──
  if (st.band > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.clip();
    for (let i = 0; i < st.band; i++) {
      const yy = y - r + (i + 0.5) * (2 * r / st.band);
      const h = (2 * r / st.band) * 0.52;
      ctx.globalAlpha = alpha * (0.10 + 0.06 * (i % 2));
      ctx.fillStyle = i % 2 ? '#ffffff' : '#3a2a12';
      ctx.beginPath(); ctx.ellipse(x, yy, r * 1.1, h / 2, 0, 0, PI * 2); ctx.fill();
    }
    // 木星大红斑
    if (st.spot) {
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = '#B0532C';
      ctx.beginPath(); ctx.ellipse(x - r * 0.28, y + r * 0.22, r * 0.26, r * 0.15, 0.2, 0, PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── 陨石坑（月亮/水星）──
  if (st.craters) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.clip();
    ctx.globalAlpha = alpha * 0.28;
    ctx.fillStyle = '#3c3c38';
    const dots = [[-0.35, -0.2, 0.16], [0.22, 0.3, 0.12], [0.1, -0.42, 0.1], [-0.15, 0.45, 0.09], [0.4, -0.12, 0.08]];
    for (const [dx, dy, dr] of dots) {
      ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, dr * r, 0, PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── 火星极冠 ──
  if (st.cap) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); ctx.clip();
    ctx.globalAlpha = alpha * 0.65; ctx.fillStyle = '#F2F6FF';
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.82, r * 0.42, r * 0.16, 0, 0, PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── 大气边缘光 ──
  if (st.haze || st.light) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = st.light;
    ctx.lineWidth = Math.max(0.6, r * 0.09);
    ctx.shadowColor = st.light; ctx.shadowBlur = r * 0.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.985, 0, PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ── 环的前半（盖在球体上）──
  if (st.ring || st.ringThin) {
    const rw = st.ring ? r * 1.95 : r * 1.5;
    const rh = rw * 0.26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lightDir + 0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI);
    ctx.strokeStyle = st.ring ? 'rgba(240,225,180,0.72)' : 'rgba(180,250,255,0.45)';
    ctx.lineWidth = Math.max(1.4, r * 0.34);
    ctx.shadowColor = st.ring ? 'rgba(240,225,180,0.7)' : 'rgba(180,250,255,0.5)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function txt(str, x, y,`
  );
  console.log('② 球体渲染函数已加');

  /* ③ 用球体替换原来的光点 */
  s = s.replace(
    `      ctx.save();
      ctx.beginPath(); ctx.arc(s.x, s.y, hot ? 6 : 3.4, 0, PI * 2);
      ctx.fillStyle = hot ? '#ffffff' : '#5ef1ff';
      ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 10; ctx.fill();
      ctx.restore();`,
    `      // ★ 真实感星球：半径随透视缩放（放大/穿梭时同步变大）
      const st = PLANET_STYLE[pl.name];
      const baseR = st ? st.r : 0.6;
      const pr = Math.max(2.5, baseR * s.s * 0.0085);
      if (st) {
        drawPlanetSphere(s.x, s.y, pr * (hot ? 1.12 : 1), st, Math.atan2(-s.y + H / 2, -s.x + W / 2), { alpha: 1 });
      } else {
        ctx.save();
        ctx.beginPath(); ctx.arc(s.x, s.y, hot ? 6 : 3.4, 0, PI * 2);
        ctx.fillStyle = hot ? '#ffffff' : '#5ef1ff';
        ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 10; ctx.fill();
        ctx.restore();
      }`
  );
  console.log('③ 行星已换成真实感球体');

  /* ④ 行星标签跟随球体半径偏移 */
  s = s.replace(
    "      for (const rr of [0.93, 0.99, 1.05]) {",
    "      for (const rr of [1.00, 1.07, 1.14]) {"
  );

  fs.writeFileSync('web/fusion3d.js', s, 'utf8');
  console.log('④ 完成');
}
