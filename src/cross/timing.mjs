// Part 6.3 触发时间线：八字大运/流年（tyme4ts 节气）× 占星外行星行运（astronomy-engine）
import { SolarTerm } from 'tyme4ts';
import { DI_ZHI, TIAN_GAN, GAN_YIN_YANG, LIU_CHONG } from '../bazi/constants.mjs';
import { zhiRelation } from '../bazi/relations.mjs';
import { findTransitYears, lonOfSignDegree, TRANSIT_PLANETS } from '../western/zodiac.mjs';

const mod60 = (n) => ((n % 60) + 60) % 60;
const gzOfIndex = (i) => TIAN_GAN[mod60(i) % 10] + DI_ZHI[mod60(i) % 12];
/** 公历年 N 的干支（立春起年） */
export const yearGanZhi = (Y) => gzOfIndex(mod60(Y - 4));
/** 六十甲子序号 */
const indexOfGanZhi = (gan, zhi) => {
  for (let i = 0; i < 60; i++) if (TIAN_GAN[i % 10] === gan && DI_ZHI[i % 12] === zhi) return i;
  return -1;
};

/** 十二「节」（非中气）在 tyme4ts 中的奇数索引 */
const JIE_INDEX = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];

function jieDays(y) {
  const out = [];
  for (const yy of [y - 1, y, y + 1]) {
    for (const i of JIE_INDEX) {
      const d = SolarTerm.fromIndex(yy, i).getSolarDay();
      out.push({ name: SolarTerm.fromIndex(yy, i).getName(), ms: Date.UTC(d.getYear(), d.getMonth() - 1, d.getDay()) });
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/** 大运：阳男阴女顺行，阴男阳女逆行；起运岁 = 到节的天数 ÷ 3 */
export function daYun(pillars, birthDate, gender = '男') {
  // ★ 入参归一：compileBazi().pillars 返回**字符串数组**（如 '戊午'），
  //   首版直接读 `pillars[1].gan` → undefined ⇒ 年干阴阳判错(恒作阴)、baseIdx 落成癸亥
  //   ⇒ 方向与起运干支全错（女命戊年应逆行，却给了顺行且序列从甲子起）。R-G6 再现。
  const P = (p) => (typeof p === 'string' ? { gan: p[0], zhi: p[1] } : { gan: p?.gan, zhi: p?.zhi });
  const yearGan = P(pillars[0]).gan;
  if (!yearGan) throw new Error(`daYun：无法解析年柱「${JSON.stringify(pillars[0])}」`);
  const yangYear = GAN_YIN_YANG[yearGan] === '阳';
  const forward = (yangYear && gender === '男') || (!yangYear && gender === '女');
  const jie = jieDays(birthDate.getFullYear());
  const t0 = birthDate.getTime();
  const target = forward ? jie.find((j) => j.ms > t0) : [...jie].reverse().find((j) => j.ms <= t0);
  const days = Math.abs((target.ms - t0) / 86400e3);
  const startAge = Math.round((days / 3) * 10) / 10;
  const month = P(pillars[1]);
  const baseIdx = indexOfGanZhi(month.gan, month.zhi);
  if (!Number.isInteger(baseIdx) || baseIdx < 0) throw new Error(`daYun：无法解析月柱「${JSON.stringify(pillars[1])}」`);
  const steps = [];
  for (let k = 1; k <= 10; k++) {
    const idx = mod60(baseIdx + (forward ? k : -k));
    steps.push({
      step: k, ganzhi: gzOfIndex(idx),
      startAge: Math.round((startAge + (k - 1) * 10) * 10) / 10,
      endAge: Math.round((startAge + k * 10 - 0.1) * 10) / 10,
      startYear: birthDate.getFullYear() + Math.ceil(startAge + (k - 1) * 10),
    });
  }
  return { forward, direction: forward ? '顺行' : '逆行', startAge, daysToJie: Math.round(days * 10) / 10, jieName: target.name, steps };
}

/** 流年是否引动原局刑冲（含夫妻宫专检） */
export function liuNianActivation(pillars, year, spouseZhi) {
  const gz = yearGanZhi(year);
  const z = gz[1];
  const hits = [];
  for (let i = 0; i < 4; i++) {
    const p = pillars[i];
    for (const t of zhiRelation(p.zhi, z)) {
      hits.push({ type: t, with: p.zhi, pos: ['年', '月', '日', '时'][i] });
    }
  }
  const spouse = LIU_CHONG[spouseZhi] === z || hits.some((h) => h.with === spouseZhi && (h.type === '冲' || h.type === '刑' || h.type === '自刑'));
  return { year, ganzhi: gz, zhi: z, hits, spouse, activation: hits.some((h) => h.type === '冲' || h.type === '刑' || h.type === '自刑') };
}

/**
 * 触发时间线
 * @param bazi compileBazi IR（含 pillars / L4_spouse）
 * @param astroInput {planets:{名:{sign,deg,house}}, aspects:[…]}
 */
export function timeline(bazi, astroInput, opts = {}) {
  const ly = opts.liuNianYears ?? 10;
  const ty = opts.transitYears ?? 5;
  const pillars = bazi.pillars.map((gz) => ({ gan: gz[0], zhi: gz[1] }));
  const birth = opts.birthDate ?? (bazi.meta?.local ? new Date(String(bazi.meta.local).replace(' ', 'T')) : null);
  const nowYear = opts.fromYear ?? new Date().getFullYear();

  // 大运必须有出生时刻（干支输入无法定起运岁）——缺失时如实标注，不猜
  const dy = birth
    ? daYun(pillars, birth, bazi.meta.gender ?? '男')
    : { unavailable: true, reason: '缺出生时间：干支输入无法计算起运岁与交运年（大运需「生日到节的天数」）' };
  const liuNian = [];
  for (let i = 0; i < ly; i++) liuNian.push(liuNianActivation(pillars, nowYear + i, bazi.L4_spouse.zhi));

  // 占星行运：本命黄经由 sign+deg 复原
  let transits = [], natalLons = null;
  const planets = astroInput?.planets;
  if (planets) {
    natalLons = Object.fromEntries(Object.entries(planets)
      .filter(([, v]) => v?.sign)
      .map(([n, v]) => [n, { lon: lonOfSignDegree(v.sign, v.deg ?? 0) }]));
    transits = findTransitYears({ natalPlanets: natalLons, fromYear: nowYear, toYear: nowYear + ty, orb: opts.orb ?? 1 });
  }

  const lyYears = new Set(liuNian.filter((x) => x.activation).map((x) => x.year));
  const tYears = new Set(transits.map((t) => t.year));
  const double = [...lyYears].filter((y) => tYears.has(y)).sort();
  const spouseYears = liuNian.filter((x) => x.spouse).map((x) => x.year);

  return { daYun: dy, liuNian, transits, natalLons, doubleIgnition: double, spouseYears, window: { from: nowYear, liuNian: ly, transit: ty }, transitPlanets: TRANSIT_PLANETS };
}

export function renderTimeline(t) {
  const L = [];
  L.push('');
  L.push('## 【触发时间线】');
  if (t.daYun.unavailable) L.push(`- 大运：⚠ ${t.daYun.reason}`);
  else {
    L.push(`- 大运：${t.daYun.direction}（${t.daYun.jieName}起算 ${t.daYun.daysToJie} 天）→ 起运 ${t.daYun.startAge} 岁`);
    L.push(`  - ${t.daYun.steps.map((s) => `${s.startAge}岁/${s.startYear}年起 ${s.ganzhi}`).join(' ｜ ')}`);
  }
  L.push(`- 八字流年触发点（未来 ${t.window.liuNian} 年）：`);
  const act = t.liuNian.filter((x) => x.activation);
  L.push(act.length
    ? '  - ' + act.map((x) => `${x.year}${x.ganzhi}（${x.hits.map((h) => `${h.type}${h.pos}${h.with}`).join('、')}${x.spouse ? ' ⚠夫妻宫' : ''}）`).join('；')
    : '  - 无引动刑冲的流年');
  if (t.spouseYears.length) L.push(`  - ⚠ 夫妻宫被引动之年：${t.spouseYears.join('、')}`);
  L.push(`- 占星行运触发点（未来 ${t.window.transit} 年，外行星 ${t.transitPlanets.join('/')} 对本命硬相位）：`);
  if (t.transits.length) {
    const byYear = new Map();
    for (const x of t.transits) { if (!byYear.has(x.year)) byYear.set(x.year, []); byYear.get(x.year).push(`${x.transit}${x.aspect}${x.natal}(±${x.orb}°)`); }
    for (const [y, list] of [...byYear].sort((a, b) => a[0] - b[0])) L.push(`  - ${y}：${list.join('、')}`);
  } else L.push('  - 该窗口内无 1° 内触发（Orb=1°）；可放宽 orb 或延长窗口');
  L.push(`- 双重引爆点（八字流年刑冲 ∧ 占星行运同年）：${t.doubleIgnition.length ? '**' + t.doubleIgnition.join('、') + '** ← 命运的地雷区，必须提前防范' : '本窗口内无重合'}`);
  return L.join('\n');
}
