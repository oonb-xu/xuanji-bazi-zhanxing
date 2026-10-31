// 「59.58 假说」：如果八字的真实周期不是 60 年而是 3×木土会合 = 59.577 年，会改什么？
//
// ★ 用户命题（2026-10-29）：
//   「历史上的节气会一直经过修正，但八字的历法是冻结的，这就导致了一部分人根本不准。
//     有没有可能 59.58 才是这套系统本身的样子？」
//
// ── 先做影响面分析（这是最要紧的）──────────────────
//   年柱   ← 60 甲子年循环          ⇒ **受 59.58 影响**
//   月干   ← f(年干, 月支)          ⇒ 年干变则月干变 ⇒ **连带受影响**
//   月支   ← 节气（太阳黄经 30°刻度）⇒ **不受影响**（节气本身就随天文修正）
//   日柱   ← 连续天数 mod 60        ⇒ **不受影响**（与木土周期无关）
//   时柱   ← 日干 + 时支            ⇒ **不受影响**（日干未变）
//   胎元   ← 月柱+1                 ⇒ 月干变则胎元变 ⇒ **连带受影响**
//   命宫   ← f(月支, 时支)          ⇒ **不受影响**
//   身宫   ← f(月支, 时支)          ⇒ **不受影响**
//
// ⇒ **结论：59.58 假说只动「年柱 + 月干 + 胎元」三处，不碰日柱、时柱、命宫、身宫。**

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const gz = (i) => GAN[((i % 10) + 10) % 10] + ZHI[((i % 12) + 12) % 12];

/** 标准：60 年一周，1984 = 甲子 */
const CYCLE_STD = 60;
/** 实验：3 × 木土会合（synodic 19.859 × 3） */
export const CYCLE_JIAZI_JUP_SAT = 3 * (1 / (1 / 11.862 - 1 / 29.457));   // ≈ 59.5770
export const EPOCH_YEAR = 1984;   // 甲子年基准

/** 标准年柱（60 年一循环） */
export function yearPillarStd(year) {
  return { index: ((year - EPOCH_YEAR) % 60 + 60) % 60, gz: gz(year - EPOCH_YEAR), cycle: CYCLE_STD };
}

/** 实验年柱（按 59.577 年一循环；同一年数里推进 60 个甲子步） */
export function yearPillarExperimental(year, cycle = CYCLE_JIAZI_JUP_SAT) {
  // 每年推进 60/cycle 个甲子步；cycle<60 ⇒ 每年推进 >1 步
  const steps = (year - EPOCH_YEAR) * (60 / cycle);
  const idx = Math.floor(steps);
  return {
    index: ((idx % 60) + 60) % 60,
    gz: gz(idx),
    cycle,
    rawSteps: Math.round(steps * 10000) / 10000,
    // 该年"进入下一个甲子"的确切时刻（年内的位置，0=年初 1=年末）
    intraYear: Math.round((steps - Math.floor(steps)) * 1000) / 1000,
  };
}

/** 月干：五虎遁（年上起月）—— 年干变则月干变 */
const WUHU = {
  甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚',
  丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲',
};
/** 由年干与月支求月干 */
export function monthGan(yearGan, monthZhi) {
  const start = WUHU[yearGan];
  if (!start) return null;
  const si = GAN.indexOf(start);
  // 寅月为起点
  const off = ((ZHI.indexOf(monthZhi) - ZHI.indexOf('寅')) + 12) % 12;
  return GAN[(si + off) % 10];
}

/** 胎元：月干进一位、月支进三位 */
export function taiYuan(monthGan_, monthZhi) {
  const g = GAN[(GAN.indexOf(monthGan_) + 1) % 10];
  const z = ZHI[(ZHI.indexOf(monthZhi) + 3) % 12];
  return g + z;
}

/**
 * 给定一盘的四柱，算出「实验版」会变成什么样
 * @param pillars ['壬申','戊申','戊辰','戊午']
 */
export function experimentalChart(pillars, year) {
  if (!Array.isArray(pillars) || pillars.length < 4) return null;

  // ★ FIX：不能直接用日历年重算，因为立春前的日期其「八字年」属于上一年。
  // 改为：只用「同年数下 标准索引 → 实验索引」的**差**，再施加到盘上真实年柱。
  const stdCalc = yearPillarStd(year);
  const expCalc = yearPillarExperimental(year);
  const delta = expCalc.index - stdCalc.index;      // 可能为负

  const actualYearGz = pillars[0];
  const actualIdx = indexOfGz(actualYearGz);
  const expIdx = ((actualIdx + delta) % 60 + 60) % 60;
  const expYearGz = actualIdx >= 0 ? gz(expIdx) : expCalc.gz;

  const monthZhi = pillars[1][1];
  const stdMonthGan = pillars[1][0];
  const expMonthGan = monthGan(expYearGz[0], monthZhi) || stdMonthGan;
  const stdTai = taiYuan(pillars[1][0], monthZhi);
  const expTai = taiYuan(expMonthGan, monthZhi);

  return {
    year,
    yearPillar: { std: actualYearGz, exp: expYearGz, changed: actualYearGz !== expYearGz, delta },
    monthPillar: {
      std: stdMonthGan + monthZhi,
      exp: expMonthGan + monthZhi,
      changed: expMonthGan !== stdMonthGan,
      note: '月支不动（由节气定），只有月干随年干变',
    },
    taiYuan: { std: stdTai, exp: expTai, changed: stdTai !== expTai },
    unchanged: {
      day: pillars[2], hour: pillars[3],
      note: '日柱/时柱/命宫/身宫**均不受影响**（与木土周期无关）',
    },
    cycle: { std: CYCLE_STD, exp: Math.round(CYCLE_JIAZI_JUP_SAT * 10000) / 10000 },
    diverged: actualYearGz !== expYearGz,
    /** 一致性自检：年柱不变则月干必须也不变 */
    consistent: (actualYearGz === expYearGz) === (stdMonthGan === expMonthGan),
  };
}

/** 反查干支索引 */
function indexOfGz(g) {
  if (typeof g !== 'string' || g.length < 2) return -1;
  for (let i = 0; i < 60; i++) if (gz(i) === g) return i;
  return -1;
}

/**
 * 扫描：从哪一年开始，标准年柱与实验年柱开始分歧？
 */
export function findDivergence(fromYear = 1800, toYear = 2200, cycle = CYCLE_JIAZI_JUP_SAT) {
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    const s = yearPillarStd(y).gz;
    const e = yearPillarExperimental(y, cycle).gz;
    out.push({ year: y, std: s, exp: e, same: s === e });
  }
  const firstDiff = out.find((r) => !r.same);
  // 分歧区间的起止（连续分歧段）
  const segs = [];
  let cur = null;
  for (const r of out) {
    if (!r.same) {
      if (!cur) cur = { from: r.year, to: r.year };
      else cur.to = r.year;
    } else if (cur) { segs.push(cur); cur = null; }
  }
  if (cur) segs.push(cur);
  return { rows: out, firstDiff: firstDiff || null, segments: segs, total: out.length };
}

export { GAN, ZHI, gz };
