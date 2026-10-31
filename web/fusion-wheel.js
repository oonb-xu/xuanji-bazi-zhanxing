// 融合圆盘：把八字四柱与西洋星盘融进同一个可交互盘面
//
// 布局（由外到内）
//   ① 四柱环（金）  年/月/日/时 四扇区，每扇显示 干支 + 藏气十神
//   ② 星盘环（青）  十二星座 + 十二宫界 + 行星按真实黄经
//   ③ 内环（金）    天干环（四柱天干）
//   ④ 中心          日主 + 太极
//   ⑤ ★ 恒等连线   月支 ⇔ 太阳黄经（唯一有天文恒等的一对）
//
// 交互：拖拽旋转 / 上下拖改倾斜 / 滚轮缩放 / 悬停看中西对照 / 切换图层

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱', '胎元', '命宫', '身宫'];

// 地支藏干（本气/中气/余气）
const CANG = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

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

// 行星基础 → 十神组（docs/32 的约定映射）
const PLANET_TG = {
  太阳: '比劫', 月亮: '印', 水星: '食伤', 金星: '财', 火星: '官杀', 木星: '印',
  土星: '官杀', 天王星: '食伤', 海王星: '印', 冥王星: '官杀', 凯龙: '食伤',
};
const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const PLANET_GLYPH = { 太阳: '☉', 月亮: '☽', 水星: '☿', 金星: '♀', 火星: '♂', 木星: '♃', 土星: '♄', 天王星: '♅', 海王星: '♆', 冥王星: '♇', 凯龙: '⚷' };
const BAGUA = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];   // 乾兑离震巽坎艮坤
const BAGUA_NAME = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

const HOUSE_DOMAIN = {
  1: '自我/身体', 2: '资源/价值', 3: '沟通/近亲', 4: '家庭/根基',
  5: '创造/子女', 6: '工作/健康', 7: '关系/合作', 8: '共享/危机',
  9: '远行/信念', 10: '事业/名声', 11: '群体/愿景', 12: '隐退/内在',
};
const ANGULAR = new Set([1, 4, 7, 10]);
const SUCCEDENT = new Set([2, 5, 8, 11]);
const mansionOf = (h) => (ANGULAR.has(h) ? '角宫' : SUCCEDENT.has(h) ? '续宫' : '果宫');

const DPR = Math.min(window.devicePixelRatio || 1, 2);
const state = {
  rot: 0, tilt: 58, zoom: 1, spin: true, drag: false, lastX: 0, lastY: 0, hover: null,
  show: { pillars: true, planets: true, aspects: true, houses: true, link: true, bagua: true },
};
let cv = null, ctx = null, W = 0, H = 0, cx = 0, cy = 0, R = 0;
let DATA = null;   // { pillars, dm, planets, cusps, aspects, asc }
// 星尘粒子
const DUST = Array.from({ length: 90 }, () => ({
  x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.4,
  p: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 1.2,
}));

const tiltRad = () => (state.tilt * Math.PI) / 180;

function fit() {
  const wrap = cv?.parentElement; if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  W = Math.max(360, r.width); H = Math.max(420, r.height);
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2; cy = H / 2 + 20;
  R = Math.min(W, H) * 0.40 * state.zoom;
}

function proj(lonDeg, radius) {
  const a = ((lonDeg + state.rot) * Math.PI) / 180;
  const t = tiltRad();
  const px = Math.cos(a) * radius;
  const py = Math.sin(a) * radius;
  return { x: cx + px, y: cy + py * Math.cos(t), depth: py * Math.sin(t) };
}

/* ══════════ 绘制 ══════════ */
function drawFloor() {
  const horizon = cy + R * 0.66;
  ctx.save(); ctx.strokeStyle = 'rgba(0,229,255,0.075)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    const y = horizon + Math.pow(i / 12, 2.2) * (H - horizon);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  const vpy = horizon - R * 0.4;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath(); ctx.moveTo(cx, vpy); ctx.lineTo(cx + (i / 12) * W * 1.3, H); ctx.stroke();
  }
  ctx.restore();
}

function circle(radius, color, width = 1, dash = null, alpha = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, Math.cos(tiltRad()));
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke(); ctx.restore();
}

function radialLine(lonDeg, r1, r2, color, w = 1, alpha = 1) {
  const a = ((lonDeg + state.rot) * Math.PI) / 180;
  const t = tiltRad();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, Math.cos(t));
  ctx.beginPath();
  ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
  ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}

