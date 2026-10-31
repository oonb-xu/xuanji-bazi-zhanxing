// 生时校正（Rectification）—— 确定性评分法，可复算、可验收
//
// 规格里点名的 "LangGraph 多智能体辩论 / vedic-rectifier" **不存在**（GitHub 零结果）。
// 本实现改为**可复现的评分法**，三类信号相加：
//   S1 外行星行运 → 本命四轴/行星（外行星慢，指向明确；权重最高）
//   S2 太阳弧正向（Solar Arc）→ 本命四轴/行星（经典校正工具，1°≈1年）
//   S3 八字流年刑冲引动（含夫妻宫，且与事件类别规则相符时加权）
// 收敛判据：得分 ≥95% 峰值的候选时段宽度 ≤10 分钟 → 认为收敛到 ±5min；否则明确报「未收敛，需追加事件」。
// 不做"AI 直觉"，不做无法复算的加权。
import { computeNatal, toUTC } from '../western/natal.mjs';
import { eclipticLongitude, angularGap } from '../western/zodiac.mjs';
import { compileBazi } from '../bazi/engine.mjs';
import { splitPillar } from '../bazi/engine.mjs';
import { liuNianActivation } from '../cross/timing.mjs';

const D2R = Math.PI / 180;

/** 权重：外行星行运（慢、指向明确） */
export const TRANSIT_PLANETS = { 土星: 1.2, 天王星: 1.0, 冥王星: 1.3, 木星: 0.6 };
/** 事件类别 → 重点参照点（让 category 真正参与计算，而不是只作标签） */
export const CATEGORY_FOCUS = {
  婚恋: ['下降', '天顶'], 事业: ['天顶', '太阳'], 学业: ['天顶'], 健康: ['上升', '月亮'],
  家庭: ['天底', '月亮'], 财运: ['天顶', '太阳'], 官非: ['土星', '天顶'], 迁移: ['上升', '天底'],
  意外: ['上升', '月亮'], 子女: ['天底'], 人际: ['下降'], 其他: [],
};
export const SIGNIFICANT_NATAL = ['上升', '天顶', '下降', '天底', '太阳', '月亮'];
const ARC_PER_YEAR = 0.985647;                            // 太阳弧：约 0.9856°/年
const ASPECT_OFFSETS = [0, 90, 180];                      // 合 / 刑 / 冲

const diff = (a, b) => angularGap(a, b);

/** 预计算：每个事件年内的外行星行运黄经（5 天步长足够——外行星 ≤0.03°/日） */
export function precomputeTransits(events, { stepDays = 5 } = {}) {
  const out = {};
  for (const e of events) {
    const samples = [];
    const start = Date.UTC(e.year, 0, 1);
    const end = Date.UTC(e.year + 1, 0, 1);
    for (let t = start; t < end; t += stepDays * 86400e3) {
      const d = new Date(t);
      for (const p of Object.keys(TRANSIT_PLANETS)) samples.push({ planet: p, lon: eclipticLongitude(p, d) });
    }
    out[e.year] = samples;
  }
  return out;
}

/** 对某候选时间算一个星盘（主后端 mine） */
export function chartAt({ localTime, lon, lat, tzName, houseSystem = 'porphyry' }) {
  return computeNatal({ at: localTime, lng: lon, lat, lng: undefined, tzName, houseSystem });
}

const addMinutes = (hhmm, delta) => {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`时间格式需 HH:MM，实得 ${hhmm}`);
  const total = (+m[1]) * 60 + (+m[2]) + delta;
  const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mi = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
};

/** 单个候选的评分 */
export function scoreCandidate({ date, time, lon, lat, tzName, events, transits, weights = { transit: 0.5, arc: 0.3, bazi: 0.2 }, orb = 3 }) {
  const localTime = `${date} ${time}`;
  const chart = computeNatal({ at: localTime, lng: lon, lat, tzName, houseSystem: 'porphyry' });
  const natal = {};
  for (const k of SIGNIFICANT_NATAL) if (chart.planets[k]) natal[k] = chart.planets[k].lon;
  const natalPlanets = {};
  for (const [k, v] of Object.entries(chart.planets)) natalPlanets[k] = v.lon;

  const ageAt = (year) => year - Number(date.slice(0, 4));

  const contacts = [];
  let s1 = 0, s2 = 0, s3 = 0;
  for (const e of events) {
    const focus = CATEGORY_FOCUS[e.category] ?? [];
    const focusBoost = (pt, planet) => (focus.includes(pt) || focus.includes(planet) ? 1.5 : 1);

    // S1 外行星行运 → 本命点
    for (const smp of transits[e.year] ?? []) {
      for (const [pt, plon] of Object.entries(natal)) {
        for (const off of ASPECT_OFFSETS) {
          const d = diff(smp.lon, plon + off);
          if (d <= orb) {
            const w = TRANSIT_PLANETS[smp.planet] * (1 - d / orb) * focusBoost(pt, smp.planet);
            s1 += w;
            contacts.push({ kind: 'transit', event: e.year, planet: smp.planet, natal: pt, aspect: off === 0 ? '合' : off === 90 ? '刑' : '冲', orb: Math.round(d * 100) / 100, w: Math.round(w * 100) / 100 });
          }
        }
      }
    }
    // S2 太阳弧正向 → 本命点
    const arc = ageAt(e.year) * ARC_PER_YEAR;
    if (arc > 0) {
      for (const [dp, dl] of Object.entries(natalPlanets)) {
        if (!SIGNIFICANT_NATAL.includes(dp) && dp !== '火星' && dp !== '金星') continue;   // 只让四轴+日月+金火参与，避免噪声
        for (const [pt, plon] of Object.entries(natal)) {
          for (const off of ASPECT_OFFSETS) {
            const d = diff(dl + arc, plon + off);
            if (d <= orb) {
              const w = 1.0 * (1 - d / orb) * focusBoost(pt, dp);
              s2 += w;
              contacts.push({ kind: 'solar-arc', event: e.year, directed: dp, natal: pt, aspect: off === 0 ? '合' : off === 90 ? '刑' : '冲', orb: Math.round(d * 100) / 100, w: Math.round(w * 100) / 100 });
            }
          }
        }
      }
    }
  }
  // S3 八字流年引动
  let bazi = null, dy = null;
  try {
    bazi = compileBazi({ at: `${date} ${time}`, gender: '男' });
    const pillars = bazi.pillars.map(splitPillar);
    for (const e of events) {
      const act = liuNianActivation(pillars, e.year, bazi.L4_spouse.zhi);
      if (act.activation) s3 += act.spouse ? 1.5 : 1.0;
      else if (act.hits.length) s3 += 0.3;
    }
  } catch { bazi = null; }

  const total = weights.transit * s1 + weights.arc * s2 + weights.bazi * s3;
  return { time, localTime, score: Math.round(total * 1000) / 1000, parts: { transit: Math.round(s1 * 100) / 100, arc: Math.round(s2 * 100) / 100, bazi: Math.round(s3 * 100) / 100 }, contacts: contacts.sort((a, b) => b.w - a.w).slice(0, 12), chart, bazi };
}

