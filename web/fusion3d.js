// 融合盘 3D：真实星空球 + 黄道环 + 七柱环 + 八环，自由相机
//
// 世界坐标 = 赤道坐标系（z 轴指向北天极）
//   · 恒星：真实 RA/Dec（921 颗 mag ≤ 4.5）→ 半径 1.0 的天球
//   · 黄道环：黄经 λ → 黄道面 → 赤道系（倾斜 ε=23.4393°）
//   · 七柱 / 天干 / 八卦：装饰环，落在黄道面上
//
// 相机：球坐标环绕（yaw/pitch/dist），透视投影
//   拖动 = 旋转，上下拖 = 俯仰，滚轮 = 缩放（dist 可 < 0.5 ⇒ 进入球内穿梭）
import { STARS } from '/stars.js';
import { initGL, resizeGL, clearGL, loadTexture, drawPlanet } from '/gl-planets.js';
// ══════════ 模块级常量与状态（缺一个都会让 draw() 每帧抛错）══════════
/** 需要跳过的虚点名（不是实体行星） */
const AUX_NAMES = new Set(['上升', '天顶', '下降', '天底', '北交点', '南交点']);
/** 页面隐藏时暂停渲染 */
let _paused = false;
// ★ PERF：宿主元素与帧节流
let _hostEl = null;
let _lastT = 0;
/* ★ AUTO-DEGRADE：帧耗时过长就自动降频，避免主线程被占满导致"点不动" */
let _frameBudget = 33;        // 初始 30fps
let _slowStreak = 0;
const _forcedOff = /[?&]off=1/.test(location.search);
document.addEventListener('visibilitychange', () => { _paused = document.hidden; });


