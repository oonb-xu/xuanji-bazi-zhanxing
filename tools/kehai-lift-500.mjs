// 修正方法论（用户 2026-10-25 指出）：
//   「不要试图一一对应，一颗星星的含义在八字中肯定不会只对应一种十神的内涵」
//
// 上一轮我做了「总克害 vs 总压迫」的全局线性相关 ⇒ 全部不显著。
// **那个设计本身仍是隐式的一一对应**（一个大数对一个大数），所以它的负结果不能用来否定命题。
//
// 本轮改为 **一对多** 的正确形式：**关联规则挖掘**
//   · 两边各抽一批**离散结构特征** B（八字）与 A（星盘）
//   · 对每个 (A,B) 算 lift = P(B|A) / P(B)     ← lift>1 表示 A 抬高 B 的出现率
//   · 用**置换检验**（打乱 B 的配对）给显著性
//   · 报告：一个 A 能同时抬高哪些 B（这就是"一对多"的量化）
import { compileBazi } from '../src/bazi/engine.mjs';
import { tenGodProfile, controlAnalysis, kuGong } from '../src/bazi/ten-gods.mjs';
import { heHuaVerdict, REL_WEIGHT } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { planetStrength, ANGULAR_HOUSES } from '../src/cross/ten-god-mapping.mjs';
import { loadVedastro } from '../src/vedastro/adapter.mjs';
import fs from 'node:fs';

const N = 500;

/* ══════════ 八字侧：离散特征 ══════════ */
function baziFeatures(bz) {
  const tg = tenGodProfile(bz);
  const g = tg.byGroup ?? {};
  const branches = bz.pillars.map((p) => p[1]);
  const rels = heHuaVerdict(branches);
  const ca = controlAnalysis(bz);
  const f = {};
  const med = 0.15; // 组占比阈值
  for (const [k, v] of Object.entries(g)) f['tg_' + k] = (v ?? 0) > med;
  // 刑冲害
  const chong = rels.filter((r) => r.k === '冲').length;
  const xing = rels.filter((r) => r.k === '刑').length;
  f.chong_any = chong > 0;
  f.chong_2plus = chong >= 2;
  f.xing_any = xing > 0;
  f.xing_chong_any = chong + xing > 0;
  // 制关系（分好坏）
  const ctrl = ca.controls ?? [];
  f.ctrl_any = ctrl.length > 0;
  f.ctrl_bad_any = ctrl.some((c) => c.good === false);
  f.ctrl_guan_zhishen = ctrl.some((c) => (c.name ?? '').includes('官杀'));
  f.ctrl_shishen_zhisha = ctrl.some((c) => (c.name ?? '').includes('食神'));
  f.ctrl_xiaoyin_duoshi = ctrl.some((c) => (c.name ?? '').includes('枭印') || (c.name ?? '').includes('夺食'));
  f.ctrl_bijie_duocai = ctrl.some((c) => (c.name ?? '').includes('比劫'));
  return f;
}

/* ══════════ 星盘侧：离散特征（含**具体相位对**，不只总量）══════════ */
function astroFeatures(ch) {
  const P = ch.planets ?? {};
  const f = {};
  const NAMES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
  for (const nm of NAMES) {
    const p = P[nm];
    if (!p) continue;
    f['ang_' + nm] = ANGULAR_HOUSES.has(p.house);
    const st = planetStrength(nm, ch.aspects);
    f['hard_' + nm] = st.pressure > 0.4;
    f['strong_' + nm] = st.strength > 0.5;
  }
  // 具体硬相位对（这是"结构"而不是"总量"）
  const hardPairs = new Set();
  for (const a of ch.aspects ?? []) {
    if (a.type !== '对冲' && a.type !== '四分相') continue;
    const key = [a.a, a.b].sort().join('-');
    hardPairs.add(key);
    f['pair_' + key] = true;
  }
  // 土星与光体的硬相位（经典压力签名）
  f['pair_土星-太阳'] = hardPairs.has('土星-太阳') || hardPairs.has('太阳-土星');
  f['pair_土星-月亮'] = hardPairs.has('土星-月亮') || hardPairs.has('月亮-土星');
  f['pair_火星-太阳'] = hardPairs.has('火星-太阳') || hardPairs.has('太阳-火星');
  f['pair_火星-月亮'] = hardPairs.has('火星-月亮') || hardPairs.has('月亮-火星');
  f['pair_冥王星-太阳'] = hardPairs.has('冥王星-太阳') || hardPairs.has('太阳-冥王星');
  f['pair_冥王星-月亮'] = hardPairs.has('冥王星-月亮') || hardPairs.has('月亮-冥王星');
  const hardCount = (ch.aspects ?? []).filter((a) => a.type === '对冲' || a.type === '四分相').length;
  f.hard_ge5 = hardCount >= 5;
  f.hard_ge8 = hardCount >= 8;
  // 土星角宫 + 光体硬相位 的复合签名
  f.sign_sat_angular_hard = f.ang_土星 && (f['pair_土星-太阳'] || f['pair_土星-月亮']);
  f.sign_mars_angular_hard = f.ang_火星 && (f['pair_火星-太阳'] || f['pair_火星-月亮']);
  return f;
}

