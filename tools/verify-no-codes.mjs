// 验证：**所有**服务端返回的 JSON 里不得出现项目编号（用户长期原则）
const BASE = 'http://127.0.0.1:8788';
const CODE = /R-[A-Z]\d|基线 ?v\d|hypothesis_under_validation|R-G|R-B/;

const post = async (path, body) => (await fetch(BASE + path, {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
})).json();

const calls = [
  ['/api/bazi', { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, gender: '男' }],
  ['/api/natal', { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, tz: 8 }],
  ['/api/fusion', { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, tz: 8, gender: '男' }],
  ['/api/synastry', { a: { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, gender: '男' }, b: { at: '1992-08-20 12:00', lng: 121.474, lat: 31.230, gender: '女' } }],
  ['/api/liuren', { at: '2026-10-22 14:20', matter: '测试' }],
  ['/api/timecheck', { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, tz: 8, gender: '男' }],
  ['/api/rectify', { date: '1990-03-15', time: '12:00', lon: 116.407, lat: 39.904, windowMin: 20, stepMin: 2, events: [{ year: 2012, category: '学业' }, { year: 2019, category: '事业' }, { year: 2023, category: '婚姻' }] }],
  ['/api/contribute', { pillars: ['庚午', '己卯', '辛酉', '甲午'], gender: '男', rectified: true, rectifyEvents: [{ year: 2012, category: '学业' }, { year: 2019, category: '事业' }, { year: 2023, category: '婚姻' }], outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
];

let bad = 0;
for (const [path, body] of calls) {
  let txt;
  try { txt = JSON.stringify(await post(path, body)); }
  catch (e) { console.log(`${path.padEnd(18)} 调用失败: ${e.message}`); continue; }
  const m = txt.match(CODE);
  if (m) {
    bad++;
    // 找出第一次出现的位置上下文
    const i = txt.indexOf(m[0]);
    console.log(`${path.padEnd(18)} ❌ 含编号 "${m[0]}"  …${txt.slice(Math.max(0, i - 40), i + 40)}…`);
  } else {
    console.log(`${path.padEnd(18)} ✅ 干净 (${(txt.length / 1024).toFixed(1)} KB)`);
  }
}

const stats = await (await fetch(BASE + '/api/contrib-stats')).json();
const st = JSON.stringify(stats);
if (CODE.test(st)) { bad++; console.log('/api/contrib-stats  ❌ 含编号'); } else console.log('/api/contrib-stats  ✅ 干净');

console.log('');
console.log(bad === 0 ? '✅ 全部接口返回均无项目编号' : `❌ ${bad} 个接口仍含编号`);
process.exit(bad === 0 ? 0 : 1);