const PI = Math.PI, D2R = PI / 180;
const OBLIQ = 23.4393 * D2R;

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const PLANET_GLYPH = { 太阳: '☉', 月亮: '☽', 水星: '☿', 金星: '♀', 火星: '♂', 木星: '♃', 土星: '♄', 天王星: '♅', 海王星: '♆', 冥王星: '♇', 凯龙: '⚷' };
const BAGUA = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];
const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱', '胎元', '命宫', '身宫'];
const HOUSE_DOMAIN = { 1: '自我/身体', 2: '资源/价值', 3: '沟通/近亲', 4: '家庭/根基', 5: '创造/子女', 6: '工作/健康', 7: '关系/合作', 8: '共享/危机', 9: '远行/信念', 10: '事业/名声', 11: '群体/愿景', 12: '隐退/内在' };
const ANGULAR = new Set([1, 4, 7, 10]), SUCCEDENT = new Set([2, 5, 8, 11]);
const mansionOf = (h) => (ANGULAR.has(h) ? '角宫' : SUCCEDENT.has(h) ? '续宫' : '果宫');
const CANG = { 子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'] };
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
// 行星真实轨道距离（AU，对地球的平均/半长轴近似）
const PLANET_AU = {
  月亮: 0.0026, 太阳: 1.0, 水星: 0.387, 金星: 0.723, 火星: 1.524,
  木星: 5.203, 土星: 9.537, 天王星: 19.19, 海王星: 30.07, 冥王星: 39.48, 凯龙: 13.7,
};
const AU_MIN_LOG = 0, AU_MAX_LOG = Math.log10(41);
/** ★ 所有行星统一所在的那个圆（与星座环对齐，保证直观） */
const PLANET_RING_R = 0.86;
/** AU → 场景半径（0.26 ~ 1.04，log 压缩让内外行星都看得见） */
function orbitRadius(name) {
  const au = PLANET_AU[name];
  if (au === undefined) return 0.55;
  const t = Math.log10(1 + au) / AU_MAX_LOG;
  return 0.26 + 0.78 * t;
}

// 行星外观：颜色 / 相对半径 / 特殊处理
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

// 行星本身的意义（占星语汇）
const PLANET_MEANING = {
  太阳: { glyph: '☉', key: '自我 · 生命力 · 核心意志', long: '代表"我是谁"、生命的核心驱动力、以及一个人想成为的样子。也主父亲、权威、名声。' },
  月亮: { glyph: '☽', key: '情绪 · 直觉 · 安全感', long: '代表内在的情绪反应、习惯性的安全感来源、潜意识。也主母亲、家宅、身体节律。' },
  水星: { glyph: '☿', key: '思维 · 沟通 · 学习', long: '代表怎么想、怎么表达、怎么学。主语言、逻辑、交易、短途移动。' },
  金星: { glyph: '♀', key: '价值 · 情感 · 审美', long: '代表喜欢什么、怎么建立关系、审美取向。主爱情、金钱、艺术、愉悦。' },
  火星: { glyph: '♂', key: '行动 · 冲突 · 欲望', long: '代表怎么出手、怎么争、怎么生气。主竞争、勇气、驱动力、手术与外伤。' },
  木星: { glyph: '♃', key: '扩张 · 信念 · 机遇', long: '代表在哪里变大、相信什么、得到什么。主成长、教育、远行、运气。' },
  土星: { glyph: '♄', key: '限制 · 责任 · 结构', long: '代表在哪里受限、必须负责、被要求。主时间、纪律、权威、边界与代价。' },
  天王星: { glyph: '♅', key: '突变 · 革新 · 破格', long: '代表哪里会突然翻转、哪里不肯按规矩来。主意外、科技、觉醒、断裂。' },
  海王星: { glyph: '♆', key: '消融 · 想象 · 迷雾', long: '代表哪里边界模糊、哪里容易理想化或沉溺。主灵性、艺术、药物、欺骗。' },
  冥王星: { glyph: '♇', key: '转化 · 权力 · 深渊', long: '代表哪里必须彻底重构、哪里有控制与生死议题。主清算、深渊、重生。' },
  凯龙:   { glyph: '⚷', key: '创伤 · 疗愈', long: '代表伤口所在，也代表能治愈别人的地方。' },
};

// 十神组的八字语义
const TG_MEANING = {
  比劫: '同我者：自我、同辈、竞争、独立',
  印: '生我者：支持、学习、庇护、母系',
  食伤: '我生者：表达、创造、消耗、子女',
  财: '我克者：资源、欲望、掌控、配偶（男命）',
  官杀: '克我者：约束、责任、压力、权威、配偶（女命）',
};

// 真实行星贴图（solarsystemscope 2K → 压缩至 1024×512）
const PLANET_TEX = {
  太阳: '/textures/sun.jpg', 月亮: '/textures/moon.jpg', 水星: '/textures/mercury.jpg',
  金星: '/textures/venus.jpg', 火星: '/textures/mars.jpg', 木星: '/textures/jupiter.jpg',
  土星: '/textures/saturn.jpg', 天王星: '/textures/uranus.jpg', 海王星: '/textures/neptune.jpg',
};

const PLANET_TG = { 太阳: '比劫', 月亮: '印', 水星: '食伤', 金星: '财', 火星: '官杀', 木星: '印', 土星: '官杀', 天王星: '食伤', 海王星: '印', 冥王星: '官杀' };

function tenGod(gan, dm) {
  const wa = GAN_WX[gan], wd = GAN_WX[dm];
  if (!wa || !wd) return null;
  const same = YANG.has(gan) === YANG.has(dm);
  if (wa === wd) return same ? '比肩' : '劫财';
  if (SHENG[wa] === wd) return same ? '偏印' : '正印';
  if (SHENG[wd] === wa) return same ? '食神' : '伤官';
  if (KE[wd] === wa) return same ? '偏财' : '正财';
  return same ? '七杀' : '正官';
}

/* ══════════ 3D 数学 ══════════ */
const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const mul = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** 赤经赤纬（度）→ 单位向量（z 指北天极，x 指向春分点） */
function radecToVec(raDeg, decDeg) {
  const ra = raDeg * D2R, dec = decDeg * D2R;
  return { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
}
/** 黄经（度）→ 赤道系单位向量 */
function eclToVec(lonDeg) {
  const l = lonDeg * D2R;
  return {
    x: Math.cos(l),
    y: Math.sin(l) * Math.cos(OBLIQ),
    z: Math.sin(l) * Math.sin(OBLIQ),
  };
}

const cam = { yaw: 0.6, pitch: 0.46, dist: 2.05, fov: 62 * D2R, spin: false, look: { x: 0, y: 0, z: 0 } };   // ★ 默认不自转（省算力）
let cv = null, ctx = null, W = 0, H = 0, DPR = 1;
let DATA = null;
const show = { zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true, orbits: false };
let hover = null, drag = false, lastX = 0, lastY = 0, flyT = 0;
const glDrawQueue = [];
const TEX_CACHE = {};
let flyAnim = null;
let downX = 0, downY = 0, moved = 0;

/** 世界 → 相机坐标 */
function toCam(p) {
  let { x, y, z } = { x: p.x - cam.look.x, y: p.y - cam.look.y, z: p.z - cam.look.z };
  // yaw（绕 z 轴）
  const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
  let x1 = x * cy - y * sy, y1 = x * sy + y * cy;
  // pitch（绕 x 轴）
  const cp = Math.cos(-cam.pitch), sp = Math.sin(-cam.pitch);
  let y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
  // 相机在 +z 方向距中心 dist
  return { x: x1, y: y2, z: z2 + cam.dist };
}

/** 相机坐标 → 屏幕（透视） */
function toScreen(c) {
  const f = (H / 2) / Math.tan(cam.fov / 2);
  const zz = Math.max(0.02, c.z);
  const s = f / zz;
  return { x: W / 2 + c.x * s, y: H / 2 - c.y * s, s, z: c.z };
}

function proj(p) { return toScreen(toCam(p)); }

/* ══════════ 绘制 ══════════ */
/** 画一个带光照的真实感星球
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

function txt(str, x, y, { color = '#cfe9ff', size = 12, bold = false, glow = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${bold ? 700 : 500} ${size}px "Noto Sans SC",system-ui,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** 画一个 3D 圆环（黄道面内） */
function ring3D(radius, { color = 'rgba(0,229,255,0.3)', width = 1, seg = 96, alpha = 1, dash = null } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= seg; i++) {
    const lon = (i / seg) * 360;
    const v = mul(eclToVec(lon), radius);
    const s = proj(v);
    if (s.z <= 0.02) { started = false; continue; }
    if (!started) { ctx.moveTo(s.x, s.y); started = true; } else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke(); ctx.restore();
}

/** 画某个半径的黄道面圆环（行星轨道） */
function orbitRing(radius, color, alpha = 0.12, width = 0.7) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= 120; i++) {
    const v = mul(eclToVec((i / 120) * 360), radius);
    const p = proj(v);
    if (p.z <= 0.02) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

/** 从中心到某黄经的辐条 */
function spoke3D(lonDeg, r1, r2, color, width = 1, alpha = 1) {
  const a = proj(mul(eclToVec(lonDeg), r1));
  const b = proj(mul(eclToVec(lonDeg), r2));
  if (a.z <= 0.02 || b.z <= 0.02) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
}

/**
 * ★ 星群扇开：把靠得过近的行星沿圆周分开，避免球体重叠
 * @param items  [{ pl, pr }]  pr = 该行星的屏幕半径（像素）
 * @returns Map<name, {lon, cluster, sidx}>
 *   lon    = 显示用黄经（扇开后的）
 *   真实位置仍用 pl.lon，另外画刻度点 + 连线
 */
function spreadLongitudes(items) {
  const out = new Map();
  if (!items.length) return out;
  // ★ 基准半径（像素）：与行星尺寸上限同源（见 pr0 的 clamp），此前漏声明导致 drawErr: R is not defined
  const R = Math.max(80, Math.min(W, H) * 0.28);   // 0.34→0.28：缩小盘面，给外环层留直径（滚轮可缩放）
  // 角度 → 该处每度对应多少屏幕像素（用于把像素间距换算成角度）
  const pxPerDeg = Math.max(0.8, (2 * Math.PI * R * PLANET_RING_R) / 360);

  // 按黄经排序（处理 0/360 环绕：以最大间隙处断开）
  const arr = items.map((it) => ({ ...it, lon: ((it.pl.lon % 360) + 360) % 360 }));
  arr.sort((a, b) => a.lon - b.lon);
  // 找最大间隙作为起点
  let gapIdx = 0, maxGap = -1;
  for (let i = 0; i < arr.length; i++) {
    const nx = arr[(i + 1) % arr.length];
    let g = nx.lon - arr[i].lon;
    if (g < 0) g += 360;
    if (g > maxGap) { maxGap = g; gapIdx = (i + 1) % arr.length; }
  }
  const seq = arr.slice(gapIdx).concat(arr.slice(0, gapIdx));

  // 分簇：相邻两颗的角距 < 所需间距 ⇒ 同簇
  const clusters = [];
  let cur = [seq[0]];
  for (let i = 1; i < seq.length; i++) {
    const prev = seq[i - 1], now = seq[i];
    // 本颗与上一颗需要的角距（像素 → 角度）
    const needDeg = ((prev.pr + now.pr) * 1.18) / Math.max(0.4, pxPerDeg * (R / 240));
    const d = now.lon - prev.lon;
    if (d < needDeg) cur.push(now);
    else { clusters.push(cur); cur = [now]; }
  }
  clusters.push(cur);

  // 每簇扇开
  for (const cl of clusters) {
    const n = cl.length;
    if (n === 1) { out.set(cl[0].pl.name, { lon: cl[0].lon, cluster: 1, sidx: 0 }); continue; }
    // 簇内平均角（用最大间隙法取中位，避免环绕问题）
    const base = cl[0].lon;
    const offs = cl.map((x) => { let dd = x.lon - base; if (dd > 180) dd -= 360; if (dd < -180) dd += 360; return dd; });
    const meanOff = offs.reduce((a, b) => a + b, 0) / n;
    const center = base + meanOff;
    // 所需角间距：取最大两颗的半径
    const avgPr = cl.reduce((a, b) => a + b.pr, 0) / n;
    let stepDeg = ((avgPr * 2.35)) / Math.max(0.4, pxPerDeg * (R / 240));
    // 簇越大越收紧（避免扇太开），但有下限
    stepDeg = Math.max(2.2, Math.min(stepDeg, 26 / n));
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * stepDeg;
      out.set(cl[i].pl.name, { lon: center + off, cluster: n, sidx: i, trueLon: cl[i].lon });
    }
  }
  return out;
}

function _drawBody() {
  if (!ctx) return;
  if (_forcedOff) return;   // ?off=1 关闭动画
  if (_paused) return;

  /* ★ PERF-GUARD：不可见就不画（切页 / 滚出视口 / 被隐藏）*/
  if (!_hostEl || !_hostEl.isConnected) return;
  if (_hostEl.offsetParent === null) return;            // 所在 page 非 active，或被 display:none
  const _rc = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null;
  if (_rc && (_rc.width === 0 || _rc.bottom < -80 || _rc.top > window.innerHeight + 80)) return;
  /* ★ 帧节流（自适应）*/
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
  }
  ctx.clearRect(0, 0, W, H);

  // ★ 宇宙深空：三层星云渐层（无星点）
  ctx.fillStyle = '#01030a'; ctx.fillRect(0, 0, W, H);
  {
    const g1 = ctx.createRadialGradient(W * 0.30, H * 0.28, 0, W * 0.30, H * 0.28, Math.max(W, H) * 0.62);
    g1.addColorStop(0, 'rgba(40,90,190,0.20)'); g1.addColorStop(0.5, 'rgba(20,50,120,0.08)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.76, H * 0.74, 0, W * 0.76, H * 0.74, Math.max(W, H) * 0.55);
    g2.addColorStop(0, 'rgba(140,60,170,0.16)'); g2.addColorStop(0.55, 'rgba(70,25,110,0.07)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    const g3 = ctx.createRadialGradient(W * 0.55, H * 0.45, 0, W * 0.55, H * 0.45, Math.max(W, H) * 0.42);
    g3.addColorStop(0, 'rgba(0,150,180,0.10)'); g3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);
  }

  if (window.__glPlanets) clearGL();
  if (!DATA) { requestAnimationFrame(draw); return; }

  /* ── 黄道 + 星座环 ── */
  if (show.ecliptic) ring3D(0.92, { color: 'rgba(0,229,255,0.22)', width: 1 });
  if (show.zodiac) {
    for (let i = 0; i < 12; i++) {
      const lon = i * 30;
      const hot = hover?.kind === 'sign' && hover.i === i;
      spoke3D(lon, 0.62, 0.98, hot ? '#5ef1ff' : 'rgba(0,229,255,0.20)', hot ? 2 : 0.9);
      const vg = proj(mul(eclToVec(lon + 15), 1.02));
      const vn = proj(mul(eclToVec(lon + 15), 0.95));
      if (vg.z > 0.02) txt(SIGN_GLYPH[i], vg.x, vg.y, { color: hot ? '#d9fbff' : 'rgba(125,215,245,0.72)', size: hot ? 18 : 14, glow: hot ? 12 : 0 });
      if (vn.z > 0.02 && vn.s > 26) txt(SIGNS[i], vn.x, vn.y, { color: hot ? '#a8f4ff' : 'rgba(90,190,220,0.75)', size: 10 });
    }
  }

  /* ── 宫位 + 领域 ── */
  if (show.houses && DATA.cusps?.length === 12) {
    for (let h = 0; h < 12; h++) {
      let c0 = DATA.cusps[h], c1 = DATA.cusps[(h + 1) % 12];
      if (c1 <= c0) c1 += 360;
      const mid = ((c0 + c1) / 2) % 360;
      spoke3D(c0, 0.58, 0.98, h === 0 ? 'rgba(255,196,87,0.60)' : 'rgba(0,229,255,0.11)', h === 0 ? 1.8 : 0.75);
      const vd = proj(mul(eclToVec(mid), 0.74));
      if (vd.z > 0.02 && vd.s > 26) {
        txt(String(h + 1), vd.x, vd.y - 7, { color: 'rgba(255,196,87,0.50)', size: 8 });
        txt(HOUSE_DOMAIN[h + 1], vd.x, vd.y + 4, { color: 'rgba(180,222,245,0.62)', size: 7.5 });
      }
    }
  }

  /* ── 七柱环 ── */
  if (show.pillars) {
    ring3D(0.56, { color: 'rgba(255,196,87,0.30)', width: 1.2 });
    const N = DATA.pillars.length || 4, step = 360 / N;
    for (let i = 0; i < N; i++) {
      const lon = i * step;
      const isExtra = i >= 4;
      const hot = hover?.kind === 'pillar' && hover.i === i;
      const p = proj(mul(eclToVec(lon), 0.60));
      if (p.z <= 0.02) continue;
      const col = hot ? '#ffe6a8' : (isExtra ? 'rgba(255,213,138,0.66)' : '#ffd58a');
      txt(DATA.pillars[i], p.x, p.y, { color: col, size: hot ? 24 : (isExtra ? 16 : 19), bold: true, glow: hot ? 14 : 6, alpha: isExtra ? 0.85 : 1 });
      const pn = proj(mul(eclToVec(lon), 0.49));
      if (pn.z > 0.02) txt(PILLAR_NAMES[i], pn.x, pn.y, { color: isExtra ? 'rgba(255,196,87,0.34)' : 'rgba(255,196,87,0.5)', size: 8.5, alpha: isExtra ? 0.8 : 1 });
    }
  }

  /* ── 八卦环（反向）── */
  if (show.bagua) {
    const rot2 = -cam.yaw * 16;
    for (let i = 0; i < 8; i++) {
      const p = proj(mul(eclToVec(i * 45 + rot2), 0.30));
      if (p.z > 0.02 && p.s > 26) txt(BAGUA[i], p.x, p.y, { color: 'rgba(255,196,87,0.30)', size: 12, glow: 3 });
    }
  }

  /* ── 行星（真实黄经 × 真实轨道距离，带深度排序）── */
  if (show.orbits) {
    // 先画轨道圈（按半径从小到大）
    const list = DATA.planets.filter((p) => typeof p.lon === 'number' && PLANET_STYLE[p.name]);
    const byOrbit = list.slice().sort((a, b) => orbitRadius(a.name) - orbitRadius(b.name));
    for (const pl of byOrbit) {
      const rr = orbitRadius(pl.name);
      if (pl.name === '太阳') continue;
      orbitRing(rr, 'rgba(0,229,255,0.55)', 0.10, 0.6);
    }
  }

  if (show.planets) {
    try {
      /* ── 采集：算屏幕位置与半径 ── */
      const items = [];
      for (const pl of DATA.planets) {
        if (typeof pl.lon !== 'number') continue;
        if (AUX_NAMES.has(pl.name)) continue;
        const st = PLANET_STYLE[pl.name] || null;
        const rr = PLANET_RING_R;
        const c0 = toCam(mul(eclToVec(pl.lon), rr));
        if (c0.z <= 0.02) continue;
        const sc0 = toScreen(c0);
        const bR = st ? st.r : 0.55;
        let pr0 = (1.6 + bR * 2.6) * 0.0190 * Math.min(sc0.s, 900);
        if (pl.name === '太阳') pr0 = Math.max(14, bR * sc0.s * 0.0220);
        pr0 = Math.max(7, Math.min(pr0, Math.min(W, H) * 0.34));
        items.push({ pl, st, sc: sc0, depth: c0.z, rr, pr: pr0 });
      }

      /* ── 星群扇开 ── */
      const DISP = spreadLongitudes(items);

      /* ── 远的先画 ── */
      items.sort((a, b) => b.depth - a.depth);

      const placed = [];
      for (const it of items) {
        try {
          const pl = it.pl, st = it.st, rr = it.rr;
          const dinfo = DISP.get(pl.name) || { lon: pl.lon, cluster: 1 };
          const cD = toCam(mul(eclToVec(dinfo.lon), rr));
          if (cD.z <= 0.02) continue;
          const scD = toScreen(cD);
          const X = scD.x, Y = scD.y;
          const hot = !!(hover && hover.kind === 'planet' && hover.name === pl.name);

          let pr = it.pr;
          if (dinfo.cluster > 1) pr *= Math.max(0.62, 1 - 0.09 * (dinfo.cluster - 1));

          /* ★ 真实黄经刻度 + 连线（扇开后仍能看到真位） */
          if (dinfo.cluster > 1 && typeof dinfo.trueLon === 'number') {
            const cT = toCam(mul(eclToVec(dinfo.trueLon), rr));
            if (cT.z > 0.02) {
              const scT = toScreen(cT);
              ctx.save();
              ctx.beginPath(); ctx.arc(scT.x, scT.y, 2, 0, PI * 2);
              ctx.fillStyle = 'rgba(0,229,255,0.7)'; ctx.fill();
              ctx.beginPath(); ctx.moveTo(scT.x, scT.y); ctx.lineTo(X, Y);
              ctx.strokeStyle = 'rgba(0,229,255,0.24)'; ctx.lineWidth = 0.8;
              ctx.setLineDash([2, 3]); ctx.stroke();
              ctx.restore();
            }
          }

          /* 球体 */
          if (st) {
            const lightA = Math.atan2(H / 2 - Y, W / 2 - X);
            if (window.__glPlanets && PLANET_TEX[pl.name]) {
              glDrawQueue.push({ x: X, y: Y, r: pr * (hot ? 1.12 : 1), name: pl.name,
                spin: (pl.lon / 40 + performance.now() / 9000) % (PI * 2), light: lightA, depth: it.depth });
            } else {
              drawPlanetSphere(X, Y, pr * (hot ? 1.1 : 1), st, lightA, { alpha: 1 });
            }
          } else {
            ctx.save();
            ctx.beginPath(); ctx.arc(X, Y, hot ? 6 : 3.2, 0, PI * 2);
            ctx.fillStyle = hot ? '#fff' : '#5ef1ff';
            ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 10; ctx.fill();
            ctx.restore();
          }

          /* 标签 */
          const g = PLANET_GLYPH[pl.name];
          const offX = X - W / 2, offY = Y - H / 2;
          const L = Math.hypot(offX, offY) || 1;
          const lx = X + (offX / L) * (pr + 13);
          const ly = Y + (offY / L) * (pr + 13);
          const clash = placed.some((q) => Math.hypot(q.x - lx, q.y - ly) < 24);
          if (!clash || hot) {
            placed.push({ x: lx, y: ly });
            txt(g ? g + pl.name : pl.name, lx, ly, {
              color: hot ? '#fff' : 'rgba(178,238,255,0.9)', size: hot ? 13 : 10.5, glow: hot ? 12 : 0,
            });
            if (dinfo.cluster > 1) {
              txt('★' + dinfo.cluster, lx, ly - 12, { color: 'rgba(255,196,87,0.85)', size: 8, bold: true });
            }
          }
        } catch (e) { /* 单颗失败不影响其他 */ }
      }
    } catch (e) {
      window.__drawErr = String((e && e.message) || e);
      console.error('[fusion3d] 行星层异常:', e);
    }
  }


  /* ── 恒等连线：月支 ⇔ 太阳黄经 ── */
  if (DATA.sunLon != null) {
    const a = proj(mul(eclToVec(360 / (DATA.pillars.length || 4)), 0.60));
    const b = proj(mul(eclToVec(DATA.sunLon), PLANET_RING_R));
    if (a.z > 0.02 && b.z > 0.02) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(255,196,87,0.55)'; ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]); ctx.shadowColor = '#ffc457'; ctx.shadowBlur = 8;
      ctx.stroke(); ctx.restore();
    }
  }

  /* ── 中心：地心（观测者）+ 太极 ── 日主不在这里：它是十神的关系原点，天球上无位置 ── */
  {
    const c0 = proj({ x: 0, y: 0, z: 0 });
    if (c0.z > 0.02) {
      const rr = Math.max(6, 0.055 * c0.s);
      ctx.save();
      ctx.beginPath(); ctx.arc(c0.x, c0.y, rr, 0, PI * 2);
      ctx.fillStyle = 'rgba(8,16,24,0.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,87,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath();
      ctx.arc(c0.x, c0.y, rr * 0.8, -PI / 2, PI / 2);
      ctx.arc(c0.x, c0.y + rr * 0.4, rr * 0.4, PI / 2, -PI / 2, true);
      ctx.arc(c0.x, c0.y - rr * 0.4, rr * 0.4, PI / 2, -PI / 2);
      ctx.fillStyle = 'rgba(255,196,87,0.18)'; ctx.fill();
      ctx.restore();
      txt(`⊙ 地心`, c0.x, c0.y - rr - 12, { color: '#ffe6a8', size: 12, bold: true, glow: 8 });
    }
  }

  /* ── ★ 命宫 / 身宫 融入行星：挂在黄道环上，连到 月亮 / 太阳 ── */
  if (DATA.aux) {
    try {
      for (const aux of DATA.aux) {
        const cA = toCam(mul(eclToVec(aux.lon), PLANET_RING_R * 0.93));
        const cL = toCam(mul(eclToVec(aux.linkLon), PLANET_RING_R));
        if (cA.z <= 0.02 || cL.z <= 0.02) continue;
        const A = toScreen(cA), Lp = toScreen(cL);

        // 连线
        ctx.save();
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(Lp.x, Lp.y);
        ctx.strokeStyle = aux.color; ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 4]); ctx.shadowColor = aux.color; ctx.shadowBlur = 6;
        ctx.stroke(); ctx.restore();

        // 节点（菱形）
        ctx.save();
        ctx.translate(A.x, A.y); ctx.rotate(PI / 4);
        ctx.fillStyle = 'rgba(6,14,24,0.9)';
        ctx.strokeStyle = aux.color; ctx.lineWidth = 1.3;
        ctx.shadowColor = aux.color; ctx.shadowBlur = 8;
        ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();

        // 标签
        txt(aux.label, A.x, A.y - 13, { color: aux.color, size: 9, bold: true, glow: 6 });
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ── 把排好序的球体送给 WebGL（远到近） ── */
  if (glDrawQueue.length > 64) glDrawQueue.length = 0;   // 兜底，防无界增长
  if (window.__glPlanets && glDrawQueue.length) {
    glDrawQueue.sort((a, b) => a.depth - b.depth);
    for (const q of glDrawQueue) {
      const tex = TEX_CACHE[q.name];
      drawPlanet({ x: q.x, y: q.y }, q.r, tex, [0.8, 0.8, 0.8], q.spin, q.light, q.name === '太阳' ? 1.5 : 1);
    }
    window.__glDebug = { n: glDrawQueue.length, tex: Object.keys(TEX_CACHE) };
    }
  glDrawQueue.length = 0;   // ★ 无论是否绘制都清空

  /* ── 状态提示 ── */
  txt(`视距 ${cam.dist.toFixed(2)}R　${cam.dist < 0.6 ? '★ 已进入星球内部（穿梭中）' : ''}`,
    12, H - 12, { color: cam.dist < 0.6 ? 'rgba(126,255,190,0.9)' : 'rgba(120,175,205,0.55)', size: 10 });

}

function draw() {
  try {
    _drawBody();
  } catch (e) {
    if (!window.__drawErr) {
      window.__drawErr = { msg: String(e && e.message), stack: String(e && e.stack).split('\n').slice(0, 4) };
      console.error('[fusion3d] draw 异常：', e);
    }
  }
  window.__fwRAF = requestAnimationFrame(draw);
}

/** ★ 相机飞向某颗行星：把 look 移到它身上，并拉近 */
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

/* ══════════ 交互 ══════════ */
function hitTest(mx, my) {
  if (!DATA) return null;
  let best = null, bd = 16;
  // 行星
  for (const pl of DATA.planets) {
    if (typeof pl.lon !== 'number') continue;
    if (['上升', '天顶', '下降', '天底', '北交点', '南交点'].includes(pl.name)) continue;
    const s = proj(mul(eclToVec(pl.lon), PLANET_RING_R));
    if (s.z <= 0.02) continue;
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d < bd) { bd = d; best = { kind: 'planet', name: pl.name, pl }; }
  }
  // 七柱
  const N = DATA.pillars.length || 4, step = 360 / N;
  for (let i = 0; i < N; i++) {
    const s = proj(mul(eclToVec(i * step), 0.60));
    if (s.z <= 0.02) continue;
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d < bd && DATA.pillars[i]) { bd = d; best = { kind: 'pillar', i, pillar: DATA.pillars[i] }; }
  }
  // 星座
  for (let i = 0; i < 12; i++) {
    const s = proj(mul(eclToVec(i * 30 + 15), 1.02));
    if (s.z <= 0.02) continue;
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d < bd) { bd = d; best = { kind: 'sign', i, sign: SIGNS[i] }; }
  }
  return best;
}

