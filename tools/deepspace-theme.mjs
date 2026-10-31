// ① 删掉群星背景，改为宇宙深空（星云渐层，无星点）
// ② 整个界面换深空主题
import fs from 'node:fs';

/* ══════════ ① fusion3d.js：不再画星空 ══════════ */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

// 移除恒星绘制块（整段）
const starBlockStart = s.indexOf('  /* ── 恒星（真实星表，按星等定大小与亮度）── */');
const starBlockEnd = s.indexOf('  /* ── 黄道 + 星座环 ── */');
if (starBlockStart > 0 && starBlockEnd > starBlockStart) {
  s = s.slice(0, starBlockStart) + s.slice(starBlockEnd);
  console.log('① 群星背景已删除');
}

// 星空开关去掉（HTML 里也没了）
s = s.replace("const show = { stars: true, zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true, orbits: false };",
  "const show = { zodiac: true, pillars: true, planets: true, houses: true, bagua: true, ecliptic: true, orbits: false };");
s = s.replace("if (['stars', 'zodiac', 'pillars', 'planets', 'houses', 'bagua', 'ecliptic', 'orbits'].includes(btn.dataset.fw))",
  "if (['zodiac', 'pillars', 'planets', 'houses', 'bagua', 'ecliptic', 'orbits'].includes(btn.dataset.fw))");

// 背景换成深空星云（不带星点）
s = s.replace(
  `  // 背景渐变
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  bg.addColorStop(0, 'rgba(6,18,30,1)');
  bg.addColorStop(1, 'rgba(2,5,9,1)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);`,
  `  // ★ 宇宙深空：三层星云渐层（无星点）
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
  }`
);
console.log('② 深空星云背景已生效');

fs.writeFileSync('web/fusion3d.js', s, 'utf8');

/* ══════════ ② 全局深空主题 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* ══ DEEP SPACE THEME')) {
  css += `

/* ══ DEEP SPACE THEME ══ 整个界面改为宇宙深空（无星点） */
:root{
  --bg:#01030a;
  --bg2:#040814;
  --card:rgba(8,14,28,.72);
  --line:rgba(90,140,220,.16);
}
html,body{
  background:
    radial-gradient(1200px 700px at 18% 12%, rgba(40,90,190,.16), transparent 62%),
    radial-gradient(1000px 620px at 84% 86%, rgba(140,60,170,.13), transparent 66%),
    radial-gradient(900px 540px at 50% 45%, rgba(0,150,180,.08), transparent 60%),
    linear-gradient(180deg,#01030a,#02050e 55%,#01030a) !important;
  background-attachment:fixed !important;
}
header.topbar{
  background:linear-gradient(180deg,rgba(2,6,16,.92),rgba(2,6,16,.72)) !important;
  border-bottom:1px solid rgba(90,140,220,.14) !important;
  backdrop-filter:blur(14px) !important;
}
.tabbar{
  background:linear-gradient(180deg,rgba(3,8,18,.96),rgba(1,3,10,.98)) !important;
  border-right:1px solid rgba(90,140,220,.14) !important;
}
#app,#main{ background:transparent !important }
.card{
  background:linear-gradient(180deg,rgba(9,16,30,.78),rgba(6,11,22,.82)) !important;
  border-color:rgba(90,140,220,.18) !important;
  backdrop-filter:blur(10px) !important;
  box-shadow:0 4px 28px rgba(0,0,0,.35) !important;
}
.stage-hero{
  background:
    radial-gradient(1200px 700px at 26% 22%, rgba(40,90,190,.18), transparent 64%),
    radial-gradient(900px 560px at 78% 80%, rgba(140,60,170,.13), transparent 68%),
    linear-gradient(180deg,#01030a,#02050e 60%,#01030a) !important;
  border-bottom-color:rgba(90,140,220,.14) !important;
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ 深空主题已加');
}
