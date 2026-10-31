// 顶部错误横幅：任何 JS 错误 / 表单错误 / API 错误都立刻可见
import fs from 'node:fs';

/* ① 横幅容器 */
let h = fs.readFileSync('web/index.html', 'utf8');
if (!h.includes('id="err-banner"')) {
  h = h.replace(
    '<body>',
    `<body>
  <div id="err-banner" role="alert"></div>`
  );
  fs.writeFileSync('web/index.html', h, 'utf8');
  console.log('① 横幅容器已加');
}

/* ② 横幅脚本（最先加载） */
fs.writeFileSync('web/err-banner.js', `// 顶部错误横幅：让任何失败都可见，不再"点了没反应"
(function () {
  function show(msg, kind) {
    var el = document.getElementById('err-banner');
    if (!el) return;
    el.textContent = String(msg).slice(0, 400);
    el.className = 'show ' + (kind || 'err');
    el.style.display = 'block';
    clearTimeout(show._t);
    show._t = setTimeout(function () { el.style.display = 'none'; }, 20000);
  }
  window.__showErr = show;

  window.addEventListener('error', function (e) {
    show('[JS 错误] ' + (e.message || e.type) + '  ' + (e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    show('[Promise 未捕获] ' + ((e.reason && e.reason.message) || e.reason));
  });

  // 拦截 fetch 的非 2xx，把服务端 error 直接弹出来
  var _f = window.fetch;
  window.fetch = function (url, opt) {
    return _f.apply(this, arguments).then(function (r) {
      if (!r.ok && String(url).indexOf('/api/') >= 0) {
        r.clone().json().then(function (j) {
          show('[接口 ' + r.status + '] ' + (j && j.error ? j.error : '请求失败') + '  参数：' + ((opt && opt.body) || '').slice(0, 160), 'warn');
        }).catch(function () { show('[接口 ' + r.status + '] ' + url, 'warn'); });
      }
      return r;
    });
  };
})();
`, 'utf8');
console.log('② err-banner.js 已写入');

/* ③ 引入 */
h = fs.readFileSync('web/index.html', 'utf8');
if (!h.includes('/err-banner.js')) {
  h = h.replace('<script src="/nav-guard.js"></script>',
    '<script src="/err-banner.js"></script>\n  <script src="/nav-guard.js"></script>');
  fs.writeFileSync('web/index.html', h, 'utf8');
  console.log('③ err-banner.js 已引入（最先执行）');
}

/* ④ 样式 + 表单错误同步到横幅 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('#err-banner')) {
  css += `

/* ══════════ 顶部错误横幅 ══════════ */
#err-banner{
  display:none;position:fixed;left:50%;top:10px;transform:translateX(-50%);
  z-index:9999;max-width:min(920px,92vw);padding:11px 18px;border-radius:10px;
  font-size:12.5px;line-height:1.6;letter-spacing:.02em;color:#fff;
  background:linear-gradient(180deg,rgba(190,40,50,.96),rgba(140,20,30,.96));
  border:1px solid rgba(255,120,120,.6);
  box-shadow:0 10px 40px rgba(0,0,0,.6),0 0 30px rgba(255,80,80,.35);
  word-break:break-all;white-space:pre-wrap;
}
#err-banner.warn{
  background:linear-gradient(180deg,rgba(200,140,20,.96),rgba(150,90,10,.96));
  border-color:rgba(255,200,110,.6);
  box-shadow:0 10px 40px rgba(0,0,0,.6),0 0 30px rgba(255,180,60,.35);
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('④ 样式已加');
}

/* ⑤ app.js 的 showErr 也同步到横幅 */
let app = fs.readFileSync('web/app.js', 'utf8');
if (!app.includes('__showErr')) {
  const idx = app.indexOf('function showErr(');
  if (idx > 0) {
    // 在 showErr 函数体开头插入横幅调用
    const braceIdx = app.indexOf('{', idx);
    app = app.slice(0, braceIdx + 1) +
      "\n  try { window.__showErr && window.__showErr((err && err.message) || String(err)); } catch (_) {}" +
      app.slice(braceIdx + 1);
    fs.writeFileSync('web/app.js', app, 'utf8');
    console.log('⑤ showErr 已接横幅');
  } else {
    console.log('⑤ ⚠️ 未找到 showErr');
  }
}
