// 修：融合盘控制按钮被页面全局 button 样式拉满宽，盖住盘面
import fs from 'node:fs';
let css = fs.readFileSync('web/style.css', 'utf8');

const FIX = `

/* ══════════ 融合盘控制条：强制覆盖全局 button 宽度 ══════════ */
.fw-card .fw-ctrl{ display:flex !important; flex-direction:row !important; flex-wrap:wrap !important;
  gap:6px !important; justify-content:center !important; align-items:center !important;
  width:auto !important; max-width:min(860px,92%) !important; margin:0 !important; padding:0 10px !important;
  background:none !important; border:0 !important; box-shadow:none !important; }
.fw-card .fw-ctrl button{
  width:auto !important; min-width:0 !important; flex:0 0 auto !important;
  display:inline-block !important; margin:0 !important;
  padding:5px 13px !important; font-size:11.5px !important; line-height:1.5 !important;
  letter-spacing:.06em !important; border-radius:999px !important;
  color:rgba(170,215,240,.78) !important;
  background:rgba(8,20,30,.78) !important;
  border:1px solid rgba(0,229,255,.24) !important;
  box-shadow:none !important;
}
.fw-card .fw-ctrl button.on{
  color:#04121a !important;
  background:linear-gradient(180deg,#5ef1ff,#00c4e6) !important;
  border-color:transparent !important; font-weight:600 !important;
}
.fw-card .fw-ctrl button:hover{ border-color:rgba(0,229,255,.55) !important; color:#cdf3ff !important; }
`;

if (!css.includes('融合盘控制条：强制覆盖')) {
  css += FIX;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ 控制条样式已修正');
} else {
  console.log('已存在');
}
