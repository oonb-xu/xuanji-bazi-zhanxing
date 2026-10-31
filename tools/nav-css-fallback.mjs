// CSS 级兜底：切页时隐藏 hero，不依赖 JS 时序
import fs from 'node:fs';

/* ① nav-guard：给 body 打标记（CSS 兜底判断用） */
let nav = fs.readFileSync('web/nav-guard.js', 'utf8');
if (!nav.includes('in-page')) {
  nav = nav.replace(
    "  function hideHero(hide) {",
    `  function markBody(go) {
    document.body.setAttribute('data-page-active', go || 'stage');
    document.body.classList.toggle('in-page', go !== 'stage');
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function hideHero(hide) {`
  );
  nav = nav.replace(
    "    hideHero(true);",
    "    hideHero(true);\n    markBody(go);"
  );
  nav = nav.replace(
    "      hideHero(false);",
    "      hideHero(false);\n      markBody('stage');"
  );
  fs.writeFileSync('web/nav-guard.js', nav, 'utf8');
  console.log('① nav-guard 已加 body 标记');
} else console.log('① 已有');

/* ② CSS 兜底：body.in-page 时强制隐藏 hero；各页也强制显示 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('body.in-page')) {
  css += `

/* ══════════ 导航兜底（CSS 级，不依赖 JS 时序） ══════════ */
body.in-page .stage-hero,
body.in-page #stage-hero{ display:none !important; }

/* 激活页必须可见 */
.page.active{ display:block !important; }

/* hero 隐藏后内容贴顶 */
body.in-page #main{ padding-top:0 !important; }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('② CSS 兜底已加');
}

/* ③ 首屏若 data-page 已指定则直接进入该页（便于调试/直达） */
let app = fs.readFileSync('web/app.js', 'utf8');
if (!app.includes('__directPage')) {
  app += `

/* 直达某页：/?p=fusion 或 #fusion */
(function __directPage() {
  try {
    var m = (location.search.match(/[?&]p=([\\w-]+)/) || [])[1] || (location.hash || '').replace('#', '');
    if (m && window.__gotoPage) window.__gotoPage(m);
  } catch (e) {}
})();
`;
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('③ 直达参数 /?p=xxx 已支持');
}
