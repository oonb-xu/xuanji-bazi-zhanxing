// 全屏引导页：进入 → 切到关于页；同一标签页只挡一次
(function () {
  var L = document.getElementById('landing');
  if (!L) return;
  var entry = document.getElementById('ld-enter');
  var skip = document.getElementById('ld-skip');

  try {
    if (sessionStorage.getItem('xuanji-landing-done') === '1') { L.parentNode.removeChild(L); return; }
  } catch (e) {}

  function enter() {
    try { sessionStorage.setItem('xuanji-landing-done', '1'); } catch (e) {}
    L.classList.add('ld-out');
    setTimeout(function () { if (L.parentNode) L.parentNode.removeChild(L); }, 460);
    // 用导航按钮切页（hash 直跳不会激活页面，已知问题）
    var b = document.querySelector('.tabbar button[data-go="about"]');
    if (b) { try { b.click(); } catch (e) {} }
    else { location.hash = '#about'; }
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  if (entry) entry.addEventListener('click', enter);
  if (skip) skip.addEventListener('click', enter);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') enter(); });
})();
