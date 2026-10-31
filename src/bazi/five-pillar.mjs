// 胎元（第五柱）—— 从 CLI 里抽出来的纯函数模块
//
// ★ 为什么单独建文件：`taiYuanOf` 原先放在 `cli-korean.mjs` 里，而那个文件**有顶层副作用**
//   （载入 CSV、打印报告、跑命令）—— 任何 `import { taiYuanOf }` 都会**把整个 CLI 重跑一遍**。
//   教训：CLI 文件不得被 import；可复用逻辑必须放纯模块（R-X2）。
import { TIAN_GAN, DI_ZHI } from '../constants.mjs';
import { splitPillar } from './engine.mjs';

/** 胎元：月干进一位、月支进三位（只需月柱 → 日精度数据集也可算） */
export function taiYuanOf(monthPillar) {
  const { gan, zhi } = splitPillar(monthPillar);
  const gi = (TIAN_GAN.indexOf(gan) + 1) % 10;
  const zi = (DI_ZHI.indexOf(zhi) + 3) % 12;
  return `${TIAN_GAN[gi]}${DI_ZHI[zi]}`;
}

/** 四柱 + 胎元 = 「五柱」（用户命题：胎元当第五柱看待） */
export function fivePillars(pillars) {
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('需要 4 柱');
  return { year: pillars[0], month: pillars[1], day: pillars[2], hour: pillars[3], taiYuan: taiYuanOf(pillars[1]) };
}
