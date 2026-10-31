#!/usr/bin/env node
// 命宫公式反推（R-G3 / ARCH-1）：枚举参数化公式族，找出能产出已知正确解的那些
//   node cli-minggong-fit.mjs
//
// 已知基准（用户专家档案 + 本项目锁定库一致）：
//   八字 丁亥 壬子 癸巳 庚申  →  命宫 **己酉**、身宫 **己酉**
// 引擎现状：命宫算出 **癸卯**（错，且与胎元同值）；身宫算出 **己酉**（对）。
//
// 方法：不猜"某一条古法"，而是**穷举**（月索引方式 × 时索引方式 × 算式）的组合，
//   报告哪些组合能同时命中命宫与身宫 —— 命中集就是**候选公式**，交人工裁定。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TIAN_GAN, DI_ZHI } from './src/constants.mjs';
import { expectedMonthGan } from './src/bazi/consistency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** 索引方式：把 月支/时支 映射为数字 */
export const INDEXINGS = {
  '子=1（子起1）': (z) => DI_ZHI.indexOf(z) + 1,
  '子=0（零基）': (z) => DI_ZHI.indexOf(z),
  '寅=1（正月起寅）': (z) => ((DI_ZHI.indexOf(z) - 2) % 12 + 12) % 12 + 1,
  '丑=1': (z) => ((DI_ZHI.indexOf(z) - 1) % 12 + 12) % 12 + 1,
  '逆序（亥=1）': (z) => 12 - DI_ZHI.indexOf(z),
};
/** 算式族：由 (月数 m, 时数 h) 得命宫支的"序号"，再按序号取支 */
export const FORMULAS = {
  '14−和': (m, h) => 14 - (m + h),
  '26−和': (m, h) => 26 - (m + h),
  '和': (m, h) => m + h,
  '12−和': (m, h) => 12 - (m + h),
  '和−12': (m, h) => m + h - 12,
  '26−和（回绕12）': (m, h) => ((26 - (m + h) - 1) % 12) + 1,
  '14−和（回绕12）': (m, h) => ((14 - (m + h) - 1) % 12 + 12) % 12 + 1,
  '和 取模12': (m, h) => ((m + h - 1) % 12) + 1,
};
/** 序号 → 支（两种解释：子=1 起，或 寅=1 起） */
export const NUM_TO_ZHI = {
  '序按子=1': (n) => DI_ZHI[(((n - 1) % 12) + 12) % 12],
  '序按寅=1': (n) => DI_ZHI[(((n + 1) % 12) + 12) % 12],
};

