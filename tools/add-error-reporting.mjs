// 【取证通道】让浏览器把错误回传服务端，我就能从日志读到真实报错
import fs from 'node:fs';

/* ══════════ ① server：加 POST /api/log ══════════ */
let srv = fs.readFileSync('server.mjs', 'utf8');
if (!srv.includes("'/api/log'")) {
  const FN = `
/** 【取证】浏览器把它遇到的错误回传到这里，写进 logs/browser.log */
function apiLog(body) {
  try {
    fs.mkdirSync('logs', { recursive: true });
    const line = JSON.stringify({
      t: new Date().toISOString(),
      kind: body?.kind ?? 'unknown',
      msg: String(body?.msg ?? '').slice(0, 800),
      detail: body?.detail ? String(body.detail).slice(0, 2000) : null,
      page: body?.page ? String(body.page).slice(0, 40) : null,
      ua: body?.ua ? String(body.ua).slice(0, 120) : null,
    });
    fs.appendFileSync('logs/browser.log', line + '\\n', 'utf8');
    return { ok: true, data: { logged: true } };
  } catch (e) {
    return { ok: false, error: 'log write failed: ' + e.message };
  }
}

`;
  srv = srv.replace('const ROUTES = {', FN + 'const ROUTES = {');
  srv = srv.replace("'/api/deep': apiDeep,", "'/api/deep': apiDeep, '/api/log': apiLog,");
  fs.writeFileSync('server.mjs', srv, 'utf8');
  console.log('① /api/log 已加');
} else console.log('① 已有');

/* ══════════ ② 前端：错误回传 ══════════ */
fs.writeFileSync('web/report.js', `// 把浏览器端错误回传到 /api/log，便于服务端取证
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
    send('error', e.message || 'unknown', (e.filename || '') + ':' + (e.lineno || '') + '\\n' + (e.error && e.error.stack || ''));
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
      send('drawErr', d.msg || String(d), (d.stack || []).join('\\n'));
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
`, 'utf8');
console.log('② web/report.js 已写入');

/* ══════════ ③ index.html 引入 report.js（放最前，才能抓到最早的错误）══════════ */
let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('/report.js')) {
  html = html.replace('<script src="/err-banner.js"></script>', '<script src="/report.js"></script>\n  <script src="/err-banner.js"></script>');
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('③ report.js 已引入（在 err-banner 之前）');
}

/* ══════════ ④ app.js：把静默吞掉的圆盘错误暴露出来 ══════════ */
let app = fs.readFileSync('web/app.js', 'utf8');
if (app.includes('fusion wheel feed failed') && !app.includes('__report(')) {
  app = app.replace(
    "try { window.__fwSetData?.(json.data); } catch (e) { console.warn('fusion wheel feed failed', e); }",
    `try {
      if (typeof window.__fwSetData !== 'function') throw new Error('__fwSetData 未挂载（fusion3d.js 可能加载失败）');
      window.__fwSetData(json.data);
    } catch (e) {
      console.error('fusion wheel feed failed', e);
      window.__report?.('wheelFeed', '圆盘喂数据失败: ' + (e && e.message), e && e.stack);
    }`
  );
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('④ app.js 已把圆盘错误暴露并回传');
}

/* 校验 */
const a = fs.readFileSync('web/app.js', 'utf8');
const h = fs.readFileSync('web/index.html', 'utf8');
console.log('\n校验：');
for (const [k, v] of [
  ['server 有 /api/log', fs.readFileSync('server.mjs', 'utf8').includes("'/api/log'")],
  ['index 引入 report.js', h.includes('/report.js')],
  ['app.js 回传圆盘错误', a.includes('__report(')],
  ['report.js 存在', fs.existsSync('web/report.js')],
]) console.log(' ', v ? '✅' : '❌', k);