function text(str, lonDeg, radius, { color = '#cfe9ff', size = 12, bold = false, glow = 0 } = {}) {
  const p = proj(lonDeg, radius);
  ctx.save();
  ctx.globalAlpha = p.depth > 0 ? 1 : 0.55;
  ctx.fillStyle = color;
  ctx.font = `${bold ? 700 : 500} ${size}px "Noto Sans SC",system-ui,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillText(str, p.x, p.y);
  ctx.restore();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  drawFloor();
  // 星尘
  {
    const t = performance.now() / 1000;
    for (const d of DUST) {
      const a = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(t * d.sp + d.p));
      ctx.beginPath();
      ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150,220,255,${a.toFixed(3)})`;
      ctx.fill();
    }
  }

  // 中心辉光
  const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.5);
  g.addColorStop(0, 'rgba(0,229,255,0.10)');
  g.addColorStop(0.5, 'rgba(0,140,180,0.035)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (!DATA) { requestAnimationFrame(draw); return; }

  // ─── ① 四柱环（最外，金）───
  if (state.show.pillars) {
    circle(R * 1.30, 'rgba(255,196,87,0.40)', 1.4);
    circle(R * 1.18, 'rgba(255,196,87,0.18)', 1, [2, 6]);
    // 四柱均分在 0/90/180/270（年 0°，顺时针）
    const N = DATA.pillars.length || 4;
    const step = 360 / N;
    DATA.pillars.forEach((p, i) => {
      const base = i * step;
      const isExtra = i >= 4;                      // 胎元/命宫/身宫
      const hot = state.hover?.kind === 'pillar' && state.hover.i === i;
      if (isExtra) {
        // ★ 实验柱：虚线 + 更暗，与四柱明确区分
        const a0 = ((base + state.rot) * Math.PI) / 180, tt = tiltRad();
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, Math.cos(tt));
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * R * 1.18, Math.sin(a0) * R * 1.18);
        ctx.lineTo(Math.cos(a0) * R * 1.30, Math.sin(a0) * R * 1.30);
        ctx.strokeStyle = 'rgba(255,196,87,0.26)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]); ctx.stroke(); ctx.restore();
      } else {
        radialLine(base, R * 1.18, R * 1.30, 'rgba(255,196,87,0.45)', 1);
      }
      const col = hot ? '#ffe6a8' : (isExtra ? 'rgba(255,213,138,0.78)' : '#ffd58a');
      text(p, base, R * 1.40, { color: col, size: hot ? 25 : (isExtra ? 18 : 21), bold: true, glow: hot ? 14 : 6 });
      // 实验柱：柱名后跟一个小圆点标记，不写字（避免七分位重叠）
      text(PILLAR_NAMES[i], base, R * 1.53, { color: isExtra ? 'rgba(255,196,87,0.38)' : 'rgba(255,196,87,0.60)', size: 10 });
      if (isExtra) {
        const dot = proj(base, R * 1.63);
        ctx.save();
        ctx.globalAlpha = dot.depth > 0 ? 0.7 : 0.35;
        ctx.fillStyle = 'rgba(255,196,87,0.55)';
        ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    });
  }

  // ─── ② 星盘环（青）───
  circle(R * 1.02, 'rgba(0,229,255,0.42)', 1.3);
  circle(R * 0.78, 'rgba(0,229,255,0.20)', 1, [2, 6]);

  if (state.show.houses && DATA.cusps?.length === 12) {
    DATA.cusps.forEach((c, i) => {
      radialLine(c, R * 0.78, R * 1.02, i === 0 ? 'rgba(255,196,87,0.6)' : 'rgba(0,229,255,0.16)', i === 0 ? 1.6 : 0.8);
    });
  }

  // 十二星座
  for (let i = 0; i < 12; i++) {
    const lon = i * 30;
    const hot = state.hover?.kind === 'sign' && state.hover.i === i;
    radialLine(lon, R * 1.02, R * 1.08, hot ? '#5ef1ff' : 'rgba(0,229,255,0.35)', hot ? 2 : 0.8);
    text(SIGN_GLYPH[i], lon + 15, R * 0.96, { color: hot ? '#d9fbff' : 'rgba(120,215,245,0.62)', size: hot ? 17 : 14, glow: hot ? 12 : 0 });
    text(SIGNS[i], lon + 15, R * 0.87, { color: hot ? '#a8f4ff' : 'rgba(90,190,220,0.82)', size: hot ? 13 : 10.5 });
  }

  // ─── ③ 天干环（内，金）───
  if (state.show.pillars) {
    circle(R * 0.60, 'rgba(255,196,87,0.28)', 1);
    const N2 = DATA.pillars.length || 4, step2 = 360 / N2;
    DATA.pillars.forEach((p, i) => {
      text(p[0], i * step2, R * 0.435, { color: 'rgba(255,196,87,0.92)', size: 17, bold: true, glow: 8 });
    });
  }

  // ─── 宫位领域内环（最直观：1–12 宫分别是什么领域）───
  if (state.show.houses && DATA.cusps?.length === 12) {
    circle(R * 0.66, 'rgba(255,196,87,0.12)', 1, [1, 5]);
    for (let h = 0; h < 12; h++) {
      const c0 = DATA.cusps[h];
      let c1 = DATA.cusps[(h + 1) % 12];
      if (c1 <= c0) c1 += 360;
      const mid = ((c0 + c1) / 2) % 360;
      const dom = HOUSE_DOMAIN[h + 1] ?? '';
      text(String(h + 1), mid, R * 0.775, { color: 'rgba(255,196,87,0.40)', size: 8.5 });
      text(dom, mid, R * 0.706, { color: 'rgba(170,215,240,0.58)', size: 8 });
    }
  }

  // ─── 卦象环（反向缓转，装饰）───
  if (state.show.bagua) {
    const rot2 = -state.rot * 0.45;
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + rot2;
      text(BAGUA[i], a, R * 0.555, { color: 'rgba(255,196,87,0.50)', size: 16, glow: 5 });
    }
  }

  // ─── 行星（青点）───
  if (state.show.planets) {
    const placed = [];
    for (const pl of DATA.planets) {
      if (!pl || typeof pl.lon !== 'number') continue;
      if (['上升', '天顶', '下降', '天底', '北交点', '南交点'].includes(pl.name)) continue;
      const hot = state.hover?.kind === 'planet' && state.hover.name === pl.name;
      const p = proj(pl.lon, R * 0.96);
      ctx.save();
      ctx.globalAlpha = p.depth > 0 ? 1 : 0.45;
      ctx.beginPath(); ctx.arc(p.x, p.y, hot ? 6.5 : 3.6, 0, Math.PI * 2);
      ctx.fillStyle = hot ? '#fff' : '#5ef1ff';
      ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 9; ctx.fill();
      ctx.restore();
      // 标签去重
      if (hot || p.depth > 0) {
        let done = false;
        for (const rr of [1.10, 1.16, 1.22]) {
          const q = proj(pl.lon, R * rr);
          if (!placed.some((x) => Math.hypot(x.x - q.x, x.y - q.y) < 26)) {
            placed.push(q);
            const g = PLANET_GLYPH[pl.name];
            text(g ? `${g} ${pl.name}` : pl.name, pl.lon, R * rr, { color: hot ? '#fff' : 'rgba(148,230,255,0.85)', size: hot ? 13 : 11, glow: hot ? 10 : 0 });
            done = true; break;
          }
        }
        if (!done && hot) text(pl.name, pl.lon, R * 1.22, { color: '#fff', size: 13 });
      }
    }
  }

  // ─── 相位线（细）───
  if (state.show.aspects && DATA.aspects) {
    const byName = {};
    for (const pl of DATA.planets) byName[pl.name] = pl;
    ctx.save();
    for (const a of DATA.aspects) {
      const A = byName[a.a], B = byName[a.b];
      if (!A || !B) continue;
      if (a.type === '合相') continue;
      const p1 = proj(A.lon, R * 0.96), p2 = proj(B.lon, R * 0.96);
      const hard = a.type === '对冲' || a.type === '四分相';
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = hard ? 'rgba(255,120,120,0.16)' : 'rgba(120,255,180,0.13)';
      ctx.lineWidth = 0.85;
      ctx.shadowColor = hard ? 'rgba(255,110,110,0.5)' : 'rgba(110,255,175,0.45)';
      ctx.shadowBlur = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ─── ④ 中心：地心（观测者）+ 太极 —— 日主不画在圆心（它是关系原点，不是空间中心） ───
  circle(R * 0.30, 'rgba(255,196,87,0.30)', 1);
  text(DATA.dm, 0, 0, { color: '#ffd58a' });   // 由下面的太极覆盖位置
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, Math.cos(tiltRad()));
  const rr = R * 0.17;
  ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,16,24,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,87,0.5)'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rr * 0.8, -Math.PI / 2, Math.PI / 2);
  ctx.arc(0, rr * 0.4, rr * 0.4, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(0, -rr * 0.4, rr * 0.4, Math.PI / 2, -Math.PI / 2);
  ctx.fillStyle = 'rgba(255,196,87,0.20)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -rr * 0.4, rr * 0.1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,196,87,0.8)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, rr * 0.4, rr * 0.1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,229,255,0.8)'; ctx.fill();
  ctx.restore();
  // 日主标注放在内环上方
  {
    const p = proj(270, R * 0.22);
    ctx.save();
    ctx.fillStyle = '#ffe6a8';
    ctx.font = '700 15px "Noto Sans SC",system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffc457'; ctx.shadowBlur = 10;
    ctx.fillText('⊙ 地心', p.x, p.y);
    ctx.restore();
  }

  // ─── ⑤ ★ 恒等连线：月支 ⇔ 太阳黄经 ───
  if (state.show.link && DATA.monthZhi != null && DATA.sunLon != null) {
    const fromDeg = (1 * (360 / (DATA.pillars.length || 4)));   // 月柱在七柱环的方位（i=1）
    const p1 = proj(fromDeg, R * 1.18);
    const p2 = proj(DATA.sunLon, R * 1.02);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo((p1.x + p2.x) / 2, Math.min(p1.y, p2.y) - R * 0.18, p2.x, p2.y);
    ctx.strokeStyle = 'rgba(255,196,87,0.75)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.shadowColor = '#ffc457'; ctx.shadowBlur = 12;
    ctx.stroke(); ctx.restore();
    // 标在中点
    const mx = (p1.x + p2.x) / 2, my = Math.min(p1.y, p2.y) - R * 0.18;
    ctx.save();
    ctx.fillStyle = 'rgba(255,196,87,0.92)';
    ctx.font = '600 10.5px "Noto Sans SC",system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('月支 ⇔ 太阳黄经（恒等）', mx, my);
    ctx.restore();
  }

  requestAnimationFrame(draw);
}

