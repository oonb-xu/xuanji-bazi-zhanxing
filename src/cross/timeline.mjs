// 三钟对齐：八字大运 / 流年 × 占星次运 / 行运
//
// 用户命题（2026-10-27）：
//   「把次运盘、行运盘…做，并且试图和大运融合（副运类似于流年，但是年限有区别，
//     你把不互通的部分当成补充内容）」
//
// ★ 四个钟的刻度
//   八字大运  10 年/步        （10 天干循环 × 地支）
//   八字流年   1 年/单位       （60 甲子循环）
//   占星次运   1 天 = 1 年     （象征性推进：出生后 N 天 = N 岁）
//   占星行运   实时           （土星 29.5y / 木星 12y / 太阳 1y）
//
// ★ 两种关系要分开
//   【互通】"哪一年" 是共同坐标 ⇒ 可对齐、可并列
//   【不互通】两边的"好坏/强度"不是同一量纲 ⇒ **并排不合并，作为补充内容**
import { computeNatal } from '../western/natal.mjs';
import { aspectEnergyFlow, dignityScore, isDayChart } from '../western/reception.mjs';
import { daYun } from './timing.mjs';

const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/* ══════════ 时间工具 ══════════ */
const pad = (n) => String(n).padStart(2, '0');
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

/** 年干支（以立春为界近似：用公历年 + 简单偏移；正式流年应查节气） */
export function yearGanZhi(year) {
  // 1984 = 甲子
  const i = ((year - 1984) % 60 + 60) % 60;
  return GAN[i % 10] + ZHI[i % 12];
}

/** 次运时刻：出生后 N 天（1 天 = 1 年） */
export function progressionAt(birth, ageYears) {
  const d = new Date(birth.getTime());
  d.setDate(d.getDate() + Math.floor(ageYears));
  return d;
}

/** 行运时刻：出生后 N 年（同月同日同时） */
export function transitAt(birth, ageYears) {
  const d = new Date(birth.getTime());
  d.setFullYear(d.getFullYear() + Math.floor(ageYears));
  return d;
}

/* ══════════ 单年快照 ══════════ */
/**
 * @param {object} o
 *   o.birth        Date
 *   o.lng,o.lat,o.tz
 *   o.pillars      八字四柱（字符串数组），用于取大运
 *   o.gender
 *   o.dayun        已算好的大运（可选，省重复计算）
 */
