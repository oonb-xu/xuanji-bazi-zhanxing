import fs from 'node:fs';
const P = 'web/style.css';
let c = fs.readFileSync(P, 'utf8');

/* 用整块替换 NAV-LINK-TAB 段，确保与 .tabbar button 的计算值一致 */
const start = c.indexOf('/* NAV-LINK-TAB');
const endMark = '/* /NAV-LINK-TAB */';
const end = c.indexOf(endMark);
if (start < 0 || end < 0) { console.error('❌ 找不到 NAV-LINK-TAB 段'); process.exit(1); }

const block = `/* NAV-LINK-TAB —— 查表是外链 <a>，但视觉/尺寸必须与 .tabbar button 完全一致 */
/* 实测按钮：padding 11/12、gap 9px、图标 span 15px/lh1、文字为裸文本(lh normal≈17px) ⇒ 总高 63px */
.tabbar a.tab{
  margin:0; border:0; background:none;
  color:var(--faint);
  padding:11px 12px;
  border-radius:10px;
  display:flex; flex-direction:column;
  align-items:center; justify-content:flex-start;
  gap:9px;
  font-size:13px; line-height:normal;
  text-decoration:none; cursor:pointer;
  min-width:0;
  font-family:inherit;
  -webkit-tap-highlight-color:transparent;
}
.tabbar a.tab span{ font-size:13px; line-height:normal }
.tabbar a.tab .tab-ic{ font-size:15px; line-height:1; display:inline-block }
.tabbar a.tab:hover{ background:rgba(90,140,220,.10); color:var(--text) }
.tabbar a.tab:active{ transform:scale(.97) }
`;

c = c.slice(0, start) + block + c.slice(end + endMark.length);
fs.writeFileSync(P, c, 'utf8');
console.log('✅ NAV-LINK-TAB 段已重写，style.css', c.length, '字节');
