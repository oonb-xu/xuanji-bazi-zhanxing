// 融合盘美化 v2：
//   ① 宫位领域内环（1–12 宫的领域名，最直观）
//   ② 卦象环：八卦 ☰☱☲☳☴☵☶☷（反向缓转）
//   ③ 星座符号 ♈♉♊… + 行星符号 ☉☽☿♀♂♃♄♅♆♇
//   ④ 星尘粒子背景 + 相位线辉光
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion-wheel.js', 'utf8');

/* ── ① 常量：符号表 + 领域 ── */
if (!s.includes('SIGN_GLYPH')) {
  s = s.replace(
    "const HOUSE_DOMAIN = {",
    `const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const PLANET_GLYPH = { 太阳: '☉', 月亮: '☽', 水星: '☿', 金星: '♀', 火星: '♂', 木星: '♃', 土星: '♄', 天王星: '♅', 海王星: '♆', 冥王星: '♇', 凯龙: '⚷' };
const BAGUA = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷'];   // 乾兑离震巽坎艮坤
const BAGUA_NAME = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

const HOUSE_DOMAIN = {`
  );
  console.log('① 符号表已加');
}

/* ── ② 星尘粒子（初始化一次）── */
if (!s.includes('DUST')) {
  s = s.replace(
    "let DATA = null;   // { pillars, dm, planets, cusps, aspects, asc }",
    `let DATA = null;   // { pillars, dm, planets, cusps, aspects, asc }
// 星尘粒子
const DUST = Array.from({ length: 90 }, () => ({
  x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.4,
  p: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 1.2,
}));`
  );
  console.log('② 星尘已加');
}

/* ── ③ 在 drawFloor 之后画星尘 ── */
s = s.replace(
  "  ctx.clearRect(0, 0, W, H);\n  drawFloor();",
  `  ctx.clearRect(0, 0, W, H);
  drawFloor();
  // 星尘
  {
    const t = performance.now() / 1000;
    for (const d of DUST) {
      const a = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(t * d.sp + d.p));
      ctx.beginPath();
      ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
      ctx.fillStyle = \`rgba(150,220,255,\${a.toFixed(3)})\`;
      ctx.fill();
    }
  }`
);

/* ── ④ 星座：加符号 ── */
s = s.replace(
  "    text(SIGNS[i], lon + 15, R * 0.90, { color: hot ? '#a8f4ff' : 'rgba(90,190,220,0.85)', size: hot ? 14 : 11.5 });",
  `    text(SIGN_GLYPH[i], lon + 15, R * 0.96, { color: hot ? '#d9fbff' : 'rgba(120,215,245,0.62)', size: hot ? 17 : 14, glow: hot ? 12 : 0 });
    text(SIGNS[i], lon + 15, R * 0.87, { color: hot ? '#a8f4ff' : 'rgba(90,190,220,0.82)', size: hot ? 13 : 10.5 });`
);

/* ── ⑤ 行星：加符号 ── */
s = s.replace(
  "            text(pl.name, pl.lon, R * rr, { color: hot ? '#fff' : 'rgba(148,230,255,0.85)', size: hot ? 13 : 11 });",
  `            const g = PLANET_GLYPH[pl.name];
            text(g ? \`\${g} \${pl.name}\` : pl.name, pl.lon, R * rr, { color: hot ? '#fff' : 'rgba(148,230,255,0.85)', size: hot ? 13 : 11, glow: hot ? 10 : 0 });`
);

/* ── ⑥ 宫位领域环 + 卦象环（插在行星绘制之前）── */
s = s.replace(
  "  // ─── 行星（青点）───",
  `  // ─── 宫位领域内环（最直观：1–12 宫分别是什么领域）───
  if (state.show.houses && DATA.cusps?.length === 12) {
    circle(R * 0.66, 'rgba(255,196,87,0.12)', 1, [1, 5]);
    for (let h = 0; h < 12; h++) {
      const c0 = DATA.cusps[h];
      let c1 = DATA.cusps[(h + 1) % 12];
      if (c1 <= c0) c1 += 360;
      const mid = ((c0 + c1) / 2) % 360;
      const dom = HOUSE_DOMAIN[h + 1] ?? '';
      text(String(h + 1), mid, R * 0.735, { color: 'rgba(255,196,87,0.42)', size: 9 });
      text(dom, mid, R * 0.665, { color: 'rgba(170,215,240,0.62)', size: 8.5 });
    }
  }

  // ─── 卦象环（反向缓转，装饰）───
  {
    const rot2 = -state.rot * 0.45;
    for (let i = 0; i < 8; i++) {
      const a = i * 45 + rot2;
      text(BAGUA[i], a, R * 0.40, { color: 'rgba(255,196,87,0.52)', size: 17, glow: 6 });
      text(BAGUA_NAME[i], a, R * 0.325, { color: 'rgba(255,196,87,0.26)', size: 8 });
    }
  }

  // ─── 行星（青点）───`
);

/* ── ⑦ 相位线加辉光（硬相位红、软相位绿）── */
s = s.replace(
  `      ctx.strokeStyle = hard ? 'rgba(255,120,120,0.13)' : 'rgba(120,255,180,0.11)';
      ctx.lineWidth = 0.8; ctx.stroke();`,
  `      ctx.strokeStyle = hard ? 'rgba(255,120,120,0.16)' : 'rgba(120,255,180,0.13)';
      ctx.lineWidth = 0.85;
      ctx.shadowColor = hard ? 'rgba(255,110,110,0.5)' : 'rgba(110,255,175,0.45)';
      ctx.shadowBlur = 3;
      ctx.stroke();`
);

/* ── ⑧ 控制条加「卦象」开关 ── */
s = s.replace(
  "show: { pillars: true, planets: true, aspects: true, houses: true, link: true },",
  "show: { pillars: true, planets: true, aspects: true, houses: true, link: true, bagua: true },"
);

fs.writeFileSync('web/fusion-wheel.js', s, 'utf8');
console.log('③–⑧ 美化已写入');
