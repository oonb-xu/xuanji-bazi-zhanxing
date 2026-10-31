// 纠正上一条：diff 是**周期性**的，不是线性漂移。
// 正确问题：
//   Q1 固定真太阳时刻下，上升星座是否在一年内遍历 12 星座？（若是 ⇒ 固定对应表必错）
//   Q2 上升的进阶是否**匀速**？（若否 ⇒ 任何"每小时一格"的线性映射必错）
//   Q3 时柱在固定时刻是否恒定？
import { computeNatal } from '../src/western/natal.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const LNG = 116.407, LAT = 39.904, TZ = 8;
const HOURS = [0, 4, 8, 12, 16, 20];

for (const hh of HOURS) {
  const signs = [], shizhu = new Set();
  for (let d = 0; d < 366; d++) {
    const t = new Date(new Date('2025-01-01T00:00:00+08:00').getTime() + d * 86400000 + hh * 3600000);
    const at = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(hh).padStart(2, '0')}:00`;
    let bz, ch;
    try { bz = compileBazi({ at, gender: '男' }); ch = computeNatal({ at, lng: LNG, lat: LAT, tz: TZ }); } catch { continue; }
    shizhu.add(bz.pillars[3][1]);
    const s = ch.planets?.['上升']?.sign;
    if (s) signs.push(s);
  }
  const uniq = [...new Set(signs)];
  // 每个星座出现的天数
  const cnt = {};
  for (const s of signs) cnt[s] = (cnt[s] ?? 0) + 1;
  const counts = Object.values(cnt);
  const spread = counts.length ? (Math.max(...counts) - Math.min(...counts)) : 0;
  console.log(`${String(hh).padStart(2, '0')}:00  时柱集合=[${[...shizhu].join('')}]  上升覆盖 ${uniq.length}/12 星座  各星座天数 min=${Math.min(...counts)} max=${Math.max(...counts)} 极差=${spread}`);
}

console.log('');
console.log('判读：');
console.log(' · 若时柱恒为 1 个 ⇒ 时辰在固定时刻不变（是"钟表格"）');
console.log(' · 若上升覆盖 12/12 ⇒ 上升在固定时刻会遍历全部星座（是"季节性格"）');
console.log(' · 若各星座天数极差很大 ⇒ 上升进阶**不匀速**（黄赤交角 + 纬度效应）');
