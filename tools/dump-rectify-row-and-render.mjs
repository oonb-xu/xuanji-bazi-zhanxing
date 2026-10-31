import fs from 'node:fs';
const t = fs.readFileSync('web/app.js', 'utf8');

console.log('=== rectifyEventRow 全文 ===');
const i1 = t.indexOf('function rectifyEventRow');
console.log(t.slice(i1, t.indexOf('function ', i1 + 10)));

console.log('\n=== 时序相关：apiTimeline / renderTimeline ===');
for (const k of ['/api/timeline', 'renderTimeline', 'timeline-out', 'function renderFusion', 'function renderSynastry']) {
  const i = t.indexOf(k);
  console.log('  ' + k.padEnd(26) + (i >= 0 ? '@' + i : '缺'));
}

console.log('\n=== renderFusion 开头 500 字符 ===');
const rf = t.indexOf('function renderFusion');
console.log(rf >= 0 ? t.slice(rf, rf + 500) : '(缺)');

console.log('\n=== renderSynastry 开头 500 字符 ===');
const rs = t.indexOf('function renderSynastry');
console.log(rs >= 0 ? t.slice(rs, rs + 500) : '(缺)');
