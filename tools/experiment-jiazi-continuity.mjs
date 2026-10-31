// 实验：检验「60 甲子日循环不连续」这一论断到底有没有道理
//
// 方法学要点（从他那里学来的）：
//   ① 只用**史料原创干支**做锚，不靠现代反推（反推是循环论证）
//   ② 算两锚之间的**精确天数差**，mod 60，与记载干支对账
//
// 但我要修正他方法里的一处弱点：
//   他用「年数 × 365.2421644」算天数 —— 跨闰日时这不是精确值。
//   **正确做法是直接算儒略日（JDN）之差**，它按定义就是整数天，无误差。
//
// 本脚本做两件事：
//   A. 用精确 JDN 复算他的关键案例，看他的结论是否依赖"365.2422 近似"
//   B. 用本引擎（连续反推法）去对多个跨朝代锚点，看连续性能否成立

import { compileBazi } from '../src/bazi/engine.mjs';

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const gzOf = (i) => GAN[((i % 10) + 10) % 10] + ZHI[((i % 12) + 12) % 12];
const idxOf = (gz) => {
  for (let i = 0; i < 60; i++) if (gzOf(i) === gz) return i;
  return -1;
};

/* ══════════ 精确儒略日 ══════════ */
/** 天文纪年（BC 113 → -112）的格列高利/儒略日数 → JDN（整数） */
function jdn(y, m, d, julian = true) {
  // 天文纪年：1 BC = 0, 113 BC = -112
  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  // 儒略历无世纪修正；格列高利历 B = 2 - A + floor(A/4)
  const B = julian ? 0 : (2 - A + Math.floor(A / 4));
  const jd = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
  return Math.floor(jd + 0.5);   // JDN 是"正午起算"的整数
}

console.log('══════ 0. JDN 算法自检 ══════');
const checks = [
  { y: 2000, m: 1, d: 1, want: 2451545, jul: false },
  { y: 1965, m: 1, d: 10, want: null },
  { y: 1582, m: 10, d: 15, want: 2299161, jul: false },
  { y: 1582, m: 10, d: 4, want: 2299159, jul: true },
];
for (const c of checks) {
  const got = jdn(c.y, c.m, c.d, c.jul);
  const ok = c.want == null || Math.abs(got - c.want) <= 1;
  console.log(`  ${c.y}-${c.m}-${c.d} (${c.jul ? '儒略' : '格列'}) → JDN ${got}${c.want ? ' 期望 ' + c.want : ''} ${ok ? '✅' : '❌'}`);
}

/* ══════════ A. 复算他的关键案例 ══════════ */
console.log('\n══════ A. 复算 Ong 的关键案例（精确 JDN vs 他的 365.2422 近似）══════');
// 史料锚点（公历纪年；1582 年前用儒略历）
const ANCHORS = [
  { name: '《史记》前113-12-24', y: -112, m: 12, d: 24, gz: '辛巳', jul: true, src: 'Shih Chi 28 / Wechsler 1985' },
  { name: '汉太初历元前105-12-24', y: -104, m: 12, d: 24, gz: '甲子', jul: true, src: '汉太初历（他认为是被人为改的）' },
  { name: '唐 618-06-12', y: 618, m: 6, d: 12, gz: '甲子', jul: true, src: '隋→唐 传国' },
  { name: '唐 640-12-24', y: 640, m: 12, d: 24, gz: '甲子', jul: true, src: '武林历（唐廷采用）' },
  { name: '1965-01-10', y: 1965, m: 1, d: 10, gz: '甲子', jul: false, src: '现代通行' },
];

for (const a of ANCHORS) a.J = jdn(a.y, a.m, a.d, a.jul);

console.log('  锚点 →');
for (const a of ANCHORS) console.log(`    ${a.name.padEnd(22)} JDN ${a.J}  史料记 ${a.gz}`);