function snapshotForYear(o, age, year) {
  const birth = o.birth;
  const prog = progressionAt(birth, age);
  const tran = transitAt(birth, age);

  // ── 次运盘 ──
  let pc = null;
  try { pc = computeNatal({ at: fmt(prog), lng: o.lng, lat: o.lat, tz: o.tz }); } catch { }
  // ── 行运盘 ──
  let tc = null;
  try { tc = computeNatal({ at: fmt(tran), lng: o.lng, lat: o.lat, tz: o.tz }); } catch { }

  const pick = (chart, names) => {
    const out = {};
    const P = chart?.planets;
    if (!P) return out;
    const get = (n) => (Array.isArray(P) ? P.find((x) => x.name === n) : P[n]);
    for (const n of names) {
      const p = get(n);
      if (p) out[n] = { sign: p.sign, deg: Math.round((p.deg ?? 0) * 10) / 10, house: p.house ?? null, lon: p.lon ?? null };
    }
    return out;
  };

  return {
    year, age,
    bazi: {
      liunian: yearGanZhi(year),
      dayun: null,        // 由外层填
      dayunIndex: null,
    },
    astro: {
      progressionDate: fmt(prog),
      transitDate: fmt(tran),
      progression: pick(pc, ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星']),
      transit: pick(tc, ['木星', '土星', '天王星', '海王星', '冥王星']),
      progressionIsDay: pc ? isDayChart(pc) : null,
      transitIsDay: tc ? isDayChart(tc) : null,
    },
  };
}

/* ══════════ ★ 三钟对齐主函数 ══════════ */
export function buildTimeline(o) {
  const { birth, gender, pillars, lng, lat, tz } = o;
  const dy = o.dayun ?? daYun(pillars, birth, gender);
  const birthYear = birth.getFullYear();
  const from = o.fromYear ?? birthYear;
  const to = o.toYear ?? birthYear + 80;

  const rows = [];
  for (let y = from; y <= to; y++) {
    const age = y - birthYear;
    if (age < 0) continue;
    const s = snapshotForYear({ birth, lng, lat, tz }, age, y);
    // 找当前大运
    const step = dy.steps.find((st) => age >= st.startAge && age < st.startAge + 10);
    if (step) {
      s.bazi.dayun = step.ganzhi;
      s.bazi.dayunIndex = dy.steps.indexOf(step);
      s.bazi.dayunRange = `${step.startAge}-${step.startAge + 10} 岁`;
      s.bazi.dayunYears = `${step.startYear}-${step.startYear + 10}`;
    }
    rows.push(s);
  }

  /* ── 互通层：年份是共同坐标 ── */
  const transitions = {
    dayunChange: [],      // 八字大运换步
    liunianCycle: [],     // 60 甲子回到起点
    progMoonSign: [],     // 次运月亮换座（约 2.3 年一次）
    progSunSign: [],      // 次运太阳换座（约 1 年一次）
    transitJupiterHouse: [],
    transitSaturnHouse: [],
  };
  let prev = null;
  for (const r of rows) {
    if (prev) {
      if (r.bazi.dayun !== prev.bazi.dayun && r.bazi.dayun) transitions.dayunChange.push({ year: r.year, age: r.age, from: prev.bazi.dayun, to: r.bazi.dayun });
      if (r.astro.progression['月亮']?.sign !== prev.astro.progression['月亮']?.sign && r.astro.progression['月亮']?.sign)
        transitions.progMoonSign.push({ year: r.year, age: r.age, from: prev.astro.progression['月亮'].sign, to: r.astro.progression['月亮'].sign });
      if (r.astro.progression['太阳']?.sign !== prev.astro.progression['太阳']?.sign && r.astro.progression['太阳']?.sign)
        transitions.progSunSign.push({ year: r.year, age: r.age, to: r.astro.progression['太阳'].sign });
      if (r.astro.transit['土星']?.house !== prev.astro.transit['土星']?.house && r.astro.transit['土星']?.house)
        transitions.transitSaturnHouse.push({ year: r.year, age: r.age, to: r.astro.transit['土星'].house });
      if (r.astro.transit['木星']?.house !== prev.astro.transit['木星']?.house && r.astro.transit['木星']?.house)
        transitions.transitJupiterHouse.push({ year: r.year, age: r.age, to: r.astro.transit['木星'].house });
    }
    prev = r;
  }

  /* ── 不互通层：并排作为补充内容 ── */
  const supplement = {
    note: '以下两层**不可合并**，只并排陈列。',
    baziClock: {
      name: '八字',
      units: [
        { label: '大运', period: '10 年/步', count: dy.steps.length, kind: '干支序列' },
        { label: '流年', period: '1 年', count: rows.length, kind: '60 甲子循环' },
      ],
    },
    astroClock: {
      name: '占星',
      units: [
        { label: '次运（副运）', period: '1 天=1 年（象征性推进）', count: rows.length, kind: '天象推进' },
        { label: '行运', period: '实时天象', count: rows.length, kind: '真实星历' },
      ],
    },
    nonAlignable: [
      '「大运的吉凶」与「星盘的庙旺强弱」不是同一量纲：前者基于日主扶抑，后者基于行星尊贵——**只能并排，不能相加**。',
      '次运虽然也是"1 年"一格，但它是**象征性推进**（1 天=1 年），不是真实天象；流年是**干支循环**。两者"同为一年"只是刻度巧合，机制无关。',
      '行运是**真实星历**，次运是**符号推进**，同一颗星在两个盘里的位置不同，不可混用。',
    ],
  };

  return {
    range: { from: rows[0]?.year, to: rows[rows.length - 1]?.year, count: rows.length },
    rows,
    transitions,
    supplement,
    alignment: {
      sharedAxis: '年份（公历年）',
      canAlign: ['大运换步的年份', '次运换座的年份', '行运行星换宫的年份'],
      cannotAlign: ['吉凶判定', '强度数值', '应期精度'],
    },
  };
}