function tipText(h) {
  if (!h) return '';
  const dm = DATA?.dm;
  if (h.kind === 'pillar') {
    if (!h.pillar || h.pillar.length < 2) return '';
    const gan = h.pillar[0], zhi = h.pillar[1];
    const cang = (CANG[zhi] || []).map((g) => `${g}${GAN_WX[g]}·${tenGod(g, dm) ?? '?'}`).join('  ');
    const tag = h.i >= 4 ? '（实验柱 · 不参与排盘与身强弱判定）' : '（四柱 · 参与排盘与判定）';
    return `${PILLAR_NAMES[h.i]}${tag}　${h.pillar}　｜　${gan}${GAN_WX[gan]}·${tenGod(gan, dm) ?? '?'}　｜　藏气：${cang}`;
  }
  if (h.kind === 'planet') {
    const pl = h.pl;
    return `${pl.name}　${pl.sign} ${pl.deg}°　第${pl.house ?? '?'}宫（${pl.house ? mansionOf(pl.house) : '?'}）　→ ${PLANET_TG[pl.name] ?? '—'}组　落在：${pl.house ? HOUSE_DOMAIN[pl.house] : '—'}`;
  }
  if (h.kind === 'sign') {
    const zi = Math.round(((h.i * 30 - 270 + 360) % 360) / 30) % 12;
    return `星座 ${h.sign}（${h.i * 30}°–${h.i * 30 + 30}°）　·　对应地支 ${ZHI[zi]}`;
  }
  return '';
}