const KNOWN = { pillars: ['丁亥', '壬子', '癸巳', '庚申'], mingGong: '己酉', shenGong: '己酉' };

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const [Y, M, D, H] = KNOWN.pillars;
  const hitsMing = [], hitsShen = [], hitsBoth = [];
  const total = Object.keys(INDEXINGS).length ** 2 * Object.keys(FORMULAS).length * Object.keys(NUM_TO_ZHI).length;
  for (const [mi, mf] of Object.entries(INDEXINGS)) {
    for (const [hi, hf] of Object.entries(INDEXINGS)) {
      for (const [fi, ff] of Object.entries(FORMULAS)) {
        for (const [ni, nf] of Object.entries(NUM_TO_ZHI)) {
          const m = mf(M[1]), h = hf(H[1]);
          let zhi;
          try { zhi = nf(ff(m, h)); } catch { continue; }
          if (!zhi || !DI_ZHI.includes(zhi)) continue;
          const gan = expectedMonthGan(Y[0], zhi);       // 命宫干：与月干同法（五虎遁）
          const gz = `${gan}${zhi}`;
          const rec = { 月索引: mi, 时索引: hi, 算式: fi, 序号解释: ni, m, h, gz };
          if (gz === KNOWN.mingGong) hitsMing.push(rec);
          if (gz === KNOWN.shenGong) hitsShen.push(rec);
          if (gz === KNOWN.mingGong && gz === KNOWN.shenGong) hitsBoth.push(rec);
        }
      }
    }
  }
  P('# 命宫 / 身宫 公式反推（ARCH-1 / R-G3）');
  P('');
  P(`已知基准：\`${KNOWN.pillars.join(' ')}\` → 命宫 **${KNOWN.mingGong}**、身宫 **${KNOWN.shenGong}**`);
  P(`（来源：用户专家档案 + 本项目锁定库 \`bazi_meta_db.json\` 的 \`tai_ming_shen\`，两者一致）`);
  P('');
  P(`枚举空间：**${total}** 种组合（${Object.keys(INDEXINGS).length} 种月索引 × ${Object.keys(INDEXINGS).length} 种时索引 × ${Object.keys(FORMULAS).length} 种算式 × ${Object.keys(NUM_TO_ZHI).length} 种序号解释）`);
  P('');
  P('## 结果');
  P('');
  P('| 命中目标 | 组合数 |');
  P('|---|---|');
  P(`| 能产出命宫 ${KNOWN.mingGong} | **${hitsMing.length}** |`);
  P(`| 能产出身宫 ${KNOWN.shenGong} | **${hitsShen.length}** |`);
  P(`| **同时产出命宫与身宫 = ${KNOWN.mingGong}**（即命宫=身宫的情形） | **${hitsBoth.length}** |`);
  P('');
  if (hitsMing.length) {
    P('## 能产出「命宫 = 己酉」的候选（去重后）');
    P('');
    P('| 月索引 | 时索引 | 算式 | 序号解释 | 算得 m,h | 结果 |');
    P('|---|---|---|---|---|---|');
    const seen = new Set();
    for (const r of hitsMing) {
      const k = `${r.月索引}|${r.时索引}|${r.算式}|${r.序号解释}`;
      if (seen.has(k)) continue; seen.add(k);
      P(`| ${r.月索引} | ${r.时索引} | ${r.算式} | ${r.序号解释} | m=${r.m},h=${r.h} | **${r.gz}** |`);
    }
  } else {
    P('## ⚠️ 在枚举空间内**没有**任何组合能产出 己酉');
    P('');
    P('⇒ 说明专家所用的命宫法**不在这个常见参数族内**，可能属于：');
    P('1. **非"月和时"输入**（如以年支/月支、或以星盘的上升/天顶定命宫）；');
    P('2. **两步掌诀法**（先"以子为正月逆数至生月"得中间位，再顺数至生时）；');
    P('3. **星宗体系**（命宫 = 上升星座按十二宫↔十二支映射，其映射起法亦有 戌起/酉起两说）。');
  }
  P('');
  P('## 引擎现状与差距');
  P('');
  const m0 = INDEXINGS['子=1（子起1）'](M[1]), h0 = INDEXINGS['子=1（子起1）'](H[1]);
  const curMing = NUM_TO_ZHI['序按子=1'](14 - (m0 + h0));
  const curShen = NUM_TO_ZHI['序按子=1'](m0 + h0);
  P(`- 月支索引（子=1）：m = ${m0}；时支索引（子=1）：h = ${h0}；和 = ${m0 + h0}`);
  P(`- 现引擎命宫算式 \`14−和\` → ${14 - (m0 + h0)} → **${expectedMonthGan(Y[0], curMing)}${curMing}**（专家为 ${KNOWN.mingGong}）**❌**`);
  P(`- 现引擎身宫算式 \`和\` → ${m0 + h0} → **${expectedMonthGan(Y[0], curShen)}${curShen}**（专家为 ${KNOWN.shenGong}）**✅**`);
  P('');
  P('⇒ **身宫公式已对上专家**；**命宫公式需换**。命宫干（五虎遁）逻辑本身正确（酉→己 ✓）。');
  P('');
  P('> ⚠️ **单点拟合不足以定案**：只有 1 个已知样本时，命中集可能多条并存。');
  P('> 下一步需**第二个已知样本**（另一组四柱 + 其命宫），或由用户直接指出所用古法出处。');

  const rp = argv[argv.indexOf('--report') + 1];
  if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
