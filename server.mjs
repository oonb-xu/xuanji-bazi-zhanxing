// 玄机 · 中西命理融合 —— 本地 API 服务（零依赖，Node 内置 http）
//
// 设计原则：
//  1. **不重造**：全部逻辑调用 meta-unified 既有引擎（compileBazi / computeNatal / compile(六壬) / complementarity / couplingOf / dayunAlignment）
//  2. **不编造**：任何字段缺失就返回 null + note，绝不用假数据填充
//  3. **零依赖**：只用 node:http / node:fs / node:path，不需要 npm install
//
// 启动：node server.mjs [port]        默认 8788
// 接口：GET  /api/health
//       POST /api/bazi      {at|pillars, gender}
//       POST /api/natal     {at, lng, lat, tz}
//       POST /api/fusion    {at, lng, lat, tz, gender}      ← 八字+占星融合（含可视化数据）
//       POST /api/timeline  {at, lng, lat, tz, gender, fromYear, toYear}  ← 三钟对齐（大运/流年 × 次运/行运）
//       POST /api/synastry  {a:{...}, b:{...}}              ← 合盘
//       POST /api/liuren    {at, matter}                    ← 大六壬断事
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

// ★ OPEN_BROWSER：命令行带 --open 时，服务起来后自动打开浏览器
const OPEN_BROWSER = process.argv.includes('--open');

/** 用 explorer.exe 打开 URL（explorer 是微软签名程序，不会被 Smart App Control 拦） */
function openBrowser(url) {
  try {
    spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch (e) {
    console.error('打开浏览器失败：', e.message);
    return false;
  }
}
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileBazi } from './src/bazi/engine.mjs';
import { complementarity, profileOf } from './src/bazi/complementarity.mjs';
import { structuralVerdict, dayunSupplement } from './src/bazi/dag.mjs';
import { controlAnalysis, hanNuan, kuGong, tenGodProfile } from './src/bazi/ten-gods.mjs';
import { computeNatal } from './src/western/natal.mjs';
import { attachChiron } from './src/western/chiron.mjs';
import { aspectTopology } from './src/cross/topology.mjs';
import { couplingOf } from './cli-paired.mjs';
import { dayunAlignment } from './cli-dayun-align.mjs';
import { compile as compileLiuren } from './src/daliuren.mjs';
import { baziClock } from './src/western/truesolar.mjs';
import { rectify } from './src/rectify/rectify.mjs';
import { apiRectify, apiContribute, contribStats, DECISIVE_EVENTS, qualityAssess } from './src/app/collect-endpoints.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(__dirname, 'web');
const PORT = Number(process.argv[2] || process.env.PORT || 8788);

const AXES = ['上升', '下降', '天顶', '天底', '北交点', '南交点'];
/** 剔除四轴/交点边（R-G8：四轴对时刻极敏感，±3 分钟就翻盘） */
const pruneAxes = (t) => ({ ...t, edges: (t.edges ?? []).filter((e) => !AXES.some((a) => String(e.step).includes(a))) });

const R3 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);

/**
 * 从请求体造八字输入：优先 pillars，否则 at
 * ★ R-G2 落地（2026-10-22）：`at` 默认视为**民用时**，自动换算真太阳时后再排盘。
 *   b.timeMode === 'trueSolar' 时跳过换算（用户已自行换算过）。
 *   返回 clock 供前端显示修正量 —— 不静默改时间。
 */
function baziInputWithClock(b) {
  let clock = null;
  if (Array.isArray(b?.pillars) && b.pillars.length === 4) {
    const o = compileBazi({ pillars: b.pillars, gender: b.gender ?? '男' });
    o.input = { ...(o.input ?? {}), birthDate: b.birthDate ?? null };
    return { o, clock: { usedTrueSolar: false, reason: '直接给四柱，未走时间换算', offsetMinutes: 0 } };
  }
  if (!b?.at) throw new Error('缺少 at 或 pillars');
  let at = String(b.at).replace('T', ' ');
  if (b.timeMode !== 'trueSolar') {
    const [date, time] = at.split(' ');
    try {
      clock = baziClock({ date, time, lon: b.lng ?? null, tz: b.tz ?? 8 });
      at = clock.at;
    } catch (e) {
      clock = { usedTrueSolar: false, reason: '真太阳时换算失败：' + e.message, offsetMinutes: 0 };
    }
  } else {
    clock = { usedTrueSolar: false, reason: '用户声明输入已是真太阳时', offsetMinutes: 0 };
  }
  const o = compileBazi({ at, gender: b.gender ?? '男' });
  o.input = { ...(o.input ?? {}), birthDate: String(b.at).slice(0, 10) };
  return { o, clock: { ...clock, civilInput: String(b.at).replace('T', ' '), baziInput: at } };
}

