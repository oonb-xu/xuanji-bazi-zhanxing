// 四钟的十神对照：真十神（八字侧）vs 映射十神（星盘侧）
//
// 用户观察（2026-10-27）：「但是他们都表现出十神的共性，试图分析与十神的联系」
//
// ★ 必须先分清两类"十神"
//   真十神：大运/流年的天干地支 对 日主 —— 十神体系的原始定义，10 种，逐年循环
//   映射十神：星盘行星按映射表推出的十神 —— 基础组恒定，只有"宫位修饰"会变（3 档）
//
// ⇒ 所以"共性"有两种可能：
//   (a) 都在描述"外来力量"（真共性，但是结构性的）
//   (b) 星盘侧是我用映射硬套的（构造性）
// 本脚本把两者逐年并列 + 做独立性检验，让数据说话。
import { compileBazi } from '../src/bazi/engine.mjs';
import { daYun } from '../src/cross/timing.mjs';
import { tenGod, TG_GROUP } from '../src/bazi/ten-gods.mjs';
import { GAN_WX, ZHI_WX } from '../src/bazi/dag.mjs';
import { yearGanZhi, progressionAt, transitAt } from '../src/cross/timeline.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { planetTenGod, ANGULAR_HOUSES, SUCCEDENT_HOUSES } from '../src/cross/ten-god-mapping.mjs';

const AT = '1990-03-15 12:00', LNG = 116.407, LAT = 39.904, TZ = 8;
const birth = new Date('1990-03-15T12:00:00+08:00');
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const bz = compileBazi({ at: AT, gender: '男' });
const dm = bz.pillars[2][0];                       // 日主
console.log(`日主 ${dm}（${GAN_WX[dm]}）｜四柱 ${bz.pillars.join(' ')}\n`);

/* ── 大运：直接用引擎输出 ── */
const dySteps = (bz.dayun?.steps ?? daYun(bz.pillars, birth, '男').steps) ?? [];
const dayunOf = (age) => dySteps.find((s) => age >= s.startAge && age < s.startAge + 10) ?? null;

/* ── 星盘侧：宫位档（角/续/果）── */
const mansionOf = (house) => (ANGULAR_HOUSES.has(house) ? '角宫' : SUCCEDENT_HOUSES.has(house) ? '续宫' : '果宫');

const rows = [];
const birthYear = birth.getFullYear();
for (let age = 0; age <= 60; age++) {
  const year = birthYear + age;
  const step = dayunOf(age);

  // ── 真十神：大运干 / 流年干 ──
  const dyGan = step ? step.ganzhi[0] : null;
  const lnGz = yearGanZhi(year);
  const lnGan = lnGz[0];
  const dyTG = dyGan ? tenGod(dyGan, dm) : null;
  const lnTG = lnGan ? tenGod(lnGan, dm) : null;

  // ── 星盘侧：次运月亮 / 行运土星 ──
  let pm = null, ts = null;
  try {
    const pc = computeNatal({ at: fmt(progressionAt(birth, age)), lng: LNG, lat: LAT, tz: TZ });
    const moon = Array.isArray(pc.planets) ? pc.planets.find((x) => x.name === '月亮') : pc.planets?.月亮;
    if (moon) pm = { sign: moon.sign, house: moon.house ?? null };
  } catch { }
  try {
    const tc = computeNatal({ at: fmt(transitAt(birth, age)), lng: LNG, lat: LAT, tz: TZ });
    const sat = Array.isArray(tc.planets) ? tc.planets.find((x) => x.name === '土星') : tc.planets?.土星;
    if (sat) ts = { sign: sat.sign, house: sat.house ?? null };
  } catch { }

  // 映射十神（基础恒定，宫位修饰）
  const pmMap = pm?.house != null ? planetTenGod('月亮', pm.house) : null;
  const tsMap = ts?.house != null ? planetTenGod('土星', ts.house) : null;

  rows.push({
    age, year,
    dayun: step?.ganzhi ?? '—',
    liunian: lnGz,
    dyTG, dyGroup: dyTG ? TG_GROUP[dyTG] : null,
    lnTG, lnGroup: lnTG ? TG_GROUP[lnTG] : null,
    pmSign: pm?.sign ?? null, pmHouse: pm?.house ?? null,
    pmMansion: pm?.house != null ? mansionOf(pm.house) : null,
    pmLabel: pmMap?.label ?? null,
    tsSign: ts?.sign ?? null, tsHouse: ts?.house ?? null,
    tsMansion: ts?.house != null ? mansionOf(ts.house) : null,
    tsLabel: tsMap?.label ?? null,
  });
}

