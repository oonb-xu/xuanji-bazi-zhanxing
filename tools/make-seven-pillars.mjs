// 四柱 → 七柱：加入 胎元 / 命宫 / 身宫
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion-wheel.js', 'utf8');

/* ① 柱名表 */
s = s.replace(
  "const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱'];",
  "const PILLAR_NAMES = ['年柱', '月柱', '日柱', '时柱', '胎元', '命宫', '身宫'];"
);

/* ② 数据里组装七柱 */
s = s.replace(
  `  DATA = {
    pillars, dm: data.bazi?.dayMaster ?? data.dayMaster ?? '', planets,`,
  `  // ★ 七柱：四柱 + 胎元 + 命宫 + 身宫
  const b = data.bazi ?? {};
  const extra = [b.taiYuan, b.mingGong, b.shenGong].filter((x) => typeof x === 'string' && x.length >= 2);
  const pillars7 = pillars.concat(extra);
  DATA = {
    pillars: pillars7, dm: b.dayMaster ?? data.dayMaster ?? '', planets,`
);

/* ③ 四柱环 → 七柱环（等分 360/7，而不是四等分） */
s = s.replace(
  `    DATA.pillars.forEach((p, i) => {
      const base = i * 90;
      radialLine(base, R * 1.18, R * 1.30, 'rgba(255,196,87,0.45)', 1);
      const hot = state.hover?.kind === 'pillar' && state.hover.i === i;
      text(p, base, R * 1.40, { color: hot ? '#ffe6a8' : '#ffd58a', size: hot ? 26 : 21, bold: true, glow: hot ? 14 : 6 });
      text(PILLAR_NAMES[i], base, R * 1.52, { color: 'rgba(255,196,87,0.55)', size: 10 });
    });`,
  `    const N = DATA.pillars.length || 4;
    const step = 360 / N;
    DATA.pillars.forEach((p, i) => {
      const base = i * step;
      const isExtra = i >= 4;                      // 胎元/命宫/身宫
      const hot = state.hover?.kind === 'pillar' && state.hover.i === i;
      radialLine(base, R * 1.18, R * 1.30, isExtra ? 'rgba(255,196,87,0.28)' : 'rgba(255,196,87,0.45)', 1);
      const col = hot ? '#ffe6a8' : (isExtra ? 'rgba(255,213,138,0.78)' : '#ffd58a');
      text(p, base, R * 1.40, { color: col, size: hot ? 25 : (isExtra ? 18 : 21), bold: true, glow: hot ? 14 : 6 });
      text(PILLAR_NAMES[i], base, R * 1.52, { color: isExtra ? 'rgba(255,196,87,0.40)' : 'rgba(255,196,87,0.55)', size: 10 });
    });`
);

/* ④ 内环天干环也用七柱 */
s = s.replace(
  `    DATA.pillars.forEach((p, i) => {
      const base = i * 90;
      text(p[0], base, R * 0.50, { color: 'rgba(255,196,87,0.9)', size: 20, bold: true, glow: 8 });
    });`,
  `    const N2 = DATA.pillars.length || 4, step2 = 360 / N2;
    DATA.pillars.forEach((p, i) => {
      text(p[0], i * step2, R * 0.50, { color: 'rgba(255,196,87,0.9)', size: 18, bold: true, glow: 8 });
    });`
);

/* ⑤ 命中检测：改用 7 等分 */
s = s.replace(
  `    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    a = ((a - state.rot) % 360 + 360) % 360;
    const i = Math.round(a / 90) % 4;
    return { kind: 'pillar', i, pillar: DATA.pillars[i] };`,
  `    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    a = ((a - state.rot) % 360 + 360) % 360;
    const N = DATA.pillars.length || 4;
    const i = Math.round(a / (360 / N)) % N;
    return { kind: 'pillar', i, pillar: DATA.pillars[i] };`
);

/* ⑥ 恒等连线：月柱位置改为 1 × (360/N) */
s = s.replace(
  "    const fromDeg = DATA.monthZhi * 90 + 90;   // 月柱在四柱环的方位（i=1 ⇒ 90°）",
  "    const fromDeg = (1 * (360 / (DATA.pillars.length || 4)));   // 月柱在七柱环的方位（i=1）"
);

/* ⑦ tooltip 支持七柱 */
s = s.replace(
  "    return `${PILLAR_NAMES[h.i]}　${h.pillar}　｜　${gan}${GAN_WX[gan]}·${tenGod(gan, dm) ?? '?'}　｜　藏气：${cang}`;",
  "    const tag = h.i >= 4 ? '（补充柱）' : '';\n    return `${PILLAR_NAMES[h.i]}${tag}　${h.pillar}　｜　${gan}${GAN_WX[gan]}·${tenGod(gan, dm) ?? '?'}　｜　藏气：${cang}`;"
);

fs.writeFileSync('web/fusion-wheel.js', s, 'utf8');
console.log('七柱改造完成');