function baziInput(b) { return baziInputWithClock(b).o; }

/* ══════════ ① 八字 ══════════ */
function apiBazi(b) {
  const { o: B, clock } = baziInputWithClock(b);
  const p = profileOf(B);
  const sv = structuralVerdict(B);
  return {
    pillars: B.pillars.map((x) => (typeof x === 'string' ? x : x.gan + x.zhi)),
    dayMaster: B.L3_verdict ? B.pillars[2][0] : null,
    strength: { verdict: B.L3_verdict?.verdict, ratio: R3(B.L3_verdict?.ratio), rooted: B.L3_verdict?.rooted, lingGate: B.L3_verdict?.lingGate, note: B.L3_verdict?.note },
    yongJi: { yong: B.L5_yongJi?.yong, ji: B.L5_yongJi?.ji, why: B.L5_yongJi?.why, candidates: B.L5_yongJi?.candidates },
    vigor: { deLing: p.deLing, deDi: p.deDi, deShi: R3(p.deShi), deSheng: p.deSheng, value: R3(p.vigor) },
    dag: { node: sv.node, yinEnergy: sv.yinEnergy, heHua: { chengJu: sv.heHua?.chengJu, monthHelpsYin: sv.heHua?.monthHelpsYin, chongHit: sv.heHua?.chongHit } },
    tenGods: tenGodProfile(B).byGroup,
    controls: controlAnalysis(B).controls.map((c) => ({ name: c.name, level: c.level, ratio: c.ratio, verdict: c.verdict })),
    hanNuan: hanNuan(B),
    ku: kuGong(B, B.L5_yongJi?.yong, B.L5_yongJi?.ji),
    dayun: dayunSupplement(B, b.gender ?? '男').slice(0, 8).map((d) => ({ ganzhi: d.ganzhi, age: `${d.startAge}-${d.endAge}`, supplyRoot: d.supplyRoot, net: d.net, rels: d.newRels.map((r) => `${r.k}${r.with ?? r.set ?? ''}${r.winner ? '(' + r.winner + '胜)' : ''}`) })),
    mingGong: B.L4_mingGong?.ganzhi ?? null,
    shenGong: B.L4_shenGong?.ganzhi ?? null,
    taiYuan: B.meta?.lib?.taiYuan ?? null,
    dist: B.L3_distribution?.adjusted ?? null,
    clock,   // ★ R-G2：真太阳时换算记录（civilInput / baziInput / offsetMinutes / usedTrueSolar / reason）
  };
}

/* ══════════ ⑥ 时间风险检测（生时矫正前置提醒） ══════════ */
/**
 * 不假装做「矫正」（真矫正需用户提供带日期的生平事件 + rectify 模块）。
 * 这里只做**三件可机算的事**，把风险量化出来：
 *   1. 真太阳时偏移量、以及**时柱是否因换算而改变**
 *   2. 上升/天顶是否在星座边界附近（±3 分钟内换座 ⇒ 四轴不可信，R-G8）
 *   3. 出生时刻是否靠近时辰交界（±5 分钟内换时柱）
 */
