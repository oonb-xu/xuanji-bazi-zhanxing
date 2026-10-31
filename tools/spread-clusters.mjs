// 解决「星体聚集时很难看」：按真实黄经分簇 → 沿圆周扇开 + 真实位置留刻度 + 连线
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (s.includes('spreadLongitudes')) { console.log('已应用'); process.exit(0); }

/* ── ① 插入分簇扇开算法（放在 draw 之前） ── */
s = s.replace(
  "function draw() {",
  `/**
 * ★ 星群扇开：把靠得过近的行星沿圆周分开，避免球体重叠
 * @param items  [{ pl, pr }]  pr = 该行星的屏幕半径（像素）
 * @returns Map<name, {lon, cluster, sidx}>
 *   lon    = 显示用黄经（扇开后的）
 *   真实位置仍用 pl.lon，另外画刻度点 + 连线
 */
function spreadLongitudes(items) {
  const out = new Map();
  if (!items.length) return out;
  // 角度 → 该处每度对应多少屏幕像素（用于把像素间距换算成角度）
  const pxPerDeg = Math.max(0.8, (2 * Math.PI * R * PLANET_RING_R) / 360 * (R / Math.max(80, R)) );

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

function draw() {`
);
console.log('① 分簇扇开算法已加');

/* ── ② 行星绘制块：改用扇开后的位置 ── */
const OLD_POS = "      const v = mul(eclToVec(pl.lon), rr);\n      const c = toCam(v);\n      if (c.z <= 0.02) continue;\n      const sc = toScreen(c);\n      items.push({ pl, st, sc, depth: c.z, rr });";
const NEW_POS = "      // 屏幕半径（供分簇算法判断需要多少间距）\n      const c0 = toCam(mul(eclToVec(pl.lon), rr));\n      const sc0 = toScreen(c0);\n      const baseR0 = st ? st.r : 0.55;\n      let pr0 = (1.6 + baseR0 * 2.6) * 0.0190 * Math.min(sc0.s, 900);\n      if (pl.name === '太阳') pr0 = Math.max(14, baseR0 * sc0.s * 0.0220);\n      pr0 = Math.max(7, Math.min(pr0, Math.min(W, H) * 0.34));\n      items.push({ pl, st, sc: sc0, depth: c0.z, rr, pr: pr0, lon: pl.lon });";
if (!s.includes(OLD_POS)) { console.log('⚠️ 行星位置代码不匹配'); } else {
  s = s.replace(OLD_POS, NEW_POS);
  console.log('② 采集阶段已带像素半径');
}

/* ③ 排序后计算显示黄经 */
s = s.replace(
  "    // 远的先画（画家算法）\n    items.sort((a, b) => b.depth - a.depth);",
  `    // ★ 先算扇开后的显示黄经
    const DISP = spreadLongitudes(items);
    // 远的先画（画家算法）
    items.sort((a, b) => b.depth - a.depth);`
);

/* ④ 位置改显示经度 + 画真实刻度 + 连线 */
s = s.replace(
  `      // 半径：基础尺寸 × 透视缩放（越近越大）
      const baseR = st ? st.r : 0.55;
      // 真实相对尺寸（木星/土星大、水星小），再压缩动态范围
      let pr = (1.6 + baseR * 2.6) * 0.0190 * Math.min(sc.s, 900);
      // 太阳在中心，另给基础大小
      if (pl.name === '太阳') pr = Math.max(14, baseR * sc.s * 0.0220);
      pr = Math.max(7, Math.min(pr, Math.min(W, H) * 0.34));`,
  `      // ★ 扇开后的位置（球体不再重叠）
      const dinfo = DISP.get(pl.name) ?? { lon: pl.lon, cluster: 1 };
      const showLon = dinfo.lon;
      const vDisp = mul(eclToVec(showLon), rr);
      const cDisp = toCam(vDisp);
      if (cDisp.z <= 0.02) continue;
      const scD = toScreen(cDisp);
      const scX = scD.x, scY = scD.y;
      // 半径：基础尺寸 × 透视缩放；星群内稍缩，避免挤
      const baseR = st ? st.r : 0.55;
      let pr = (1.6 + baseR * 2.6) * 0.0190 * Math.min(scD.s, 900);
      if (pl.name === '太阳') pr = Math.max(14, baseR * scD.s * 0.0220);
      pr = Math.max(6, Math.min(pr, Math.min(W, H) * 0.34));
      if (dinfo.cluster > 1) pr *= Math.max(0.62, 1 - 0.09 * (dinfo.cluster - 1));
      // ★ 真实位置的刻度点 + 连线（保证不丢真实黄经）
      if (dinfo.cluster > 1 && Math.abs(((showLon - dinfo.trueLon + 540) % 360) - 180) > 0.4) {
        const vT = mul(eclToVec(dinfo.trueLon), rr);
        const cT = toCam(vT);
        if (cT.z > 0.02) {
          const scT = toScreen(cT);
          ctx.save();
          ctx.beginPath(); ctx.arc(scT.x, scT.y, 2.0, 0, PI * 2);
          ctx.fillStyle = 'rgba(0,229,255,0.75)'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(scT.x, scT.y); ctx.lineTo(scX, scY);
          ctx.strokeStyle = 'rgba(0,229,255,0.26)'; ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 3]); ctx.stroke();
          ctx.restore();
        }
      }`
);

