// 接入 /api/timeline：三钟对齐（大运/流年 × 次运/行运）
import fs from 'node:fs';

let s = fs.readFileSync('server.mjs', 'utf8');
if (s.includes("api/timeline")) { console.log('已接入'); process.exit(0); }

/* ① import */
s = s.replace(
  "import { summarizeReception } from './src/western/reception.mjs';",
  "import { summarizeReception } from './src/western/reception.mjs';\nimport { buildTimeline } from './src/cross/timeline.mjs';"
);

/* ② 加 apiTimeline（放在 ROUTES 之前） */
const FN = `
/** 三钟对齐：八字大运/流年 × 占星次运/行运 */
function apiTimeline(b) {
  const at = b?.at;
  if (!at) throw new Error('需要 at（出生时刻）');
  const birth = parseAtLocal(at, b.tz ?? 8);
  const bz = apiBazi(b);
  const tl = buildTimeline({
    birth,
    gender: b.gender ?? '男',
    pillars: bz.pillars,
    lng: b.lng ?? 116.407,
    lat: b.lat ?? 39.904,
    tz: b.tz ?? 8,
    fromYear: Number(b.fromYear ?? birth.getFullYear()),
    toYear: Number(b.toYear ?? birth.getFullYear() + 80),
  });
  return {
    range: tl.range,
    // 时间轴逐行（默认只回前 40 年，避免响应过大）
    rows: tl.rows.slice(0, Number(b.limit ?? 40)),
    transitions: tl.transitions,
    alignment: tl.alignment,
    supplement: tl.supplement,
    clockNote: '四钟刻度：大运 10 年/步｜流年 1 年（60 甲子）｜次运 1 天=1 年（象征推进）｜行运 实时天象。只能按"年份"对齐，不能互相换算。',
  };
}

/** 把 'YYYY-MM-DD HH:mm' 按指定时区解析成 Date */
function parseAtLocal(at, tz) {
  const m = String(at).match(/^(\\d{4})-(\\d{2})-(\\d{2})[ T](\\d{2}):(\\d{2})/);
  if (!m) throw new Error('at 格式应为 YYYY-MM-DD HH:mm');
  const [, y, mo, d, hh, mi] = m;
  const sign = tz >= 0 ? '+' : '-';
  const hh2 = String(Math.abs(tz)).padStart(2, '0');
  return new Date(\`\${y}-\${mo}-\${d}T\${hh}:\${mi}:00\${sign}\${hh2}:00\`);
}

`;
s = s.replace('const ROUTES = {', FN + 'const ROUTES = {');
s = s.replace("'/api/liuren': apiLiuren,", "'/api/liuren': apiLiuren, '/api/timeline': apiTimeline,");

/* ③ 路由注释 */
s = s.replace('//       POST /api/synastry  {a:{...}, b:{...}}              ← 合盘',
  '//       POST /api/timeline  {at, lng, lat, tz, gender, fromYear, toYear}  ← 三钟对齐（大运/流年 × 次运/行运）\n//       POST /api/synastry  {a:{...}, b:{...}}              ← 合盘');

fs.writeFileSync('server.mjs', s, 'utf8');
console.log('server.mjs：/api/timeline 已接入');
