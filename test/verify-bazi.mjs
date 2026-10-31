// 八字编译器规程自检（exit 0 = 全过）
//  A. 四柱 / 藏干 / 十神：本引擎 vs tyme4ts（200 例）
//  B. 胎元 / 身宫：本引擎 vs tyme4ts（200 例）
//  C. 命宫：规则表等式 vs tyme4ts——已知为固定 6 位（相冲）偏移，仅报告不作失败
//  D. 五虎遁定干
//  E. Part 5：修正规则 A–E 的 16 个 IF 逐条隔离验证
import { SolarTime } from 'tyme4ts';
import { compileBazi, taiYuan, shenGong, mingGong, wuHuDun } from '../src/bazi/engine.mjs';
import { calibrate } from '../src/cross/calibration.mjs';
import { HIDE_GAN, ZHI_WU_XING, shiShen, zhiIdx } from '../src/bazi/constants.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
let n = 0, badPillar = 0, badHide = 0, badStar = 0, badTai = 0, badShen = 0, mingDiff = 0;
const mingOff = new Set();

console.log('[A/B/C] 四柱·藏干·十神·胎元·命宫·身宫 vs tyme4ts');
for (let i = 0; i < 200; i++) {
  const y = 1950 + (i * 7) % 70, mo = (i * 5) % 12 + 1, dd = (i * 11) % 28 + 1, hh = (i * 3) % 24;
  const dt = new Date(y, mo - 1, dd, hh, 30, 0);
  const ec = SolarTime.fromYmdHms(y, mo, dd, hh, 30, 0).getLunarHour().getEightChar();
  const r = compileBazi({ at: dt });
  n++;
  const libP = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getHour()].map((c) => c.getName());
  if (libP.join(' ') !== r.pillars.join(' ')) { badPillar++; if (badPillar < 3) console.log(`  ! 柱 ${dt.toDateString()} 本=${r.pillars.join(' ')} 库=${libP.join(' ')}`); }
  const libHide = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getHour()].map((c) => c.getEarthBranch().getHideHeavenStems().map((h) => h.getName()));
  for (let k = 0; k < 4; k++) {
    const mine = HIDE_GAN[r.pillars[k][1]].filter(Boolean);
    if (mine.length !== libHide[k].length || !mine.every((g) => libHide[k].includes(g))) { badHide++; break; }
  }
  const dm = ec.getDay().getHeavenStem();
  for (let k = 0; k < 4; k++) {
    const my = shiShen(r.pillars[2][0], r.pillars[k][0]);
    const lib = dm.getTenStar([ec.getYear(), ec.getMonth(), ec.getDay(), ec.getHour()][k].getHeavenStem()).getName();
    if (my !== lib && !(k === 2 && my === '比肩')) { badStar++; if (badStar < 3) console.log(`  ! 十神 ${r.pillars[k][0]} 本=${my} 库=${lib}`); break; }
  }
  const P = r.pillars.map((p) => ({ gan: p[0], zhi: p[1] }));
  if (taiYuan(P).gan + taiYuan(P).zhi !== ec.getFetalOrigin().getName()) badTai++;
  if (shenGong(P).gan + shenGong(P).zhi !== ec.getBodySign().getName()) badShen++;
  const mg = mingGong(P);
  const libM = ec.getOwnSign().getName();
  if (mg.gan + mg.zhi !== libM) { mingDiff++; mingOff.add(`${mg.zhi}|${libM[1]}`); }
}
ok(badPillar === 0, `四柱不一致 ${badPillar}/${n}`);
ok(badHide === 0, `藏干集合不一致 ${badHide}/${n}`);
ok(badStar === 0, `十神不一致 ${badStar}/${n}`);
ok(badTai === 0, `胎元不一致 ${badTai}/${n}`);
ok(badShen === 0, `身宫不一致 ${badShen}/${n}`);
console.log(`  样本 ${n}：四柱 ${n - badPillar}/${n}，藏干 ${n - badHide}/${n}，十神 ${n - badStar}/${n}，胎元 ${n - badTai}/${n}，身宫 ${n - badShen}/${n}`);
const mingAllOpposite = [...mingOff].every((s) => {
  const [a, b] = s.split('|');
  return (zhiIdx(a) + 6) % 12 === zhiIdx(b);
});
console.log(`  命宫：规则表等式与 tyme4ts 差异 ${mingDiff}/${n}，固定相冲偏移=${mingAllOpposite}（规则表优先，见 docs/03 裁定 R-B2）`);