function apiTimecheck(b) {
  if (!b?.at) throw new Error('缺少 at');
  const civil = String(b.at).replace('T', ' ');
  const [date, time] = civil.split(' ');
  const lng = b.lng ?? 116.4, lat = b.lat ?? 39.9, tz = b.tz ?? 8;
  const gender = b.gender ?? '女';

  let clock = null, atTrue = civil;
  try {
    clock = baziClock({ date, time, lon: lng, tz });
    atTrue = clock.at;
  } catch (e) { clock = { usedTrueSolar: false, reason: e.message, offsetMinutes: 0 }; }

  const pCivil = compileBazi({ at: civil, gender }).pillars.map((x) => (typeof x === 'string' ? x : x.gan + x.zhi));
  const pTrue = compileBazi({ at: atTrue, gender }).pillars.map((x) => (typeof x === 'string' ? x : x.gan + x.zhi));
  const changed = pCivil.map((x, i) => (x !== pTrue[i] ? ['年', '月', '日', '时'][i] : null)).filter(Boolean);

  // 时辰交界：±5 分钟内换时柱？
  const shift = (min) => {
    const d = new Date(civil.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return null;
    d.setMinutes(d.getMinutes() + min);
    const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    try { return compileBazi({ at: t, gender }).pillars[3]; } catch { return null; }
  };
  const h0 = pTrue[3], hMinus = shift(-5), hPlus = shift(5);
  const hourBorderline = (hMinus && hMinus !== h0) || (hPlus && hPlus !== h0);

  // 上升是否在星座边界（±3 分钟两次取值比较星座）
  const ascAt = (min) => {
    const d = new Date(civil.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return null;
    d.setMinutes(d.getMinutes() + min);
    const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    try { return computeNatal({ at: t, lng, lat, tz }).planets?.['上升'] ?? null; } catch { return null; }
  };
  const asc0 = ascAt(0), ascM = ascAt(-3), ascP = ascAt(3);
  const ascSign = asc0?.sign ?? null;
  const ascStable = ascSign !== null && ascM?.sign === ascSign && ascP?.sign === ascSign;
  const ascDeg = asc0?.deg ?? null;
  const ascEdgeDist = ascDeg === null ? null : Math.min(ascDeg, 30 - ascDeg);

  // 风险等级
  const risks = [];
  if (changed.length) risks.push({ level: 'high', why: `民用时→真太阳时使 **${changed.join('/')}柱** 改变（${pCivil.join(' ')} → ${pTrue.join(' ')}）` });
  if (hourBorderline) risks.push({ level: 'high', why: `出生时刻距时辰交界不足 5 分钟（时柱 ${hMinus} / ${h0} / ${hPlus}），**±5 分钟即换时柱**` });
  if (!ascStable && ascSign) risks.push({ level: 'high', why: `上升在星座边界（${ascSign} ${ascDeg}°，±3 分钟即换座）⇒ 所有跟上升有关的结论都不可信` });
  else if (ascEdgeDist !== null && ascEdgeDist < 2) risks.push({ level: 'medium', why: `上升距星座边界仅 ${R3(ascEdgeDist)}°，接近临界` });
  const level = risks.some((r) => r.level === 'high') ? 'high' : risks.length ? 'medium' : 'low';

  return {
    civilInput: civil,
    trueSolarInput: atTrue,
    offsetMinutes: R3(clock?.offsetMinutes ?? 0),
    usedTrueSolar: clock?.usedTrueSolar ?? false,
    clockReason: clock?.reason ?? null,
    pillars: { civil: pCivil, trueSolar: pTrue, changed },
    hourBorderline, asc: { sign: ascSign, deg: R3(ascDeg), stable: ascStable, edgeDistance: R3(ascEdgeDist) },
    risk: { level, items: risks },
    advice: level === 'low'
      ? '未发现明显时间风险。但仍建议用生平事件做生时校正（本工具未接矫正引擎）。'
      : '存在高/中风险：请提供 3 条以上带日期的生平事件做生时校正，或确认出生时刻精确到分钟。**未矫正前，时柱与四轴相关推论请谨慎对待。**',
  };
}

/* ══════════ ② 星盘 ══════════ */
// ★ computeNatal 的真实形状（2026-10-22 核实）：
//   planets 是**对象**（键=中文明星名，值={sign,deg,house,lon,retro,element}），不是数组
//   aspects 是数组 [{a,b,type,orb,exact}]；宫位字段名是 cusps 不是 houses；angles={asc,mc,ramc,obliquity,gastHours}
function apiNatal(b) {
  if (!b?.at) throw new Error('缺少 at');
  const ch = computeNatal({ at: b.at, lng: b.lng ?? 116.4, lat: b.lat ?? 39.9, tz: b.tz ?? 8 });
  const planets = Object.entries(ch.planets ?? {}).map(([name, p]) => ({
    name, sign: p.sign, lon: R3(p.lon), deg: R3(p.deg), house: p.house ?? null,
    retro: p.retro ?? null, element: p.element ?? null,
  }));
  const aspects = (ch.aspects ?? []).map((a) => ({ a: a.a, b: a.b, type: a.type, orb: R3(Math.abs(a.orb ?? a.exact ?? 0)) }));
  const topo = aspectTopology(ch);
  return {
    planets, aspects,
    angles: ch.angles ?? null,
    cusps: ch.cusps ?? null,
    chiron: ch.planets?.['凯龙'] ?? null,
    topology: { edges: topo.edges.length, weighted: R3(topo.edges.reduce((s, e) => s + (e.weight ?? 1), 0)), largeOrb: topo.edges.filter((e) => e.largeOrb).length },
    // 可视化：给前端直接画 SVG 轮盘（只取十大行星+交点，轴单独给）
    wheel: planets.filter((p) => !['上升', '下降', '天顶', '天底'].includes(p.name)).map((p) => ({ name: p.name, lon: p.lon, sign: p.sign })),
  };
}

/* ══════════ ③ 融合（八字 + 占星） ══════════ */
function apiFusion(b) {
  const bz = apiBazi(b);
  const nt = b?.at ? apiNatal(b) : null;
  // ★ 星盘自带 element 字段（水/火/土/金）—— 直接计数，不自己从星座反推
  const elements = {};
  for (const p of nt?.planets ?? []) if (p.element) elements[p.element] = (elements[p.element] ?? 0) + 1;
  return {
    bazi: bz,
    natal: nt,
    fusion: {
      baziFiveElements: bz.dist,
      astroElements: elements,
      notes: [
        '八字五行取自引擎 L3_distribution（内部标度）；星盘四元素取自 computeNatal 的 planet.element 计数 —— 两者标度不同，此处仅并列展示，不做加权合成。',
        '四轴（上升/下降/天顶/天底）对出生时刻极敏感（±3 分钟就可能换座），计算耦合度时已把它们排除在外。',
      ],
    },
  };
}

/* ══════════ ④ 合盘 ══════════ */
const BASELINE = { comp: 1.138, compSd: 1.523, astro: 0.49, astroSd: 0.165, dayun: 0.261, dayunSd: 0.356 };
const VETO = { severe: 0.5, weak: 0.8, normal: 1.0 };

function apiSynastry(b) {
  if (!b?.a || !b?.b) throw new Error('需要 a 与 b 两组参数');
  const BA = baziInput(b.a), BB = baziInput(b.b);
  const c = complementarity(BA, BB);
  const dy = dayunAlignment(BA, BB, { sexA: b.a.gender ?? '男', sexB: b.b.gender ?? '女' });

  let astroScore = null, astroTopo = null;
  if (b.a.at && b.b.at) {
    const chA = computeNatal({ at: b.a.at, lng: b.a.lng ?? 116.4, lat: b.a.lat ?? 39.9, tz: b.a.tz ?? 8 });
    const chB = computeNatal({ at: b.b.at, lng: b.b.lng ?? 116.4, lat: b.b.lat ?? 39.9, tz: b.b.tz ?? 8 });
    const tA = pruneAxes(aspectTopology(chA)), tB = pruneAxes(aspectTopology(chB));
    astroScore = couplingOf(tA.edges, tB.edges).score;
    astroTopo = { edgesA: tA.edges.length, edgesB: tB.edges.length };
  }

  // z 分数（基线 v2.7，R-G17 适婚窗口加权后）
  const zC = (c.complementarity - BASELINE.comp) / BASELINE.compSd;
  const zA = astroScore === null ? null : (astroScore - BASELINE.astro) / BASELINE.astroSd;
  const wf = dy.window?.weightedFraction ?? null;
  const zD = wf === null ? null : (wf - BASELINE.dayun) / BASELINE.dayunSd;

  // 动态权重：大运在所有对中越"居中"越不可靠 ⇒ 权重下调（R-G16）
  const W = { comp: 0.5, astro: 0.25, dayun: 0.25 };
  const pctApprox = (z) => 1 / (1 + Math.exp(-1.0 * z));   // 仅用于给 w 定标的占位 CDF
  const g = Math.max(0, 1 - 2 * Math.min(pctApprox(zD ?? 0), 1 - pctApprox(zD ?? 0)));
  const wD = W.dayun * g;
  const denom = W.comp + W.astro + wD;
  let M = (W.comp * zC + W.astro * (zA ?? 0) + wD * (zD ?? 0)) / denom;
  const veto = dy.window?.veto ?? 'normal';
  const vetoMult = VETO[veto] ?? 1;
  M = M * vetoMult;

  const pairBazi = (bb) => ({ pillars: bb.pillars.map((x) => (typeof x === 'string' ? x : x.gan + x.zhi)), verdict: bb.L3_verdict?.verdict, yong: bb.L5_yongJi?.yong, ji: bb.L5_yongJi?.ji });

  return {
    a: pairBazi(BA), b: pairBazi(BB),
    complementarity: { total: c.complementarity, supplyAB: c.supplyAB, supplyBA: c.supplyBA, parts: c.parts ?? null },
    astro: astroScore === null ? null : { score: R3(astroScore), ...astroTopo },
    dayun: {
      weighted: wf, windowFraction: dy.window?.windowFraction, coreFraction: dy.window?.coreFraction,
      lateFraction: dy.window?.lateFraction, veto, note: dy.window?.note, buffer: dy.window?.buffer,
    },
    z: { comp: R3(zC), astro: R3(zA), dayun: R3(zD) },
    weights: { comp: W.comp, astro: W.astro, dayun: R3(wD) },
    m: { value: R3(M), vetoMultiplier: vetoMult, note: '把三路证据折算成同一把尺子后加权求和，再过否决门槛。它不是准确率，也不代表好坏。' },
    // ★ 综合结构契合度：把 M 映射到 0–100%（逻辑斯蒂映射，纯计算层面的换标度）
    summary: (() => {
      const toPct = (z) => Math.round((100 / (1 + Math.exp(-1.1 * (z ?? 0)))) * 10) / 10;
      const comps = [
        { key: '互补度', what: '两盘互相补了多少（一方缺的，另一方正好有）', raw: c.complementarity, z: R3(zC), pct: toPct(zC), weight: W.comp, dir: '越高＝越互补' },
        { key: '星盘结构', what: '两张星盘的相位图相似度（已剔除四轴）', raw: astroScore === null ? null : R3(astroScore), z: R3(zA), pct: astroScore === null ? null : toPct(zA), weight: W.astro, dir: '越高＝结构越像' },
        { key: '适婚窗口', what: '20–40 岁里两人同时走好运的比例（按年龄加权）', raw: wf, z: R3(zD), pct: wf === null ? null : toPct(zD), weight: R3(wD), dir: '越高＝关键期越同步' },
      ];
      return {
        structuralFitPct: toPct(M),
        band: toPct(M) >= 70 ? '偏高' : toPct(M) >= 58 ? '略偏高' : toPct(M) >= 42 ? '接近人群平均' : toPct(M) >= 30 ? '略偏低' : '偏低',
        mValue: R3(M),
        components: comps,
        veto: { level: veto, multiplier: vetoMult, note: dy.window?.note ?? null },
        formula: '先各算 z（＝相对人群平均高出几个标准差），再把 z 经 100/(1+e^(−1.1z)) 换成百分比，然后按权重 0.50 / 0.25 / 0.25 加权（大运权重还会按"是否居中"动态下调），最后乘否决系数。',
        meaning: '这个百分比只回答一件事：**这两张盘的结构，在人群里算不算"搭"**。它衡量结构，不衡量感情。',
        disclaimer: '**纯计算层面的结构指数，不是感情好坏的预测，也不是任何建议。** 它没有用任何真实情侣的结局校准过，也不含"磨合"这类盘里根本没有的东西。',
      };
    })(),
    explain: {
      'z 是什么': 'z 是"标准分"：先看这一项在人群里的平均值和离散程度，再看你们这对高出平均多少个标准差。z=0 是正好平均，z=+2 大概处于前 2~3%，z=−1 则低于约 84% 的人。',
      'M 是什么': 'M 是"综合分"：把互补度、星盘结构、适婚窗口三路的 z 按权重加起来，得到一个数。M 本身没有上下限，0 附近代表"和人群平均差不多"。',
      '为什么还要乘一个系数': '若适婚窗口内两人几乎没有共同吉运，整体会再打一个折（0.5~0.8）。依据是一个经验判断：20–40 岁是事业与资本成型的阶段，也是婚姻的基础期——**这条是假设，未经数据检验**。',
      '互补度是什么': '它算的不是「你俩像不像」，而是**「你缺的我有没有」**：一方盘里偏弱、需要的五类元素（木火土金水），在另一方的盘里是否充足。数值越高说明互补越多。它是**双向**的——你补他的、他补你的，会分别计算。注意它衡量的是结构上的「能不能互相供给」，不是感情。',
      '占比怎么读': '各分项的百分比是**把 z 换成更直观的 0–100 刻度**，方便横向比较哪一路拉高/拉低了总分。它不是概率。',
    },
    caveats: [
      '本数值是**结构描述**，没有用任何真实情侣的结局校准过',
      '模型不含「磨合」项',
      '若一方出生时刻存疑，四轴相关推导须降级',
    ],
  };
}

/* ══════════ ⑤ 大六壬 ══════════ */
function apiLiuren(b) {
  if (!b?.at) throw new Error('缺少 at');
  const r = compileLiuren({ at: b.at, matter: b.matter ?? null });
  const sc = r.L5_sanChuan ?? {};
  return {
    time: r.time ?? null,
    frame: r.L1_frame ?? null,
    pan: r.L2_pan ?? null,           // { diPan, tianPan, rotation }
    siKe: r.L3_relation?.siKe ?? null,
    guiRen: r.L4_guiRen ?? null,
    tianJiang: r.L4_tianJiang ?? null,
    sanChuan: {
      chu: sc.chuChuan, zhong: sc.zhongChuan, mo: sc.moChuan,
      method: sc.method, keTi: sc.keTi, chain: sc.chain ?? [],
      special: sc.special ?? [], confidence: sc.confidence,
      agree: sc.agree, lib: sc.lib ?? null,
    },
  };
}

/* ══════════ HTTP ══════════ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
};

const DEPS = { rectify, compileBazi, ROOT: __dirname };
import { buildSupplement, registrySummary } from './src/cross/correspondence-registry.mjs';
import { summarizeReception } from './src/western/reception.mjs';
import { buildTimeline } from './src/cross/timeline.mjs';
import { dynamicWeights, crossValidate, analyzeConjunction } from './src/cross/dynamic-ten-god.mjs';
import { findShenSha, psychologicalProfile } from './src/bazi/shensha.mjs';
import { hiddenStemReveal, saturnDualRole } from './src/cross/hidden-stem.mjs';

// ★ 路由层装饰：给 fusion 结果附上「对应关系补充块」（不侵入 apiFusion 内部）
function withSupplement(handler) {
  return (b, ...rest) => {
    const out = handler(b, ...rest);
    try {
      const bz = apiBazi(b);
      const nt = b?.at ? apiNatal(b) : null;
      out.supplement = buildSupplement(bz, nt);
      // ★ 互容结构 + 相位输能（古典尊贵体系）
      if (nt) out.reception = summarizeReception(nt);
    } catch (e) { out.supplement = { items: [], count: 0, display: '补充块不可用：' + e.message }; }
    return out;
  };
}


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
  const m = String(at).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) throw new Error('at 格式应为 YYYY-MM-DD HH:mm');
  const [, y, mo, d, hh, mi] = m;
  const sign = tz >= 0 ? '+' : '-';
  const hh2 = String(Math.abs(tz)).padStart(2, '0');
  return new Date(`${y}-${mo}-${d}T${hh}:${mi}:00${sign}${hh2}:00`);
}


/** 深度学习层：动态十神权重 + 合相双效应 + 八字能量印证 + 神煞心理印证 + 藏干透出 + 土星双角色 */
function apiDeep(b) {
  const at = b?.at;
  if (!at) throw new Error('需要 at（出生时刻）');
  const birth = parseAtLocal(at, b.tz ?? 8);
  const bz = apiBazi(b);
  const natal = computeNatal({ at, lng: b.lng ?? 116.407, lat: b.lat ?? 39.904, tz: b.tz ?? 8 });
  const planets = Array.isArray(natal.planets)
    ? natal.planets
    : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);

  const isDay = !!b.isDay;
  const sun = planets.find((p) => p.name === '太阳');

  // ① 动态权重
  const dyn = planets
    .map((p) => dynamicWeights(p, { aspects: natal.aspects, sunLon: sun?.lon, isDay }))
    .filter(Boolean);

  // ② 合相双效应
  const conjs = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const r = analyzeConjunction(planets[i], planets[j], 8);
      if (r) conjs.push(r);
    }
  }

  // ③ 八字能量印证
  const tenEn = (bz.bazi ?? bz).tenGods || null;
  const validate = tenEn ? crossValidate(dyn, tenEn) : null;

  // ④ 藏干透出 + 土星双角色
  const hidden = hiddenStemReveal(planets, natal.angles, isDay);
  const saturn = saturnDualRole(planets.find((p) => p.name === '土星'), isDay);

  // ⑤ 神煞 + 占星印证
  const shensha = findShenSha(bz.pillars);
  const psych = psychologicalProfile(shensha, planets);

  return {
    planets: dyn.map((d) => ({
      planet: d.planet, sign: d.sign, house: d.house,
      weights: d.weights, strength: d.strength,
      primary: d.primary, secondary: d.secondary,
      strengthMods: d.strengthMods, aspectMods: d.aspectMods,
    })),
    conjunctions: conjs,
    validate,
    hidden: {
      revealed: hidden.revealed.map((x) => ({ planet: x.planet, sign: x.sign, grade: x.grade, score: x.revealScore, why: x.why })),
      hiddenOnly: hidden.hiddenOnly.map((x) => ({ planet: x.planet, sign: x.sign, grade: x.grade, score: x.revealScore })),
    },
    saturn,
    shensha: psych.rows,
    profile: psych.profile,
    disclaimer: '本层全部为结构描述与内部一致性，不含吉凶判定；神煞与十神映射置信度 ≤0.6。',
  };
}


