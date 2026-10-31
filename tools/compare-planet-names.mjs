const body = { at: '1990-05-20T10:30', gender: '女', lng: 116.4, lat: 39.9, tz: 8 };
const r = await fetch('http://127.0.0.1:8788/api/fusion', {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
});
const j = await r.json();
const d = j.data ?? j;
const planets = d.planets || d.wheel || [];
console.log('fusion 行星名:', planets.map((p) => p.name || p.planet).join(' | '));

const r2 = await fetch('http://127.0.0.1:8788/api/deep', {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
});
const j2 = await r2.json();
const deepNames = (j2.data?.planets || []).map((p) => p.planet);
console.log('deep  行星名:', deepNames.join(' | '));

const fn = planets.map((p) => p.name || p.planet);
const missing = fn.filter((n) => !deepNames.includes(n));
console.log('\n融合盘里没有对应权重的行星:', missing.length ? missing.join(', ') : '无 ✅ 全部匹配');
