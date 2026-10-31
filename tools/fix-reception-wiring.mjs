// 修：把 summarizeReception 从 server.mjs 挪进 reception.mjs（避免 PowerShell 吃掉模板字符串）
import fs from 'node:fs';

/* ① 清理 server.mjs 里被写坏的那段 */
let s = fs.readFileSync('server.mjs', 'utf8');
const start = s.indexOf('/** 互容结构的对外摘要（自然语言，不含内部编号） */');
const end = s.indexOf('// ★ 路由层装饰：给 fusion 结果附上「对应关系补充块」');
if (start > 0 && end > start) {
  s = s.slice(0, start) + s.slice(end);
  console.log('① server.mjs 坏段已删除');
}
// 改 import：加上 summarizeReception
s = s.replace(
  "import { aspectEnergyFlow, mutualReception, dignityScore, dignitiesOf, RECEPTION_GRADE } from './src/western/reception.mjs';",
  "import { summarizeReception } from './src/western/reception.mjs';"
);
fs.writeFileSync('server.mjs', s, 'utf8');

/* ② 把函数追加到 reception.mjs */
let r = fs.readFileSync('src/western/reception.mjs', 'utf8');
if (!r.includes('export function summarizeReception')) {
  r += `
/* ══════════ 五、对外摘要（自然语言，服务端输出用） ══════════ */
export function summarizeReception(chart) {
  const e = aspectEnergyFlow(chart);
  const gname = (g) => (RECEPTION_GRADE[g]?.name ?? '无互容');

  const receptions = e.receptions.map((r) => ({
    a: r.a + '@' + r.aSign,
    b: r.b + '@' + r.bSign,
    aspect: r.type,
    grade: r.grade,
    gradeName: gname(r.grade),
    score: r.score,
    aInB: r.aInB ?? null,
    bInA: r.bInA ?? null,
    note: r.note,
  }));

  const flows = e.flows.slice(0, 12).map((f) => ({
    from: f.from,
    to: f.to,
    aspect: f.type,
    fromDignity: f.fromDignity,
    toDignity: f.toDignity,
    amount: f.amount,
    carryingDignity: f.carryingDignity,
    reception: f.reception === 'none' ? null : gname(f.reception),
    smooth: f.smooth,
  }));

  const byGrade = {};
  for (const r of e.receptions) { const k = gname(r.grade); byGrade[k] = (byGrade[k] ?? 0) + 1; }

  return {
    receptions,
    flows,
    netByPlanet: e.netByPlanet,
    summary: {
      receptionCount: receptions.length,
      flowCount: e.flows.length,
      byGrade,
      note: '互容按古典尊贵体系判定（庙>旺>三分）；失势星（陷/落）不作为待客之所。相位全程输送能量，落陷亦可经由「携带其尊贵」的星获得补给。',
    },
  };
}
`;
  fs.writeFileSync('src/western/reception.mjs', r, 'utf8');
  console.log('② summarizeReception 已加入 reception.mjs');
}
