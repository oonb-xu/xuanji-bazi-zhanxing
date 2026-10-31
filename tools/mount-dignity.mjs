// 把尊贵/相位面板挂到融合页 + 全息样式
import fs from 'node:fs';

let h = fs.readFileSync('web/index.html', 'utf8');

/* ① 容器（放在融合盘下方） */
if (!h.includes('id="dignity-host"')) {
  const anchor = '<div id="fusion-out"></div>';
  if (!h.includes(anchor)) { console.error('❌ 未找到 fusion-out 锚点'); process.exit(1); }
  h = h.replace(anchor, '<div id="dignity-host" class="holo-row"></div>\n      ' + anchor);
  console.log('① 面板容器已插入');
}

/* ② 引入脚本 */
if (!h.includes('/dignity-panel.js')) {
  h = h.replace('<script type="module" src="/fusion3d.js"></script>',
    '<script type="module" src="/dignity-panel.js"></script>\n  <script type="module" src="/fusion3d.js"></script>');
  console.log('② dignity-panel.js 已引入');
}
fs.writeFileSync('web/index.html', h, 'utf8');

/* ③ 全息样式 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.holo-card')) {
  css += `

/* ══════════ 全息悬浮信息 ══════════ */
.holo-row{
  display:grid;grid-template-columns:1fr 1fr;gap:14px;
  margin:0 0 16px;
}
@media(min-width:900px){ .holo-row{grid-column:1 / -1} }
@media(max-width:760px){ .holo-row{grid-template-columns:1fr} }

.holo-card{
  position:relative;padding:16px 18px;border-radius:14px;
  background:
    linear-gradient(160deg, rgba(20,40,70,.55), rgba(8,16,30,.72)),
    radial-gradient(420px 180px at 20% 0%, rgba(0,200,255,.10), transparent 70%);
  border:1px solid rgba(90,170,230,.26);
  box-shadow:
    0 0 0 1px rgba(0,229,255,.05) inset,
    0 8px 34px rgba(0,0,0,.45),
    0 0 40px rgba(0,150,220,.10);
  backdrop-filter:blur(14px) saturate(1.15);
  transform:perspective(900px) rotateX(1.2deg);
  transition:transform .3s ease, box-shadow .3s ease;
}
.holo-card:hover{
  transform:perspective(900px) rotateX(0deg) translateY(-2px);
  box-shadow:0 0 0 1px rgba(0,229,255,.10) inset, 0 14px 44px rgba(0,0,0,.55), 0 0 54px rgba(0,180,240,.18);
}
/* 顶部扫描光条 */
.holo-card::before{
  content:'';position:absolute;left:12px;right:12px;top:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(0,229,255,.65),transparent);
}
.holo-h{
  font-size:12.5px;letter-spacing:.14em;color:#7ee8ff;margin-bottom:11px;
  text-shadow:0 0 12px rgba(0,229,255,.45);
}
.holo-h span{color:rgba(150,200,225,.5);font-size:10.5px;letter-spacing:.05em;margin-left:8px}
.holo-tb{width:100%;border-collapse:collapse;font-size:12px}
.holo-tb th{
  text-align:left;font-weight:600;color:rgba(150,205,235,.6);font-size:10.5px;
  letter-spacing:.1em;padding:4px 6px;border-bottom:1px solid rgba(90,160,220,.18);
}
.holo-tb td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.045);white-space:nowrap}
.holo-tb td.pn{color:rgba(230,245,255,.95);font-weight:600}
.holo-tb td.mut{color:rgba(150,190,215,.5)}
.holo-tb td.mut2{color:rgba(170,205,228,.7);font-size:11.5px;white-space:normal}
.holo-tb td.dg{font-weight:700}
.holo-tb td.a{color:#7dffb4}
.holo-tb td.b{color:#ff9d9d}
.holo-tb td.n{color:rgba(180,210,230,.55)}
.holo-tb td.hm{color:rgba(150,190,215,.6);font-size:11px}
.holo-note{
  margin-top:10px;font-size:10.5px;line-height:1.7;color:rgba(150,190,215,.55);
  border-top:1px dashed rgba(90,160,220,.18);padding-top:8px;
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ 全息样式已加');
}
