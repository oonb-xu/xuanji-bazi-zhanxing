// 页面可用性排查：服务端 + 静态资源 + HTML 完整性
const BASE = 'http://127.0.0.1:8788';

const MIME_OK = {
  '/': 'text/html',
  '/app.js': 'javascript',
  '/stage.js': 'javascript',
  '/fusion3d.js': 'javascript',
  '/gl-planets.js': 'javascript',
  '/dignity-panel.js': 'javascript',
  '/nav-guard.js': 'javascript',
  '/timeline-ui.js': 'javascript',
  '/style.css': 'text/css',
  '/textures/sun.jpg': 'image/jpeg',
  '/textures/jupiter.jpg': 'image/jpeg',
};

let fail = 0;
console.log('== 静态资源 ==');
for (const [p, want] of Object.entries(MIME_OK)) {
  try {
    const r = await fetch(BASE + p, { signal: AbortSignal.timeout(8000) });
    const ct = r.headers.get('content-type') || '';
    const ok = r.ok && ct.includes(want);
    if (!ok) fail++;
    console.log(ok ? ' ✅' : ' ❌', r.status, ct.padEnd(26), p);
  } catch (e) {
    fail++;
    console.log(' ❌ ERR', p, String(e.message).slice(0, 50));
  }
}

console.log('\n== HTML 关键结构 ==');
try {
  const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(8000) });
  const t = await r.text();
  const need = [
    ['fusion-wheel-host', '融合盘容器'],
    ['dignity-host', '尊贵面板容器'],
    ['/nav-guard.js', '导航护栏脚本'],
    ['/fusion3d.js', '融合盘脚本'],
    ['/dignity-panel.js', '尊贵面板脚本'],
    ['/gl-planets.js"', 'gl-planets 直引（应为 import 而非 script）'],
    ['data-go="timeline"', '时序导航'],
    ['</html>', 'HTML 收尾'],
  ];
  for (const [k, label] of need) {
    const has = t.includes(k);
    // gl-planets 用 import，不该出现在 script 标签里
    const isNeg = k.includes('gl-planets');
    const ok = isNeg ? !t.includes('<script type="module" src="/gl-planets.js"') : has;
    if (!ok) fail++;
    console.log(ok ? ' ✅' : ' ❌', label);
  }
  // script 标签配对
  const opens = (t.match(/<script\b/g) || []).length;
  const closes = (t.match(/<\/script>/g) || []).length;
  console.log(opens === closes ? ' ✅' : ' ❌', `script 标签配对 ${opens}/${closes}`);
  if (opens !== closes) fail++;
} catch (e) {
  fail++;
  console.log(' ❌ HTML 读取失败', e.message);
}

console.log('\n== 接口 ==');
try {
  const r = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(8000) });
  const j = await r.json();
  console.log(r.ok ? ' ✅' : ' ❌', '/api/health routes=', Object.keys(j.routes || {}).length);
  if (!r.ok) fail++;
} catch (e) {
  fail++;
  console.log(' ❌ /api/health', e.message);
}

console.log('\n' + (fail ? `❌ 共 ${fail} 项异常` : '✅ 全部正常'));