console.log('\n  两两对账（以先者为基准，算后者应有的干支）：');
for (let i = 0; i < ANCHORS.length; i++) {
  for (let j = i + 1; j < ANCHORS.length; j++) {
    const A = ANCHORS[i], B = ANCHORS[j];
    const days = B.J - A.J;
    const steps = ((days % 60) + 60) % 60;
    const pred = gzOf(idxOf(A.gz) + steps);
    const hit = pred === B.gz;
    // 对比他的近似法
    const approxDays = (days / 365.2422) * 365.2421644;
    const approxSteps = ((Math.round(approxDays) % 60) + 60) % 60;
    const approxPred = gzOf(idxOf(A.gz) + approxSteps);
    console.log(`    ${A.name} → ${B.name}`);
    console.log(`      ${days} 天，mod60 = ${steps} ⇒ 预测 ${pred} / 记 ${B.gz}  ${hit ? '✅ 对上' : '❌ 差 ' + (((idxOf(B.gz) - idxOf(pred)) + 60) % 60) + ' 位'}`);
    if (approxPred !== pred) console.log(`      （他的近似法会算成 ${approxPred}，与精确法差 ${((idxOf(approxPred) - idxOf(pred)) + 60) % 60} 位）`);
  }
}

/* ══════════ B. 本引擎的连续反推能否对上这些锚点 ══════════ */
console.log('\n══════ B. 本引擎（连续反推）对账 ══════');
const TZ = 8, LNG = 116.407, LAT = 39.904;
let engineHits = 0, engineTried = 0;
for (const a of ANCHORS) {
  // 只测引擎能处理的年份（tyme4ts 未必支持公元前）
  const at = `${a.y < 0 ? a.y : a.y}-${String(a.m).padStart(2, '0')}-${String(a.d).padStart(2, '0')} 12:00`;
  let out = null;
  try {
    const b = compileBazi({ at, gender: '男', lng: LNG, lat: LAT, tz: TZ });
    out = b.pillars?.[2];
  } catch (e) {
    console.log(`  ${a.name.padEnd(22)} 引擎不支持：${String(e.message).slice(0, 40)}`);
    continue;
  }
  engineTried++;
  const hit = out === a.gz;
  if (hit) engineHits++;
  console.log(`  ${a.name.padEnd(22)} 引擎算日柱 ${out}  史料 ${a.gz}  ${hit ? '✅' : '❌'}`);
}
console.log(`\n  引擎命中 ${engineHits}/${engineTried}`);

/* ══════════ C. 结论 ══════════ */
console.log('\n══════ C. 结论：他的论断到底有没有道理 ══════');
const pairs = [];
for (let i = 0; i < ANCHORS.length; i++) for (let j = i + 1; j < ANCHORS.length; j++) {
  const A = ANCHORS[i], B = ANCHORS[j];
  const steps = ((((B.J - A.J) % 60) + 60) % 60);
  pairs.push({ a: A.name, b: B.name, pred: gzOf(idxOf(A.gz) + steps), rec: B.gz, ok: gzOf(idxOf(A.gz) + steps) === B.gz });
}
const nOk = pairs.filter((p) => p.ok).length;
console.log(`  史料间自洽比例：${nOk}/${pairs.length} 对相邻/跨朝锚点能对上`);
console.log(`  若全部对上 ⇒ 史料本身**没有**记录到重置 ⇒ 支持"连续"`);
console.log(`  若有对不上 ⇒ 说明至少有一处史料被改动过（他的论点）`);
console.log('\n  ★ 他的方法学中最有价值的一点（应采纳）：');
console.log('     "从现代往前反推古历是循环论证" —— 反推必然自洽，因此不能用来证明连续性。');
console.log('  ★ 他的方法学中最弱的一点（应指出）：');
console.log('     用"年数×365.2422"算天数会引入近似误差；跨闰日必须用精确 JDN 差。');
console.log('  ★ 无论哪一种，**连续性是假设而非证明** —— 这一点主流（Adam Smith 2010）也承认。');
