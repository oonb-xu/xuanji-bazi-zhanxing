// 用户命题（2026-10-25）：
//   「不要试图一一对应，一颗星星的含义在八字中肯定不会只对应一种十神的内涵」
//   「不止土星，以土星这个例子，看看还有没有类似的对应情况」
//   「试图把八字中的**克害**这一类关系在星盘中找出来」
//
// 所以本实验不做"行星→十神"的符号映射，而是：
//   在**两边各建一个「克害强度」度量**，然后看它们是否**同现**（cross-system correlation）。
//
// 八字侧「克害」= 官杀权重 + 刑冲害权重 + 压制型制关系（枭印夺食/比劫夺财/财破印）
// 星盘侧「压迫」= 土星角宫 + 土/火/外行星的硬相位压力 + 硬相位密度
//
// 纪律（R-C4 / R-G9）：必须给**同层级零模型**——用打乱配对的方式估计"无关时的基线相关"。
import { compileBazi } from '../src/bazi/engine.mjs';
import { tenGodProfile, controlAnalysis } from '../src/bazi/ten-gods.mjs';
import { heHuaVerdict, REL_WEIGHT } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { planetStrength, planetTenGod, ANGULAR_HOUSES } from '../src/cross/ten-god-mapping.mjs';
import { loadVedastro } from '../src/vedastro/adapter.mjs';

const N = 500;

/* ══════════ 八字侧：克害强度 ══════════ */
function baziKehai(bz) {
  const tg = tenGodProfile(bz);
  const guanSha = tg.byGroup['官杀'] ?? 0;                       // 官杀 = 克我
  const branches = bz.pillars.map((p) => p[1]);
  const rels = heHuaVerdict(branches);
  // 刑 / 冲 计入克害；合不计
  let xingChong = 0;
  for (const r of rels) {
    if (r.k === '冲') xingChong += REL_WEIGHT.冲;
    else if (r.k === '刑') xingChong += REL_WEIGHT.刑;
  }
  // 压制型"制"关系（good === false 的才算害）
  const ca = controlAnalysis(bz);
  let oppress = 0;
  for (const c of ca.controls) {
    if (c.good === false) oppress += 1;                          // 枭印夺食/比劫夺财/财破印
    else if (c.name === '官杀制身') oppress += 0.5;              // 官杀压身
  }
  const total = guanSha * 1.0 + xingChong * 1.0 + oppress * 1.0;
  return { guanSha, xingChong, oppress, total };
}

/* ══════════ 星盘侧：压迫强度 ══════════ */
function astroYapo(ch) {
  const P = ch.planets ?? {};
  // 土星角宫
  const satHouse = P['土星']?.house;
  const satAngular = ANGULAR_HOUSES.has(satHouse) ? 1 : 0;
  // 各行星的硬相位压力
  const sat = planetStrength('土星', ch.aspects);
  const mar = planetStrength('火星', ch.aspects);
  const plu = planetStrength('冥王星', ch.aspects);
  const ura = planetStrength('天王星', ch.aspects);
  // 硬相位密度
  const hard = (ch.aspects ?? []).filter((a) => a.type === '对冲' || a.type === '四分相').length;
  const all = (ch.aspects ?? []).length || 1;
  const hardDensity = hard / all;
  // 综合（每项独立，让相关性自己说话）
  return {
    satAngular,
    satPressure: sat.pressure,
    marPressure: mar.pressure,
    pluPressure: plu.pressure,
    uraPressure: ura.pressure,
    hardCount: hard,
    hardDensity: +hardDensity.toFixed(4),
    total: satAngular * 1.0 + sat.pressure * 0.5 + mar.pressure * 0.4 + plu.pressure * 0.3 + ura.pressure * 0.3 + hardDensity * 2,
  };
}

