// 融合排盘后自动拉 /api/deep
(function () {
  function payloadOf(form) {
    var g = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    return {
      at: g('at'), gender: g('gender'),
      lng: parseFloat(g('lng')), lat: parseFloat(g('lat')),
      tz: 8,
    };
  }

  function attach() {
    var form = document.querySelector('#f-fusion');
    if (!form || form.__deepBound) return;
    form.__deepBound = true;

    form.addEventListener('submit', function () {
      var body = payloadOf(form);
      var host = document.querySelector('#deep-host');
      if (host) host.innerHTML = '<div class="holo-card wide"><div class="holo-h">深度层 <span>计算中…</span></div></div>';

      // 延后一点，避开排盘请求高峰
      setTimeout(function () {
        fetch('/api/deep', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify(body),
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.ok) {
            window.__renderDeep && window.__renderDeep(j.data);
            // ★ 同一份深度数据同时喂给全屏融合盘，让十神权重直接长在盘上
            try { window.__fwSetDeep && window.__fwSetDeep(j.data); } catch (e) {}
          }
            else if (host) host.innerHTML = '<div class="holo-card wide"><div class="holo-h">深度层</div><div class="holo-note">' +
              (j && j.error ? j.error : '接口无返回') + '</div></div>';
          })
          .catch(function (e) {
            if (host) host.innerHTML = '<div class="holo-card wide"><div class="holo-h">深度层</div><div class="holo-note">请求失败：' + e.message + '</div></div>';
          });
      }, 600);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
  // 导航切换后再试一次（页面可能是动态渲染的）
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-go="fusion"]')) setTimeout(attach, 120);
  }, true);
})();


/* AUTO-DEEP-PATCH —— 融合页一激活就自动拉深度数据（不必手动提交表单）
   目的：直接点行星即可看到十神比例 */
(function () {
  var inflight = false;

  function currentBody() {
    var form = document.querySelector('#f-fusion');
    if (!form) return null;
    var g = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    var body = {
      at: g('at'), gender: g('gender'),
      lng: parseFloat(g('lng')), lat: parseFloat(g('lat')),
      tz: 8,
    };
    if (!body.at) return null;
    return body;
  }

  function runDeep(force) {
    if (inflight) return;
    if (!force && window.__fwDeep) return;      // 已有数据就不重复请求
    var body = currentBody();
    if (!body) return;
    inflight = true;
    fetch('/api/deep', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          try { window.__renderDeep && window.__renderDeep(j.data); } catch (e) {}
          try { window.__fwSetDeep && window.__fwSetDeep(j.data); } catch (e) {}
          try { window.dispatchEvent(new CustomEvent('xuanji:deep', { detail: j.data })); } catch (e) {}
        }
      })
      .catch(function () {})
      .then(function () { inflight = false; });
  }

  /* ① 切到融合页时自动拉 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-go="fusion"], a[href="#fusion"]');
    if (b) { setTimeout(runDeep, 900); }
  }, true);

  /* ② 进站即已在融合页，或表单值就绪后 */
  function boot() {
    if ((location.hash || '').indexOf('fusion') >= 0) setTimeout(runDeep, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  /* ③ 兜底：行星面板打开时若仍无数据，补拉一次（供下次点击生效） */
  document.addEventListener('pointerdown', function (e) {
    var host = document.querySelector('#fusion-wheel-host');
    if (host && host.contains(e.target) && !window.__fwDeep) setTimeout(function () { runDeep(true); }, 400);
  }, true);

  window.__fwEnsureDeep = runDeep;
})();
