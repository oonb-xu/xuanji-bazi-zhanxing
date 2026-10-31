// 测 synastry 的 summary / explain（Node fetch，避开 PowerShell 编码坑）
const BASE = 'http://127.0.0.1:8788';
const post = async (path, body) => (await fetch(BASE + path, {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
})).json();

const body = {
  a: { at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, gender: '男' },
  b: { at: '1992-08-20 12:00', lng: 121.474, lat: 31.230, gender: '女' },
};
const r = await post('/api/synastry', body);
const d = r.data;
if (!d) { console.log('失败:', JSON.stringify(r).slice(0, 300)); process.exit(1); }

const s = d.summary;
console.log('=== 综合结构契合度 ===');
console.log(`  ${s.structuralFitPct}%  （${s.band}）  M=${s.mValue}`);
console.log('');
console.log('=== 三路分项 ===');
for (const c of s.components) {
  console.log(`  ${c.key.padEnd(6)} 原值=${String(c.raw).slice(0, 8).padEnd(9)} z=${String(c.z).padEnd(7)} → ${c.pct}%  权重${c.weight}`);
}
console.log('');
console.log('  否决:', JSON.stringify(s.veto));
console.log('');
console.log('=== 解释 ===');
for (const [k, v] of Object.entries(d.explain ?? {})) console.log(`  【${k}】${v.slice(0, 64)}…`);
console.log('');
console.log('公式:', s.formula.slice(0, 90) + '…');
console.log('声明:', s.disclaimer.slice(0, 70) + '…');
