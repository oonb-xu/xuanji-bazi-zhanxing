// ① 导航加固：document 级事件委托，不依赖 app.js 内部 handler
// ② 补回丢失的「时序」按钮
import fs from 'node:fs';

/* ── ① 补按钮 ── */
let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('data-go="timeline"')) {
  html = html.replace(
    '<button type="button" data-go="rectify"',
    '<button type="button" data-go="timeline" title="四钟时序"><i class="ic">⏱</i><span>时序</span></button>\n    <button type="button" data-go="rectify"'
  );
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('① 时序按钮已补回');
} else console.log('① 时序按钮已在');

/* ── ② 加固脚本 ── */
const GUARD = 'web/nav-guard.js';
fs.writeFileSync(GUARD, `// 导航加固：不依赖 app.js 的内部 handler
// 任何 [data-go] 元素被点击 ⇒ 切页 + 高亮 + 滚动到顶
(function () {
  function switchPage(go) {
    if (go === 'stage') {
      const hero = document.querySelector('#stage-hero');
      if (hero) hero.scrollIntoView({ behavior: 'smooth' });
      return true;
    }
    const page = document.querySelector('.page[data-page="' + go + '"]');
    if (!page) return false;
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.dataset.page === go);
    });
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      var on = b.dataset.go === go;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    // 切页后滚到内容顶部（避免停在上一页的位置）
    var main = document.querySelector('#main') || page;
    try { main.scrollIntoView({ block: 'start' }); } catch (e) { }
    return true;
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-go]') : null;
    if (!t) return;
    var go = t.getAttribute('data-go');
    if (!go) return;
    if (switchPage(go)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);   // capture 阶段，先于 app.js 的 handler

  // 对外暴露（供其他脚本主动切页）
  window.__gotoPage = switchPage;
})();
`, 'utf8');
console.log('② 导航加固脚本已写入');

/* ── ③ 引入脚本（放最前，确保最先执行） ── */
if (!html.includes('/nav-guard.js')) {
  html = fs.readFileSync('web/index.html', 'utf8');
  html = html.replace(
    '<script type="module" src="/stage.js"></script>',
    '<script src="/nav-guard.js"></script>\n  <script type="module" src="/stage.js"></script>'
  );
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('③ nav-guard.js 已引入（普通脚本，最先执行）');
}

/* ── ④ 侧栏 z-index 抬高 + 确保可点 ── */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* 导航加固')) {
  css += `

/* 导航加固：确保侧栏永远在最上层且可点 */
.tabbar{ z-index:60 !important; pointer-events:auto !important }
.tabbar button{ pointer-events:auto !important; cursor:pointer !important }
.tabbar button:active{ transform:scale(.97) }
@media(min-width:900px){
  /* topbar 不要盖住侧栏左上角 */
  .topbar{ z-index:50 !important }
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('④ 侧栏层级已抬高');
}
