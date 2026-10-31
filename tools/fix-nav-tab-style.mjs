// 修导航：把「查表」这个 <a class="tab"> 做成与其它 <button class="tab"> 完全同一格式
import fs from 'node:fs';
const P = 'web/style.css';
let css = fs.readFileSync(P, 'utf8');

if (css.includes('/* NAV-LINK-TAB */')) {
  console.log('已打过补丁，先移除旧块');
  css = css.replace(/\/\* NAV-LINK-TAB \*\/[\s\S]*?\/\* \/NAV-LINK-TAB \*\//, '');
}

const block = `
/* NAV-LINK-TAB —— 查表是外链，但视觉/布局必须与其它 .tabbar button 完全一致 */
.tabbar a.tab{
  margin:0; border:0; background:none;
  color:var(--faint);
  padding:11px 12px;
  border-radius:10px;
  display:flex; align-items:center; gap:9px; justify-content:flex-start;
  font-size:13px; line-height:1;
  text-decoration:none; cursor:pointer;
  min-width:0;
  font-family:inherit;
  -webkit-tap-highlight-color:transparent;
}
.tabbar a.tab span{ font-size:13px; line-height:1 }
.tabbar a.tab .tab-ic{ font-size:15px; line-height:1; display:inline-block }
.tabbar a.tab:hover{ background:rgba(90,140,220,.10); color:var(--text) }
.tabbar a.tab:active{ transform:scale(.97) }
/* /NAV-LINK-TAB */
`;

css += block;
fs.writeFileSync(P, css, 'utf8');
console.log('✅ 已追加 NAV-LINK-TAB 规则，style.css 大小', css.length);

/* 校验：确认按钮规则与 a.tab 规则覆盖同一批关键属性 */
const need = ['padding', 'display:flex', 'border-radius', 'font-size', 'align-items', 'gap'];
const seg = css.slice(css.indexOf('/* NAV-LINK-TAB */'));
const miss = need.filter((k) => !seg.includes(k));
console.log(miss.length ? '⚠️ 缺属性: ' + miss.join(',') : '✅ 关键属性齐全（padding/display/radius/font/align/gap）');