/* ══════════ 命中检测 ══════════ */
function hit(mx, my) {
  const t = tiltRad();
  const dx = mx - cx, dy = (my - cy) / Math.cos(t);
  const dist = Math.hypot(dx, dy);
  if (!DATA || dist > R * 1.75) return null;

  // 四柱环
  if (state.show.pillars && dist > R * 1.12 && dist < R * 1.60) {
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    a = ((a - state.rot) % 360 + 360) % 360;
    const N = DATA.pillars.length || 4;
    const i = Math.round(a / (360 / N)) % N;
    return { kind: 'pillar', i, pillar: DATA.pillars[i] };
  }
  // 行星
  for (const pl of DATA.planets) {
    if (typeof pl.lon !== 'number') continue;
    if (['上升', '天顶', '下降', '天底', '北交点', '南交点'].includes(pl.name)) continue;
    const p = proj(pl.lon, R * 0.96);
    if (Math.hypot(p.x - mx, p.y - my) < 11) return { kind: 'planet', name: pl.name, pl };
  }
  // 星座
  if (dist > R * 0.82 && dist < R * 1.10) {
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    a = ((a - state.rot) % 360 + 360) % 360;
    const i = Math.floor(a / 30) % 12;
    return { kind: 'sign', i, sign: SIGNS[i] };
  }
  return null;
}

