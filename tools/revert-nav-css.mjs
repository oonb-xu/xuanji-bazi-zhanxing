// 撤销我加的「左侧竖栏」改动，恢复原底部横条；只把 4 列改 9 列（一行）+ 给内容留底边距
import fs from 'node:fs';
let css = fs.readFileSync('web/style.css', 'utf8');

/* ① 删掉我加的整块「导航布局修复」 */
const before = css.length;
css = css.replace(/\n?\/\* ═+ 导航布局修复[\s\S]*$/m, '\n');
console.log('删除我的改动:', before - css.length, '字符');

/* ② 若还有 body padding-left 也清掉 */
css = css.replace(/body\{padding-left:var\(--nav-w\)\}/g, '');
css = css.replace(/:root\{ --nav-w: 96px \}/g, '');

/* ③ 最小修正：底部一条、9 列一行、给内容留出高度 */
if (!css.includes('底部导航单行修正')) {
  css += `

/* ══════════ 底部导航单行修正（恢复原设计，只改列数） ══════════ */
.tabbar{
  grid-template-columns:repeat(9,1fr) !important;
  overflow-x:auto;
}
.tabbar button,.tabbar a.tab{min-width:0}
.tabbar button span,.tabbar .tab-ic{font-size:15px;line-height:1}
/* 给内容留出底部空间，避免被固定导航遮住 */
body{padding-bottom:76px !important}
@media(max-width:760px){ body{padding-bottom:64px !important} }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ 已加底部单行修正');
} else {
  fs.writeFileSync('web/style.css', css, 'utf8');
}

/* ④ 校验括号平衡 */
const c = fs.readFileSync('web/style.css', 'utf8');
const o = (c.match(/{/g) || []).length, cl = (c.match(/}/g) || []).length;
console.log('brace', o + '/' + cl, o === cl ? '✅' : '❌');
console.log('还有 --nav-w 吗:', c.includes('--nav-w') ? '有' : '无');
console.log('还有 padding-left:var:', c.includes('padding-left:var(--nav-w)') ? '有' : '无');
console.log('文件大小:', (c.length / 1024).toFixed(1), 'KB');
