// 让 排盘 / 生时矫正 / 合盘 共享同一份出生数据：填一次，三处通用
// 存在 localStorage（仅本机），键名 xuanji:birth
(function () {
  var KEY = 'xuanji:birth';
  var FIELDS = ['at', 'gender', 'lng', 'lat', 'city'];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function forms() {
    return Array.prototype.slice.call(document.querySelectorAll('#f-fusion, #f-synastry, #f-rectify, #f-bazi'));
  }
  /** 把已保存的值填进所有空字段 */
  function hydrate() {
    var d = read();
    forms().forEach(function (f) {
      FIELDS.forEach(function (n) {
        var el = f.querySelector('[name="' + n + '"]');
        if (el && !el.value && d[n] != null) el.value = d[n];
      });
    });
  }
  /** 任一表单改动 ⇒ 写入共享存储并同步到其它表单的同名字段 */
  function attach() {
    forms().forEach(function (f) {
      if (f.__shared) return;
      f.__shared = true;
      f.addEventListener('input', function (e) {
        var n = e.target && e.target.name;
        if (!n || FIELDS.indexOf(n) < 0) return;
        var d = read();
        d[n] = e.target.value;
        write(d);
        // 同步到其它表单
        forms().forEach(function (g) {
          if (g === f) return;
          var el = g.querySelector('[name="' + n + '"]');
          if (el && el.value !== e.target.value) el.value = e.target.value;
        });
      });
    });
  }
  function boot() { hydrate(); attach(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);
  // 切页后再补一次（表单可能是动态渲染）
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-go]');
    if (t) setTimeout(boot, 350);
  }, true);

  window.__birthShared = { read: read, write: write, hydrate: hydrate };
})();