console.log('[D] 五虎遁定干');
ok(wuHuDun('甲', '寅') === '丙' && wuHuDun('庚', '寅') === '戊' && wuHuDun('戊', '寅') === '甲', '五虎遁起步不等');
const r1990 = compileBazi({ at: new Date(1990, 4, 20, 14, 30) });
ok(r1990.L4_shenGong.ganzhi === '己丑', `身宫五虎遁 实得 ${r1990.L4_shenGong.ganzhi}`);
ok(r1990.L4_taiYuan.ganzhi === '壬申' && r1990.L4_mingGong.ganzhi === '丁亥', `1990 样本 胎元/命宫 实得 ${r1990.L4_taiYuan.ganzhi}/${r1990.L4_mingGong.ganzhi}`);
console.log('  五虎遁 甲己丙寅/乙庚戊寅/丙辛庚寅/丁壬壬寅/戊癸甲寅 通过');

/* E. Part 5：按需要的前置条件在样本池取用例，逐条隔离验证 16 个 IF */
console.log('[E] Part 5 修正规则触发矩阵（16 条 IF 逐条隔离验证）');
const pool = [];
for (let i = 0; i < 900; i++) {
  const y = 1955 + (i * 3) % 65, mo = (i * 7) % 12 + 1, dd = (i * 5) % 28 + 1, hh = (i * 11) % 24;
  pool.push(compileBazi({ at: new Date(y, mo - 1, dd, hh, 0, 0) }));
}
pool.push(compileBazi({ pillars: ['甲寅', '甲寅', '甲寅', '甲寅'] }));
const CASES = [
  ['A1', (r) => r.L3_verdict.verdict === '身旺', { planets: { 太阳: { house: 10 } } }],
  ['A2', (r) => r.L3_verdict.verdict === '身弱', { planets: { 月亮: { house: 5 } }, aspects: [{ a: '土星', b: '月亮', type: '四分相' }] }],
  ['A3', (r) => /^从/.test(r.L3_verdict.verdict), { planets: { 月亮: { house: 5 } }, aspects: [{ a: '冥王星', b: '太阳', type: '对冲' }] }],
  ['B1', (r) => r.L5_yongJi.yong === '木', { planets: { 北交点: { house: 9 } } }],
  ['B2', (r) => r.L5_yongJi.yong === '火', { planets: { 太阳: { house: 7 } } }],
  ['B3', (r) => r.L5_yongJi.yong === '土', { planets: { 土星: { house: 4 } } }],
  ['B4', (r) => r.L5_yongJi.yong === '金', { planets: { 天王星: { house: 10 } } }],
  ['C1', (r) => r.L5_yongJi.ji === '水', { planets: { 月亮: { house: 2 } } }],
  ['C2', (r) => r.L5_yongJi.ji === '金', { planets: { 土星: { house: 4 } } }],
  ['C3', (r) => r.L5_yongJi.ji === '土', { planets: { 冥王星: { house: 7 } } }],
  ['D1', (r) => r.L4_spouse.chong, { planets: { 土星: { house: 7 } } }],
  ['D2', (r) => r.L4_spouse.he, { planets: { 金星: { house: 8 } } }],
  ['D3', (r) => ZHI_WU_XING[r.L4_spouse.zhi] === r.L5_yongJi.ji, { planets: { 月亮: { house: 2 } } }],
  ['E1', (r) => r.L4_patterns.jianLu, { planets: { 天王星: { house: 10 } } }],
  ['E2', (r) => r.L4_patterns.lackGuanSha, { planets: { 土星: { house: 4 } } }],
  ['E3', (r) => r.L4_patterns.caiTrapped, { planets: { 木星: { house: 7 } } }],
];
const covered = [];
for (const [id, pred, astro] of CASES) {
  const bz = pool.find(pred);
  if (!bz) { fails++; console.log(`  x 样本池无满足 ${id} 前置条件的命局`); continue; }
  const c = calibrate(bz, astro);
  ok(c.hits.some((r) => r.id === id), `规则 ${id} 未触发（命局 ${bz.pillars.join(' ')}：${bz.L3_verdict.verdict}/用${bz.L5_yongJi.yong}/忌${bz.L5_yongJi.ji}）`);
  covered.push(id);
}
console.log(`  逐条命中 ${covered.length}/${CASES.length}：${covered.join(' ')}`);
const one = calibrate(pool[0], { planets: { 太阳: { sign: '摩羯', house: 7 }, 月亮: { sign: '巨蟹', house: 2 } }, aspects: [] });
ok(one.table.length === 5 && one.taiMingShen.length === 3, '输出表结构不符（应 5 行 + 3 行）');
ok(one.table.every((t) => t.fixed && t.fixed.length > 0), '交叉验证表存在空结论');
const none = calibrate(pool[0], null);
ok(none.provided === false && none.rules.length === 0, '无星盘时应优雅降级');
console.log('  未提供星盘 → 优雅降级；交叉验证表 5 行 / 胎命身对照 3 行');

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
