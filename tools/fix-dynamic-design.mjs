// 修动态权重设计：分离「组内分布」与「总体强弱」
//   组内分布：基础配比 × 方向性修正（硬相位→官杀/比劫；和谐→印/食伤）
//   总体强弱：尊贵 × 宫位 × 灼伤 × 得时 × 逆行（统一作用，不参与组内归一）
//   ⇒ 入庙的木星 = 更强的木星，不是不同的木星
import fs from 'node:fs';
let s = fs.readFileSync('src/cross/dynamic-ten-god.mjs', 'utf8');
if (s.includes('// ★ strength')) { console.log('已修'); process.exit(0); }

s = s.replace(
  `  // ① 本质尊贵：放大或削弱它「本来的味道」
  const dg = dignityOf(p.name, p.sign);
  if (dg.k !== 1) {
    for (const g of GROUPS) if (w[g]) w[g] *= dg.k;
    mods.push({ k: '尊贵', v: dg.tier, f: dg.k });
  }

  // ② 宫位档：角宫=显、果宫=隐
  const h = p.house;
  let hk = 1.0, hTag = '';
  if (ANGULAR.has(h)) { hk = 1.28; hTag = '角宫'; }
  else if (SUCCEDENT.has(h)) { hk = 1.06; hTag = '续宫'; }
  else if (h) { hk = 0.80; hTag = '果宫'; }
  if (hk !== 1) { for (const g of GROUPS) if (w[g]) w[g] *= hk; mods.push({ k: '宫位', v: hTag, f: hk }); }

  // ③ 顺逆：逆行 = 力量内化、反复，整体增益（结构上更"浓"，但方向向内）
  if (p.retro === true) { for (const g of GROUPS) if (w[g]) w[g] *= 1.10; mods.push({ k: '逆行', v: '内化', f: 1.10 }); }

  // ④ 得时（hayz 简化）：昼星昼盘 / 夜星夜盘
  const daySet = new Set(['太阳', '木星', '土星']);
  const nightSet = new Set(['月亮', '金星', '火星']);
  if (ctx.isDay != null) {
    const hayz = (ctx.isDay && daySet.has(p.name)) || (!ctx.isDay && nightSet.has(p.name));
    if (hayz) { for (const g of GROUPS) if (w[g]) w[g] *= 1.15; mods.push({ k: '得时', v: ctx.isDay ? '昼' : '夜', f: 1.15 }); }
  }

  // ⑤ 与太阳的距角：灼伤/光束下削弱自我表达
  if (typeof ctx.sunLon === 'number' && p.name !== '太阳') {
    const d = sepAt(p.lon, ctx.sunLon);
    if (d < 8.5) { for (const g of GROUPS) if (w[g]) w[g] *= 0.72; mods.push({ k: '日光灼伤', v: d.toFixed(1) + '°', f: 0.72 }); }
    else if (d < 17) { for (const g of GROUPS) if (w[g]) w[g] *= 0.84; mods.push({ k: '在光束下', v: d.toFixed(1) + '°', f: 0.84 }); }
  }`,
  `  // ★ strength：总体强弱（统一作用，不参与组内归一）
  //   ⇒ 入庙的木星 = 更强的木星，而不是"不同的木星"
  let strength = 1.0;
  const strengthMods = [];

  // ① 本质尊贵
  const dg = dignityOf(p.name, p.sign);
  if (dg.k !== 1) { strength *= dg.k; strengthMods.push({ k: '尊贵', v: dg.tier, f: dg.k }); }

  // ② 宫位档
  const h = p.house;
  let hk = 1.0, hTag = '';
  if (ANGULAR.has(h)) { hk = 1.28; hTag = '角宫'; }
  else if (SUCCEDENT.has(h)) { hk = 1.06; hTag = '续宫'; }
  else if (h) { hk = 0.80; hTag = '果宫'; }
  if (hk !== 1) { strength *= hk; strengthMods.push({ k: '宫位', v: hTag, f: hk }); }

  // ③ 逆行：力量内化（整体仍增益，但方向向内）
  if (p.retro === true) { strength *= 1.10; strengthMods.push({ k: '逆行', v: '内化', f: 1.10 }); }

  // ④ 得时（hayz 简化）
  const daySet = new Set(['太阳', '木星', '土星']);
  const nightSet = new Set(['月亮', '金星', '火星']);
  if (ctx.isDay != null) {
    const hayz = (ctx.isDay && daySet.has(p.name)) || (!ctx.isDay && nightSet.has(p.name));
    if (hayz) { strength *= 1.15; strengthMods.push({ k: '得时', v: ctx.isDay ? '昼' : '夜', f: 1.15 }); }
  }

  // ⑤ 与太阳距角：灼伤/光束下
  if (typeof ctx.sunLon === 'number' && p.name !== '太阳') {
    const d = sepAt(p.lon, ctx.sunLon);
    if (d < 8.5) { strength *= 0.72; strengthMods.push({ k: '日光灼伤', v: d.toFixed(1) + '°', f: 0.72 }); }
    else if (d < 17) { strength *= 0.84; strengthMods.push({ k: '在光束下', v: d.toFixed(1) + '°', f: 0.84 }); }
  }`
);

