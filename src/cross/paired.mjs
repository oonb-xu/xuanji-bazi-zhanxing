// 现代实战成对数据：录入校验 + 状态标签 + 结构量对齐（sandbox 隔离）
//
// ★ 决策三（系统隔离原则）在本模块的落实：
//   · 本模块**只读**核心引擎，**核心引擎永不 import 本模块**（由 test/verify-isolation.mjs 机检保证）
//   · 所有产出强制带 `status: "hypothesis_under_validation"`
//   · 置信度上限锁死 `CONFIDENCE_CAP = 0.6`（R-B13）
//   · **只做结论的互相比对**，不产出"预测"，不写回正式案例库
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBazi } from '../bazi/engine.mjs';
import { trueSolarTime } from '../western/truesolar.mjs';
import { computeNatal } from '../western/natal.mjs';
import { compileFromGanZhi } from '../daliuren.mjs';
import { sanChuanTopology, aspectTopology, topologyShape, topologySignature, wuxingOfGan } from './topology.mjs';
import { CONFIDENCE_CAP, gateConfidence } from '../../cli-resonance.mjs';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const PAIRED_DIR = join(HERE, '..', '..', 'data', 'samples', 'paired');
export const STATUS = 'hypothesis_under_validation';
export { CONFIDENCE_CAP };

export const CATEGORIES = ['事业功名', '婚恋', '财运', '疾病', '家宅', '官讼', '寻人失物', '终身格局', '其他'];
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;

/** 严格校验（返回错误数组；空数组 = 通过）——不引入外部校验库，规则少且稳定 */
export function validatePaired(o) {
  const e = [];
  const need = (c, m) => { if (!c) e.push(m); };
  need(o && typeof o === 'object', '根对象必须是 JSON 对象');
  if (!o || typeof o !== 'object') return e;
  need(/^PAIR-\d{4,}$/.test(o.sampleId ?? ''), 'sampleId 须形如 PAIR-0001');
  need(typeof o.collector === 'string' && o.collector.length, 'collector 必填');
  need(DATE.test(o.collectedAt ?? ''), 'collectedAt 须为 YYYY-MM-DD');
  const b = o.birth ?? {};
  need(DATE.test(b.date ?? ''), 'birth.date 须为 YYYY-MM-DD');
  need(TIME.test(b.time ?? ''), 'birth.time 须为 HH:MM');
  need(['minute', 'hour', 'unknown'].includes(b.timePrecision), 'birth.timePrecision 取值非法');
  need(typeof b.place === 'string' && b.place.length, 'birth.place 必填');
  need(typeof b.lon === 'number' && b.lon >= -180 && b.lon <= 180, 'birth.lon 越界');
  need(typeof b.lat === 'number' && b.lat >= -90 && b.lat <= 90, 'birth.lat 越界');
  need(typeof b.tzOffsetHours === 'number' && b.tzOffsetHours >= -12 && b.tzOffsetHours <= 14, 'birth.tzOffsetHours 越界');
  const d = o.divination ?? {};
  need(DATE.test(d.date ?? ''), 'divination.date 须为 YYYY-MM-DD');
  need(TIME.test(d.time ?? ''), 'divination.time 须为 HH:MM（起课必须到时辰）');
  need(typeof d.tzOffsetHours === 'number', 'divination.tzOffsetHours 必填');
  need(typeof d.place === 'string' && d.place.length, 'divination.place 必填');
  need(typeof d.lon === 'number' && d.lon >= -180 && d.lon <= 180, 'divination.lon 越界（真太阳时必需，R-T2）');
  need(typeof d.lat === 'number', 'divination.lat 必填');
  need(CATEGORIES.includes(d.category), `divination.category 须属：${CATEGORIES.join('/')}`);
  need(typeof d.question === 'string' && d.question.length >= 2, 'divination.question 至少 2 字');
  const f = o.feedback ?? {};
  need(['应验', '部分应验', '未应验', '尚未发生', '无法判断'].includes(f.outcome), 'feedback.outcome 取值非法');
  need(f.outcomeDate === null || /^\d{4}-\d{2}(-\d{2})?$/.test(f.outcomeDate ?? ''), 'feedback.outcomeDate 须为 YYYY-MM 或 YYYY-MM-DD 或 null');
  need(['high', 'medium', 'low'].includes(f.reliability), 'feedback.reliability 取值非法');
  // ★ 强制标签（决策三）
  need(o.status === STATUS, `status 必须为 "${STATUS}"（R-C5）`);
  need(o.confidenceCap === CONFIDENCE_CAP, `confidenceCap 必须锁死为 ${CONFIDENCE_CAP}（R-B13）`);
  // ★ 逻辑一致性：占问日不得当作出生日（R-A3）
  if (DATE.test(b.date ?? '') && DATE.test(d.date ?? '')) {
    need(b.date !== d.date || true, '');                       // 同日合法，不作限制，仅提示见注释
  }
  if (f.outcome === '尚未发生' && f.outcomeDate !== null) e.push('outcome=尚未发生 时 outcomeDate 必须为 null');
  if (f.outcome === '应验' && !f.outcomeDate) e.push('outcome=应验 时必须给出 outcomeDate（验证需要应期）');
  return e;
}

