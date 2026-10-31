// 大周期精确运算：用真实星历扫木土会合，量出「间隔」「会合点黄经」「大不等式周期」
import * as A from 'astronomy-engine';

const J = A.Body.Jupiter, S = A.Body.Saturn;

function eclLon(body, time) {
  const eq = A.GeoVector(body, time, true);
  return A.Ecliptic(eq).elon;           // 0–360
}
function norm360(x) { return ((x % 360) + 360) % 360; }
function diffLon(a, b) { let d = norm360(a - b); if (d > 180) d -= 360; return d; }  // −180..180

/* ── 扫会合：J 与 S 黄经相同 ── */
const conj = [];
let t = new Date(Date.UTC(1000, 0, 1));
const END = Date.UTC(2501, 0, 1);
let guard = 0;
while (t.getTime() < END && guard++ < 400) {
  let hit;
  try {
    hit = A.SearchRelativeLongitude(J, S, 0, t);
  } catch (e) { break; }
  if (!hit || hit.date.getTime() >= END) break;
  const lon = eclLon(J, hit);
  conj.push({ t: hit.date, lon: norm360(lon) });
  /* 跳到 3 年后继续找，避免同一对重复 */
  t = new Date(hit.date.getTime() + 3 * 365.2422 * 86400000);
}
console.log('会合数:', conj.length, '  范围:', conj[0]?.t.toISOString().slice(0, 10), '→', conj[conj.length - 1]?.t.toISOString().slice(0, 10));

/* ── 间隔序列（年） ── */
const YEAR = 365.2422 * 86400000;
const iv = [];
for (let i = 1; i < conj.length; i++) {
  iv.push({ y0: conj[i - 1].t.getUTCFullYear(), gap: (conj[i].t - conj[i - 1].t) / YEAR });
}
const gaps = iv.map((x) => x.gap);
const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
console.log('\n=== 会合间隔 ===');
console.log('  平均', mean.toFixed(6), '年   （理论 1/(1/11.862−1/29.457) = 19.85899）');
console.log('  标准差', sd.toFixed(6), '  最小', Math.min(...gaps).toFixed(4), '  最大', Math.max(...gaps).toFixed(4), '  极差', (Math.max(...gaps) - Math.min(...gaps)).toFixed(4));

/* ── 找间隔的振荡周期（大不等式）：对 gap 序列做自相关 ── */
console.log('\n=== 间隔振荡的周期（大不等式） ===');
const n = gaps.length;
const detrend = gaps.map((g) => g - mean);
let best = { lag: 0, r: -Infinity };
for (let lag = 5; lag < Math.floor(n / 2); lag++) {
  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i + lag < n; i++) { num += detrend[i] * detrend[i + lag]; d1 += detrend[i] ** 2; d2 += detrend[i + lag] ** 2; }
  const r = num / Math.sqrt(d1 * d2 || 1);
  if (r > best.r) best = { lag, r };
}
console.log('  最相关滞后', best.lag, '个会合 ≈', (best.lag * mean).toFixed(0), '年   r =', best.r.toFixed(3));

/* ── 会合点黄经：每次推进多少度，转满 360 需多少次 ── */
const adv = [];
for (let i = 1; i < conj.length; i++) adv.push(diffLon(conj[i].lon, conj[i - 1].lon));
const advMean = adv.reduce((a, b) => a + b, 0) / adv.length;
console.log('\n=== 会合点黄经推进 ===');
console.log('  平均每次', advMean.toFixed(4), '°');
console.log('  转满 360° 需', (360 / Math.abs(advMean)).toFixed(2), '次会合 ≈', (360 / Math.abs(advMean) * mean).toFixed(0), '年');

/* ── 3 次会合（59.58）的实际值：每次会合间隔 ×3 ── */
console.log('\n=== 「3 次会合 ≈ 60 年」的实测分布 ===');
const tri = [];
for (let i = 0; i + 2 < conj.length; i++) {
  tri.push({ y: conj[i].t.getUTCFullYear(), span: (conj[i + 2].t - conj[i].t) / YEAR });
}
const trv = tri.map((x) => x.span);
const tmean = trv.reduce((a, b) => a + b, 0) / trv.length;
console.log('  平均', tmean.toFixed(5), '年  （理论 59.576971）');
console.log('  最小', Math.min(...trv).toFixed(3), '  最大', Math.max(...trv).toFixed(3), '  极差', (Math.max(...trv) - Math.min(...trv)).toFixed(3));
console.log('  与 60 的偏差：最小', (Math.min(...trv) - 60).toFixed(3), ' 最大', (Math.max(...trv) - 60).toFixed(3));

/* 近 400 年逐年（每 5 个取一）*/
console.log('\n=== 近几百年实测（3 次会合跨度）===');
const recent = tri.filter((x) => x.y >= 1600 && x.y <= 2300);
for (let i = 0; i < recent.length; i += 4) {
  const r = recent[i];
  console.log(`  起 ${r.y}  跨度 ${r.span.toFixed(4)} 年   偏 60 = ${(r.span - 60).toFixed(4)}`);
}

/* ── 输出 JSON 供页面使用 ── */
const out = {
  window: [conj[0].t.toISOString().slice(0, 10), conj[conj.length - 1].t.toISOString().slice(0, 10)],
  count: conj.length,
  gapMean: +mean.toFixed(6), gapSD: +sd.toFixed(6),
  gapMin: +Math.min(...gaps).toFixed(4), gapMax: +Math.max(...gaps).toFixed(4),
  greatInequalityLagConj: best.lag, greatInequalityYears: Math.round(best.lag * mean), greatInequalityR: +best.r.toFixed(3),
  advMean: +advMean.toFixed(4), wrapConj: +(360 / Math.abs(advMean)).toFixed(2), wrapYears: Math.round(360 / Math.abs(advMean) * mean),
  tripleMean: +tmean.toFixed(5), tripleMin: +Math.min(...trv).toFixed(3), tripleMax: +Math.max(...trv).toFixed(3),
  sample: recent.filter((_, i) => i % 4 === 0).map((x) => ({ y: x.y, span: +x.span.toFixed(4) })),
};
import fs from 'node:fs';
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/jupiter-saturn-bigcycle.json', JSON.stringify(out, null, 2), 'utf8');
console.log('\n✅ 已写入 reports/jupiter-saturn-bigcycle.json');
