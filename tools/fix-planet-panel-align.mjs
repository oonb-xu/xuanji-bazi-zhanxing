// 修行星面板：① 十神比例块与 .pp-sec 对齐（补左右内边距）② 面板不再钉在右上角，改为贴卡片右下并限高滚动
import fs from 'node:fs';
const P = 'web/style.css';
let c = fs.readFileSync(P, 'utf8');
if (c.includes('/* PP-ALIGN-FIX */')) { console.log('已修过'); process.exit(0); }

c += `
/* PP-ALIGN-FIX —— 十神比例块与面板其它区块对齐；面板改贴卡片右下、限高可滚 */
.pp-weights{
  margin-top:0;
  padding:13px 18px;                       /* 与 .pp-sec 完全一致 */
  border-top:1px solid rgba(90,150,230,.10); /* 与 .pp-sec 的分隔线同色 */
  border-bottom:0;
}
.pp-weights .pp-wk{ margin-bottom:9px }
.pp-wr{ margin-bottom:6px }

.planet-panel{
  right:14px;
  top:auto;                                /* 不再钉在右上角 */
  bottom:14px;
  max-height:calc(100% - 28px);            /* 限高，避免顶出卡片 */
  overflow-y:auto;
  overscroll-behavior:contain;
}
@media (max-width:900px){
  .planet-panel{ left:12px; right:12px; width:auto; max-height:56% }
}
`;
fs.writeFileSync(P, c, 'utf8');
console.log('✅ 已追加 PP-ALIGN-FIX，style.css', c.length, '字节');
