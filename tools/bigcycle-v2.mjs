// 大周期精确运算 v2：自己找木土会合（黄经相等），再量周期结构
import * as A from 'astronomy-engine';
import fs from 'node:fs';

const lonJ = (t) => A.EclipticLongitude(A.Body.Jupiter, t);
const lonS = (t) => A.EclipticLongitude(A.Body.Saturn, t);
function rel(t) {           // J − S，归到 (−180, 180]
  let d = ((lonJ(t) - lonS(t)) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}
const DAY = 86400000;
const YEAR = 365.2422 * DAY;

/* ── 扫会合：先粗扫 4 天一步，找负→正过零，再二分到 1 分钟 ── */
const conj = [];
let t = Date.UTC(1700, 0, 1);
const END = Date.UTC(2300, 0, 1);
let prevR = rel(new Date(t)), prevT = t;
let guard = 0;
while (t < END && guard++ < 400000) {
  t += 4 * DAY;
  const r = rel(new Date(t));
  if (prevR < 0 && r >= 0 && Math.abs(prevR) < 20 && Math.abs(r) < 20) {
    /* 二分 */
    let lo = prevT, hi = t;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (rel(new Date(mid)) < 0) lo = mid; else hi = mid;
      if (hi - lo < 60000) break;
    }
    const hit = new Date((lo + hi) / 2);
    conj.push({ t: hit, lon: ((lonJ(hit) % 360) + 360) % 360 });
  }
  prevR = r; prevT = t;
}
console.log('会合数:', conj.length, '  范围:', conj[0]?.t.toISOString().slice(0, 10), '→', conj.at(-1)?.t.toISOString().slice(0, 10));
if (conj.length < 10) { console.error('❌ 会合太少'); process.exit(1); }

/* ── 间隔 ── */
const gaps = [];
for (let i = 1; i < conj.length; i++) gaps.push((conj[i].t - conj[i - 1].t) / YEAR);
const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
console.log('\n=== 会合间隔 ===');
console.log('  平均', mean.toFixed(6), '（理论 19.85899）');
console.log('  标准差', sd.toFixed(6), ' 最小', Math.min(...gaps).toFixed(4), ' 最大', Math.max(...gaps).toFixed(4), ' 极差', (Math.max(...gaps) - Math.min(...gaps)).toFixed(4));

/* ── 间隔振荡周期（大不等式）＝ 自相关 ── */
const n = gaps.length, det = gaps.map((g) => g - mean);
let best = { lag: 0, r: -Infinity };
for (let lag = 3; lag < Math.floor(n / 2); lag++) {
  let num = 0, d1 = 0, d2 = 0;
  for (let i = 0; i + lag < n; i++) { num += det[i] * det[i + lag]; d1 += det[i] ** 2; d2 += det[i + lag] ** 2; }
  const r = num / Math.sqrt(d1 * d2 || 1);
  if (r > best.r) best = { lag, r };
}
console.log('\n=== 间隔振荡周期（大不等式）===');
console.log('  最相关滞后', best.lag, '个会合 ≈', Math.round(best.lag * mean), '年   r =', best.r.toFixed(3));

/* ── 会合点黄经推进 ── */
const adv = [];
for (let i = 1; i < conj.length; i++) {
  let d = ((conj[i].lon - conj[i - 1].lon) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  adv.push(d);
}
const advMean = adv.reduce((a, b) => a + b, 0) / adv.length;
console.log('\n=== 会合点黄经推进 ===');
console.log('  平均每次', advMean.toFixed(4), '°  ⇒ 转满 360° 需', (360 / Math.abs(advMean)).toFixed(2), '次 ≈', Math.round(360 / Math.abs(advMean) * mean), '年');

/* ── 3 次会合跨度（对应「60 年」） ── */
const tri = [];
for (let i = 0; i + 3 < conj.length; i++) tri.push({ y: conj[i].t.getUTCFullYear(), span: (conj[i + 3].t - conj[i].t) / YEAR });
const trv = tri.map((x) => x.span);
const tmean = trv.reduce((a, b) => a + b, 0) / trv.length;
console.log('\n=== 3 次会合跨度（应 ≈60 年）===');
console.log('  平均', tmean.toFixed(5), '（理论 59.576971）');
console.log('  最小', Math.min(...trv).toFixed(3), ' 最大', Math.max(...trv).toFixed(3), ' 极差', (Math.max(...trv) - Math.min(...trv)).toFixed(3));
console.log('\n  近三百年抽样：');
for (const r of tri.filter((x) => x.y >= 1700 && x.y <= 2300)) {
  console.log(`    ${r.y}  跨度 ${r.span.toFixed(4)} 年   与60差 ${(r.span - 60).toFixed(4)} 年 (${((r.span - 60) * 365.2422).toFixed(0)} 天)`);
}

const out = {
  window: [conj[0].t.toISOString().slice(0, 10), conj.at(-1).t.toISOString().slice(0, 10)],
  count: conj.length,
  gapMean: +mean.toFixed(6), gapSD: +sd.toFixed(6),
  gapMin: +Math.min(...gaps).toFixed(4), gapMax: +Math.max(...gaps).toFixed(4),
  greatInequalityLag: best.lag, greatInequalityYears: Math.round(best.lag * mean), greatInequalityR: +best.r.toFixed(3),
  advMean: +advMean.toFixed(4), wrapConj: +(360 / Math.abs(advMean)).toFixed(2), wrapYears: Math.round(360 / Math.abs(advMean) * mean),
  tripleMean: +tmean.toFixed(5), tripleMin: +Math.min(...trv).toFixed(3), tripleMax: +Math.max(...trv).toFixed(3),
  triples: tri.filter((x) => x.y >= 1700 && x.y <= 2300).map((x) => ({ y: x.y, span: +x.span.toFixed(4) })),
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/jupiter-saturn-bigcycle.json', JSON.stringify(out, null, 2), 'utf8');
console.log('\n✅ reports/jupiter-saturn-bigcycle.json');