function tipText(h) {
  if (!h) return '';
  const dm = DATA?.dm;
  if (h.kind === 'pillar') {
    const gan = h.pillar[0], zhi = h.pillar[1];
    const cang = (CANG[zhi] || []).map((g) => `${g}${GAN_WX[g]}·${tenGod(g, dm) ?? '?'}`).join('  ');
    const tag = h.i >= 4 ? '（实验柱 · 不参与排盘与身强弱判定）' : '（四柱 · 参与排盘与判定）';
    return `${PILLAR_NAMES[h.i]}${tag}　${h.pillar}　｜　${gan}${GAN_WX[gan]}·${tenGod(gan, dm) ?? '?'}　｜　藏气：${cang}`;
  }
  if (h.kind === 'planet') {
    const pl = h.pl;
    const tg = PLANET_TG[pl.name] ?? '—';
    const dom = pl.house ? HOUSE_DOMAIN[pl.house] : '—';
    return `${pl.name}　${pl.sign} ${pl.deg}°　第${pl.house ?? '?'}宫（${pl.house ? mansionOf(pl.house) : '?'}）　→ ${tg}组　落在：${dom}`;
  }
  if (h.kind === 'sign') {
    const zhiIdx = Math.round(((h.i * 30 - 270 + 360) % 360) / 30) % 12;
    return `星座 ${h.sign}（${h.i * 30}°–${h.i * 30 + 30}°）　·　对应地支 ${ZHI[zhiIdx]}`;
  }
  return '';
}

