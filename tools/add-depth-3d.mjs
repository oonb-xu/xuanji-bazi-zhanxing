// 加入真实纵深：行星按真实轨道距离放置 + 轨道圈 + 深度排序
//   · 月亮 0.0026AU（几乎贴脸）→ 冥王 39.5AU
//   · 半径用 log 压缩：r = 0.26 + 0.78 * log10(1+AU)/log10(41)
//   · 每颗行星画出自己的轨道圈（黄道面）
//   · 深度排序：远先画，近后画（真实遮挡关系）
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

/* ① 真实轨道距离表 */
if (!s.includes('PLANET_AU')) {
  s = s.replace(
    "// 行星外观：颜色 / 相对半径 / 特殊处理",
    `// 行星真实轨道距离（AU，对地球的平均/半长轴近似）
const PLANET_AU = {
  月亮: 0.0026, 太阳: 1.0, 水星: 0.387, 金星: 0.723, 火星: 1.524,
  木星: 5.203, 土星: 9.537, 天王星: 19.19, 海王星: 30.07, 冥王星: 39.48, 凯龙: 13.7,
};
const AU_MIN_LOG = 0, AU_MAX_LOG = Math.log10(41);
/** AU → 场景半径（0.26 ~ 1.04，log 压缩让内外行星都看得见） */
function orbitRadius(name) {
  const au = PLANET_AU[name];
  if (au === undefined) return 0.55;
  const t = Math.log10(1 + au) / AU_MAX_LOG;
  return 0.26 + 0.78 * t;
}

// 行星外观：颜色 / 相对半径 / 特殊处理`
  );
  console.log('① 真实轨道距离表已加');
}

/* ② 画轨道圈（插在 ring3D 之后） */
if (!s.includes('function orbitRing')) {
  s = s.replace(
    "/** 从中心到某黄经的辐条 */",
    `/** 画某个半径的黄道面圆环（行星轨道） */
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

/** 从中心到某黄经的辐条 */`
  );
  console.log('② 轨道圈函数已加');
}

/* ③ 行星绘制：改用真实轨道半径 + 深度排序 + 轨道圈 */
const OLD_BLOCK_START = "  /* ── 行星（按真实黄经，画在 0.85）── */";
const NEW_BLOCK = `  /* ── 行星（真实黄经 × 真实轨道距离，带深度排序）── */
  if (show.planets && show.orbits !== false) {
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
    const items = [];
    for (const pl of DATA.planets) {
      if (typeof pl.lon !== 'number') continue;
      if (['上升', '天顶', '下降', '天底', '北交点', '南交点'].includes(pl.name)) continue;
      const st = PLANET_STYLE[pl.name];
      const rr = orbitRadius(pl.name);
      const v = mul(eclToVec(pl.lon), rr);
      const c = toCam(v);
      if (c.z <= 0.02) continue;
      const sc = toScreen(c);
      items.push({ pl, st, sc, depth: c.z, rr });
    }
    // 远的先画（画家算法）
    items.sort((a, b) => b.depth - a.depth);

    const placed = [];
    for (const it of items) {
      const { pl, st, sc, rr } = it;
      const hot = hover?.kind === 'planet' && hover.name === pl.name;
      // 半径：基础尺寸 × 透视缩放（越近越大）
      const baseR = st ? st.r : 0.55;
      let pr = baseR * sc.s * 0.0090;
      // 太阳在中心，另给基础大小
      if (pl.name === '太阳') pr = Math.max(5, baseR * sc.s * 0.0060);
      pr = Math.max(2.2, Math.min(pr, Math.min(W, H) * 0.30));
      if (st) {
        drawPlanetSphere(sc.x, sc.y, pr * (hot ? 1.10 : 1), st, Math.atan2(H / 2 - sc.y, W / 2 - sc.x), { alpha: 1 });
      } else {
        ctx.save();
        ctx.beginPath(); ctx.arc(sc.x, sc.y, hot ? 6 : 3.2, 0, PI * 2);
        ctx.fillStyle = hot ? '#fff' : '#5ef1ff';
        ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 10; ctx.fill();
        ctx.restore();
      }
      // 标签：放在星球外侧
      const g = PLANET_GLYPH[pl.name];
      const label = g ? \`\${g}\${pl.name}\` : pl.name;
      const offX = sc.x - W / 2, offY = sc.y - H / 2;
      const L = Math.hypot(offX, offY) || 1;
      const lx2 = sc.x + (offX / L) * (pr + 14);
      const ly2 = sc.y + (offY / L) * (pr + 14);
      const clash = placed.some((p) => Math.hypot(p.x - lx2, p.y - ly2) < 24);
      if (!clash || hot) {
        placed.push({ x: lx2, y: ly2 });
        txt(label, lx2, ly2, { color: hot ? '#fff' : 'rgba(170,235,255,0.88)', size: hot ? 13 : 10.5, glow: hot ? 12 : 0 });
        // 轨道半径标注（小字）
        if (!clash && sc.s > 30) {
          txt(\`\${it.rr.toFixed(2)}R\`, lx2, ly2 + 12, { color: 'rgba(0,229,255,0.32)', size: 8 });
        }
      }
    }
  }
`;

// 找到旧行星块的起止（到恒等连线之前）
const startIdx = s.indexOf(OLD_BLOCK_START);
const endMark = "  /* ── 恒等连线：月支 ⇔ 太阳黄经 ── */";
const endIdx = s.indexOf(endMark);
if (startIdx > 0 && endIdx > startIdx) {
  s = s.slice(0, startIdx) + NEW_BLOCK + '\n' + s.slice(endIdx);
  console.log('③ 行星块已替换（真实纵深 + 轨道圈 + 深度排序）');
} else {
  console.log('③ ⚠️ 未定位旧行星块', startIdx, endIdx);
}

/* ④ 命中检测：按新半径算 */
s = s.replace(
  `    const s = proj(mul(eclToVec(pl.lon), 0.85));
    if (s.z <= 0.02) continue;
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d < bd) { bd = d; best = { kind: 'planet', name: pl.name, pl }; }`,
  `    const s = proj(mul(eclToVec(pl.lon), orbitRadius(pl.name)));
    if (s.z <= 0.02) continue;
    const d = Math.hypot(s.x - mx, s.y - my);
    if (d < bd) { bd = d; best = { kind: 'planet', name: pl.name, pl }; }`
);

/* ⑤ 恒等连线的太阳端也改用真实轨道半径 */
s = s.replace(
  "    const b = proj(mul(eclToVec(DATA.sunLon), 0.85));",
  "    const b = proj(mul(eclToVec(DATA.sunLon), orbitRadius('太阳')));"
);

/* ⑥ show 表加 orbits */
s = s.replace(
  "const show = { stars: true, zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true };",
  "const show = { stars: true, zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true, orbits: true };"
);

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('④–⑥ 完成');
