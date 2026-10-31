// ① 彻底移除 err-banner.js 里的 fetch 包装（它已经坑过一次 Illegal invocation，且是当前 fetch 挂起的第一嫌疑）
//    改由 runForm 的 catch 主动上报，不劫持全局 fetch
// ② 给 runForm 加超时 + 明确报错，用户不会再卡在「计算中…」
import fs from 'node:fs';

/* ══════════ ① 重写 err-banner.js：不再包装 fetch ══════════ */
fs.writeFileSync('web/err-banner.js', `// 顶部错误横幅：只监听全局错误，**不劫持 fetch**（劫持会造成 Illegal invocation / 请求挂起）
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
`, 'utf8');
console.log('① err-banner.js 已重写（不再包装 fetch）');

/* ══════════ ② runForm 加超时 ══════════ */
let app = fs.readFileSync('web/app.js', 'utf8');

if (!app.includes('FETCH-TIMEOUT')) {
  app = app.replace(
    `  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });`,
    `  try {
    // ★ FETCH-TIMEOUT：25 秒没回来就明确报错，绝不让用户停在"计算中…"
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const to = ctrl ? setTimeout(() => ctrl.abort(), 25000) : 0;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
    } catch (e) {
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))) {
        throw new Error(\`请求超时（25 秒无响应）：\${url}。请确认服务端在运行：node server.mjs 8788\`);
      }
      throw new Error(\`网络请求失败（\${url}）：\${(e && e.message) || e}\`);
    } finally {
      if (to) clearTimeout(to);
    }`
  );
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('② runForm 已加 25 秒超时与明确报错');
} else console.log('② 已有超时');

/* ══════════ 校验 ══════════ */
const a = fs.readFileSync('web/app.js', 'utf8');
const e2 = fs.readFileSync('web/err-banner.js', 'utf8');
const checks = [
  ['err-banner 不再包装 fetch', !e2.includes('window.fetch =')],
  ['err-banner 仍有 __showErr', e2.includes('window.__showErr')],
  ['runForm 有 AbortController', a.includes('AbortController')],
  ['runForm 有超时文案', a.includes('请求超时（25 秒无响应）')],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
