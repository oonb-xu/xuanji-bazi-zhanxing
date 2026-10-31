// 一次性诊断：后端接口是否健康（不依赖浏览器）
const BASE = 'http://127.0.0.1:8788';
const out = { base: BASE, checks: [], verdict: '' };
let bad = 0;
const add = (name, ok, detail) => {
  out.checks.push({ name, ok, detail });
  if (!ok) bad++;
};

async function timed(path, body) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + path, body ? {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    } : { signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    return { status: r.status, ms: Date.now() - t0, len: txt.length, txt };
  } catch (e) {
    return { error: String(e && e.message), ms: Date.now() - t0 };
  }
}

/* ① 健康检查 */
const h = await timed('/api/health');
add('/api/health', h.status === 200, `${h.status} ${h.ms}ms ${h.len}B`);

/* ② 融合接口（排盘主接口） */
const PAY = { at: '1992-08-20T12:00', gender: '女', lng: 121.474, lat: 31.23, tz: 8 };
const f = await timed('/api/fusion', PAY);
let fusionOk = false;
try {
  const j = JSON.parse(f.txt);
  fusionOk = j.ok === true;
  out.fusionKeys = j.ok ? Object.keys(j.data) : null;
  if (j.ok) {
    out.fusionBrief = {
      pillars: j.data.bazi?.pillars,
      planets: Array.isArray(j.data.natal?.planets) ? j.data.natal.planets.length : 'not-array',
      aspects: j.data.natal?.aspects?.length,
      cusps: j.data.natal?.cusps?.length,
    };
  }
} catch (e) { out.fusionParseErr = String(e.message); }
add('/api/fusion', f.status === 200 && fusionOk, `${f.status} ${f.ms}ms ${f.len}B`);

/* ③ 深度接口 */
const d = await timed('/api/deep', { ...PAY, isDay: true });
let deepOk = false;
try { deepOk = JSON.parse(d.txt).ok === true; } catch { }
add('/api/deep', d.status === 200 && deepOk, `${d.status} ${d.ms}ms ${d.len}B`);

/* ④ 前端关键文件是否可下载且含有必要标识 */
const FILES = [
  ['/fusion3d.js', ['let _paused', 'const AUX_NAMES', 'spreadLongitudes', 'glDrawQueue', 'flyToPlanet']],
  ['/app.js', ['function runForm', '#f-fusion', 'renderFusion']],
  ['/deep-fetch.js', ['__renderDeep', '/api/deep']],
  ['/deep-panel.js', ['__renderDeep']],
  ['/dignity-panel.js', ['__renderDignity', 'accidentalDignity']],
  // 注意：fetch 包装器已刻意移除（它曾导致 Illegal invocation / 请求挂起），这里只断言横幅本身
  ['/err-banner.js', ['__showErr']],
];
for (const [path, needles] of FILES) {
  const r = await timed(path);
  const missing = needles.filter((n) => !(r.txt || '').includes(n));
  add(path, r.status === 200 && missing.length === 0,
    missing.length ? `缺少 ${missing.join(', ')}` : `${r.status} ${r.len}B 完整`);
}

out.verdict = bad === 0 ? '✅ 后端与前端资源全部正常 —— 问题在浏览器运行时' : `❌ ${bad} 项异常`;
console.log(JSON.stringify(out, null, 2));