/** 弹出行星详情面板 */
function showPlanetPanel(host, pl) {
  if (!host || !pl) return;
  let panel = host.querySelector('.planet-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'planet-panel';
    host.appendChild(panel);
  }
  const m = PLANET_MEANING[pl.name] ?? { glyph: '', key: '—', long: '' };
  const tg = PLANET_TG[pl.name] ?? '—';
  const tgDesc = TG_MEANING[tg] ?? '';
  const dom = pl.house ? ({ 1: '自我/身体', 2: '资源/价值', 3: '沟通/近亲', 4: '家庭/根基', 5: '创造/子女', 6: '工作/健康', 7: '关系/合作', 8: '共享/危机', 9: '远行/信念', 10: '事业/名声', 11: '群体/愿景', 12: '隐退/内在' }[pl.house]) : '—';
  const mans = pl.house ? (ANGULAR.has(pl.house) ? '角宫（强）' : SUCCEDENT.has(pl.house) ? '续宫（中）' : '果宫（弱）') : '—';

  // 相位
  const asps = (DATA.aspects ?? []).filter((a) => a.a === pl.name || a.b === pl.name);
  const aspRows = asps.map((a) => {
    const other = a.a === pl.name ? a.b : a.a;
    const hard = a.type === '对冲' || a.type === '四分相';
    return `<div class="pp-asp"><span class="${hard ? 'bad' : 'ok'}">${a.type}</span><span class="nm">${other}</span><span class="orb">${a.orb}°</span></div>`;
  }).join('');

  // 尊贵
  const dign = pl.dignity ?? null;

  panel.innerHTML = `
    <button class="pp-close" type="button" aria-label="关闭">✕</button>
    <div class="pp-head">
      <div class="pp-glyph">${m.glyph || ''}</div>
      <div>
        <div class="pp-name">${pl.name}</div>
        <div class="pp-sub">${pl.sign} ${pl.deg}°　第${pl.house ?? '?'}宫（${mans}）</div>
      </div>
    </div>
    <div class="pp-sec"><div class="pp-h">本身的意义</div>
      <div class="pp-key">${m.key}</div>
      <div class="pp-long">${m.long}</div>
    </div>
    <div class="pp-sec"><div class="pp-h">在八字中的代表</div>
      <div class="pp-kv"><b>${tg}</b><span>${tgDesc}</span></div>
      <div class="pp-note">落宫领域：<b>${dom}</b>　·　宫位档：${mans}</div>
    </div>
    <div class="pp-sec"><div class="pp-h">与其他行星的相位（${asps.length}）</div>
      <div class="pp-asps">${aspRows || '<div class="pp-none">无相位</div>'}</div>
    </div>
  `;
  panel.classList.add('open');
  panel.querySelector('.pp-close').addEventListener('click', () => panel.classList.remove('open'));
}

