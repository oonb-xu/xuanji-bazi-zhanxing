// 按实测状态定稿：月支严格可推（100%），时支当前实现精度不足（如实记录）
import fs from 'node:fs';
let s = fs.readFileSync('src/cross/position-to-pillars.mjs', 'utf8');

// 替换掉那段不可靠的时支实现，改成用 ramc + 如实标注精度
const START = s.indexOf('/* ══════════════════════════════════════════════\n * ② 时支 ← 太阳时角');
const END = s.indexOf('/* ══════════════════════════════════════════════\n * ③ 不可推的两根柱');
if (START < 0 || END < 0) { console.error('❌ 定位失败'); process.exit(1); }

const NEW = `/* ══════════════════════════════════════════════
 * ② 时支 ← 太阳时角（★ 实测：当前实现精度不足，如实标注）
 * ══════════════════════════════════════════════ */
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const EPS = 23.4392911 * D2R;

/** 黄经 → 赤经（度） */
export function raOfEcliptic(lonDeg) {
  const l = norm(lonDeg) * D2R;
  return norm(Math.atan2(Math.cos(EPS) * Math.sin(l), Math.cos(l)) * R2D);
}

/**
 * 从「太阳黄经 + 天顶/恒星时」求时支
 *
 * ★ 实测结论（96 盘扫描，跨 5 地、跨 60 年）：
 *   - 时角本身算得对（HA = ramc − RA☉，ramc 由引擎直接给出）
 *   - 但把它映射到「时支」时**不能只用时角**，因为：
 *       时支按**真太阳时**划分，而真太阳时 = 平太阳时 + **均时差(EoT)**
 *       均时差在一 年内可达 ±16 分钟，跨越时辰边界时就会翻转
 *   - 我试过 3 种索引映射与偏移扫描，最高只到 **50%**，**不足以实用**
 *
 * ⇒ 结论：**时支当前不可靠地从落位推出**。要真正做到，必须补上均时差修正，
 *   这属于后续工作，不应在此假装成功。
 *
 * @param sunLon 太阳黄经
 * @param ramc   天顶赤经/地方恒星时（度）—— 引擎 angles.ramc 直给
 * @returns 时支 + 时角 + 明确的精度警告
 */
export function shiZhiFromHourAngle(sunLon, ramc) {
  const raSun = raOfEcliptic(sunLon);
  const ha = norm(ramc - raSun);
  // 平太阳时近似：HA=0 → 午(6)
  const idx = Math.floor(norm(ha + 15) / 30) % 12;
  return {
    zhi: ZHI[idx],
    hourAngle: Math.round(ha * 100) / 100,
    hourAngleHours: Math.round(ha / 15 * 100) / 100,
    exact: false,
    measuredAccuracy: 0.50,
    caveat: '⚠️ 实测仅约 50% 正确。缺均时差(EoT, 年内可达 ±16 分钟)修正，跨时辰边界会翻错。**不可用于生产**。',
    basis: 'HA = ramc − RA☉；但时支按真太阳时划分，需 +EoT 修正',
  };
}

`;

s = s.slice(0, START) + NEW + s.slice(END);
fs.writeFileSync('src/cross/position-to-pillars.mjs', s, 'utf8');
console.log('✅ 时支实现已按实测状态改写（标注 50% + 缺 EoT）');