/* ══════════ 取数据 ══════════ */
const { records } = loadVedastro();
const rows = [];
let tried = 0;
for (const r of records) {
  if (rows.length >= N) break;
  if (tried++ > N * 6) break;
  try {
    const at = `${r.date} ${r.time || '12:00'}`;
    const bz = compileBazi({ at, gender: '男' });
    const ch = computeNatal({ at, lng: r.lon, lat: r.lat, tz: r.offsetHours });
    const b = baziKehai(bz);
    const a = astroYapo(ch);
    // 每颗行星的「宫廷 + 硬相位压力」也单独记，用于逐行星分析
    const perPlanet = {};
    for (const nm of ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星']) {
      const p = ch.planets?.[nm];
      if (!p) continue;
      const st = planetStrength(nm, ch.aspects);
      const tgm = planetTenGod(nm, p.house);
      perPlanet[nm] = {
        house: p.house ?? null,
        angular: ANGULAR_HOUSES.has(p.house) ? 1 : 0,
        label: tgm?.label ?? null,
        tension: tgm?.tension ?? null,
        pressure: st.pressure, ease: st.ease, strength: st.strength,
      };
    }
    rows.push({ b, a, perPlanet });
  } catch { /* 跳过排不出的 */ }
}

console.log(`有效样本 ${rows.length} / 尝试 ${tried}`);
if (rows.length < 100) { console.log('样本不足，中止'); process.exit(1); }

/* ══════════ 统计工具 ══════════ */
const pearson = (x, y) => {
  const n = x.length;
  const mx = x.reduce((a, v) => a + v, 0) / n, my = y.reduce((a, v) => a + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
};
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 同层级零模型：打乱星盘侧，重算 r，取 1000 次分布 */
function nullDist(xs, ys, reps = 1000) {
  const rs = [];
  for (let k = 0; k < reps; k++) rs.push(pearson(xs, shuffle(ys)));
  rs.sort((a, b) => a - b);
  return { p2: rs[Math.floor(0.025 * reps)], p50: rs[Math.floor(0.5 * reps)], p975: rs[Math.floor(0.975 * reps)], rs };
}

/* ══════════ 主检验：八字克害 vs 星盘压迫 ══════════ */
const xKehai = rows.map((r) => r.b.total);
const tests = [
  ['星盘压迫总分', rows.map((r) => r.a.total)],
  ['土星落角宫 (0/1)', rows.map((r) => r.a.satAngular)],
  ['土星硬相位压力', rows.map((r) => r.a.satPressure)],
  ['火星硬相位压力', rows.map((r) => r.a.marPressure)],
  ['冥王硬相位压力', rows.map((r) => r.a.pluPressure)],
  ['硬相位数量', rows.map((r) => r.a.hardCount)],
  ['硬相位密度', rows.map((r) => r.a.hardDensity)],
];

console.log('\n=== 八字「克害」× 星盘「压迫」：500 盘叉相关（含 1000 次打乱零模型）===');
console.log('  星盘侧指标'.padEnd(20) + 'r'.padStart(8) + '   零模型 2.5%  97.5%   判定');
for (const [name, ys] of tests) {
  const r = pearson(xKehai, ys);
  const nd = nullDist(xKehai, ys, 1000);
  const sig = (r < nd.p2 || r > nd.p975) ? '★显著' : '不显著';
  console.log(`  ${name.padEnd(18)}${r.toFixed(4).padStart(8)}   ${nd.p2.toFixed(4)}   ${nd.p975.toFixed(4)}   ${sig}`);
}

/* ══════════ 逐行星：哪一颗的"压力"最像八字克害 ══════════ */
console.log('\n=== 逐行星：压力指标 × 八字克害 ===');
const planetNames = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
const ranked = [];
for (const nm of planetNames) {
  const xs = rows.filter((r) => r.perPlanet[nm]).map((r) => r.perPlanet[nm].pressure);
  const ys = rows.filter((r) => r.perPlanet[nm]).map((r) => r.b.total);
  const ang = rows.filter((r) => r.perPlanet[nm]).map((r) => r.perPlanet[nm].angular);
  const rP = pearson(xs, ys), rA = pearson(ang, ys);
  ranked.push({ nm, rPressure: rP, rAngular: rA, n: xs.length });
}
ranked.sort((a, b) => Math.abs(b.rPressure) - Math.abs(a.rPressure));
for (const q of ranked) {
  console.log(`  ${q.nm.padEnd(6)} 压力相关 r=${q.rPressure.toFixed(4)}   角宫相关 r=${q.rAngular.toFixed(4)}`);
}

/* ══════════ 保存明细供复核 ══════════ */
import fs from 'node:fs';
fs.mkdirSync('data/cross', { recursive: true });
fs.writeFileSync('data/cross/kehai-vs-yapo.json', JSON.stringify(rows.map((r) => ({ b: r.b, a: r.a })), null, 1), 'utf8');
console.log('\n明细已落盘 data/cross/kehai-vs-yapo.json');