// 相位部分：这些是**方向性**的，才进组内分布
s = s.replace(
  `  if (conjAmp !== 1) { for (const g of GROUPS) if (w[g]) w[g] *= conjAmp; mods.push({ k: '合相放大', v: conj.join('+') || '—', f: round(conjAmp) }); }`,
  `  // 合相 = 可见度放大（进 strength，不改组内配比）
  if (conjAmp !== 1) { strength *= conjAmp; strengthMods.push({ k: '合相放大', v: conj.join('+') || '—', f: round(conjAmp) }); }`
);
s = s.replace(
  `  if (hard.length) { w.官杀 = (w.官杀 || 0) * (1 + 0.10 * hard.length); w.比劫 = (w.比劫 || 0) * (1 + 0.06 * hard.length); mods.push({ k: '硬相位', v: hard.length + '条', f: 1.10 }); }
  if (soft.length) { w.印 = (w.印 || 0) * (1 + 0.08 * soft.length); w.食伤 = (w.食伤 || 0) * (1 + 0.05 * soft.length); mods.push({ k: '和谐相位', v: soft.length + '条', f: 1.08 }); }`,
  `  // ★ 硬/和谐相位 = 方向性修正，改变组内配比（这才是"什么时候偏哪个十神"）
  const aspectMods = [];
  if (hard.length) {
    const f = 1 + 0.10 * hard.length;
    w.官杀 = (w.官杀 || 0) * f; w.比劫 = (w.比劫 || 0) * (1 + 0.06 * hard.length);
    aspectMods.push({ k: '硬相位', v: hard.length + '条', f: round(f), dir: '→官杀/比劫' });
  }
  if (soft.length) {
    const f = 1 + 0.08 * soft.length;
    w.印 = (w.印 || 0) * f; w.食伤 = (w.食伤 || 0) * (1 + 0.05 * soft.length);
    aspectMods.push({ k: '和谐相位', v: soft.length + '条', f: round(f), dir: '→印/食伤' });
  }`
);

// 归一：加上小余数补偿，保证严格为 1
s = s.replace(
  `  const sum = GROUPS.reduce((a, g) => a + (w[g] || 0), 0) || 1;
  const pct = {};
  for (const g of GROUPS) pct[g] = round((w[g] || 0) / sum, 4);`,
  `  const sum = GROUPS.reduce((a, g) => a + (w[g] || 0), 0) || 1;
  const pct = {};
  for (const g of GROUPS) pct[g] = (w[g] || 0) / sum;
  // 余数补偿到最大组，确保严格和为 1
  const maxG = GROUPS.reduce((m, g) => (pct[g] > pct[m] ? g : m), GROUPS[0]);
  const diff = 1 - GROUPS.reduce((a, g) => a + pct[g], 0);
  pct[maxG] += diff;
  for (const g of GROUPS) pct[g] = round(pct[g], 6);`
);

s = s.replace(
  `    mods,
    conj: conj,`,
  `    mods: [...strengthMods, ...aspectMods],
    strength: round(strength, 4),
    strengthMods, aspectMods,
    conj: conj,`
);

fs.writeFileSync('src/cross/dynamic-ten-god.mjs', s, 'utf8');
console.log('✅ 已分离 strength 与组内分布');