export function mountFusion3D(el, data) {
  if (!el) return;
  _hostEl = el;   // ★ PERF：用于可见性判断
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
    for (const [n, url] of Object.entries(PLANET_TEX)) {
      loadTexture(url).then((t) => { if (t) TEX_CACHE[n] = t; });
    }
    console.log('[fusion3d] WebGL 行星层已启用');
  } else {
    console.warn('[fusion3d] WebGL 不可用，退回 2D 球体');
  }
  window.__glPlanets = glOK;
  const tip = el.querySelector('.fw-tip');
  setFusion3DData(data);

  function fit() {
    const r = el.getBoundingClientRect();
    // ★ OOM-GUARD：必须取整！小数会让"尺寸未变"判断永远为假，导致每帧重建 canvas 直至 OOM
    const nW = Math.max(360, Math.round(r.width));
    const nH = Math.max(380, Math.round(r.height));
    if (W === nW && H === nH && cv.width > 0) return;
    W = nW; H = nH;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = el.querySelector('canvas.gl');
    if (g && g.__ok) resizeGL(g, Math.round(W * DPR), Math.round(H * DPR));
    else if (g) { g.width = Math.round(W * DPR); g.height = Math.round(H * DPR); g.style.width = W + 'px'; g.style.height = H + 'px'; }
  }
  fit();
  new ResizeObserver(fit).observe(el);
  if (window.__fwRAF) cancelAnimationFrame(window.__fwRAF);
  window.__fwRAF = requestAnimationFrame(draw);
  if (window.__fwSpinTimer) clearInterval(window.__fwSpinTimer);
  window.__fwSpinTimer = setInterval(() => { if (cam.spin && !drag && !flyT) cam.yaw += 0.0016; }, 30);

  cv.addEventListener('pointerdown', (e) => {
    drag = true; lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY; moved = 0;
    try { cv.setPointerCapture(e.pointerId); } catch { }
    cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointerup', (e) => {
    drag = false;
    try { cv.releasePointerCapture(e.pointerId); } catch { }
    cv.style.cursor = 'grab';
    // ★ 位移很小 ⇒ 视为点击 ⇒ 打开行星面板
    if (moved < 6 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
      const r = cv.getBoundingClientRect();
      const h = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (h?.kind === 'planet') {
        showPlanetPanel(el, h.pl);
        flyToPlanet(h.pl);                       // ★ 相机拉近到该行星
      } else {
        const p = el.querySelector('.planet-panel');
        if (p) p.classList.remove('open');
      }
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag) {
      cam.yaw += (e.clientX - lastX) * 0.006;
      cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + (e.clientY - lastY) * 0.006));
      moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY; hover = null; if (tip) tip.style.opacity = 0; return;
    }
    hover = hitTest(mx, my);
    if (tip) {
      if (hover) {
        tip.textContent = tipText(hover);
        tip.style.opacity = 1;
        tip.style.left = Math.min(W - 350, Math.max(8, mx + 14)) + 'px';
        tip.style.top = Math.max(6, my - 40) + 'px';
      } else tip.style.opacity = 0;
    }
    cv.style.cursor = hover ? 'pointer' : 'grab';
  });
  cv.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return; e.preventDefault();
    cam.dist = Math.max(0.12, Math.min(4.2, cam.dist * (1 + e.deltaY * 0.0012)));
  }, { passive: false });
  cv.style.cursor = 'grab';

  el.querySelectorAll('[data-fw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.fw;
      if (k === 'spin') { cam.spin = !cam.spin; btn.classList.toggle('on', cam.spin); }
      else if (k === 'reset') { cam.yaw = 0.6; cam.pitch = 0.46; cam.dist = 2.05; cam.look = { x: 0, y: 0, z: 0 }; if (flyAnim) { cancelAnimationFrame(flyAnim); flyAnim = null; } cam.spin = true; }
      else if (k === 'flat') cam.pitch = 0.05;
      else if (k === 'top') cam.pitch = 1.42;
      else if (k === 'fly') {
        // 穿梭：从外飞到球心再回
        if (flyT) return;
        let t = 0;
        const from = cam.dist;
        flyT = setInterval(() => {
          t += 0.02;
          const k2 = Math.sin(Math.min(1, t) * PI);      // 0→1→0
          cam.dist = from * (1 - k2) + 0.16 * k2;
          cam.spin = false;
          if (t >= 1) { clearInterval(flyT); flyT = 0; cam.dist = from; cam.spin = true; }
        }, 30);
      }
      else if (show[k] !== undefined) { show[k] = !show[k]; btn.classList.toggle('on', show[k]); }
    });
    if (['zodiac', 'pillars', 'planets', 'houses', 'bagua', 'ecliptic', 'orbits'].includes(btn.dataset.fw)) btn.classList.toggle('on', show[btn.dataset.fw]);
    if (btn.dataset.fw === 'spin') btn.classList.add('on');
  });
}

