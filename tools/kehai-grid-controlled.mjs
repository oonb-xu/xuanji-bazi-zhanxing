// ★ 决定性实验：用**日期网格**生成配对样本，彻底消除日期混杂。
//
// 上一轮问题：VedAstro 的 500 条跨 167 年（每年 3 条），chong2 年份间极差 40pp
// ⇒ 任何"星盘特征 × 八字特征"的关联都可能只是日期造成的。
//
// 本实验：固定地点，在 **1950–1999 每 2 天** 的网格上采样（每年 ~183 条，年份完全均匀），
// 同一 (date,time,loc) 同时算八字与星盘。日期分布受控 ⇒ 残留关联只能是体系间的真实对应。
import { compileBazi } from '../src/bazi/engine.mjs';
import { tenGodProfile, controlAnalysis } from '../src/bazi/ten-gods.mjs';
import { heHuaVerdict } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { planetStrength, ANGULAR_HOUSES } from '../src/cross/ten-god-mapping.mjs';
import fs from 'node:fs';

const LNG = 116.407, LAT = 39.904, TZ = 8;
const YEARS = [1950, 1999];
const STEP_DAYS = 2;              // 每 2 天一个
const TIMES = ['00:00', '06:00', '12:00', '18:00'];   // 4 个时刻，覆盖四个时辰

const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m, 0).getDate();

/* ══════════ 特征提取（八字侧）══════════ */
function baziFeat(bz) {
  const tg = tenGodProfile(bz);
  const g = tg.byGroup ?? {};
  const rels = heHuaVerdict(bz.pillars.map((p) => p[1]));
  const ca = controlAnalysis(bz);
  const ctrl = ca.controls ?? [];
  const f = {};
  for (const [k, v] of Object.entries(g)) f['tg_' + k] = (v ?? 0) > 0.15;
  const chong = rels.filter((r) => r.k === '冲').length;
  const xing = rels.filter((r) => r.k === '刑').length;
  f.chong_any = chong > 0;
  f.chong_2plus = chong >= 2;
  f.xing_any = xing > 0;
  f.xing_chong_any = chong + xing > 0;
  f.ctrl_any = ctrl.length > 0;
  f.ctrl_bad = ctrl.some((c) => c.good === false);
  f.ctrl_guan = ctrl.some((c) => (c.name ?? '').includes('官杀'));
  f.ctrl_shishen = ctrl.some((c) => (c.name ?? '').includes('食神'));
  f.ctrl_xiaoyin = ctrl.some((c) => (c.name ?? '').includes('枭印') || (c.name ?? '').includes('夺食'));
  return f;
}

/* ══════════ 特征提取（星盘侧）══════════ */
const BODIES = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星', '上升', '天顶', '下降', '天底'];
function astroFeat(ch) {
  const P = ch.planets ?? {};
  const f = {};
  for (const nm of BODIES) {
    const p = P[nm];
    if (!p) continue;
    if (nm !== '上升' && nm !== '天顶' && nm !== '下降' && nm !== '天底') {
      f['ang_' + nm] = ANGULAR_HOUSES.has(p.house);
      const st = planetStrength(nm, ch.aspects);
      f['hard_' + nm] = st.pressure > 0.4;
      f['strong_' + nm] = st.strength > 0.5;
    }
  }
  const hard = new Set();
  for (const a of ch.aspects ?? []) {
    if (a.type !== '对冲' && a.type !== '四分相') continue;
    hard.add([a.a, a.b].sort().join('-'));
  }
  for (const k of hard) f['pair_' + k] = true;
  f.hard_ge5 = hard.size >= 5;
  f.hard_ge8 = hard.size >= 8;
  return f;
}

