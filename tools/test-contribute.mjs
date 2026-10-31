// 用 Node 原生 fetch 测采集接口（避免 PowerShell -Body 的 ANSI 编码坑）
const BASE = 'http://127.0.0.1:8788';

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return r.json();
};

const P = ['戊子', '戊午', '乙巳', '甲申'];
const RE = [{ year: 2012, category: '学业' }, { year: 2019, category: '事业' }, { year: 2023, category: '婚姻' }];

const cases = [
  ['① 未矫正（应照收 → C 级）', { pillars: P, gender: '女', birthPlace: '示例市', rectifyEvents: RE, outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
  ['② 已矫正·单事件（B 级 0.6）', { pillars: P, gender: '女', birthPlace: '示例市', rectified: true, rectifyEvents: RE, outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
  ['③ 已矫正·多事件（A 级 1.0）', { pillars: P, gender: '女', birthPlace: '示例市', rectified: true, rectifyEvents: RE, outcomeEvents: [{ year: 2020, category: '婚姻' }, { year: 2022, category: '事业' }] }],
  ['④ 缺四柱（X 级，唯一拒收）', { gender: '女', rectified: true, rectifyEvents: RE, outcomeEvents: [{ year: 2020, category: '婚姻' }] }],
];

for (const [name, body] of cases) {
  const r = await post('/api/contribute', body);
  const d = r.data ?? r;
  if (d.accepted) {
    console.log(`${name}`);
    console.log(`   已入库 id=${d.id}  级=${d.tier}  权重=${d.calibrationWeight}  分=${d.qualityScore}`);
    console.log(`   ${d.label}`);
    if (d.advisories?.length) for (const a of d.advisories) console.log('   ! ' + a.replace(/\*\*/g, '').slice(0, 62) + '…');
  } else {
    console.log(`${name}`);
    console.log(`   未入库  级=${d.tier}  原因=${d.reason}`);
  }
  console.log('');
}

const s = await (await fetch(BASE + '/api/contrib-stats')).json();
console.log('=== 采集库统计 ===');
console.log(`  总数 ${s.total} ｜ 有效样本(加权) ${s.effectiveSamples} ｜ 分层 ${JSON.stringify(s.byTier)}`);
console.log(`  决定性事件分布 ${JSON.stringify(s.decisive)}`);
