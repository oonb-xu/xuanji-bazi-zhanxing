// 顶部错误横幅：只监听全局错误，**不劫持 fetch**（劫持会造成 Illegal invocation / 请求挂起）
(function () {
  function show(msg, kind) {
    var el = document.getElementById('err-banner');
    if (!el) { try { console.error('[err]', msg); } catch (e) {} return; }
    el.textContent = String(msg).slice(0, 500);
    el.className = 'show ' + (kind || 'err');
    el.style.display = 'block';
    clearTimeout(show._t);
    show._t = setTimeout(function () { el.style.display = 'none'; }, 25000);
  }
  window.__showErr = show;

  window.addEventListener('error', function (e) {
    show('[JS 错误] ' + (e.message || e.type) + ' @ ' + (e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    show('[Promise 未捕获] ' + ((r && r.message) || r));
  });
})();
