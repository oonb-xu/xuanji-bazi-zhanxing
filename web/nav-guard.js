// 导航加固：不依赖 app.js 的内部 handler
// 任何 [data-go] 元素被点击 ⇒ 切页 + 高亮 + 滚动到顶
(function () {
  function markBody(go) {
    document.body.setAttribute('data-page-active', go || 'stage');
    document.body.classList.toggle('in-page', go !== 'stage');
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function hideHero(hide) {
    var hero = document.querySelector('#stage-hero');
    if (!hero) return;
    hero.style.display = hide ? 'none' : '';
    // 让顶栏固定（hero 隐藏后页面就能贴顶）
    var main = document.querySelector('#main');
    if (main) main.style.paddingTop = hide ? '0' : '';
  }

  function switchPage(go) {
    if (go === 'stage') {
      hideHero(false);
      markBody('stage');
      var h = document.querySelector('#stage-hero');
      if (h) h.scrollIntoView({ behavior: 'smooth' });
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.querySelectorAll('.tabbar button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.go === 'stage');
      });
      return true;
    }
    hideHero(true);
    markBody(go);
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

  // ★ 初始状态：按当前激活页决定 hero 是否隐藏
  function __initHeroState() {
    var act = document.querySelector('.page.active');
    var go = act ? act.dataset.page : 'stage';
    if (go === 'stage') { hideHero(false); markBody('stage'); }
    else { hideHero(true); markBody(go); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(__initHeroState, 60); });
  } else { setTimeout(__initHeroState, 60); }

  // 对外暴露（供其他脚本主动切页）
  window.__gotoPage = switchPage;
})();
