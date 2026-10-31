// 整块重写行星绘制（原块被补丁改过 6 次已不可靠）
// 策略：按花括号配对精确定位 `if (show.planets) {` 整块，替换为防御式新实现
import fs from 'node:fs';

let s = fs.readFileSync('web/fusion3d.js', 'utf8');

const START = '  if (show.planets) {';
const startIdx = s.indexOf(START);
if (startIdx < 0) { console.error('❌ 未找到行星块起点'); process.exit(1); }

// 从 START 的 { 开始做花括号配对
let depth = 0, i = startIdx + START.length - 1, endIdx = -1, inStr = null, esc = false;
for (; i < s.length; i++) {
  const ch = s[i];
  if (inStr) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === inStr) inStr = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
  if (ch === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
  if (ch === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i++; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
}
if (endIdx < 0) { console.error('❌ 花括号配对失败'); process.exit(1); }

const NEW = `  if (show.planets) {
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
`;

s = s.slice(0, startIdx) + NEW + s.slice(endIdx + 1);

/* 辅助：需要跳过的虚点名 */
if (!s.includes('AUX_NAMES')) {
  s = s.replace(
    "const PLANET_RING_R = 0.86;",
    "const PLANET_RING_R = 0.86;\nconst AUX_NAMES = new Set(['上升', '天顶', '下降', '天底', '北交点', '南交点']);"
  );
}

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('✅ 行星绘制块已整体重写（防御式）');
