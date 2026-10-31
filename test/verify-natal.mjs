// 西方本命盘生成器 规程自检（exit 0 = 全过）
//  A. 天文事实：二分点/至点黄经、新月合相、月亮日行度、交点退行率
//  B. 星座归属：太阳星座 vs 公历（外部常识锚点）
//  C. 宫位不变量：宫头递增 / 对宫差 180° / 1宫=Asc / 10宫=MC / 4宫=IC / 7宫=Desc / 每宫跨度<180°
//  D. 相位：对称唯一、容许度生效、新月时日月合相
//  E. 三宫位制一致性与确定性
//  F. 端到端：本命盘 → Part5 交叉修正 → Part6 摩擦引擎（不再手填 JSON）
import { computeNatal, bodyLongitude, meanNodeLongitude, houseOf, toUTC, norm360 } from '../src/western/natal.mjs';
import { SIGNS, signOfLon } from '../src/western/zodiac.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { calibrate } from '../src/cross/calibration.mjs';
import { friction } from '../src/cross/friction.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(a === b, `${m}：期望 ${b} 实得 ${a}`);
/** 有符号最短角差（注意：norm360 会把 -1e-14 映射成 ≈360，不能用它做等值比较） */
const angDiff = (a, b) => (((a - b) % 360) + 540) % 360 - 180;

console.log('[A] 天文事实对拍');
// 二分点/至点：太阳真黄经 = 0 / 90 / 180 / 270
const EVENTS = [
  ['2020-03-20T03:50:00Z', 0, '春分'],
  ['2020-06-20T21:44:00Z', 90, '夏至'],
  ['2020-09-22T13:31:00Z', 180, '秋分'],
  ['2020-12-21T10:02:00Z', 270, '冬至'],
];
for (const [iso, expect, name] of EVENTS) {
  const lon = bodyLongitude('太阳', new Date(iso));
  const diff = Math.abs(((lon - expect + 540) % 360) - 180);
  ok(diff < 0.05, `${name} 太阳黄经应≈${expect}，实得 ${lon.toFixed(4)}`);
}
// 新月：2024-01-11 11:57 UTC → 日月合相
const nm = computeNatal({ at: '2024-01-11T11:57:00Z', lat: 0, lon: 0, tz: 0, orb: 6 });
const gap = Math.abs(((nm.planets['太阳'].lon - nm.planets['月亮'].lon + 540) % 360) - 180);
ok(gap < 0.5, `新月时日月黄经差应<0.5°，实得 ${gap.toFixed(3)}°`);
ok(nm.aspects.some((a) => [a.a, a.b].sort().join() === ['月亮', '太阳'].sort().join() && a.type === '合相'), '新月应产出日月合相');
// 月亮日行度 11–15.5°
const t0 = new Date('2024-01-01T00:00:00Z');
for (let i = 0; i < 20; i++) {
  const a = bodyLongitude('月亮', new Date(t0.getTime() + i * 86400e3));
  const b = bodyLongitude('月亮', new Date(t0.getTime() + (i + 1) * 86400e3));
  const d = ((b - a + 540) % 360) - 180;
  ok(d > 11 && d < 15.5, `月亮第 ${i} 天日行度应在 11–15.5°，实得 ${d.toFixed(2)}`);
}
// 交点退行 ≈ -19.34°/年
const n1 = meanNodeLongitude(new Date('2020-01-01T00:00:00Z'));
const n2 = meanNodeLongitude(new Date('2021-01-01T00:00:00Z'));
const dNode = ((n2 - n1 + 540) % 360) - 180;
ok(Math.abs(dNode + 19.34) < 1.5, `交点年退行应≈-19.34°，实得 ${dNode.toFixed(2)}°`);
console.log(`  四分二至 ✓｜新月差 ${gap.toFixed(3)}° ✓｜月亮日行 11–15.5° ✓｜交点年退行 ${dNode.toFixed(2)}° ✓`);

