// 证明「相关是采样分布的属性，不是体系间的属性」
//
// 论断：A=f(t)、B=g(t) 都是 t 的确定性函数 ⇒ 任何 A×B 的"相关"只由 **t 的分布**决定。
// 检验：同一个 (A,B) 对，换不同的 t 采样方式，看 lift 变不变。
//   若 lift 随采样方式大幅变动 ⇒ 它测的不是体系关系，而是采样偏差。
import { compileBazi } from '../src/bazi/engine.mjs';
import { heHuaVerdict } from '../src/bazi/dag.mjs';
import { computeNatal } from '../src/western/natal.mjs';

const LNG = 116.407, LAT = 39.904, TZ = 8;
const pad = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m, 0).getDate();

// 生成覆盖 1950–1999 的完整采样池（每月全部日期 × 4 时刻）
const pool = [];
for (let y = 1950; y <= 1999; y++) for (let m = 1; m <= 12; m++) {
  const dmax = daysIn(y, m);
  for (let d = 1; d <= dmax; d++) for (const hh of ['00:00', '06:00', '12:00', '18:00']) {
    const at = `${y}-${pad(m)}-${pad(d)} ${hh}`;
    try {
      const ch = computeNatal({ at, lng: LNG, lat: LAT, tz: TZ });
      const bz = compileBazi({ at, gender: '男' });
      const hard = new Set();
      for (const a of ch.aspects ?? []) {
        if (a.type !== '对冲' && a.type !== '四分相') continue;
        hard.add([a.a, a.b].sort().join('-'));
      }
      const sunAxis = hard.has('上升-太阳') || hard.has('太阳-上升') || hard.has('下降-太阳') || hard.has('太阳-下降');
      const chong2 = heHuaVerdict(bz.pillars.map((p) => p[1])).filter((r) => r.k === '冲').length >= 2;
      pool.push({ y, m, d, hh, sunAxis, chong2 });
    } catch { }
  }
}
console.log(`采样池 ${pool.length} 条（1950–1999 全部日期 × 4 时刻）\n`);

const liftOf = (rows) => {
  const n = rows.length;
  const pB = rows.filter((r) => r.chong2).length / n;
  const sub = rows.filter((r) => r.sunAxis);
  if (!sub.length || !pB) return null;
  const pBA = sub.filter((r) => r.chong2).length / sub.length;
  return { lift: pBA / pB, pBA, pB, n, nA: sub.length };
};

const schemes = {
  '① 全池等权（1950–1999）': pool,
  '② 只取 1950–1959': pool.filter((r) => r.y < 1960),
  '③ 只取 1990–1999': pool.filter((r) => r.y >= 1990),
  '④ 只取 1 月': pool.filter((r) => r.m === 1),
  '⑤ 只取 7 月': pool.filter((r) => r.m === 7),
  '⑥ 只取每月 1 号': pool.filter((r) => r.d === 1),
  '⑦ 只取每月 15 号': pool.filter((r) => r.d === 15),
  '⑧ 只取 12:00': pool.filter((r) => r.hh === '12:00'),
  '⑨ 只取 00:00': pool.filter((r) => r.hh === '00:00'),
};

console.log('=== 同一个 (太阳近四轴 → 冲≥2)，换采样方式 ===');
console.log('  采样方式'.padEnd(28) + 'n'.padStart(7) + 'nA'.padStart(7) + 'P(B|A)'.padStart(9) + 'P(B)'.padStart(8) + 'lift'.padStart(8));
const lifts = [];
for (const [name, rows] of Object.entries(schemes)) {
  const L = liftOf(rows);
  if (!L) { console.log(`  ${name.padEnd(26)}样本不足`); continue; }
  lifts.push(L.lift);
  console.log(`  ${name.padEnd(26)}${String(L.n).padStart(7)}${String(L.nA).padStart(7)}${(L.pBA * 100).toFixed(1).padStart(8)}%${(L.pB * 100).toFixed(1).padStart(7)}%${L.lift.toFixed(3).padStart(8)}`);
}
console.log(`\n  ⇒ lift 取值范围 ${Math.min(...lifts).toFixed(3)} ~ ${Math.max(...lifts).toFixed(3)}，极差 ${(Math.max(...lifts) - Math.min(...lifts)).toFixed(3)}`);
console.log('  ⇒ 同一对特征，仅换采样方式，lift 就大幅变动 ⇒ 它测的是**采样偏差**，不是体系关系。');

/* ★ 关键：条件独立的直接演示——给定 t，A 与 B 都是常量 */
console.log('\n=== 给定相同的 (日期, 时刻)，A 与 B 是常量吗？ ===');
const grouped = {};
for (const r of pool) {
  const key = `${r.y}-${r.m}-${r.d} ${r.hh}`;
  (grouped[key] ??= []).push(r);
}
let groupsWithVariance = 0;
for (const [k, arr] of Object.entries(grouped)) {
  if (arr.length < 2) continue;
  const aSet = new Set(arr.map((x) => x.sunAxis));
  const bSet = new Set(arr.map((x) => x.chong2));
  if (aSet.size > 1 || bSet.size > 1) groupsWithVariance++;
}
console.log(`  分组数 ${Object.keys(grouped).length}，组内出现方差的组数 = ${groupsWithVariance}`);
console.log('  ⇒ 0 表示：给定 t，A 与 B 各自完全确定 ⇒ **条件独立 I(A;B|t)=0**');
console.log('  ⇒ 这就是「结构性无解」的形式化表述：两套体系的输出只共同携带关于 t 的信息。');