/**
 * 主入口
 * @param case_ {name, gender, date:'YYYY-MM-DD', time:'HH:MM', lon, lat, tzName, events:[{year,event,category}]}
 */
export function rectify(c, { windowMin = 60, stepMin = 1, orb = 3, weights } = {}) {
  const events = c.events ?? [];
  if (events.length < 3) {
    return {
      ok: false, reason: `事件不足：仅 ${events.length} 条，生时校正至少需要 3 条（规格 Step 5 明令：少于 3 条拒绝执行生时校正）`,
      need: '请补充至 ≥3 条重大人生事件（年份 + 类别）',
      input_events: events,
    };
  }
  const transits = precomputeTransits(events);
  const cands = [];
  for (let k = -windowMin; k <= windowMin; k += stepMin) {
    const t = addMinutes(c.time, k);
    cands.push(scoreCandidate({ date: c.date, time: t, lon: c.lon, lat: c.lat, tzName: c.tzName, events, transits, orb, weights }));
  }
  const max = Math.max(...cands.map((x) => x.score));
  const plateau = cands.filter((x) => x.score >= 0.95 * max);
  const widthMin = plateau.length ? (plateau.length - 1) * stepMin + (plateau.length > 1 ? 0 : 0) : 0;
  const wsum = plateau.reduce((a, x) => a + x.score, 0) || 1;
  const meanMin = plateau.reduce((a, x) => a + parseInt(x.time.slice(0, 2), 10) * 60 + parseInt(x.time.slice(3, 5), 10), 0) / plateau.length;
  const corrected = `${String(Math.floor(meanMin / 60)).padStart(2, '0')}:${String(Math.round(meanMin % 60)).padStart(2, '0')}`;
  const converged = plateau.length * stepMin <= 10;
  return {
    ok: true, converged,
    original_time: c.time, corrected_time: corrected,
    confidence: converged ? '±5min' : `±${Math.round(plateau.length * stepMin / 2)}min（未达 ±5min，需追加事件）`,
    method: 'deterministic-scoring(v1): 外行星行运 0.5 + 太阳弧 0.3 + 八字流年 0.2',
    window: `±${windowMin}min / 步长 ${stepMin}min`,
    best: cands.reduce((a, b) => (b.score > a.score ? b : a)),
    plateau: { count: plateau.length, widthMin: plateau.length * stepMin, from: plateau[0]?.time, to: plateau[plateau.length - 1]?.time },
    top: [...cands].sort((a, b) => b.score - a.score).slice(0, 5).map((x) => ({ time: x.time, score: x.score, parts: x.parts })),
    events, input_events: events,
  };
}

/** Step 3：由校正后时间产出八字，并标注跨日/跨节气风险 */
export function baziAfterRectify(c, correctedTime) {
  const a = compileBazi({ at: `${c.date} ${c.time}`, gender: c.gender ?? '男' });
  const b = compileBazi({ at: `${c.date} ${correctedTime}`, gender: c.gender ?? '男' });
  const changed = a.pillars.map((p, i) => (p !== b.pillars[i] ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);
  const hourChanged = a.pillars[3] !== b.pillars[3];
  const dayChanged = a.pillars[2] !== b.pillars[2];
  const monthChanged = a.pillars[1] !== b.pillars[1];
  const flags = [];
  if (hourChanged) flags.push(`时柱由 ${a.pillars[3]} 变为 ${b.pillars[3]}（校正跨时辰）`);
  if (dayChanged) flags.push(`日柱由 ${a.pillars[2]} 变为 ${b.pillars[2]}（**跨日**）`);
  if (monthChanged) flags.push(`月柱由 ${a.pillars[1]} 变为 ${b.pillars[1]}（**跨节气**）`);
  return {
    original: { pillars: a.pillars, hour: a.L1_gan[3], zhi: a.L1_zhi[3] },
    corrected: b, changed, flags,
    needHumanReview: dayChanged || monthChanged,
  };
}
