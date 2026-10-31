// 修 experimentalChart：不能用日历年重算标准年柱（立春前的日期，八字年属上一年）
// 正确做法：算出「同年数下标准索引与实验索引之差」，把这个差分施加到盘上真实的年柱
import fs from 'node:fs';
const P = 'src/cross/experimental-calendar.mjs';
let s = fs.readFileSync(P, 'utf8');

const START = s.indexOf('export function experimentalChart(');
const END = s.indexOf('/**\n * 扫描：从哪一年开始');
if (START < 0 || END < 0) { console.error('❌ 定位失败'); process.exit(1); }

const NEW = `export function experimentalChart(pillars, year) {
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

`;

s = s.slice(0, START) + NEW + s.slice(END);
fs.writeFileSync(P, s, 'utf8');
console.log('✅ experimentalChart 已改为「差分平移」');

/* 导出 indexOfGz 供测试 */
if (!s.includes('export { GAN, ZHI, gz')) {
  console.log('⚠️ 导出行缺失');
} else if (!s.includes('indexOfGz')) {
  s = fs.readFileSync(P, 'utf8').replace('export { GAN, ZHI, gz };', 'export { GAN, ZHI, gz, indexOfGz };');
  fs.writeFileSync(P, s, 'utf8');
  console.log('   已导出 indexOfGz');
}
