// 凯龙星（Chiron）自检（exit 0 = 全过）
//  A 桥接可用性与数值  B ★框架：libephemeris 返回**日心**而非地心（视差 0.36–3.46°）  C 独立校验（JPL 根数开普勒）
//  D 宫位判定与专家基准一致（9 宫）  E 并入后九宫群星完整
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasChiron, chironLongitude, helioToGeo, keplerianChironHelioLon, keplerianHelio, CHIRON_ELEMENTS, signOf, degInSign, attachChiron, CHIRON_NAME } from '../src/western/chiron.mjs';
import { computeNatal } from '../src/western/natal.mjs';
import { eclipticLongitude } from '../src/western/zodiac.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);

if (!hasChiron()) {
  console.log('[chiron] SKIP：.venv 或 py/chiron.py 缺失');
  console.log('\nRESULT: PASS (skipped)');
  process.exit(0);
}

console.log('[A] 桥接可用性与数值');
const D = new Date(Date.UTC(2008, 3, 16, 2, 30));
const r = chironLongitude(D);
ok(typeof r.lon === 'number' && r.lon >= 0 && r.lon < 360, `黄经应在 0–360，实得 ${r.lon}`);
ok(r.dist > 8 && r.dist < 20, `日心距应在 8–20 AU（Chiron q=8.49、Q=18.9），实得 ${r.dist}`);
ok(/libephemeris/.test(r.source), '须记录来源');
console.log(`  2008-04-16 日心 ${r.lon.toFixed(3)}°｜黄纬 ${r.lat.toFixed(3)}°｜距 ${r.dist.toFixed(2)} AU ✓`);

console.log('[B] ★ 框架：该接口返回**日心**，必须转地心（否则静默错 3.8°）');
{
  const sunGeo = eclipticLongitude('太阳', D);
  const geo = helioToGeo(r, (sunGeo + 180) % 360);
  const para = Math.abs(((geo.lon - r.lon + 180) % 360) - 180);
  ok(para > 0.2, `视差应显著（实测 ${para.toFixed(2)}°），否则说明无需转换或实现有误`);
  ok(para < 4.0, `视差不应超过 atan(1/q)=${(Math.atan(1 / 8.49) * 180 / Math.PI).toFixed(2)}°，实得 ${para.toFixed(2)}°`);
  // ★ 核心回归钉：不转换会跨宫界（8 宫 vs 9 宫）
  const raw = computeNatal({ at: '2008-04-16 10:30', lng: 104.06, lat: 30.67, tz: 8 });
  const houseOf = (lon) => {
    const cusps = (raw.cuspsRaw ?? raw.cusps ?? []).map((c) => (typeof c === 'number' ? c : c?.lon));
    if (cusps.length !== 12) return null;
    for (let k = 0; k < 12; k++) { const s = cusps[k], t = cusps[(k + 1) % 12];
      if (((lon - s) % 360 + 360) % 360 < ((t - s) % 360 + 360) % 360) return k + 1; }
    return null;
  };
  eq(houseOf(r.lon), 8, '未转换（日心）应落 8 宫 —— 这正是"静默错"的样子');
  eq(houseOf(geo.lon), 9, '转换后（地心）应落 9 宫');
  ok(houseOf(r.lon) !== houseOf(geo.lon), '★ 框架转换必须改变宫位（否则本测试失去意义）');
  console.log(`  日心 ${r.lon.toFixed(2)}°→${houseOf(r.lon)}宫｜地心 ${geo.lon.toFixed(2)}°→${houseOf(geo.lon)}宫｜视差 ${para.toFixed(2)}° ✓`);
}

console.log('[C] 独立校验：JPL SBDB 根数开普勒传播');
{
  eq(CHIRON_ELEMENTS.period, 18500, '周期须为 18500 天（JPL）');
  ok(/3 significant/.test(CHIRON_ELEMENTS.source), '须标注根数只有 3 位有效数字（误差来源）');
  const kep = keplerianChironHelioLon(r.jd);
  const d = Math.abs(((kep - r.lon + 180) % 360) - 180);
  ok(d < 1.5, `两个独立来源的日心黄经应接近（<1.5°），实测差 ${d.toFixed(3)}°`);
  // 开普勒解自洽性：偏近点角代回轨道方程
  const { x, y, z } = keplerianHelio(r.jd);
  const rr = Math.sqrt(x * x + y * y + z * z);
  ok(rr > CHIRON_ELEMENTS.a * (1 - CHIRON_ELEMENTS.e) - 0.2 && rr < CHIRON_ELEMENTS.a * (1 + CHIRON_ELEMENTS.e) + 0.2,
    `开普勒半径 ${rr.toFixed(2)} AU 应落在 a(1±e) 区间`);
  console.log(`  开普勒 ${kep.toFixed(3)}° vs libephemeris ${r.lon.toFixed(3)}°｜Δ=${d.toFixed(3)}°｜r=${rr.toFixed(2)} AU ✓`);
}

console.log('[D] 宫位与专家基准一致');
{
  const raw = computeNatal({ at: '2008-04-16 10:30', lng: 104.06, lat: 30.67, tz: 8 });
  const w = attachChiron(raw, D, { eclipticLonOf: (dt) => eclipticLongitude('太阳', dt) });
  const c = w.planets[CHIRON_NAME];
  ok(c !== undefined, '须并入星盘');
  eq(c.sign, '水瓶', '凯龙星座应为水瓶');
  eq(c.house, 9, '★ 凯龙宫位应为 9（专家档案：九宫群星含凯龙）');
  ok(w.chironMeta.geocentric === true, '须标记已完成地心转换');
  ok(w.chironMeta.warning === null, '转换完成后不应有 warning');
  // 未传 eclipticLonOf 时必须**显式告警**，不得静默给日心值
  const noConv = attachChiron(raw, D);
  ok(/视差/.test(noConv.chironMeta.warning ?? ''), '缺 eclipticLonOf 时必须告警（防静默用日心值）');
  console.log(`  凯龙 ${c.sign} ${c.deg}° → ${c.house} 宫｜未转换时告警已就位 ✓`);
}

console.log('[E] 并入后九宫群星完整（专家基准：海王星、北交点、凯龙）');
{
  const raw = computeNatal({ at: '2008-04-16 10:30', lng: 104.06, lat: 30.67, tz: 8 });
  const w = attachChiron(raw, D, { eclipticLonOf: (dt) => eclipticLongitude('太阳', dt) });
  const AX = ['上升', '下降', '天顶', '天底'];
  const h9 = Object.entries(w.planets).filter(([k, v]) => v.house === 9 && !AX.includes(k)).map(([k]) => k).sort();
  eq(h9.join('、'), ['北交点', '海王星', CHIRON_NAME].sort().join('、'), '九宫群星须与专家一致');
  ok(!h9.includes('下降'), '轴点不得计入群星（七宫群星曾因含「下降」而假不一致）');
  console.log(`  九宫群星：${h9.join('、')} ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
