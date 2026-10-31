// 生时矫正改为「弹层」：从融合页 / 合盘页的入口打开，不再作为独立导航项
(function () {
  var SEL = '[data-page="rectify"]';
  function sec() { return document.querySelector(SEL); }

  function open() {
    var s = sec();
    if (!s) return;
    s.classList.add('rx-open');
    document.documentElement.style.overflow = 'hidden';
    if (!s.querySelector('.rx-close')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rx-close';
      b.setAttribute('aria-label', '关闭生时矫正');
      b.textContent = '×';
      b.addEventListener('click', close);
      s.appendChild(b);
    }
    try { s.scrollTop = 0; } catch (e) {}
    var f = s.querySelector('input,select,button');
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  function close() {
    var s = sec();
    if (!s) return;
    s.classList.remove('rx-open');
    document.documentElement.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-rx-open]')) { e.preventDefault(); open(); return; }
    if (t.closest('[data-rx-close]')) { e.preventDefault(); close(); return; }
    // 切到别的页面时自动关掉
    if (t.closest('.tabbar [data-go], .tabbar a')) close();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  window.__rxOpen = open;
  window.__rxClose = close;
})();
