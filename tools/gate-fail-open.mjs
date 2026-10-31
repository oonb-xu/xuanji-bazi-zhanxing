// gate 改为「失败放行」：健康检查失败只警告，不再阻断排盘
// 理由：全部计算在本地，服务端同源，健康检查瞬断不该让用户点不动
import fs from 'node:fs';

let app = fs.readFileSync('web/app.js', 'utf8');

if (!app.includes('GATE-FAIL-OPEN')) {
  app = app.replace(
    `  if (gate.locked) {
    // gate 锁定已可见：明确告诉用户为什么没反应
    gate.mask?.classList.add('flash');
    try {
      window.__showErr?.('排盘被拦截：' + (gate.reason || 'API 未连接') +
        '。请确认服务端已启动（node server.mjs 8788），然后点右上角状态或刷新页面重试。', 'warn');
    } catch (_) {}
    return;
  }`,
    `  // ★ GATE-FAIL-OPEN：健康检查失败只提示，不阻断（本应用计算全在本地，同源服务端）
  if (gate.locked) {
    gate.mask?.classList.add('flash');
    try {
      window.__showErr?.('服务状态异常：' + (gate.reason || 'API 未连接') +
        ' —— 仍会尝试排盘；若失败请看具体报错。', 'warn');
      // 稍后自动重连
      setTimeout(() => { try { void checkHealth(); } catch (_) {} }, 1500);
    } catch (_) {}
    // 不 return：继续执行排盘
  }`
  );
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('① gate 已改为失败放行');
} else console.log('① 已有');

/* ② 遮罩不要挡住整个页面（只做提示，允许点击穿透） */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('GATE-FAIL-OPEN')) {
  css += `

/* ══════════ GATE-FAIL-OPEN：未连接提示不再全屏锁死 ══════════ */
#gate-mask{
  background:transparent !important;
  pointer-events:none !important;
  inset:auto 16px auto auto !important;
  top:64px !important;
  z-index:9000 !important;
}
#gate-mask > .card{
  pointer-events:auto !important;
  background:rgba(60,20,26,.96) !important;
  border:1px solid rgba(255,120,120,.5) !important;
  box-shadow:0 10px 40px rgba(0,0,0,.6) !important;
  max-width:340px !important;
  padding:14px 16px !important;
  font-size:12.5px !important;
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('② 遮罩已改为角落提示（不阻塞操作）');
}