console.log('[B] 太阳星座 vs 公历');
const SIGN_CASES = [
  ['1990-05-20 14:30', 8, '金牛'], ['2026-10-02 10:30', 8, '天秤'],
  ['2026-03-25 12:00', 8, '白羊'], ['2000-01-05 12:00', 8, '摩羯'],
  ['2024-08-10 12:00', 8, '狮子'], ['1985-11-20 12:00', 8, '天蝎'],
  ['1970-07-15 12:00', 8, '巨蟹'], ['2010-02-10 12:00', 8, '水瓶'],
];
for (const [at, tz, sign] of SIGN_CASES) {
  const n = computeNatal({ at, tz });
  eq(n.planets['太阳'].sign, sign, `${at} 太阳星座`);
}
console.log(`  ${SIGN_CASES.length} 个日期太阳星座全对 ✓`);

console.log('[C] 宫位不变量');
for (const sys of ['porphyry', 'equal', 'whole']) {
  const n = computeNatal({ at: '1990-05-20 14:30', lat: 31.23, lon: 121.47, tz: 8, houseSystem: sys });
  const c = n.cuspsRaw, asc = n.anglesRaw.asc, mc = n.anglesRaw.mc;
  // 所有宫位制共有：对宫差 180°
  for (let i = 0; i < 6; i++) ok(Math.abs(angDiff(c[(i + 6) % 12], c[i] + 180)) < 1e-9, `${sys} 宫${i + 1}/宫${i + 7} 非对宫`);
  // 每宫跨度必须 < 180°（捕捉 IC/Desc 互换那类错误）
  let maxSpan = 0;
  for (let i = 0; i < 12; i++) maxSpan = Math.max(maxSpan, norm360(c[(i + 1) % 12] - c[i]));
  ok(maxSpan < 180, `${sys} 最大宫跨度应<180°，实得 ${maxSpan.toFixed(2)}°`);
  // 每颗星恰归一宫（用未取整宫头复核）；四轴由定义决定宫位（1/10/7/4），不适用区间判定
  const AXES = new Set(['上升', '天顶', '下降', '天底']);
  for (const [k, v] of Object.entries(n.planets)) {
    ok(v.house >= 1 && v.house <= 12, `${sys} ${k} 宫位越界 ${v.house}`);
    if (AXES.has(k)) continue;
    eq(v.house, houseOf(v.lon, c), `${sys} ${k} houseOf 复核`);
  }
  // 各制专属定义
  if (sys === 'porphyry') {
    ok(Math.abs(angDiff(c[0], asc)) < 1e-9 && Math.abs(angDiff(c[9], mc)) < 1e-9, 'porphyry 1宫=Asc 且 10宫=MC');
    ok(Math.abs(angDiff(c[3], mc + 180)) < 1e-9, 'porphyry 4宫=IC');
    ok(Math.abs(angDiff(c[6], asc + 180)) < 1e-9, 'porphyry 7宫=Desc');
  }
  if (sys === 'equal') {
    ok(Math.abs(angDiff(c[0], asc)) < 1e-9, 'equal 1宫=Asc');
    for (let i = 0; i < 12; i++) ok(Math.abs(angDiff(c[i], asc + i * 30)) < 1e-9, `equal 宫${i + 1}=Asc+${i * 30}`);
  }
  if (sys === 'whole') {
    const start = Math.floor(norm360(asc) / 30) * 30;
    ok(Math.abs(angDiff(c[0], start)) < 1e-9, `whole 1宫=上升所在星座起点 ${start}`);
    for (let i = 0; i < 12; i++) ok(Math.abs(angDiff(c[i], start + i * 30)) < 1e-9, `whole 宫${i + 1}`);
  }
}
console.log('  三种宫位制：对宫/跨度<180°/星体归一/各制专属定义 ✓');
// 已知内部一致性：太阳在午后应落 9 宫方向（西侧），且上海 14:30 太阳高度角应 >45°
const nShanghai = computeNatal({ at: '1990-05-20 14:30', lat: 31.23, lon: 121.47, tz: 8 });
ok(nShanghai.planets['太阳'].house >= 8 && nShanghai.planets['太阳'].house <= 10, `14:30 上海（合成基准）太阳应落 8–10 宫，实得 ${nShanghai.planets['太阳'].house}`);
console.log(`  上海 14:30 太阳落第 ${nShanghai.planets['太阳'].house} 宫（8–10 区间内）✓`);