export function setFusion3DData(data) {
  if (!data) return;
  const b = data.bazi ?? {};
  const base = b.pillars ?? data.pillars ?? [];
  // ★ FIX：胎元/命宫/身宫 在 API 里可能是对象 {gan,zhi,ganzhi}，不能只收 string
  const _gz = (x) => {
    if (x == null) return null;
    if (typeof x === 'string') return x.length >= 2 ? x : null;
    if (typeof x === 'object') return x.ganzhi ?? (x.gan && x.zhi ? x.gan + x.zhi : null);
    return null;
  };
  const extra = [b.taiYuan, b.mingGong, b.shenGong].map(_gz).filter(Boolean);
  const planets = data.natal?.planets ?? data.planets ?? [];
  const sun = (Array.isArray(planets) ? planets : Object.values(planets)).find((p) => p?.name === '太阳');
  DATA = {
    pillars: base.concat(extra),
    dm: b.dayMaster ?? data.dayMaster ?? '',
    planets,
    cusps: data.natal?.cusps ?? data.cusps ?? [],
    aspects: data.natal?.aspects ?? data.aspects ?? [],
    sunLon: sun?.lon ?? null,
    __dignity: (() => { try { window.__renderDignity?.(data); } catch (e) {} })(),
    aux: (() => {
      const arr = [];
      const moon = (Array.isArray(planets) ? planets : Object.values(planets)).find((p) => p?.name === '月亮');
      const sun2 = (Array.isArray(planets) ? planets : Object.values(planets)).find((p) => p?.name === '太阳');
      // 命宫 ↔ 月亮（-14° 挂靠），身宫 ↔ 太阳（+14° 挂靠）
      if (moon && typeof moon.lon === 'number') {
        arr.push({ label: '命宫 ' + (b.mingGong || ''), lon: moon.lon - 14, linkLon: moon.lon, color: 'rgba(180,150,255,0.85)' });
      }
      if (sun2 && typeof sun2.lon === 'number') {
        arr.push({ label: '身宫 ' + (b.shenGong || ''), lon: sun2.lon + 14, linkLon: sun2.lon, color: 'rgba(255,170,90,0.85)' });
      }
      return arr;
    })(),
  };
}

