// 决定性实验（快速版）：网格采样 + **解析统计**（2×2 G 检验 + 年份分层 CMH）+ Bonferroni
//
// 为什么改解析：
//  置换检验复杂度 O(REP × 对数 × 样本) = 60 × 1704 × 37248 ≈ 38 亿次 ⇒ 太慢被中断。
//  改用 2×2 列联表 G 检验（O(对数)）+ **Cochran–Mantel–Haenszel 年份分层**（控制日期混杂），
//  两者都是解析式，秒级完成，且统计上更标准。
import { compileBazi } from '../src/bazi/engine.mjs';
import { tenGodProfile, controlAnalysis } from '../src/bazi/ten-gods.mjs';
import { heHuaVerdict } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { planetStrength, ANGULAR_HOUSES } from '../src/cross/ten-god-mapping.mjs';
import fs from 'node:fs';

const LNG = 116.407, LAT = 39.904, TZ = 8;
const Y0 = 1950, Y1 = 1999, STEP = 2;
const TIMES = ['00:00', '06:00', '12:00', '18:00'];
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m, 0).getDate();

const BODIES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];

function baziFeat(bz) {
  const tg = tenGodProfile(bz); const g = tg.byGroup ?? {};
  const rels = heHuaVerdict(bz.pillars.map((p) => p[1]));
  const ctrl = controlAnalysis(bz).controls ?? [];
  const f = {};
  for (const [k, v] of Object.entries(g)) f['tg_' + k] = (v ?? 0) > 0.15;
  const chong = rels.filter((r) => r.k === '冲').length;
  const xing = rels.filter((r) => r.k === '刑').length;
  f.chong_any = chong > 0; f.chong_2plus = chong >= 2;
  f.xing_any = xing > 0; f.xing_chong_any = chong + xing > 0;
  f.ctrl_any = ctrl.length > 0;
  f.ctrl_bad = ctrl.some((c) => c.good === false);
  f.ctrl_guan = ctrl.some((c) => (c.name ?? '').includes('官杀'));
  return f;
}

function astroFeat(ch) {
  const P = ch.planets ?? {}; const f = {};
  for (const nm of BODIES) {
    const p = P[nm]; if (!p) continue;
    f['ang_' + nm] = ANGULAR_HOUSES.has(p.house);
    const st = planetStrength(nm, ch.aspects);
    f['hard_' + nm] = st.pressure > 0.4;
  }
  const hard = new Set();
  for (const a of ch.aspects ?? []) {
    if (a.type !== '对冲' && a.type !== '四分相') continue;
    hard.add([a.a, a.b].sort().join('-'));
  }
  for (const k of hard) f['pair_' + k] = true;
  f.hard_ge5 = hard.size >= 5;
  return f;
}

/* 采样 */
const rows = [];
for (let y = Y0; y <= Y1; y++) for (let m = 1; m <= 12; m++) {
  const dmax = daysIn(y, m);
  for (let d = 1; d <= dmax; d += STEP) for (const hh of TIMES) {
    const at = `${y}-${pad(m)}-${pad(d)} ${hh}`;
    try { rows.push({ y, a: astroFeat(computeNatal({ at, lng: LNG, lat: LAT, tz: TZ })), b: baziFeat(compileBazi({ at, gender: '男' })) }); } catch { }
  }
}
console.log(`网格样本 ${rows.length}（${Y0}–${Y1}，每 ${STEP} 天 × ${TIMES.length} 时刻）`);
const cy = {}; for (const r of rows) cy[r.y] = (cy[r.y] ?? 0) + 1;
console.log(`每年样本 min=${Math.min(...Object.values(cy))} max=${Math.max(...Object.values(cy))}`);

const aKeys = [...new Set(rows.flatMap((r) => Object.keys(r.a)))];
const bKeys = [...new Set(rows.flatMap((r) => Object.keys(r.b)))];
const rate = (arr, k, side) => arr.filter((r) => r[side][k]).length / arr.length;
const aBase = Object.fromEntries(aKeys.map((k) => [k, rate(rows, k, 'a')]));
const bBase = Object.fromEntries(bKeys.map((k) => [k, rate(rows, k, 'b')]));
const okA = aKeys.filter((k) => aBase[k] > 0.05 && aBase[k] < 0.95);
const okB = bKeys.filter((k) => bBase[k] > 0.05 && bBase[k] < 0.95);
console.log(`星盘 ${aKeys.length}(可用${okA.length})  八字 ${bKeys.length}(可用${okB.length})`);