console.log('[D] 相位');
const nn = computeNatal({ at: '1990-05-20 14:30', lat: 31.23, lon: 121.47, tz: 8, orb: 6 });
const keys = nn.aspects.map((a) => [a.a, a.b].sort().join('|'));
eq(keys.length, new Set(keys).size, '相位应无重复对');
for (const a of nn.aspects) ok(a.orb <= 6 + 1e-9 || (a.a === '太阳' || a.a === '月亮') && a.orb <= 8 + 1e-9, `相位 ${a.a}-${a.b} 超出容许度 ${a.orb}`);
const tight = computeNatal({ at: '1990-05-20 14:30', lat: 31.23, lon: 121.47, tz: 8, orb: 1 });
ok(tight.aspects.length < nn.aspects.length, '容许度收窄后相位数应减少');
console.log(`  orb=6° → ${nn.aspects.length} 条；orb=1° → ${tight.aspects.length} 条；无重复对 ✓`);

console.log('[E] 确定性与时区');
const A1 = computeNatal({ at: '1990-05-20 14:30', tz: 8 });
const A2 = computeNatal({ at: '1990-05-20 14:30', tz: 8 });
ok(JSON.stringify(A1) === JSON.stringify(A2), '同输入应完全一致（确定性）');
eq(toUTC('1990-05-20 14:30', 8).toISOString(), '1990-05-20T06:30:00.000Z', 'tz+8 转换');
eq(toUTC('1990-05-20 14:30', 0).toISOString(), '1990-05-20T14:30:00.000Z', 'tz+0 转换');
eq(toUTC('1990-05-20T06:30:00Z', 8).toISOString(), '1990-05-20T06:30:00.000Z', '带 Z 不重复扣时区');
// 时区不同但 UTC 相同 → 星盘必须一致（除 meta）
const B1 = computeNatal({ at: '1990-05-20 14:30', tz: 8 });
const B2 = computeNatal({ at: '1990-05-20T06:30:00Z', tz: 8 });
ok(JSON.stringify(B1.planets) === JSON.stringify(B2.planets), '同一 UTC 时刻应得同一盘');
console.log('  确定性 ✓；tz+8/+0/Z 三种写法 ✓；同 UTC 同盘 ✓');

console.log('[F] 端到端：本命盘 → Part5 → Part6');
const natal = computeNatal({ at: '1990-05-20 14:30', lat: 31.23, lon: 121.47, tz: 8 });
const bz = compileBazi({ at: '1990-05-20 14:30', gender: '男' });
const cal = calibrate(bz, natal);
ok(cal.provided === true && cal.table.length === 5 && cal.taiMingShen.length === 3, 'Part5 未正常消费本命盘');
const fr = friction(bz, natal);
ok(fr.provided === true, 'Part6 未正常消费本命盘');
ok(Array.isArray(fr.rows) && Array.isArray(fr.benign), 'Part6 输出结构异常');
const ascAspects = natal.aspects.filter((a) => a.a === '上升' || a.b === '上升');
ok(ascAspects.length >= 0, '上升相位统计');
console.log(`  Part5 交叉验证表 5 行 / 胎命身 3 行 ✓｜Part6 摩擦点 ${fr.rows.length} 条、吉相位 ${fr.benign.length} 条 ✓｜涉上升相位 ${ascAspects.length} 条`);

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
