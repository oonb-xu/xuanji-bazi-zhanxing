// 验证互容体系 + 用户那个具体例子（木星落 + 月亮巨蟹对冲）
import { computeNatal } from '../src/western/natal.mjs';
import {
  dignitiesOf, dignityScore, mutualReception, aspectEnergyFlow,
  DOMICILE, EXALTATION, DETRIMENT, FALL, RECEPTION_GRADE,
} from '../src/western/reception.mjs';

console.log('=== ① 尊贵表自检 ===');
for (const [p, s] of [['月亮', '巨蟹'], ['木星', '摩羯'], ['木星', '巨蟹'], ['土星', '天秤'], ['太阳', '白羊'], ['火星', '摩羯']]) {
  const d = dignitiesOf(p, s);
  console.log(`  ${p} 在 ${s}：${d.length ? d.map((x) => `${x.type}(${x.score > 0 ? '+' : ''}${x.score})`).join(' ') : '无尊贵'}  综合分 ${dignityScore(p, s)}`);
}

console.log('\n=== ② ★ 用户例子的机制核对 ===');
console.log('  前提：木星在摩羯（落）· 月亮在巨蟹（月亮庙 + 木星旺）');
const r1 = mutualReception('月亮', '巨蟹', '木星', '摩羯');
console.log(`  月亮在巨蟹 → 是否木星尊贵？${r1.aInB ?? '否'}`);
console.log(`  木星在摩羯 → 是否月亮尊贵？${r1.bInA ?? '否'}`);
console.log(`  互容级别：${r1.grade} ${r1.name}`);
console.log(`  ⇒ 月亮"携带着木星的旺"来对冲木星 —— 用户的说法成立`);

console.log('\n=== ③ 分级判定自检 ===');
const cases = [
  ['庙庙互换', '土星', '摩羯', '月亮', '巨蟹'],   // 土星庙摩羯, 月亮庙巨蟹 → 互相？需检查
  ['庙旺互换', '月亮', '白羊', '火星', '巨蟹'],   // 月亮在白羊(火星庙), 火星在巨蟹(月亮庙+木星旺)
  ['旺旺互换', '太阳', '白羊', '土星', '天秤'],   // 太阳旺白羊, 土星旺天秤 → 互旺
  ['无互容', '太阳', '白羊', '土星', '白羊'],
];
for (const [label, pa, sa, pb, sb] of cases) {
  const r = mutualReception(pa, sa, pb, sb);
  console.log(`  ${label.padEnd(8)} ${pa}@${sa} × ${pb}@${sb} → ${r.grade} ${r.name}（分 ${r.score}） aInB=${r.aInB ?? '-'} bInA=${r.bInA ?? '-'}`);
}

console.log('\n=== ④ 真实盘的互容与输能 ===');
const cases2 = [
  { name: '样例A 北京1990-03-15 12:00', at: '1990-03-15 12:00', lng: 116.407, lat: 39.904 },
  { name: '样例B 上海1992-08-20 12:00', at: '1992-08-20 12:00', lng: 121.474, lat: 31.230 },
];
for (const c of cases2) {
  const ch = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: 8 });
  console.log(`\n  【${c.name}】`);
  console.log('  各星尊贵：');
  for (const [n, v] of Object.entries(ch.planets)) {
    if (!v?.sign) continue;
    const s = dignityScore(n, v.sign);
    if (s === 0) continue;
    console.log(`    ${n.padEnd(4)} ${v.sign}  ${s > 0 ? '+' : ''}${s}  ${dignitiesOf(n, v.sign).map((x) => x.type).join('/')}`);
  }
  const e = aspectEnergyFlow(ch);
  console.log(`  互容 ${e.receptions.length} 条：`);
  for (const r of e.receptions.slice(0, 6)) {
    console.log(`    ${r.a}@${r.aSign} × ${r.b}@${r.bSign} (${r.type}) → ${r.grade} ${r.name}`);
  }
  console.log(`  输能 Top5：`);
  for (const f of e.flows.slice(0, 5)) {
    console.log(`    ${f.from}(${f.fromDignity > 0 ? '+' : ''}${f.fromDignity}) → ${f.to}(${f.toDignity > 0 ? '+' : ''}${f.toDignity})  ${f.type}  量${f.amount}  ${f.carryingDignity ? '★携带尊贵' : ''} ${f.reception !== 'none' ? '[' + f.receptionName + ']' : ''}`);
  }
}
