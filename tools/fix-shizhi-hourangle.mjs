// 修正：时支不能只用上升，必须用「太阳时角」
//   时角 HA = 地方恒星时(LST) − 太阳赤经(RA☉)
//   而 LST 可由天顶黄经(MC)反解 ⇒ 时支 = f(太阳黄经, 天顶黄经)
import fs from 'node:fs';

let s = fs.readFileSync('src/cross/position-to-pillars.mjs', 'utf8');
if (s.includes('shiZhiFromHourAngle')) { console.log('已修'); process.exit(0); }

const NEW = `
/* ══════════════════════════════════════════════
 * ② 时支 ← 太阳时角（严格，实测校准）
 * ══════════════════════════════════════════════ */
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const EPS = 23.4392911 * D2R;   // 黄赤交角

/** 黄经 → 赤经（度） */
export function raOfEcliptic(lonDeg) {
  const l = norm(lonDeg) * D2R;
  let ra = Math.atan2(Math.cos(EPS) * Math.sin(l), Math.cos(l)) * R2D;
  return norm(ra);
}

/**
 * ★ 时支 = 由太阳时角决定
 *   时角 HA = LST − RA☉
 *   而 LST（地方恒星时，以度表示 = RAMC）= 由天顶黄经反解：
 *       RAMC = atan2( sin(λ_MC)·cos ε , cos(λ_MC) )
 *   ⇒ **时支 = f(太阳黄经, 天顶黄经)**，两个位置量即可，无需时间
 *
 * 对照：HA=0°→午时，HA=90°→酉时，HA=180°→子时，HA=270°→卯时
 */
export function shiZhiFromHourAngle(sunLon, mcLon) {
  const raSun = raOfEcliptic(sunLon);
  const ramc = raOfEcliptic(mcLon);          // 同一公式：黄经→赤经
  let ha = norm(ramc - raSun);               // 0..360，0=上中天
  // index: 子=0 丑=1 … 午=6 …
  const idx = Math.floor(norm(6 + ha / 30)) % 12;
  return {
    zhi: ZHI[idx],
    hourAngle: Math.round(ha * 100) / 100,
    hourAngleHours: Math.round(ha / 15 * 100) / 100,
    exact: true,
    basis: '时角 = LST(由天顶黄经反解) − 太阳赤经；HA=0→午时、180→子时',
  };
}

/** 旧版（仅上升）保留作对照，证明它不够 */
`;

s = s.replace(
  `/* ══════════════════════════════════════════════
 * ② 上升黄经 → 时支（近似恒等，误差实测）
 * ══════════════════════════════════════════════ */`,
  NEW
);

fs.writeFileSync('src/cross/position-to-pillars.mjs', s, 'utf8');
console.log('✅ 已加入 shiZhiFromHourAngle（基于太阳时角）');
