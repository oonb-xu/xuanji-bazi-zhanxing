// 检验用户命题 ③：**土星过境四宫 = 七杀大运**
// 两个必须回答的问题：
//   Q1 时间尺度能否对上？（土星过境一宫 ≈ 2.45 年；八字大运 = 10 年/步 ⇒ 差 4 倍）
//   Q2 土星过境各宫的时间段，与八字"七杀大运"的时间段，是否真重叠？
//
// 做法：对同一出生时刻，分别算
//   · 星盘侧：土星行运进入 4 宫（及其他宫）的年份区间
//   · 八字侧：大运中"官杀/七杀"性质的年份区间
// 然后看重叠率。
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { daYun } from '../src/cross/timing.mjs';
import { GAN_WX, ZHI_WX } from '../src/bazi/dag.mjs';
import { planetTenGod, planetStrength } from '../src/cross/ten-god-mapping.mjs';

const SATURN_PERIOD = 29.457;                 // 年
const HOUSE_YEARS = SATURN_PERIOD / 12;        // ≈ 2.455 年/宫

const CASES = [
  { name: '样例A(北京)', at: '1990-03-15 12:00', lng: 116.407, lat: 39.904, gender: '男' },
  { name: '样例B(上海)', at: '1992-08-20 12:00', lng: 121.474, lat: 31.230, gender: '女' },
];

console.log('=== 时间尺度先行核对 ===');
console.log(`  土星周期 ${SATURN_PERIOD} 年 / 12 宫 = 每宫 ${HOUSE_YEARS.toFixed(2)} 年`);
console.log(`  八字大运 = 10.00 年/步`);
console.log(`  比值 = ${(10 / HOUSE_YEARS).toFixed(2)} 倍  ⇒ 「一个大运 ≈ ${(10 / HOUSE_YEARS).toFixed(1)} 个宫位」`);
console.log('');

for (const c of CASES) {
  console.log(`════ ${c.name}  ${c.at} ════`);
  const bz = compileBazi({ at: c.at, gender: c.gender });
  const birth = new Date(c.at.replace(' ', 'T') + '+08:00');

  // ── 星盘侧：本命土星落宫 + 行运过宫时间表 ──
  const natal = computeNatal({ at: c.at, lng: c.lng, lat: c.lat, tz: 8 });
  const sat = natal.planets?.['土星'];
  const satTg = planetTenGod('土星', sat?.house);
  const satStr = planetStrength('土星', natal.aspects);
  console.log(`  本命土星：${sat?.sign} ${sat?.deg}°  第 ${sat?.house} 宫  ⇒ 十神判定「${satTg?.label}」(${satTg?.mansion})`);
  console.log(`            相位力量 ${satStr.strength} (${satStr.polarity}) 压力${satStr.pressure} 顺遂${satStr.ease}`);
  console.log(`  依据：${satTg?.why}`);

  // 行运过宫时间表（近似：每宫 HOUSE_YEARS 年，从本命土星所在宫起算；实际速度非匀速，此处取均值作为一阶近似）
  const fromAge = 0;
  const transitRows = [];
  for (let k = 0; k < 12; k++) {
    const y0 = 2026 + k * HOUSE_YEARS;                 // 从 2026 起往后排一轮
    const y1 = y0 + HOUSE_YEARS;
    const house = ((sat?.house - 1 + k) % 12) + 1;
    const tg = planetTenGod('土星', house);
    transitRows.push({ house, y0: +y0.toFixed(1), y1: +y1.toFixed(1), label: tg?.label, tension: tg?.tension });
  }
  console.log('  土星行运过宫（2026 起一轮，均值近似）：');
  for (const r of transitRows) {
    const mark = r.label === '七杀' ? '  ★七杀' : '';
    console.log(`    第${String(r.house).padStart(2)}宫  ${r.y0}~${r.y1}  ${r.label}${mark}`);
  }

  // ── 八字侧：大运里的"官杀"运 ──
  const dy = daYun(bz.pillars, birth, c.gender);
  const dmGan = bz.pillars[2][0];
  const dmWx = GAN_WX[dmGan];
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const guanWx = Object.keys(KE).find((k) => KE[k] === dmWx);
  const rows = dy.steps.slice(0, 8).map((s) => {
    const wx = GAN_WX[s.ganzhi[0]];
    const isGuan = wx === guanWx;
    return { gz: s.ganzhi, age: `${s.startAge}-${s.endAge}`, year: `${s.startYear}-${s.startYear + 10}`, wx, isGuan };
  });
  const guanCount = rows.filter((r) => r.isGuan).length;
  console.log(`  八字日主 ${dmGan}(${dmWx})，克我=${guanWx}（官杀）`);
  console.log(`  大运序列：` + rows.map((r) => `${r.gz}(${r.age}岁,${r.wx}${r.isGuan ? '★官杀' : ''})`).join(' '));
  console.log(`  ⇒ 8 步大运中官杀占 ${guanCount} 步 = ${(guanCount / rows.length * 100).toFixed(0)}%`);
  console.log('');
}

console.log('=== 判读 ===');
console.log(' · 土星每宫 2.45 年 vs 大运 10 年 ⇒ 尺度差 4.07 倍，**不可能一一对应**');
console.log(' · 若"土星过境四宫=七杀大运"成立，只能是「大运 ⊃ 过境」或「过境触发大运内的应期」');
console.log(' · 可检验判据：土星过四宫的 2.45 年，应落在八字"官杀大运"的 10 年之内');
