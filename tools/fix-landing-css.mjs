// 修引导页两处：① 跳过按钮被全局 button 规则拉满宽 ② 标题上缘略被裁
import fs from 'node:fs';
const P = 'web/style.css';
let c = fs.readFileSync(P, 'utf8');

if (c.includes('/* LD-FIX */')) { console.log('已修过'); process.exit(0); }

const fix = `
/* LD-FIX —— 覆盖全局 button 规则（width:100% 等），并修标题裁切 */
#landing .ld-skip{
  position:absolute !important;
  top:22px !important; right:26px !important; left:auto !important;
  width:auto !important; max-width:180px;
  white-space:nowrap;
  display:inline-flex !important; align-items:center; justify-content:center;
  margin:0 !important;
}
#landing .ld-enter{
  width:auto !important; max-width:none;
  display:inline-flex !important; align-items:center; justify-content:center;
  margin:36px 0 0 !important;
}
#landing .ld-title{ line-height:1.12 !important; padding:.04em 0 .02em }
`;
c += fix;
fs.writeFileSync(P, c, 'utf8');
console.log('✅ 已追加 LD-FIX，style.css', c.length, '字节');
