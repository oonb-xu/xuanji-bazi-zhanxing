// 规程自检：三条硬判据，全部必须通过（exit 0）
//  A. 月将表：规则表 12 中气映射 vs 第三方库 yuejiang（逐中气取样）
//  B. 天地盘 + 天将顺逆：本引擎 vs 第三方库 tianPan/tianJiang
//  C. 三传：本引擎规则表推导 vs 第三方库 sanChuan；特殊课体（伏吟/返吟/别责/八专）
//     按规则表 Step 4.6 单列，不计入常规一致率。
import { getLiuRenByDate, DiZhiToPinyin } from 'liuren-ts-lib';
import { SolarTerm } from 'tyme4ts';
import { compile } from '../src/daliuren.mjs';
import { DI_ZHI, YUE_JIANG_BY_QI, JIANG_ALIAS, SPECIAL_KETI_RE } from '../src/constants.mjs';

const JIANG_NORM = (j) => JIANG_ALIAS[j] ?? j;
const zh = (p) => DI_ZHI[DI_ZHI.findIndex((z) => DiZhiToPinyin[z] === p)] ?? p;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } return cond; };
const sample = (i) => {
  const y = 2024 + (i % 3), mo = (i * 5) % 12 + 1, dd = (i * 13) % 28 + 1, hh = (i * 3) % 24, mi = (i * 17) % 60;
  return new Date(y, mo - 1, dd, hh, mi, 0);
};

/* A. 月将表 */
console.log('[A] 月将映射表 vs 库');
for (const [qi, jiang] of Object.entries(YUE_JIANG_BY_QI)) {
  const qiIdx = ['冬至', '大寒', '雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪'].indexOf(qi);
  const t = SolarTerm.fromIndex(qiIdx === 0 ? 2026 : 2026, qiIdx * 2);
  const d = t.getSolarDay();
  const dt = new Date(d.getYear(), d.getMonth() - 1, d.getDay() + 3, 12, 0, 0);
  ok(compile({ at: dt }).L1_frame.yueJiang === jiang, `${qi} → 期望${jiang} 实得${compile({ at: dt }).L1_frame.yueJiang}`);
  ok(getLiuRenByDate(dt).dateInfo.yuejiang === jiang, `${qi} 库月将不等`);
}
console.log(`  覆盖 ${Object.keys(YUE_JIANG_BY_QI).length} 个中气`);

/* B. 天地盘 / 天将 */
console.log('[B] 天地盘 + 天将 vs 库');
let n = 0, badPan = 0, badJiang = 0, badGui = 0;
for (let i = 0; i < 150; i++) {
  const dt = sample(i);
  const r = compile({ at: dt });
  const lib = getLiuRenByDate(dt);
  n++;
  const libPan = lib.tianDiPan.tianPan, libJ = lib.tianDiPan.tianJiang;
  for (const z of DI_ZHI) if (libPan[DiZhiToPinyin[z]] !== r.L2_pan.tianPan[z]) { badPan++; break; }
  for (const z of DI_ZHI) if (JIANG_NORM(libJ[DiZhiToPinyin[z]]) !== r.L4_tianJiang[z]) { badJiang++; break; }
  // 贵人落位也须与库一致（库中「贵人」所在的地盘位）
  const libGuiPos = DI_ZHI.find((z) => JIANG_NORM(libJ[DiZhiToPinyin[z]]) === '贵人');
  if (libGuiPos !== r.L4_guiRen.landPos) badGui++;
}
ok(badPan === 0, `天地盘不一致 ${badPan}/${n}`);
ok(badJiang === 0, `天将不一致 ${badJiang}/${n}`);
ok(badGui === 0, `贵人落位不一致 ${badGui}/${n}`);
console.log(`  样本 ${n}：天地盘 ${n - badPan}/${n}，天将 ${n - badJiang}/${n}，贵人落位 ${n - badGui}/${n}`);

/* C. 三传 */
console.log('[C] 三传一致率（本引擎规则表推导 vs 库）');
const byMethod = {};
let tot = 0, agr = 0, spTot = 0, spAgr = 0;
for (let i = 0; i < 300; i++) {
  const r = compile({ at: sample(i) });
  const s = r.L5_sanChuan;
  const isSp = SPECIAL_KETI_RE.test(s.keTi ?? '') || s.special.length > 0;
  if (isSp) { spTot++; if (s.agree) spAgr++; continue; }
  const key = s.specMethod.split('·')[0];
  byMethod[key] ??= { n: 0, a: 0 };
  byMethod[key].n++; tot++;
  if (s.agree) { agr++; byMethod[key].a++; }
}
for (const [k, v] of Object.entries(byMethod)) console.log(`  ${k}: ${v.a}/${v.n} = ${(v.a / v.n * 100).toFixed(1)}%`);
const rate = tot ? agr / tot : 1;
console.log(`  常规课体一致率 ${agr}/${tot} = ${(rate * 100).toFixed(1)}%`);
console.log(`  特殊课体 ${spTot} 例（Step 4.6 授权交专用规则，其中与常规算法巧合一致 ${spAgr}）`);
ok(rate >= 0.95, `常规课体一致率 ${(rate * 100).toFixed(1)}% < 95% 阈值`);

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