/* ⑤ 把后面用到的 sc 换成 scX/scY */
s = s.replace(
  `      if (st) {
        const lightA = Math.atan2(H / 2 - sc.y, W / 2 - sc.x);
        if (window.__glPlanets && !pl.name.startsWith('冥') && !pl.name.startsWith('凯')) {
          // ★ WebGL 纹理球体
          glDrawQueue.push({ x: sc.x, y: sc.y, r: pr * (hot ? 1.12 : 1), name: pl.name, spin: (pl.lon / 40 + performance.now() / 9000) % (Math.PI * 2), light: lightA });
        } else {
          drawPlanetSphere(sc.x, sc.y, pr * (hot ? 1.10 : 1), st, lightA, { alpha: 1 });
        }
      } else {
        ctx.save();
        ctx.beginPath(); ctx.arc(sc.x, sc.y, hot ? 6 : 3.2, 0, PI * 2);
        ctx.fillStyle = hot ? '#fff' : '#5ef1ff';
        ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 10; ctx.fill();
        ctx.restore();
      }`,
  `      if (st) {
        const lightA = Math.atan2(H / 2 - scY, W / 2 - scX);
        if (window.__glPlanets && !pl.name.startsWith('冥') && !pl.name.startsWith('凯')) {
          // ★ WebGL 纹理球体
          glDrawQueue.push({ x: scX, y: scY, r: pr * (hot ? 1.12 : 1), name: pl.name, spin: (pl.lon / 40 + performance.now() / 9000) % (Math.PI * 2), light: lightA, depth: it.depth });
        } else {
          drawPlanetSphere(scX, scY, pr * (hot ? 1.10 : 1), st, lightA, { alpha: 1 });
        }
      } else {
        ctx.save();
        ctx.beginPath(); ctx.arc(scX, scY, hot ? 6 : 3.2, 0, PI * 2);
        ctx.fillStyle = hot ? '#fff' : '#5ef1ff';
        ctx.shadowColor = '#5ef1ff'; ctx.shadowBlur = hot ? 18 : 10; ctx.fill();
        ctx.restore();
      }`
);

/* ⑥ 标签位置改用扇开坐标 */
s = s.replace(
  `      const offX = sc.x - W / 2, offY = sc.y - H / 2;
      const L = Math.hypot(offX, offY) || 1;
      const lx2 = sc.x + (offX / L) * (pr + 14);
      const ly2 = sc.y + (offY / L) * (pr + 14);`,
  `      const offX = scX - W / 2, offY = scY - H / 2;
      const L = Math.hypot(offX, offY) || 1;
      const lx2 = scX + (offX / L) * (pr + 13);
      const ly2 = scY + (offY / L) * (pr + 13);`
);

/* ⑦ 星群标个数（簇内第一颗画一个 ×N 徽标） */
s = s.replace(
  `        txt(label, lx2, ly2, { color: hot ? '#fff' : 'rgba(170,235,255,0.88)', size: hot ? 13 : 10.5, glow: hot ? 12 : 0 });`,
  `        txt(label, lx2, ly2, { color: hot ? '#fff' : 'rgba(170,235,255,0.88)', size: hot ? 13 : 10.5, glow: hot ? 12 : 0 });
        if (dinfo.cluster > 1 && dinfo.sidx === 0) {
          txt('★' + dinfo.cluster, lx2, ly2 - 13, { color: 'rgba(255,196,87,0.85)', size: 8.5, bold: true, glow: 6 });
        }`
);

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('③–⑦ 扇开渲染已完成');
