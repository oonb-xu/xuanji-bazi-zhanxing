// 修导航布局：宽屏=左侧竖栏（不遮内容）；窄屏=底部一行横条（不再折成 3 行）
import fs from 'node:fs';
let css = fs.readFileSync('web/style.css', 'utf8');

/* 先移除我们可能加过的旧版规则，避免叠加 */
css = css.replace(/\n\/\* ═+ 导航布局修复[\s\S]*?(?=\n\/\* ═|$)/, '\n');

if (!css.includes('导航布局修复')) {
  css += `

/* ══════════ 导航布局修复（宽屏左侧栏 / 窄屏底部横条） ══════════ */
:root{ --nav-w: 96px }

/* —— 宽屏：左侧竖栏 —— */
@media (min-width: 761px){
  .tabbar{
    position:fixed;left:0;top:0;bottom:0;right:auto;
    width:var(--nav-w);
    display:flex;flex-direction:column;justify-content:center;gap:2px;
    padding:0 0 18px;
    background:rgba(10,13,19,.86);
    backdrop-filter:blur(14px);
    border-top:none;border-right:1px solid var(--line);
    z-index:60;
    overflow-y:auto;
  }
  .tabbar button,.tabbar a.tab{
    display:flex;flex-direction:row;align-items:center;gap:8px;
    padding:9px 14px;font-size:12px;white-space:nowrap;
    border-left:2.5px solid transparent;
  }
  .tabbar button.active{color:var(--gold);border-left-color:var(--gold);background:rgba(255,196,87,.06)}
  .tabbar button span,.tabbar .tab-ic{font-size:14px;line-height:1;width:16px;text-align:center}
  /* 给内容让出左侧空间 */
  body{padding-left:var(--nav-w)}
  main,.stage-hero{box-sizing:border-box}
  #stage-hero{left:var(--nav-w)}
}

/* —— 窄屏：底部一行 —— */
@media (max-width: 760px){
  .tabbar{
    position:fixed;left:0;right:0;bottom:0;top:auto;width:auto;
    display:grid;grid-template-columns:repeat(9,1fr);
    border-right:none;border-top:1px solid var(--line);
    z-index:60;
  }
  .tabbar button,.tabbar a.tab{flex-direction:column;gap:1px;padding:6px 0 7px;font-size:9px}
  .tabbar button span,.tabbar .tab-ic{font-size:15px}
  body{padding-left:0}
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ 导航布局已修（宽屏左侧栏 + 窄屏底部一行）');
} else console.log('已有规则');
