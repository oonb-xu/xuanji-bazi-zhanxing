// 十神融合的正确形式：力量组（八字）× 作用领域（星盘）
//
// 已有结论：
//   · 八字侧十神 = 10 种全谱，逐年变化（时间变量）
//   · 星盘侧映射十神 = 基础组恒定（月亮永远印、土星永远官杀），只有宫位档变
//   · 两者的 χ² 独立性检验均不显著 ⇒ 各自携带不同信息，不冗余
//
// ⇒ 所以融合的正确形式不是"谁的十神对"，而是：
//     八字的十神 = 「来了什么力量」
//     星盘的宫位 = 「这股力量落在什么领域」
//     组合 = 「什么力量 × 什么领域」的二维结构
import { compileBazi } from '../src/bazi/engine.mjs';
import { tenGod, TG_GROUP } from '../src/bazi/ten-gods.mjs';
import { daYun } from '../src/cross/timing.mjs';
import { yearGanZhi, progressionAt, transitAt } from '../src/cross/timeline.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { ANGULAR_HOUSES, SUCCEDENT_HOUSES } from '../src/cross/ten-god-mapping.mjs';

const AT = '1990-03-15 12:00', LNG = 116.407, LAT = 39.904, TZ = 8;
const birth = new Date('1990-03-15T12:00:00+08:00');
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const bz = compileBazi({ at: AT, gender: '男' });
const dm = bz.pillars[2][0];
const dySteps = daYun(bz.pillars, birth, '男').steps;
const mansionOf = (h) => (ANGULAR_HOUSES.has(h) ? '角宫' : SUCCEDENT_HOUSES.has(h) ? '续宫' : '果宫');

/** 宫位 → 领域（人生层面） */
const HOUSE_DOMAIN = {
  1: '自我/身体', 2: '资源/价值', 3: '沟通/近亲', 4: '家庭/根基',
  5: '创造/子女', 6: '工作/健康', 7: '关系/合作', 8: '共享/危机',
  9: '远行/信念', 10: '事业/名声', 11: '群体/愿景', 12: '隐退/内在',
};

const GROUPS = ['比劫', '印', '食伤', '财', '官杀'];

const rows = [];
const birthYear = birth.getFullYear();
for (let age = 0; age <= 60; age++) {
  const year = birthYear + age;
  const step = dySteps.find((s) => age >= s.startAge && age < s.startAge + 10) ?? null;
  const dyGan = step?.ganzhi?.[0] ?? null;
  const lnGan = yearGanZhi(year)[0];
  const dyTG = dyGan ? tenGod(dyGan, dm) : null;
  const lnTG = tenGod(lnGan, dm);

  let pmHouse = null, tsHouse = null;
  try {
    const pc = computeNatal({ at: fmt(progressionAt(birth, age)), lng: LNG, lat: LAT, tz: TZ });
    const m = Array.isArray(pc.planets) ? pc.planets.find((x) => x.name === '月亮') : pc.planets?.月亮;
    pmHouse = m?.house ?? null;
  } catch { }
  try {
    const tc = computeNatal({ at: fmt(transitAt(birth, age)), lng: LNG, lat: LAT, tz: TZ });
    const s = Array.isArray(tc.planets) ? tc.planets.find((x) => x.name === '土星') : tc.planets?.土星;
    tsHouse = s?.house ?? null;
  } catch { }

  rows.push({
    age, year,
    dyGroup: dyTG ? TG_GROUP[dyTG] : null, dyTG,
    lnGroup: TG_GROUP[lnTG], lnTG,
    pmHouse, pmDomain: pmHouse ? HOUSE_DOMAIN[pmHouse] : null, pmMansion: pmHouse ? mansionOf(pmHouse) : null,
    tsHouse, tsDomain: tsHouse ? HOUSE_DOMAIN[tsHouse] : null, tsMansion: tsHouse ? mansionOf(tsHouse) : null,
  });
}

/* ══════════ ★ 交叉表：力量组 × 作用领域 ══════════ */
console.log('=== ★ 十神融合二维表（力量组 × 作用领域）===');
console.log('  来源：流年十神组（八字）× 行运土星所在宫位领域（星盘）\n');

const cross = {};
for (const r of rows) {
  if (!r.lnGroup || !r.pmDomain) continue;
  cross[r.lnGroup] ??= {};
  cross[r.lnGroup][r.pmDomain] = (cross[r.lnGroup][r.pmDomain] ?? 0) + 1;
}

// 打印矩阵
const domains = [...new Set(rows.map((r) => r.pmDomain).filter(Boolean))];
console.log('  力量组\\领域'.padEnd(12) + domains.map((d) => d.padStart(11)).join(''));
for (const g of GROUPS) {
  if (!cross[g]) continue;
  console.log('  ' + g.padEnd(10) + domains.map((d) => String(cross[g][d] ?? '·').padStart(11)).join(''));
}

/* ══════════ 逐年示例：完整二维读数 ══════════ */
console.log('\n=== 逐年完整读数（每 5 年，展示"力量×领域"）===');
for (const r of rows.filter((x) => x.age % 5 === 0).slice(0, 10)) {
  const bits = [];
  if (r.dyTG) bits.push(`大运${r.dyTG}(${r.dyGroup})`);
  bits.push(`流年${r.lnTG}(${r.lnGroup})`);
  if (r.pmDomain) bits.push(`次运月→${r.pmDomain}(${r.pmMansion})`);
  if (r.tsDomain) bits.push(`行运土→${r.tsDomain}(${r.tsMansion})`);
  console.log(`  ${r.year} ${String(r.age).padStart(2)}岁  ${bits.join('  ')}`);
}

/* ══════════ 结论 ══════════ */
console.log('\n=== ★ 分析与十神的联系：三条结论 ===');
console.log('  ① 共性在「组」层，不在「十神」层：四钟都能归到 5 组（比劫/印/食伤/财/官杀）');
console.log('  ② 但两者的十神角色不同：');
console.log('     · 八字侧 = **时间变量**（今年来的是哪种力量），10 种全谱逐年轮转');
console.log('     · 星盘侧 = **领域标签**（这股力量落在哪个领域），基础组恒定、只靠宫位变档');
console.log('  ③ 统计上**独立**（χ² 均不显著）⇒ 不冗余 ⇒ 可组合');
console.log('     ⇒ 融合形式：「八字的什么力量」× 「星盘的什么领域」');
console.log('     ⇒ 这才是可加的两个维度（不是把两个吉凶分数相加）');

console.log('\n=== 为什么星盘侧做不出 10 种十神（结构性限制）===');
console.log('  · 十神的定义是「某干 对 日主的生克 + 阴阳」，需要**两个天干**才能定阴阳');
console.log('  · 星盘侧只有「行星」这一个对象，没有"第二个天干"可配');
console.log('  · 所以星盘侧只能给到**组**（官杀/财/印…），给不到**正/偏**的分化');
console.log('  · 除非引入"行星对行星"（土星对月亮）才能凑出阴阳对——但那已是另一套逻辑');
