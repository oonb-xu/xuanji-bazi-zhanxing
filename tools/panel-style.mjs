// 行星面板样式 + 八字融合排版收拾
import fs from 'node:fs';
let css = fs.readFileSync('web/style.css', 'utf8');

if (!css.includes('.planet-panel')) {
  css += `

/* ══════════ 行星详情面板 ══════════ */
.planet-panel{
  position:absolute;right:14px;top:14px;bottom:14px;width:330px;z-index:8;
  display:flex;flex-direction:column;gap:0;
  background:linear-gradient(180deg,rgba(6,12,24,.97),rgba(3,7,15,.98));
  border:1px solid rgba(90,150,230,.28);border-radius:14px;
  box-shadow:0 12px 50px rgba(0,0,0,.7),0 0 40px rgba(0,140,200,.14);
  backdrop-filter:blur(16px);
  opacity:0;pointer-events:none;transform:translateX(16px);
  transition:opacity .22s ease,transform .22s ease;
  overflow-y:auto;
}
.planet-panel.open{opacity:1;pointer-events:auto;transform:none}
.pp-close{
  position:absolute;right:10px;top:10px;width:26px;height:26px;border-radius:50%;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
  color:rgba(200,225,245,.7);cursor:pointer;font-size:12px;line-height:1;
}
.pp-close:hover{background:rgba(255,100,100,.18);color:#fff;border-color:rgba(255,120,120,.4)}
.pp-head{display:flex;gap:12px;align-items:center;padding:18px 18px 14px;border-bottom:1px solid rgba(90,150,230,.16)}
.pp-glyph{
  width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:24px;color:#ffe6a8;background:radial-gradient(circle at 35% 30%,rgba(255,220,130,.35),rgba(120,80,20,.18));
  box-shadow:0 0 22px rgba(255,196,87,.35);flex:0 0 auto;
}
.pp-name{font-size:17px;font-weight:700;color:#eaf7ff;letter-spacing:.06em}
.pp-sub{font-size:11.5px;color:rgba(160,210,240,.72);margin-top:3px}
.pp-sec{padding:13px 18px;border-bottom:1px solid rgba(90,150,230,.10)}
.pp-sec:last-child{border-bottom:0}
.pp-h{font-size:11px;color:#ffc457;letter-spacing:.16em;margin-bottom:8px;text-transform:uppercase}
.pp-key{font-size:13.5px;color:#9fe8ff;margin-bottom:6px;font-weight:600}
.pp-long{font-size:12px;line-height:1.85;color:rgba(185,215,238,.82)}
.pp-kv{display:flex;gap:10px;align-items:baseline;font-size:12.5px;line-height:1.8}
.pp-kv b{color:#ffd58a;font-size:15px;flex:0 0 auto}
.pp-kv span{color:rgba(185,215,238,.8)}
.pp-note{font-size:11.5px;color:rgba(160,200,225,.68);margin-top:7px}
.pp-note b{color:#9fe8ff}
.pp-asps{display:flex;flex-direction:column;gap:5px;max-height:220px;overflow-y:auto}
.pp-asp{display:grid;grid-template-columns:52px 1fr 46px;gap:8px;align-items:center;font-size:12px}
.pp-asp .ok{color:#7dffb4}
.pp-asp .bad{color:#ff9d9d}
.pp-asp .nm{color:rgba(200,228,248,.9)}
.pp-asp .orb{color:rgba(150,190,215,.6);text-align:right;font-variant-numeric:tabular-nums}
.pp-none{font-size:12px;color:rgba(150,185,210,.5)}

/* ══════════ 八字融合：收拾排版（原来偏乱） ══════════ */
/* 四柱卡片：更紧凑、层次更清 */
#fusion-out .pillars{gap:10px !important}
#fusion-out .pil{padding:11px 8px !important;border-radius:10px !important}
#fusion-out .pil .p{font-size:10.5px !important;letter-spacing:.14em !important;color:rgba(190,220,240,.5) !important}
#fusion-out .pil .gz{font-size:26px !important;letter-spacing:3px !important;line-height:1.15 !important}
#fusion-out .pil .wx{font-size:10.5px !important;margin-bottom:3px !important}
#fusion-out .cang{margin-top:6px !important;padding-top:6px !important}
#fusion-out .cang-h{font-size:8.5px !important;letter-spacing:.14em !important;margin-bottom:2px !important}
#fusion-out .cang-i{font-size:9.5px !important;gap:3px !important;line-height:1.5 !important}
#fusion-out .cang-g{font-size:11px !important}

/* 气势四维：条形更细更整齐 */
#fusion-out .bar{grid-template-columns:34px 1fr 44px !important;gap:8px !important;font-size:11px !important}
#fusion-out .track{height:6px !important;border-radius:3px !important}

/* 卡片之间统一间距、标题更克制 */
#fusion-out .card{margin-bottom:12px !important}
#fusion-out h3{font-size:12.5px !important;letter-spacing:.1em !important;margin-bottom:9px !important}

/* 双列布局：结果列更宽，避免挤 */
@media(min-width:900px){
  .page.active[data-page="fusion"]{grid-template-columns:minmax(280px,3fr) minmax(0,9fr) !important}
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('① 行星面板样式已加');
  console.log('② 八字融合排版已收拾');
}