/* ══════════ 生成网格样本 ══════════ */
const A = [], B = [], meta = [];
const t0 = Date.now();
for (let y = YEARS[0]; y <= YEARS[1]; y++) {
  for (let m = 1; m <= 12; m++) {
    const dmax = daysIn(y, m);
    for (let d = 1; d <= dmax; d += STEP_DAYS) {
      for (const hh of TIMES) {
        const at = `${y}-${pad(m)}-${pad(d)} ${hh}`;
        try {
          const bz = compileBazi({ at, gender: '男' });
          const ch = computeNatal({ at, lng: LNG, lat: LAT, tz: TZ });
          A.push(astroFeat(ch)); B.push(baziFeat(bz)); meta.push({ y, m, at });
        } catch { }
      }
    }
  }
}
console.log(`网格样本 ${A.length} 条（${YEARS[0]}–${YEARS[1]}，每 2 天 × 4 时刻），耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);

/* 年份均匀性核对 */
const byY = {};
for (const x of meta) byY[x.y] = (byY[x.y] ?? 0) + 1;
const cnts = Object.values(byY);
console.log(`每年样本数 min=${Math.min(...cnts)} max=${Math.max(...cnts)}（越均匀越好）`);

/* ══════════ 关联规则 + 置换检验 ══════════ */
const aKeys = [...new Set(A.flatMap(Object.keys))];
const bKeys = [...new Set(B.flatMap(Object.keys))];
const rate = (arr, k) => arr.filter((x) => x[k]).length / arr.length;
const bBase = Object.fromEntries(bKeys.map((k) => [k, rate(B, k)]));
const aBase = Object.fromEntries(aKeys.map((k) => [k, rate(A, k)]));
const okB = bKeys.filter((k) => bBase[k] > 0.05 && bBase[k] < 0.95);
const okA = aKeys.filter((k) => aBase[k] > 0.05 && aBase[k] < 0.95);
console.log(`星盘特征 ${aKeys.length}（可用 ${okA.length}）  八字特征 ${bKeys.length}（可用 ${okB.length}）`);

const pairs = [];
for (const ak of okA) {
  const idx = [];
  for (let i = 0; i < A.length; i++) if (A[i][ak]) idx.push(i);
  if (idx.length < 40) continue;
  for (const bk of okB) {
    const pBA = idx.filter((i) => B[i][bk]).length / idx.length;
    const pB = bBase[bk];
    if (pB <= 0) continue;
    pairs.push({ ak, bk, lift: pBA / pB, pBA, pB, nA: idx.length });
  }
}
console.log(`待检验 (A,B) 对：${pairs.length}`);

// 置换检验（打乱 B 顺序）
const REP = 60;
const nulls = [];
const permBase = B.map((x) => x);
for (let r = 0; r < REP; r++) {
  const perm = [...Array(B.length).keys()].sort(() => Math.random() - 0.5);
  for (const p of pairs) {
    const idx = [];
    for (let i = 0; i < A.length; i++) if (A[i][p.ak]) idx.push(i);
    const pb = bBase[p.bk];
    const pba = idx.filter((i) => permBase[perm[i]]?.[p.bk]).length / idx.length;
    nulls.push(pba / pb);
  }
}
nulls.sort((a, b) => a - b);
const q = (p) => nulls[Math.floor(p * nulls.length)];
console.log(`零模型 lift: 0.5%=${q(0.005).toFixed(3)}  99.5%=${q(0.995).toFixed(3)}`);

// Bonferroni：α=0.05 / 检验数
const nTests = pairs.length;
const alphaBonf = 0.05 / nTests;
const qBonfLo = q(alphaBonf / 2), qBonfHi = q(1 - alphaBonf / 2);
console.log(`Bonferroni 校正后阈值（${nTests} 次检验，α=0.05）：lift < ${qBonfLo.toFixed(3)} 或 > ${qBonfHi.toFixed(3)}`);

const sig = pairs.filter((p) => p.lift > qBonfHi || p.lift < qBonfLo)
  .sort((a, b) => Math.abs(Math.log(b.lift)) - Math.abs(Math.log(a.lift)));
console.log(`\n=== ★ Bonferroni 校正后仍显著：${sig.length} 条 ===`);
if (sig.length === 0) {
  console.log('  （无）⇒ 在日期受控的网格样本上，两套体系的离散结构之间没有可检出的关联。');
} else {
  console.log('  星盘 A'.padEnd(28) + '八字 B'.padEnd(20) + 'lift'.padStart(7) + ' P(B|A)'.padStart(8) + ' P(B)'.padStart(7) + ' nA'.padStart(6));
  for (const p of sig.slice(0, 25)) {
    console.log(`  ${p.ak.padEnd(26)}${p.bk.padEnd(20)}${p.lift.toFixed(3).padStart(7)}${(p.pBA * 100).toFixed(1).padStart(8)}%${(p.pB * 100).toFixed(1).padStart(7)}%${String(p.nA).padStart(6)}`);
  }
}

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/kehai-grid.json', JSON.stringify({ n: A.length, nTests, qBonfLo, qBonfHi, sig }, null, 1), 'utf8');
console.log('\n落盘 reports/kehai-grid.json');
