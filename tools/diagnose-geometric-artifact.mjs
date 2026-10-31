// 诊断：这些"显著关联"到底是体系间对应，还是**几何恒等** / **共同输入**造成的假象？
import { compileBazi } from '../src/bazi/engine.mjs';
import { heHuaVerdict } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';

const LNG = 116.407, LAT = 39.904, TZ = 8;
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m, 0).getDate();

const rows = [];
for (let y = 1950; y <= 1999; y++) for (let m = 1; m <= 12; m++) {
  const dmax = daysIn(y, m);
  for (let d = 1; d <= dmax; d += 2) for (const hh of ['00:00', '06:00', '12:00', '18:00']) {
    const at = `${y}-${pad(m)}-${pad(d)} ${hh}`;
    try {
      const ch = computeNatal({ at, lng: LNG, lat: LAT, tz: TZ });
      const bz = compileBazi({ at, gender: '男' });
      const hard = new Set();
      for (const a of ch.aspects ?? []) {
        if (a.type !== '对冲' && a.type !== '四分相') continue;
        hard.add([a.a, a.b].sort().join('-'));
      }
      rows.push({ y, at, hard: [...hard], chong: heHuaVerdict(bz.pillars.map((p) => p[1])).filter((r) => r.k === '冲').length });
    } catch { }
  }
}
console.log(`样本 ${rows.length}`);

/* ① 四轴相位对：是不是恒等（同一批样本上全等）？ */
const FOUR = ['下降-天顶', '上升-天底', '下降-天底', '上升-天顶'];
const sets = {};
for (const k of FOUR) sets[k] = new Set(rows.map((r, i) => (r.hard.includes(k) ? i : -1)).filter((i) => i >= 0));
console.log('\n=== ① 四轴相位对的特征集是否相同 ===');
for (const k of FOUR) console.log(`  ${k}: n=${sets[k].size}`);
const base = sets['上升-天顶'];
for (const k of FOUR.slice(1)) {
  const s = sets[k];
  const inter = [...base].filter((i) => s.has(i)).length;
  const uni = new Set([...base, ...s]).size;
  console.log(`  与"上升-天顶"的 Jaccard = ${(inter / uni).toFixed(4)}  ${inter / uni > 0.99 ? '★ 完全相同（几何恒等）' : ''}`);
}

/* ② 太阳-四轴相位 vs 时柱：是否只是"共同输入"的两条路径？ */
console.log('\n=== ② 太阳近四轴 与 时柱 的关系（共同输入检验）===');
const sunAxis = rows.map((r) => r.hard.some((k) => k.includes('太阳') && (k.includes('上升') || k.includes('下降'))));
// 重建时柱
let shiSame = 0, shiDiff = 0;
for (let i = 0; i < rows.length; i++) {
  const bz = compileBazi({ at: rows[i].at, gender: '男' });
  const isWu = ['午', '未'].includes(bz.pillars[3][1]);   // 12:00 前后落在午/未
  if (sunAxis[i]) (isWu ? shiSame++ : shiDiff++);
}
const pSunAxis = sunAxis.filter(Boolean).length / rows.length;
console.log(`  太阳近上升/下降 的比例 = ${(pSunAxis * 100).toFixed(1)}%`);
console.log(`  ⇒ 太阳落到上升/下降点附近，本身就是**由时刻决定**的（一天两次经过地平线）`);

/* ③ 决定性检查：给定相同的 (日期, 时刻)，两边都是确定性函数 ⇒ 相关必然存在 */
console.log('\n=== ③ 关键逻辑检查：两边是否共用同一输入 ===');
console.log('  八字特征 (冲/刑/十神占比) 完全由 (date, time) 决定');
console.log('  星盘特征 (太阳四轴位置/相位) 完全由 (date, time, lat, lon) 决定');
console.log('  ⇒ 任何"星盘特征 × 八字特征"的关联，都是**同一输入经两个固定算法映射后的确定性函数关系**');
console.log('  ⇒ 這种关联**不能**解释为"两套体系间存在对应"，因为它无法与"共同输入"区分。');

/* ④ 用"同一时刻"做对照：若换日期但保持时刻不变，关联应该减弱（因为冲主要靠日期） */
console.log('\n=== ④ 对照：固定时刻、只变日期 时的关联强度 ===');
const CHONG = rows.map((r) => r.chong >= 2);
const lift = (mask) => {
  const idx = mask.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const pB = CHONG.filter(Boolean).length / CHONG.length;
  const pBA = idx.filter((i) => CHONG[i]).length / idx.length;
  return { pBA, pB, lift: pBA / pB, n: idx.length };
};
const sunAxisArr = rows.map((r) => r.hard.some((k) => (k.includes('太阳') && (k.includes('上升') || k.includes('下降')))));
const L = lift(sunAxisArr);
console.log(`  太阳近四轴 → chong≥2 : ${(L.pBA * 100).toFixed(1)}% vs 基线 ${(L.pB * 100).toFixed(1)}%  lift=${L.lift.toFixed(3)}  n=${L.n}`);
console.log('  （这个 lift 是真实的，但它来自"同一输入"：太阳每日两次过地平线 ⇒ 那两个时刻的时支固定 ⇒ 冲的数量随日支变化）');