/** 【取证】浏览器把它遇到的错误回传到这里，写进 logs/browser.log */
function apiLog(body) {
  try {
    fs.mkdirSync('logs', { recursive: true });
    const line = JSON.stringify({
      t: new Date().toISOString(),
      kind: body?.kind ?? 'unknown',
      msg: String(body?.msg ?? '').slice(0, 800),
      detail: body?.detail ? String(body.detail).slice(0, 2000) : null,
      page: body?.page ? String(body.page).slice(0, 40) : null,
      ua: body?.ua ? String(body.ua).slice(0, 120) : null,
    });
    fs.appendFileSync('logs/browser.log', line + '\n', 'utf8');
    return { ok: true, data: { logged: true } };
  } catch (e) {
    return { ok: false, error: 'log write failed: ' + e.message };
  }
}


/** 【训练样本】合盘事例：两人的出生时间 + 具体发生过的事（吵架/复合/异地/生孩子…）
 *  只存匿名出生信息与事件，不存姓名/联系方式。追加写入 data/samples/synastry.jsonl */
function apiSynastrySample(body) {
  const person = (p, tag) => {
    if (!p || typeof p !== 'object') throw new Error(tag + ' 缺少出生信息');
    const at = String(p.at || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(at)) throw new Error(tag + ' 出生时间格式应为 YYYY-MM-DDTHH:mm');
    const lng = Number(p.lng), lat = Number(p.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error(tag + ' 经纬度无效');
    return { at, gender: p.gender === '男' || p.gender === '女' ? p.gender : null, lng, lat };
  };

  const a = person(body.a, 'A');
  const b = person(body.b, 'B');

  const raw = Array.isArray(body.events) ? body.events : [];
  const events = raw
    .map((e) => ({
      type: String(e && e.type || '').trim().slice(0, 24),
      date: String(e && e.date || '').trim().slice(0, 7),   // YYYY-MM
      note: e && e.note ? String(e.note).trim().slice(0, 200) : null,
    }))
    .filter((e) => e.type);
  if (!events.length) throw new Error('至少填 1 条事例');

  const rec = {
    v: 1,
    savedAt: new Date().toISOString(),
    kind: 'synastry-event-sample',
    a, b,
    events,
    consent: body.consent === true,
    source: 'web:synastry',
  };

  fs.mkdirSync('data/samples', { recursive: true });
  fs.appendFileSync('data/samples/synastry.jsonl', JSON.stringify(rec) + '\n', 'utf8');

  let total = 0;
  try { total = fs.readFileSync('data/samples/synastry.jsonl', 'utf8').split('\n').filter(Boolean).length; } catch (e) {}

  return {
    ok: true,
    saved: true,
    events: events.length,
    total,
    note: '样本已保存。训练用的核心是「出生时间 + 事例」，事件越具体越有价值。',
  };
}

const ROUTES = { '/api/bazi': apiBazi, '/api/natal': apiNatal, '/api/fusion': withSupplement(apiFusion), '/api/synastry': apiSynastry, '/api/liuren': apiLiuren, '/api/timeline': apiTimeline, '/api/deep': apiDeep, '/api/log': apiLog, '/api/timecheck': apiTimecheck,
  '/api/rectify': (b) => apiRectify(b, DEPS),
  '/api/contribute': (b) => apiContribute(b, DEPS), '/api/synastry-sample': apiSynastrySample,
  '/api/contrib-stats': () => ({ ok: true, ...contribStats(DEPS), decisiveCategories: Object.keys(DECISIVE_EVENTS) }),
};

const readBody = (req) => new Promise((res, rej) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 1e6) { rej(new Error('body too large')); req.destroy(); } });
  req.on('end', () => { try { res(s ? JSON.parse(s) : {}); } catch (e) { rej(new Error('JSON 解析失败：' + e.message)); } });
  req.on('error', rej);
});