export { cam as cam3d, show as show3d };


/* ══════════ 自动挂载 + 对外钩子 ══════════ */
let _m3 = false, _p3 = null;
function __fw3dInit() {
  const host = document.querySelector('#fusion-wheel-host');
  if (!host || _m3) return;
  mountFusion3D(host, _p3);
  _m3 = true;
}
window.__fwSetData = function (data) {
  _p3 = data;
  if (!_m3) __fw3dInit();
  else setFusion3DData(data);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __fw3dInit);
else __fw3dInit();


/* ══════════ 点击行星 → 详情面板里直接显示十神五组比例 ══════════ */
(function () {
  if (typeof showPlanetPanel !== 'function') return;
  var _spp = showPlanetPanel;
  var G5 = [['比劫', '#ff9a8a'], ['印', '#7dffb4'], ['食伤', '#5ef1ff'], ['财', '#ffc457'], ['官杀', '#b48cff']];

  function injectTenGodBars(host, pl) {
    if (!host || !pl) return;
    var panel = host.querySelector('.planet-panel');
    if (!panel || panel.querySelector('.pp-weights')) return;
    var deep = window.__fwDeep;
    var dp = null;
    if (deep && Array.isArray(deep.planets)) {
      for (var i = 0; i < deep.planets.length; i++) {
        if (deep.planets[i].planet === pl.name) { dp = deep.planets[i]; break; }
      }
    }
    if (!dp || !dp.weights) return;
    var box = document.createElement('div');
    box.className = 'pp-weights';
    var html = '<div class="pp-wk">十神比例 · 动态权重（含相位与宫位修正）</div>';
    var maxG = '', maxV = -1;
    G5.forEach(function (p) {
      var v = (dp.weights[p[0]] || 0) * 100;
      if (v > maxV) { maxV = v; maxG = p[0]; }
    });
    G5.forEach(function (p) {
      var v = (dp.weights[p[0]] || 0) * 100;
      html += '<div class="pp-wr' + (p[0] === maxG ? ' top' : '') + '">' +
        '<i style="color:' + p[1] + '">' + p[0] + '</i>' +
        '<span class="pp-wb"><b style="width:' + v.toFixed(1) + '%;background:' + p[1] + '"></b></span>' +
        '<em>' + v.toFixed(1) + '%</em></div>';
    });
    if (dp.primary && dp.primary.group) {
      html += '<div class="pp-wn">主组 <b style="color:#ffc457">' + dp.primary.group + '</b>' +
        ' · ' + Math.round((dp.primary.w || 0) * 100) + '%　说明：同一颗星，状态不同则配比不同</div>';
    }
    box.innerHTML = html;
    panel.appendChild(box);
  }

  showPlanetPanel = function (host, pl) {
    try { _spp(host, pl); } catch (e) { return; }
    try { injectTenGodBars(host, pl); } catch (e) {}
  };
})();
