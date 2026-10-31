const r = await fetch('http://127.0.0.1:8788/api/deep', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ at: '1990-05-20T10:30', gender: '女', lng: 116.4, lat: 39.9, tz: 8 }),
});
console.log('status', r.status);
const j = await r.json();
console.log('ok:', j.ok, ' 顶层键:', Object.keys(j.data ?? j).join(','));
const d = j.data ?? j;
if (Array.isArray(d.planets)) {
  console.log('\nplanets 数量:', d.planets.length);
  const p0 = d.planets[0];
  console.log('第一个 planet 的键:', Object.keys(p0).join(','));
  console.log('planet 字段值样例:', d.planets.slice(0, 4).map((x) => x.planet).join(' | '));
  console.log('有 weights 吗:', !!p0.weights, ' weights 键:', p0.weights ? Object.keys(p0.weights).join(',') : '-');
  console.log('样例 weights:', JSON.stringify(p0.weights));
  console.log('primary:', JSON.stringify(p0.primary));
} else {
  console.log('\n❌ 没有 planets 数组；实际结构:', JSON.stringify(d).slice(0, 400));
}
