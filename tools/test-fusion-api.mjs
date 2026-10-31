// 模拟前端排盘请求，逐步定位失败点
const BASE = 'http://127.0.0.1:8788';

const payload = { at: '1992-08-20T12:00', gender: '女', lng: 121.474, lat: 31.23 };

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { }
  return { status: r.status, json, text };
}

/* ① 三个基础接口 */
for (const [name, path, body] of [
  ['bazi', '/api/bazi', { at: payload.at, gender: payload.gender }],
  ['natal', '/api/natal', { at: payload.at, lng: payload.lng, lat: payload.lat }],
]) {
  const r = await post(path, body);
  console.log(`[${name}] HTTP ${r.status}`, r.json?.ok ? '✅ ok' : '❌ ' + (r.json?.error || r.text.slice(0, 120)));
}

/* ② 融合接口（前端实际用的） */
const f = await post('/api/fusion', payload);
console.log(`\n[fusion] HTTP ${f.status}`, f.json?.ok ? '✅ ok' : '❌ ' + (f.json?.error || ''));
if (f.json?.ok) {
  const d = f.json.data;
  console.log('  data keys:', Object.keys(d).join(', '));
  console.log('  bazi.pillars:', JSON.stringify(d.bazi?.pillars));
  console.log('  bazi.dayMaster:', d.bazi?.dayMaster, ' 命宫:', d.bazi?.mingGong, ' 身宫:', d.bazi?.shenGong);
  console.log('  natal.planets 数量:', d.natal?.planets?.length);
  console.log('  natal.aspects 数量:', d.natal?.aspects?.length);
  console.log('  natal.cusps 数量:', d.natal?.cusps?.length);
  console.log('  reception 存在:', !!d.reception, ' supplement 存在:', !!d.supplement);
  // 检查渲染需要的关键字段
  const need = [
    ['bazi.pillars', d.bazi?.pillars?.length === 4],
    ['bazi.dayMaster', typeof d.bazi?.dayMaster === 'string'],
    ['natal.planets 是数组', Array.isArray(d.natal?.planets)],
    ['每颗行星有 lon/name', (d.natal?.planets ?? []).every((p) => typeof p.name === 'string' && typeof p.lon === 'number')],
    ['natals.cusps 12', d.natal?.cusps?.length === 12],
    ['aspects 数组', Array.isArray(d.natal?.aspects)],
  ];
  console.log('\n  渲染依赖字段：');
  for (const [k, ok] of need) console.log('   ', ok ? '✅' : '❌', k);
}
