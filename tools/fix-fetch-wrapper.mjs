// 修 err-banner 的 fetch 包装（Illegal invocation） + 让 gate 锁定可见
import fs from 'node:fs';

/* ① 修 fetch 包装：必须用 window 作为 this */
let eb = fs.readFileSync('web/err-banner.js', 'utf8');
eb = eb.replace(
  `  var _f = window.fetch;
  window.fetch = function (url, opt) {
    return _f.apply(this, arguments).then(function (r) {`,
  `  var _f = window.fetch;
  // ★ 必须用 window 作为 this：模块里裸调 fetch 时 this===undefined，
  //   直接 apply(undefined) 会抛 "Illegal invocation"，导致所有请求失败
  window.fetch = function (url, opt) {
    return _f.call(window, url, opt).then(function (r) {`
);
// 兜底：包装内部任何异常都不影响原请求
eb = eb.replace(
  `      return r;
    });
  };`,
  `      return r;
    }, function (e) {
      show('[请求失败] ' + ((e && e.message) || e) + '  ' + String(url), 'warn');
      throw e;
    });
  };
  // 保底：若包装后 self-test 失败，恢复原生 fetch
  try {
    _f.call(window, 'data:text/plain,ok').catch(function () {});
  } catch (e) {
    window.fetch = _f;
  }`
);
fs.writeFileSync('web/err-banner.js', eb, 'utf8');
console.log('① err-banner fetch 包装已修');

/* ② gate 锁定时显示原因（不再静默） */
let app = fs.readFileSync('web/app.js', 'utf8');
if (!app.includes('gate 锁定已可见')) {
  app = app.replace(
    `  if (gate.locked) {
    gate.mask?.classList.add('flash');
    return;
  }`,
    `  if (gate.locked) {
    // gate 锁定已可见：明确告诉用户为什么没反应
    gate.mask?.classList.add('flash');
    try {
      window.__showErr?.('排盘被拦截：' + (gate.reason || 'API 未连接') +
        '。请确认服务端已启动（node server.mjs 8788），然后点右上角状态或刷新页面重试。', 'warn');
    } catch (_) {}
    return;
  }`
  );
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('② gate 锁定已可见');
} else console.log('② 已有');

/* ③ 让「在线」状态可以点击强制重连 */
if (!app.includes('__forceReconnect')) {
  app = app.replace(
    `async function checkHealth() {
  const box = q('#health');`,
    `async function checkHealth() {
  const box = q('#health');
  if (box && !box.__forceReconnect) {
    box.__forceReconnect = true;
    box.style.cursor = 'pointer';
    box.title = (box.title || '') + '\\n（点击可强制重连）';
    box.addEventListener('click', () => { try { unlock(); } catch (_) {} void checkHealth(); });
  }`
  );
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('③ 状态可点击重连');
}