/* ══════════ 取数 ══════════ */
const { records } = loadVedastro();
const A = [], B = [];
for (const r of records) {
  if (A.length >= N) break;
  try {
    const at = `${r.date} ${r.time || '12:00'}`;
    const bz = compileBazi({ at, gender: '男' });
    const ch = computeNatal({ at, lng: r.lon, lat: r.lat, tz: r.offsetHours });
    A.push(astroFeatures(ch));
    B.push(baziFeatures(bz));
  } catch { }
}
console.log(`有效样本 ${A.length}`);

/* ══════════ 关联规则 ══════════ */
const aKeys = [...new Set(A.flatMap(Object.keys))].sort();
const bKeys = [...new Set(B.flatMap(Object.keys))].sort();
const rate = (arr, k) => arr.filter((x) => x[k]).length / arr.length;
const bBase = Object.fromEntries(bKeys.map((k) => [k, rate(B, k)]));

// 只保留出现率在 3%~97% 之间的特征（避免退化）
const okB = bKeys.filter((k) => bBase[k] > 0.03 && bBase[k] < 0.97);
const aBaseAll = Object.fromEntries(aKeys.map((k) => [k, rate(A, k)]));
const okA = aKeys.filter((k) => aBaseAll[k] > 0.05 && aBaseAll[k] < 0.95);

console.log(`星盘特征 ${aKeys.length}（可用 ${okA.length}）  八字特征 ${bKeys.length}（可用 ${okB.length}）`);

const pairs = [];
for (const ak of okA) {
  const idx = A.map((x, i) => (x[ak] ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 20) continue;
  for (const bk of okB) {
    const pBgivenA = idx.filter((i) => B[i][bk]).length / idx.length;
    const pB = bBase[bk];
    if (pB <= 0) continue;
    const lift = pBgivenA / pB;
    pairs.push({ ak, bk, lift, pBgivenA, pB, nA: idx.length });
  }
}

/* 置换检验：打乱 B 与 A 的配对，重建 lift 分布 */
const REP = 400;
const nullAbs = [];
const shuffledIdx = [];
for (let r = 0; r < REP; r++) {
  const perm = B.map((_, i) => i).sort(() => Math.random() - 0.5);
  for (const p of pairs) {
    const idx = A.map((x, i) => (x[p.ak] ? i : -1)).filter((i) => i >= 0);
    const pb = perm.filter((i) => B[i][p.bk]).length / perm.length;
    const pba = idx.filter((i) => B[perm[i]]?.[p.bk]).length / idx.length;
    nullAbs.push(pba / pb);
  }
}
nullAbs.sort((a, b) => a - b);
const q975 = nullAbs[Math.floor(0.975 * nullAbs.length)];
const q99 = nullAbs[Math.floor(0.99 * nullAbs.length)];
const q025 = nullAbs[Math.floor(0.025 * nullAbs.length)];

console.log(`\n零模型 lift：2.5%=${q025.toFixed(3)}  97.5%=${q975.toFixed(3)}  99%=${q99.toFixed(3)}`);

const sig = pairs.filter((p) => p.lift > q99 || p.lift < 1 / q99).sort((a, b) => Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift)));
console.log(`\n=== 显著关联（|lift| 超零模型 99% 分位）：${sig.length} 条 ===`);
console.log('  星盘特征 A'.padEnd(30) + '八字特征 B'.padEnd(24) + 'lift'.padStart(7) + '  P(B|A)'.padStart(8) + '  P(B)'.padStart(7) + '  nA'.padStart(5));
for (const p of sig.slice(0, 30)) {
  console.log(`  ${p.ak.padEnd(28)}${p.bk.padEnd(24)}${p.lift.toFixed(3).padStart(7)}${(p.pBgivenA * 100).toFixed(1).padStart(8)}%${(p.pB * 100).toFixed(1).padStart(7)}%${String(p.nA).padStart(5)}`);
}

/* ★ 一对多：哪些星盘结构同时抬高多个八字结构 */
const byA = {};
for (const p of sig) (byA[p.ak] ??= []).push(p);
const multi = Object.entries(byA).filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
console.log(`\n=== ★ 一对多：同时抬高 ≥2 个八字结构的星盘特征（前 10）===`);
for (const [ak, v] of multi.slice(0, 10)) {
  console.log(`  【${ak}】(nA=${v[0].nA}) 抬高 ${v.length} 个八字结构：`);
  console.log('     ' + v.sort((x, y) => y.lift - x.lift).slice(0, 8).map((p) => `${p.bk}(×${p.lift.toFixed(2)})`).join('  '));
}
if (!multi.length) console.log('  （无）');

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/kehai-lift.json', JSON.stringify({ n: A.length, q025, q975, q99, sig, multi: multi.map(([k, v]) => ({ ak: k, hits: v })) }, null, 1), 'utf8');
console.log('\n明细落盘 reports/kehai-lift.json');
