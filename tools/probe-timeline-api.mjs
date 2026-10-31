const r = await fetch('http://127.0.0.1:8788/api/timeline', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ at: '1990-05-20T10:30', gender: '女', lng: 116.4, lat: 39.9, tz: 8 }),
});
console.log('status', r.status);
const j = await r.json();
console.log('ok:', j.ok, j.error || '');
const d = j.data ?? j;
console.log('顶层键:', Object.keys(d).join(','));
for (const k of Object.keys(d)) {
  const v = d[k];
  const t = Array.isArray(v) ? 'array[' + v.length + ']' : typeof v;
  console.log('  ' + k.padEnd(16) + t);
  if (Array.isArray(v) && v.length) console.log('    样例:', JSON.stringify(v[0]).slice(0, 220));
  else if (v && typeof v === 'object') console.log('    键:', Object.keys(v).join(','));
}
