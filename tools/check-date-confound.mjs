// 混杂因子自查：lift 显著性是否只是"日期聚集"的产物？
// 逻辑：星盘特征（如土星-太阳相位）与八字特征（冲的数量）都强烈依赖出生日期。
// 若 500 条样本的日期分布不均匀，两者的"相关"可能只是日期造成的，而非体系间真实对应。
import { compileBazi } from '../src/bazi/engine.mjs';
import { heHuaVerdict } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { loadVedastro } from '../src/vedastro/adapter.mjs';

const { records } = loadVedastro();
const rows = [];
for (const r of records) {
  if (rows.length >= 500) break;
  try {
    const at = `${r.date} ${r.time || '12:00'}`;
    const bz = compileBazi({ at, gender: '男' });
    const ch = computeNatal({ at, lng: r.lon, lat: r.lat, tz: r.offsetHours });
    const branches = bz.pillars.map((p) => p[1]);
    const rels = heHuaVerdict(branches);
    const chong = rels.filter((x) => x.k === '冲').length;
    const hard = (ch.aspects ?? []).filter((a) => a.type === '对冲' || a.type === '四分相').map((a) => [a.a, a.b].sort().join('-'));
    const year = Number(r.date.slice(0, 4));
    const month = Number(r.date.slice(5, 7));
    rows.push({
      year, month, chong,
      chong2: chong >= 2,
      satSun: hard.includes('土星-太阳') || hard.includes('太阳-土星'),
      satUra: hard.includes('土星-天王星') || hard.includes('天王星-土星'),
      moonAsc: hard.includes('上升-月亮') || hard.includes('月亮-上升'),
      pluNode: hard.includes('冥王星-南交点') || hard.includes('南交点-冥王星'),
      mcMoon: hard.includes('天顶-月亮') || hard.includes('月亮-天顶'),
    });
  } catch { }
}

console.log(`样本 ${rows.length}`);
const yrs = {};
for (const r of rows) yrs[r.year] = (yrs[r.year] ?? 0) + 1;
const ysorted = Object.entries(yrs).sort((a, b) => a[0] - b[0]);
console.log('\n=== 年份分布（前 12）===');
console.log(ysorted.slice(0, 12).map(([y, n]) => `${y}:${n}`).join('  '));
console.log(`年份跨度 ${ysorted[0][0]}–${ysorted[ysorted.length - 1][0]}，共 ${ysorted.length} 个年份`);

// 每个目标八字特征在各年份的出现率（看是否强烈随年份变）
const FEATS = ['chong2'];
const AKEYS = ['satSun', 'satUra', 'moonAsc', 'pluNode', 'mcMoon'];
console.log('\n=== 八字 chong2 出现率 按年份（少于 5 例的年份略）===');
const byYear = {};
for (const r of rows) (byYear[r.year] ??= []).push(r);
const yrRates = [];
for (const [y, arr] of Object.entries(byYear)) {
  if (arr.length < 5) continue;
  yrRates.push({ y: Number(y), n: arr.length, rate: arr.filter((x) => x.chong2).length / arr.length });
}
yrRates.sort((a, b) => a.y - b.y);
console.log(yrRates.map((r) => `${r.y}:${(r.rate * 100).toFixed(0)}%(${r.n})`).join('  '));
const rs = yrRates.map((r) => r.rate);
console.log(`  ⇒ 年份间 chong2 率 min=${(Math.min(...rs) * 100).toFixed(0)}% max=${(Math.max(...rs) * 100).toFixed(0)}% 极差=${((Math.max(...rs) - Math.min(...rs)) * 100).toFixed(0)}pp`);

// ★ 分层检验：在每个年份内部，A 与 chong2 是否仍关联？
console.log('\n=== ★ 分层（按年份）后的条件关联：同一年内 A 对 chong2 的 lift ===');
console.log('  A'.padEnd(12) + ' 全局lift'.padStart(10) + '  分层lift'.padStart(10) + '  结论');
const gLift = (aKey) => {
  const a = rows.filter((r) => r[aKey]);
  const base = rows.filter((r) => r.chong2).length / rows.length;
  if (!a.length) return NaN;
  return (a.filter((r) => r.chong2).length / a.length) / base;
};
const stratifiedLift = (aKey) => {
  // 每个年份内算 lift，再按年份样本量加权平均
  let num = 0, den = 0;
  for (const [, arr] of Object.entries(byYear)) {
    if (arr.length < 8) continue;
    const a = arr.filter((r) => r[aKey]);
    if (a.length < 3) continue;                 // 太少的年份跳过
    const baseIn = arr.filter((r) => r.chong2).length / arr.length;
    if (baseIn === 0) continue;
    const l = (a.filter((r) => r.chong2).length / a.length) / baseIn;
    num += l * arr.length; den += arr.length;
  }
  return den ? num / den : NaN;
};
for (const k of AKEYS) {
  const g = gLift(k), s = stratifiedLift(k);
  const verdict = Math.abs(s - 1) < 0.35 ? '★ 分层后消失 ⇒ 日期混淆' : Math.abs(s - 1) >= 0.35 ? '分层后仍在' : '样本不足';
  console.log(`  ${k.padEnd(10)}${g.toFixed(3).padStart(10)}${(isFinite(s) ? s.toFixed(3) : 'n/a').padStart(10)}  ${verdict}`);
}
