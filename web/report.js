// 把浏览器端错误回传到 /api/log，便于服务端取证
(function () {
  var buf = [];
  function send(kind, msg, detail) {
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: kind, msg: String(msg || '').slice(0, 800),
          detail: detail ? String(detail).slice(0, 2000) : null,
          page: (document.querySelector('.page.active') || {}).dataset ? document.querySelector('.page.active').dataset.page : null,
          ua: navigator.userAgent,
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }
  window.__report = send;

  window.addEventListener('error', function (e) {
    if (e.target && e.target.tagName) {
      // 资源加载失败
      send('resource', '资源加载失败: ' + (e.target.src || e.target.href || e.target.tagName),
        'tag=' + e.target.tagName);
      return;
    }
    send('error', e.message || 'unknown', (e.filename || '') + ':' + (e.lineno || '') + '\n' + (e.error && e.error.stack || ''));
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    send('rejection', (r && r.message) || String(r), (r && r.stack) || '');
  });

  // 圆盘渲染失败的回传：定时检查 __drawErr
  var last = null;
  setInterval(function () {
    var d = window.__drawErr;
    if (d && d !== last) {
      last = d;
      send('drawErr', d.msg || String(d), (d.stack || []).join('\n'));
    }
  }, 1500);

  // 圆盘状态快照（供人工排查）
  window.__dumpWheel = function () {
    var h = document.querySelector('#fusion-wheel-host');
    var cvs = h ? h.querySelectorAll('canvas') : [];
    return {
      hostExists: !!h,
      hostRect: h ? (function () { var r = h.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() : null,
      canvasCount: cvs.length,
      canvasSizes: [].map.call(cvs, function (c) { return [c.width, c.height]; }),
      glOk: window.__glPlanets === true,
      drawErr: window.__drawErr || null,
      m3: typeof window.__fwSetData === 'function',
    };
  };
})();
