// hero 首屏舞台（stage.js）也改成深空：去掉透视网格地面，换成星云
import fs from 'node:fs';

let s = fs.readFileSync('web/stage.js', 'utf8');
if (s.includes('// ★ 深空：无网格')) { console.log('已改'); process.exit(0); }

// ① drawGrid 改为空（不画网格地面）
s = s.replace(
  "function drawGrid() {",
  `function drawGrid() {
  // ★ 深空：无网格、无星点，只保留一层极淡的中心辉光（背景渐变已由 CSS 提供）
  return;`
);

// ② 背景渐变也换成深空色调
s = s.replace(
  `  const g = ctx.createRadialGradient(cx, cy + R * 0.15, R * 0.1, cx, cy + R * 0.15, R * 1.5);
  g.addColorStop(0, 'rgba(0,229,255,0.10)');
  g.addColorStop(0.45, 'rgba(0,140,180,0.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);`,
  `  // ★ 深空：三层星云
  const g = ctx.createRadialGradient(cx * 0.7, cy * 0.6, 0, cx * 0.7, cy * 0.6, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(40,90,190,0.20)');
  g.addColorStop(0.5, 'rgba(20,50,120,0.07)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(cx * 1.5, cy * 1.4, 0, cx * 1.5, cy * 1.4, Math.max(W, H) * 0.6);
  g2.addColorStop(0, 'rgba(140,60,170,0.15)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);`
);

fs.writeFileSync('web/stage.js', s, 'utf8');
console.log('① hero 舞台已改深空');

// ③ CSS：hero 背景换深空
let css = fs.readFileSync('web/style.css', 'utf8');
css = css.replace(
  `.stage-hero{
  position:relative;width:100%;height:calc(100dvh - 56px);min-height:560px;
  overflow:hidden;
  background:
    radial-gradient(1200px 600px at 50% 12%, rgba(0,120,150,0.16), transparent 65%),
    radial-gradient(800px 400px at 80% 80%, rgba(255,160,40,0.06), transparent 70%),
    linear-gradient(180deg,#050a10 0%,#070d15 55%,#04080c 100%);
  border-bottom:1px solid rgba(0,229,255,0.12);
}`,
  `.stage-hero{
  position:relative;width:100%;height:calc(100dvh - 56px);min-height:560px;
  overflow:hidden;
  background:
    radial-gradient(1200px 680px at 30% 22%, rgba(40,90,190,0.20), transparent 64%),
    radial-gradient(950px 560px at 78% 80%, rgba(140,60,170,0.15), transparent 68%),
    radial-gradient(760px 460px at 52% 46%, rgba(0,150,180,0.09), transparent 62%),
    linear-gradient(180deg,#01030a,#02050e 58%,#01030a) !important;
  border-bottom:1px solid rgba(90,140,220,0.14);
}`
);
// 扫描线也去掉（那是科技风元素，不属于深空）
css = css.replace(
  `.stage-hero::before{
  /* 顶部扫描线 */
  content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(180deg,rgba(0,229,255,0.028) 0 1px,transparent 1px 3px);
  mix-blend-mode:screen;opacity:.55;
}`,
  `.stage-hero::before{content:none}`
);
fs.writeFileSync('web/style.css', css, 'utf8');
console.log('② hero 样式已改深空');
