// 诊断：apiBazi / apiNatal 的对外形状是否与 buildSupplement 期望的一致
const base = 'http://127.0.0.1:8788';
const body = { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, tz: 8, gender: '男' };
const H = { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) };

const bz = (await (await fetch(base + '/api/bazi', H)).json()).data;
const nt = (await (await fetch(base + '/api/natal', H)).json()).data;

console.log('=== apiBazi 对外形状 ===');
console.log('  keys:', Object.keys(bz).slice(0, 14).join(', '));
console.log('  pillars[0] =', JSON.stringify(bz.pillars?.[0]));
console.log('  pillars 元素类型:', typeof bz.pillars?.[0]);

console.log('\n=== apiNatal 对外形状 ===');
console.log('  keys:', Object.keys(nt).slice(0, 14).join(', '));
console.log('  planets 类型:', Array.isArray(nt.planets) ? 'array' : typeof nt.planets);
console.log('  planets.土星 =', JSON.stringify(nt.planets?.['土星'])?.slice(0, 140));
console.log('  aspects 条数:', nt.aspects?.length);
if (nt.aspects?.[0]) console.log('  aspects[0] =', JSON.stringify(nt.aspects[0]).slice(0, 140));

console.log('\n=== buildSupplement 期望 ===');
console.log('  baziResult.pillars[1][1]  ← 需要字符串 "乙"');
console.log('  astroChart.planets["土星"].house');
console.log('  astroChart.aspects[] {a,b,type,orb}');

console.log('\n=== 判定 ===');
const okPillars = typeof bz.pillars?.[1] === 'string';
const okPlanets = !!nt.planets?.['土星'];
const okAspects = Array.isArray(nt.aspects);
console.log(`  pillars 形状匹配: ${okPillars ? '✅' : '❌ 需适配'}`);
console.log(`  planets 形状匹配: ${okPlanets ? '✅' : '❌ 需适配'}`);
console.log(`  aspects 形状匹配: ${okAspects ? '✅' : '❌ 需适配'}`);