const send = (res, code, obj, type = 'application/json; charset=utf-8') => {
  // Buffer/字符串是已序列化好的原始内容，直接发；只有普通对象才 stringify
  // （否则静态 .json 文件会被 JSON.stringify(Buffer) 成 {"type":"Buffer","data":[...]}）
  const raw = Buffer.isBuffer(obj) || typeof obj === 'string';
  const body = (!raw && type.startsWith('application/json')) ? JSON.stringify(obj) : obj;
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === '/api/contrib-stats' && req.method === 'GET') {
    return send(res, 200, { ok: true, ...contribStats(DEPS), decisiveCategories: Object.keys(DECISIVE_EVENTS) });
  }
  if (p === '/api/health') return send(res, 200, { ok: true, service: 'xuanji-fusion', port: PORT, routes: Object.keys(ROUTES) });

  // 【临时】把 POST 的原文落盘到 tools/_dump.json（用于从浏览器导出渲染好的 HTML）
  if (p === '/api/dump' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      fs.mkdirSync('tools', { recursive: true });
      fs.writeFileSync('tools/_dump.json', JSON.stringify(body), 'utf8');
      return send(res, 200, { ok: true, bytes: JSON.stringify(body).length });
    } catch (e) { return send(res, 400, { ok: false, error: e.message }); }
  }

  if (ROUTES[p]) {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: '只接受 POST' });
    try {
      const body = await readBody(req);
      const t0 = Date.now();
      const data = ROUTES[p](body);
      return send(res, 200, { ok: true, ms: Date.now() - t0, data });
    } catch (e) {
      return send(res, 400, { ok: false, error: e.message });
    }
  }

  // 静态文件
  let f = p === '/' ? '/index.html' : p;
  const abs = path.join(WEB, path.normalize(f).replace(/^(\.\.[/\\])+/, ''));
  if (!abs.startsWith(WEB)) return send(res, 403, 'forbidden', 'text/plain');
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    return send(res, 200, fs.readFileSync(abs), MIME[path.extname(abs)] ?? 'application/octet-stream');
  }
  return send(res, 404, 'not found', 'text/plain; charset=utf-8');
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      // 端口已占用：说明服务已在跑，直接开浏览器然后退出
      const url = `http://127.0.0.1:${PORT}`;
      console.log(`端口 ${PORT} 已被占用 —— 服务应已在运行，直接打开浏览器`);
      if (OPEN_BROWSER) openBrowser(url);
      setTimeout(() => process.exit(0), 600);
      return;
    }
    console.error('服务启动失败：', e.message);
    process.exit(1);
  })
  .listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`玄机·融合 → ${url}`);
    console.log(`健康检查 → ${url}/api/health`);
    if (OPEN_BROWSER) {
      console.log('正在打开浏览器…');
      setTimeout(() => openBrowser(url), 500);
    }
  });
