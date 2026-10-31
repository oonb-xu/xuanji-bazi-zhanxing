// 接入外环层：CSS + script 标签 + 让 dw-interact 响应 dw-show 事件
import fs from 'node:fs';

/* ① CSS */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* FW-RING-LAYER */')) {
  css += `
/* FW-RING-LAYER —— 融合盘外环层（叠在 3D 盘之上，不改 3D 渲染） */
#fusion-wheel-host{ position:relative }
.fw-ring-layer{
  position:absolute; inset:0; z-index:6; pointer-events:none;
}
.fw-ring-svg{ position:absolute; left:0; top:0; overflow:visible }
.fw-ring-svg text{ pointer-events:auto; transition:filter .15s }
.fw-ring-svg text:hover{ filter:drop-shadow(0 0 6px currentColor) }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ style.css 追加 FW-RING-LAYER');
}

/* ② dw-interact.js 响应 dw-show 事件 */
const W = 'web/dw-interact.js';
let w = fs.readFileSync(W, 'utf8');
if (!w.includes("'dw-show'")) {
  const OLD = `  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();`;
  const NEW = `  /* 供融合盘外环层复用同一详情面板 */
  document.addEventListener('dw-show', function (e) {
    if (!e || !e.detail) return;
    loadGloss(function () { show(e.detail); });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();`;
  if (!w.includes(OLD)) { console.error('❌ dw-interact 未匹配 boot 段'); process.exit(1); }
  w = w.replace(OLD, NEW);
  fs.writeFileSync(W, w, 'utf8');
  console.log('✅ dw-interact.js 已支持 dw-show 事件');
}

/* ③ index.html 引入 */
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
if (!h.includes('/fw-ring-overlay.js')) {
  const b = h.lastIndexOf('</body>');
  h = h.slice(0, b) + '  <script src="/fw-ring-overlay.js"></script>\n' + h.slice(b);
  fs.writeFileSync(P, h, 'utf8');
  console.log('✅ 已引入 fw-ring-overlay.js');
} else console.log('— 已引入');

/* 校验 */
const c = (s, r) => (s.match(r) || []).length;
const okScript = c(h, /<script\b/g) === c(h, /<\/script>/g);
const app = h.indexOf('<div id="app"');
const at = h.indexOf('>', app) + 1;
const r3 = /<div\b|<\/div>/g; r3.lastIndex = at;
let d3 = 1, m3, appEnd = -1;
while ((m3 = r3.exec(h))) { d3 += m3[0] === '</div>' ? -1 : 1; if (d3 === 0) { appEnd = m3.index; break; } }
const allIn = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => {
  const p = h.indexOf('data-page="' + k + '"'); return p > app && p < appEnd;
});
console.log('  script 平衡: ' + (okScript ? '✅' : '❌') + '  #app 包住页面: ' + (allIn ? '✅' : '❌'));
process.exit(okScript && allIn ? 0 : 1);