/* ══════════ 输出前 30 年 ══════════ */
console.log('=== 逐年四钟十神并排（前 30 年）===');
console.log('岁 年   大运 十神    流年 十神    | 次运月 宫位档 映射十神 | 行运土 宫位档 映射十神');
for (const r of rows.slice(0, 30)) {
  const col = (s, w) => String(s ?? '—').padEnd(w);
  console.log(
    `${String(r.age).padStart(2)} ${r.year} ${col(r.dayun, 4)} ${col(r.dyTG, 6)} ${col(r.liunian, 4)} ${col(r.lnTG, 6)} | ` +
    `${col(r.pmSign, 4)} ${col(r.pmMansion, 5)} ${col(r.pmLabel, 6)} | ${col(r.tsSign, 4)} ${col(r.tsMansion, 5)} ${col(r.tsLabel, 6)}`
  );
}

/* ══════════ 统计 ══════════ */
const count = (arr) => arr.reduce((o, x) => { if (x) o[x] = (o[x] ?? 0) + 1; return o; }, {});
console.log('\n=== 十神组分布（61 年）===');
console.log('  大运组：', JSON.stringify(count(rows.map((r) => r.dyGroup))));
console.log('  流年组：', JSON.stringify(count(rows.map((r) => r.lnGroup))));
console.log('  次运月宫位档：', JSON.stringify(count(rows.map((r) => r.pmMansion))));
console.log('  行运土宫位档：', JSON.stringify(count(rows.map((r) => r.tsMansion))));

console.log('\n=== 映射十神的"基础组"是否恒定？ ===');
console.log('  次运月亮 ≠ null 的年份，其 label 集合：', JSON.stringify([...new Set(rows.map((r) => r.pmLabel).filter(Boolean))]));
console.log('  行运土星 ≠ null 的年份，其 label 集合：', JSON.stringify([...new Set(rows.map((r) => r.tsLabel).filter(Boolean))]));
console.log('  ⇒ 若只有 2–3 种取值，说明映射十神**基础恒定**，变化仅来自宫位档');

/* ══════════ 独立性检验：八字十神组 × 星盘宫位档 ══════════ */
function chi2(groups, cols) {
  const n = groups.length;
  const gv = [...new Set(groups)].filter(Boolean);
  const cv = [...new Set(cols)].filter(Boolean);
  const obs = {};
  for (let i = 0; i < n; i++) {
    const g = groups[i], c = cols[i];
    if (!g || !c) continue;
    obs[g + '|' + c] = (obs[g + '|' + c] ?? 0) + 1;
  }
  const gr = {}, cr = {};
  let tot = 0;
  for (let i = 0; i < n; i++) {
    const g = groups[i], c = cols[i];
    if (!g || !c) continue;
    gr[g] = (gr[g] ?? 0) + 1; cr[c] = (cr[c] ?? 0) + 1; tot++;
  }
  let x2 = 0;
  for (const g of gv) for (const c of cv) {
    const e = (gr[g] * cr[c]) / tot;
    const o = obs[g + '|' + c] ?? 0;
    if (e > 0) x2 += (o - e) ** 2 / e;
  }
  const df = Math.max(1, (gv.length - 1) * (cv.length - 1));
  return { x2, df, gv, cv, tot };
}

console.log('\n=== 独立性检验：八字十神组 与 星盘宫位档 是否独立 ===');
for (const [label, gs, cs] of [
  ['大运组 × 次运月宫位档', rows.map((r) => r.dyGroup), rows.map((r) => r.pmMansion)],
  ['流年组 × 行运土宫位档', rows.map((r) => r.lnGroup), rows.map((r) => r.tsMansion)],
  ['大运组 × 行运土宫位档', rows.map((r) => r.dyGroup), rows.map((r) => r.tsMansion)],
]) {
  const t = chi2(gs, cs);
  console.log(`  ${label}: χ²=${t.x2.toFixed(2)} df=${t.df} n=${t.tot}  组数${t.gv.length}×${t.cv.length}`);
}
console.log('  （样本仅 61 年，χ² 检验力不足；此处只作方向参考，不下结论）');
