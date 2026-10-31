// 补口径：昼夜盘区分（三分性取主的必需前提）
// 古典规则：太阳在地平线以上 = 日盘（昼盘），以下 = 夜盘。
// 占星宫位里，第 7–12 宫在地平线之上（上升—下降轴把盘分成上下半球）。
import fs from 'node:fs';

let s = fs.readFileSync('src/western/reception.mjs', 'utf8');

/* ① 新增 isDayChart + 改 dignitiesOf 签名 */
if (!s.includes('export function isDayChart')) {
  s = s.replace(
    '/** 某星在某星座的尊贵类型（可能多重） */\nexport function dignitiesOf(planet, sign) {',
    `/** 判定日盘/夜盘：太阳在地平线以上（第 7–12 宫）为日盘 */
export function isDayChart(chart) {
  const P = chart?.planets;
  const sun = Array.isArray(P) ? P.find((x) => x?.name === '太阳') : P?.['太阳'];
  if (!sun || sun.house == null) return null;
  return sun.house >= 7;
}

/** 某星在某星座的尊贵类型（可能多重）
 *  @param {boolean|null} isDay 日盘=true 夜盘=false 未知=null（两者都算，但标"未判"） */
export function dignitiesOf(planet, sign, isDay = null) {`
  );
  console.log('① isDayChart 已加');
}

/* ② 三分性按昼夜取主 */
const OLD_TRIP = `  for (const [el, t] of Object.entries(TRIPLICITY)) {
    if (t.signs.includes(sign)) {
      if (t.day === planet) out.push({ type: '三分(昼)', score: 3 });
      else if (t.night === planet) out.push({ type: '三分(夜)', score: 3 });
      else if (t.part === planet) out.push({ type: '三分(参)', score: 2 });
    }
  }`;
const NEW_TRIP = `  for (const [el, t] of Object.entries(TRIPLICITY)) {
    if (t.signs.includes(sign)) {
      // ★ 昼夜盘决定取哪个三分主：日盘用昼主、夜盘用夜主（参与主两者皆可用，权重低）
      if (isDay === true) {
        if (t.day === planet) out.push({ type: '三分(昼)', score: 3 });
      } else if (isDay === false) {
        if (t.night === planet) out.push({ type: '三分(夜)', score: 3 });
      } else {
        // 未判昼夜：两者都给，但标"未判"，分值降半以免高估
        if (t.day === planet) out.push({ type: '三分(昼·未判)', score: 1.5 });
        else if (t.night === planet) out.push({ type: '三分(夜·未判)', score: 1.5 });
      }
      if (t.part === planet) out.push({ type: '三分(参)', score: 2 });
    }
  }`;
if (s.includes(OLD_TRIP)) { s = s.replace(OLD_TRIP, NEW_TRIP); console.log('② 三分性昼夜取主已改'); }
else console.log('② ⚠️ 未匹配三分性段');

/* ③ dignityScore 传 isDay */
s = s.replace('export function dignityScore(planet, sign) {\n  const d = dignitiesOf(planet, sign);',
  'export function dignityScore(planet, sign, isDay = null) {\n  const d = dignitiesOf(planet, sign, isDay);');

/* ④ hasDignity 传 isDay，且三分类型名要兼容"未判" */
s = s.replace("const TRIP = ['三分(昼)', '三分(夜)', '三分(参)'];",
  "const TRIP = ['三分(昼)', '三分(夜)', '三分(参)', '三分(昼·未判)', '三分(夜·未判)'];");
s = s.replace('const hasDignity = (planet, sign, kinds) => {\n  const d = dignitiesOf(planet, sign);',
  'const hasDignity = (planet, sign, kinds, isDay = null) => {\n  const d = dignitiesOf(planet, sign, isDay);');

/* ⑤ mutualReception 加 isDay 参数并下传 */
s = s.replace('export function mutualReception(pa, sa, pb, sb) {',
  'export function mutualReception(pa, sa, pb, sb, isDay = null) {');
s = s.replace('    trip: hasDignity(pb, sa, TRIP),', '    trip: hasDignity(pb, sa, TRIP, isDay),');
s = s.replace('    trip: hasDignity(pa, sb, TRIP),', '    trip: hasDignity(pa, sb, TRIP, isDay),');

/* ⑥ aspectEnergyFlow：先判昼夜，再全盘传下去 */
s = s.replace("  const dign = {};\n  for (const [name, p] of Object.entries(P)) {\n    if (!p?.sign) continue;\n    dign[name] = { score: dignityScore(name, p.sign), sign: p.sign, items: dignitiesOf(name, p.sign) };\n  }",
  `  // ★ 先判昼夜盘（三分性取主的前提）
  const isDay = isDayChart(chart);
  const dign = {};
  for (const [name, p] of Object.entries(P)) {
    if (!p?.sign) continue;
    dign[name] = { score: dignityScore(name, p.sign, isDay), sign: p.sign, items: dignitiesOf(name, p.sign, isDay) };
  }`);
s = s.replace('const rec = mutualReception(a, pa.sign, b, pb.sign);', 'const rec = mutualReception(a, pa.sign, b, pb.sign, isDay);');

/* ⑦ 返回值带上 isDay（便于前端显示） */
s = s.replace('return { flows: flows.sort((x, y) => y.amount - x.amount), receptions, netByPlanet, dignities: dign };',
  'return { flows: flows.sort((x, y) => y.amount - x.amount), receptions, netByPlanet, dignities: dign, isDay };');

/* ⑧ summarizeReception 输出 chord */
s = s.replace('    summary: {\n      receptionCount: receptions.length,',
  "    summary: {\n      chartType: e.isDay === true ? '日盘（昼）' : e.isDay === false ? '夜盘' : '未判定',\n      receptionCount: receptions.length,");

fs.writeFileSync('src/western/reception.mjs', s, 'utf8');
console.log('③ 全部改完');