/* 2×2 G 检验 */
function gTest(a, b, c, d) {
  const n = a + b + c + d;
  if (!n) return { g: 0, p: 1 };
  const row1 = a + b, row2 = c + d, col1 = a + c, col2 = b + d;
  const ln = Math.log;
  const part = (o, e) => (o > 0 && e > 0 ? o * ln(o / e) : 0);
  const g = 2 * (part(a, row1 * col1 / n) + part(b, row1 * col2 / n) + part(c, row2 * col1 / n) + part(d, row2 * col2 / n));
  // chi2 df=1 的 p 值（用 erfc 近似）
  const p = erfc(Math.sqrt(Math.max(0, g) / 2));
  return { g, p };
}
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + z / 2);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/* CMH 年份分层 */
function cmh(pairRows, ak, bk) {
  let num = 0, den = 0;
  const byY = {};
  for (const r of pairRows) (byY[r.y] ??= []).push(r);
  for (const arr of Object.values(byY)) {
    const n = arr.length; if (n < 8) continue;
    let a = 0, b = 0, c = 0, d = 0;
    for (const r of arr) {
      const hasA = r.a[ak], hasB = r.b[bk];
      if (hasA && hasB) a++; else if (hasA) b++; else if (hasB) c++; else d++;
    }
    const n1 = a + b, n2 = c + d, m1 = a + c, m2 = b + d;
    if (n1 === 0 || n2 === 0 || m1 === 0 || m2 === 0) continue;
    num += a - n1 * m1 / n;
    den += (n1 * n2 * m1 * m2) / (n * n * (n - 1));
  }
  if (den <= 0) return { z: 0, p: 1 };
  const z = num / Math.sqrt(den);
  return { z, p: erfc(Math.abs(z) / Math.SQRT2) };
}

/* 全对检验 */
const pairs = [];
for (const ak of okA) {
  const sub = rows.filter((r) => r.a[ak]);
  if (sub.length < 50) continue;
  for (const bk of okB) {
    let a = 0, b = 0;
    for (const r of sub) { if (r.b[bk]) a++; else b++; }
    const tot = rows.length, totB = rows.filter((r) => r.b[bk]).length;
    const c = totB - a, d = tot - a - b - c;
    const { p } = gTest(a, b, c, d);
    const lift = (a / (a + b)) / (totB / tot);
    pairs.push({ ak, bk, lift, pBA: a / (a + b), pB: totB / tot, nA: sub.length, p, a, b, c, d });
  }
}
console.log(`检验对数 ${pairs.length}，Bonferroni α = ${(0.05 / pairs.length).toExponential(2)}`);

/* 先按 Bonferroni 筛，再对通过的做 CMH 分层（控制日期） */
const alphaBonf = 0.05 / pairs.length;
let sig = pairs.filter((p) => p.p < alphaBonf);
console.log(`\nBonferroni 后显著：${sig.length} 条`);

for (const p of sig) {
  const c = cmh(rows, p.ak, p.bk);
  p.cmhZ = c.z; p.cmhP = c.p;
}
const survived = sig.filter((p) => p.cmhP < alphaBonf);
console.log(`再过 CMH 年份分层：${survived.length} 条存活\n`);

if (survived.length) {
  console.log('  星盘 A'.padEnd(26) + '八字 B'.padEnd(18) + 'lift'.padStart(7) + 'P(B|A)'.padStart(8) + 'P(B)'.padStart(7) + 'CMHz'.padStart(7) + ' nA'.padStart(6));
  for (const p of survived.sort((x, y) => Math.abs(y.cmhZ) - Math.abs(x.cmhZ)).slice(0, 20)) {
    console.log(`  ${p.ak.padEnd(24)}${p.bk.padEnd(18)}${p.lift.toFixed(3).padStart(7)}${(p.pBA * 100).toFixed(1).padStart(8)}%${(p.pB * 100).toFixed(1).padStart(7)}%${p.cmhZ.toFixed(2).padStart(7)}${String(p.nA).padStart(6)}`);
  }
} else {
  console.log('  ★ 无一条在控制日期后仍显著。');
}

/* 一对多：即使不显著，也列出 lift 最大的 A 及其多个 B */
console.log('\n=== 探索性（未校正，仅供参考）：lift 最大的 12 对 ===');
for (const p of pairs.sort((x, y) => (Math.abs(Math.log(y.lift)) - Math.abs(Math.log(x.lift)))).slice(0, 12)) {
  console.log(`  ${p.ak.padEnd(24)}×${p.bk.padEnd(18)} lift=${p.lift.toFixed(2)}  p=${p.p.toExponential(1)}`);
}

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/kehai-grid-analytic.json', JSON.stringify({ n: rows.length, nPairs: pairs.length, alphaBonf, nSig: sig.length, nSurvived: survived.length, survived, top: pairs.sort((x, y) => Math.abs(Math.log(y.lift)) - Math.abs(Math.log(x.lift))).slice(0, 40) }, null, 1), 'utf8');
console.log('\n落盘 reports/kehai-grid-analytic.json');