/* ══════════ 对外挂载 ══════════ */
export function mountFusionWheel(el, data) {
  if (!el) return;
  cv = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
  ctx = cv.getContext('2d');
  const tip = el.querySelector('.fw-tip');
  setFusionData(data);
  fit();
  new ResizeObserver(fit).observe(el);
  requestAnimationFrame(draw);
  setInterval(() => { if (state.spin && !state.drag) state.rot += 0.10; }, 30);

  cv.addEventListener('pointerdown', (e) => {
    state.drag = true; state.lastX = e.clientX; state.lastY = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch { }
    cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointerup', (e) => {
    state.drag = false; try { cv.releasePointerCapture(e.pointerId); } catch { } cv.style.cursor = 'grab';
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (state.drag) {
      state.rot += (e.clientX - state.lastX) * 0.4;
      state.tilt = Math.max(20, Math.min(82, state.tilt + (e.clientY - state.lastY) * 0.14));
      state.lastX = e.clientX; state.lastY = e.clientY;
      state.hover = null; if (tip) tip.style.opacity = 0; return;
    }
    const h = hit(mx, my);
    state.hover = h;
    if (tip) {
      if (h) {
        tip.textContent = tipText(h);
        tip.style.opacity = 1;
        tip.style.left = Math.min(W - 340, Math.max(8, mx + 14)) + 'px';
        tip.style.top = Math.max(6, my - 38) + 'px';
      } else tip.style.opacity = 0;
    }
    cv.style.cursor = h ? 'pointer' : 'grab';
  });
  cv.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return; e.preventDefault();
    state.zoom = Math.max(0.62, Math.min(1.55, state.zoom - e.deltaY * 0.0008));
    fit();
  }, { passive: false });
  cv.style.cursor = 'grab';

  el.querySelectorAll('[data-fw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.dataset.fw;
      if (k === 'spin') { state.spin = !state.spin; btn.classList.toggle('on', state.spin); }
      else if (k === 'reset') { state.rot = 0; state.tilt = 58; state.zoom = 1; fit(); }
      else if (k === 'flat') state.tilt = 20;
      else if (k === 'top') state.tilt = 78;
      else if (state.show[k] !== undefined) { state.show[k] = !state.show[k]; btn.classList.toggle('on', state.show[k]); }
    });
    // 初始态
    if (['pillars', 'planets', 'aspects', 'houses', 'link'].includes(btn.dataset.fw)) {
      btn.classList.toggle('on', state.show[btn.dataset.fw]);
    }
    if (btn.dataset.fw === 'spin') btn.classList.add('on');
  });
}

export function setFusionData(data) {
  if (!data) return;
  const pillars = data.bazi?.pillars ?? data.pillars ?? [];
  const planets = data.natal?.planets ?? data.planets ?? [];
  const monthZhiChar = pillars[1]?.[1];
  const monthZhi = monthZhiChar ? ZHI.indexOf(monthZhiChar) : null;
  const sun = (Array.isArray(planets) ? planets : Object.values(planets)).find((p) => p?.name === '太阳');
  // ★ 七柱：四柱 + 胎元 + 命宫 + 身宫
  const b = data.bazi ?? {};
  const extra = [b.taiYuan, b.mingGong, b.shenGong].filter((x) => typeof x === 'string' && x.length >= 2);
  const pillars7 = pillars.concat(extra);
  DATA = {
    pillars: pillars7, dm: b.dayMaster ?? data.dayMaster ?? '', planets,
    cusps: data.natal?.cusps ?? data.cusps ?? [],
    aspects: data.natal?.aspects ?? data.aspects ?? [],
    asc: data.natal?.angles?.asc ?? null,
    monthZhi: monthZhi >= 0 ? monthZhi : null,
    sunLon: sun?.lon ?? null,
  };
}

export { state as fusionWheelState };

/* ══════════ 自动挂载 + 对外钩子（供 app.js 在拿到排盘结果后喂数据） ══════════ */
let _mounted = false;
let _pending = null;

function __fwInit() {
  const host = document.querySelector('#fusion-wheel-host');
  if (!host || _mounted) return;
  mountFusionWheel(host, _pending);
  _mounted = true;
}
window.__fwSetData = function (data) {
  _pending = data;
  if (!_mounted) { __fwInit(); }
  else { setFusionData(data); }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __fwInit);
else __fwInit();
