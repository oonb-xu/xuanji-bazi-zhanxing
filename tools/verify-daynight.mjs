// 验证昼夜盘口径：同一出生，日盘/夜盘应给出不同的三分性主星
import { computeNatal } from '../src/western/natal.mjs';
import { isDayChart, dignitiesOf, dignityScore, mutualReception, aspectEnergyFlow } from '../src/western/reception.mjs';

const CASES = [
  { n: '正午 12:00（昼）', at: '1990-03-15 12:00', lng: 116.407, lat: 39.904 },
  { n: '午夜 00:00（夜）', at: '1990-03-15 00:00', lng: 116.407, lat: 39.904 },
  { n: '清晨 06:00', at: '1990-03-15 06:00', lng: 116.407, lat: 39.904 },
  { n: '傍晚 18:00', at: '1990-03-15 18:00', lng: 116.407, lat: 39.904 },
];

console.log('=== ① 昼夜判定（太阳宫位 ≥7 为日盘）===');
for (const c of CASES) {
  const ch = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: 8 });
  const sun = ch.planets?.太阳;
  const d = isDayChart(ch);
  console.log(`  ${c.n.padEnd(14)} 太阳第 ${String(sun?.house).padStart(2)} 宫  ⇒  ${d === null ? '未判' : d ? '日盘' : '夜盘'}`);
}

console.log('\n=== ② 同一星座、不同昼夜 ⇒ 三分主星不同 ===');
// 例子：火星在狮子（火象）
for (const isDay of [true, false, null]) {
  const d = dignitiesOf('火星', '狮子', isDay);
  const tag = isDay === true ? '日盘' : isDay === false ? '夜盘' : '未判';
  console.log(`  火星@狮子（火象）${tag.padEnd(4)} → ${d.length ? d.map((x) => `${x.type}(${x.score})`).join(' ') : '无尊贵'}`);
}
// 火象三分：昼主=太阳、夜主=木星、参与=土星
console.log('  说明：火象昼主=太阳、夜主=木星、参与=土星');
for (const isDay of [true, false]) {
  const tag = isDay ? '日盘' : '夜盘';
  const who = isDay ? '太阳' : '木星';
  const r = dignitiesOf(who, '狮子', isDay);
  console.log(`  ${who}@狮子（火象·${tag}）→ ${r.length ? r.map((x) => `${x.type}(${x.score})`).join(' ') : '无尊贵'}`);
}

console.log('\n=== ③ 真实盘：昼夜盘对互容/输能的影响 ===');
for (const c of CASES) {
  const ch = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: 8 });
  const e = aspectEnergyFlow(ch);
  const byGrade = {};
  for (const r of e.receptions) byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1;
  console.log(`  ${c.n.padEnd(14)} ${e.isDay ? '日盘' : '夜盘'}  互容 ${e.receptions.length} 条 ${JSON.stringify(byGrade)}  输能 ${e.flows.length} 条`);
}