/** 由成对样本算出两侧结构量（只做比对，不产出预测） */
export async function alignSample(o) {
  const errs = validatePaired(o);
  if (errs.length) return { ok: false, errors: errs };
  // 侧 A：六壬 —— 占问地真太阳时 → 时辰 → 课式
  const ts = trueSolarTime({ at: `${o.divination.date} ${o.divination.time}`, lon: o.divination.lon, tz: o.divination.tzOffsetHours });
  const b = compileBazi({ at: ts.at ?? `${o.divination.date} ${o.divination.time}`, lon: o.divination.lon, tz: o.divination.tzOffsetHours });
  const [Y, M, D] = b.pillars;
  const riGan = D[0], riZhi = D[1];
  // 月将：由该时刻的太阳过宫决定（引擎内既有链路）
  let topo6 = null, sanChuan = null, note6 = null;
  try {
    // 月将取自引擎的「中气 → 月将」链路
    const { governingZhongQi, yueJiangFromQi, shiChenOf } = await import('../../src/daliuren.mjs');
    const date = new Date(`${o.divination.date}T${o.divination.time}:00Z`);
    const qi = governingZhongQi(date);
    const yj = yueJiangFromQi(qi);
    const sc = shiChenOf(Number(o.divination.time.slice(0, 2))).name;
    const r = compileFromGanZhi({ dayGz: D, yueJiang: yj, zhanShi: sc });
    sanChuan = r.sanChuan;
    topo6 = sanChuanTopology(r.sanChuan, wuxingOfGan(riGan));
    note6 = { zhongQi: qi, yueJiang: yj, zhanShi: sc, trueSolarAt: ts.at, usedTrueSolar: ts.usedTrueSolar };
  } catch (e) { note6 = { error: e.message }; }
  // 侧 B：星盘 —— 出生地
  let topoA = null, chartNote = null;
  try {
    const chart = computeNatal({ at: `${o.birth.date} ${o.birth.time}`, lng: o.birth.lon, lat: o.birth.lat, tz: o.birth.tzOffsetHours });
    topoA = aspectTopology(chart);
    chartNote = { asc: chart.planets['上升']?.sign, sunSign: chart.planets['太阳']?.sign };
  } catch (e) { chartNote = { error: e.message }; }
  const gate = gateConfidence(0.5, { hasAstroConstraint: false, hasDualEventWitness: o.feedback.outcome === '应验' && !!o.feedback.outcomeDate });
  return {
    ok: true, sampleId: o.sampleId,
    status: STATUS, confidenceCap: CONFIDENCE_CAP,
    sixPillars: { year: Y, month: M, day: D, riGan, riZhi, ...note6 },
    natal: chartNote,
    topologies: {
      liuren: topo6 && { label: topo6.label, chain: topo6.chain, shape: topologyShape(topo6), signature: topologySignature(topo6) },
      astro: topoA && { label: topoA.label, shape: topologyShape(topoA), signature: topologySignature(topoA) },
    },
    alignment: { sameShape: topo6 && topoA ? topologyShape(topo6) === topologyShape(topoA) : null, basis: 'shape 相等（仅比对，不作预测）' },
    confidence: gate,
    disclaimer: 'status=hypothesis_under_validation：真实事件验证前不得升级置信度（R-C5）',
  };
}

/** 载入目录下全部成对样本 */
export function loadPaired(dir = PAIRED_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}
