// 样本采集 + 本地双盘数据库（每次训练/推演写入）
//
// 数据流：Sample_Input（用户填写）→ 双盘采集（mine + kerykeion）→ 一致性核验 → 追加进本地库
// 库形态与 kb.jsonl 一致：**只追加事件**，状态由回放推出；样本单盘快照另存一份便于人工查看。
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileBazi, splitPillar } from '../bazi/engine.mjs';
import { shiShen } from '../bazi/constants.mjs';
import { liuNianActivation, daYun, yearGanZhi } from '../cross/timing.mjs';
import { computeDual, hasKerykeion, BACKENDS, PRIMARY_BACKEND } from '../western/backends.mjs';
import { dignityOf } from '../western/dignity.mjs';
import { EVENT_CATEGORIES, normalizeCategory, verifySample, ruleEvidence, sampleRuleStats, renderRuleStats, RULE_SPECS } from './event-rules.mjs';
import { baziClock } from '../western/truesolar.mjs';
import { observe, buildLibrary, LIB_PATH } from './mapping-library.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJ = resolve(HERE, '../..');
export const SAMPLES_DB = join(PROJ, 'data', 'samples.jsonl');
export const SAMPLES_DIR = join(PROJ, 'data', 'samples');
export const TEMPLATE = join(SAMPLES_DIR, '_template.json');

const p2 = (n) => String(n).padStart(2, '0');
const loadLines = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

/** 样本 ID：对「出生时刻 + 坐标」取内容哈希 → 同一人重复提交不会产生两条 */
export function sampleId(intake) {
  const b = intake.birth_date;
  const key = `${b.date} ${b.time}|${b.birth_place.longitude},${b.birth_place.latitude}|${b.time_precision}`;
  return `S-${createHash('sha1').update(key).digest('hex').slice(0, 10)}`;
}

/**
 * 校验并归一化 Sample_Input（用户样板）
 * 必填：birth_date.date、birth_date.time、birth_place.{longitude,latitude,timezone}
 * 建议填：gender（大运顺逆需要）、life_events（训练标签）
 */
export function validateSample(x) {
  const errors = [], warnings = [];
  if (!x || typeof x !== 'object') return { ok: false, errors: ['输入不是对象'] };
  const b = x.birth_date;
  if (!b) errors.push('缺 birth_date');
  const date = b?.date, time = b?.time ?? '12:00';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) errors.push(`birth_date.date 需为 YYYY-MM-DD，实得 ${date}`);
  if (!/^\d{1,2}:\d{2}$/.test(time)) errors.push(`birth_date.time 需为 HH:MM，实得 ${time}`);
  const place = b?.birth_place ?? {};
  if (typeof place.longitude !== 'number') errors.push('birth_place.longitude 需为数字');
  if (typeof place.latitude !== 'number') errors.push('birth_place.latitude 需为数字');
  // 时区：IANA 名 或 显式数值时差（VedAstro 等外部数据集只给 ±HH:MM）
  const offH = place.utc_offset_hours;
  if (!place.timezone && typeof offH !== 'number') errors.push('birth_place 需要 timezone（IANA 名）或 utc_offset_hours（数值时差）');
  if (offH !== undefined && (typeof offH !== 'number' || Math.abs(offH) > 14)) errors.push(`utc_offset_hours 非法：${offH}`);
  const cal = b?.calendar ?? '公历';
  if (!['公历', '农历'].includes(cal)) errors.push(`calendar 只能是公历/农历，实得 ${cal}`);
  const prec = b?.time_precision ?? '精确到分';
  if (!['精确到分', '大概到时辰'].includes(prec)) errors.push(`time_precision 非法：${prec}`);
  if (cal === '农历') errors.push('农历输入尚未支持（需先转公历；本引擎不做农历换算，避免引入未验证的历法）');
  if (!x.gender) warnings.push('未填 gender：大运顺逆默认为男，结果可能反');
  if (prec === '大概到时辰') warnings.push('时间精度为「大概到时辰」：星盘四轴与宫位对时间极敏感，该样本不宜用于宫位类结论');
  const events = x.life_events ?? [];
  if (!Array.isArray(events)) errors.push('life_events 需为数组');
  else for (const [i, e] of events.entries()) {
    if (typeof e?.year !== 'number') errors.push(`life_events[${i}].year 需为数字`);
    if (!e?.event) errors.push(`life_events[${i}].event 必填`);
    const nz = normalizeCategory(e?.category);
    if (!nz.category) errors.push(`life_events[${i}].category 非法（收到「${e?.category ?? ''}」）：必须是 ${EVENT_CATEGORIES.join('/')} 之一`);
    else if (nz.unknown.length) warnings.push(`life_events[${i}].category 含未收录值 ${nz.unknown.join('、')} → 已并入 tags`);
  }
  if (!events.length) warnings.push('未填 life_events：该样本只能用于盘面统计，无法做「事件↔盘面」验证');
  if (errors.length) return { ok: false, errors, warnings };

  const intake = {
    name: String(x.name ?? '匿名').slice(0, 40),
    gender: x.gender ?? '男',
    birth_date: {
      calendar: cal, date, time, time_precision: prec,
      birth_place: {
        city: place.city ?? null, province: place.province ?? null,
        longitude: place.longitude, latitude: place.latitude, timezone: place.timezone ?? null,
        utc_offset_hours: typeof offH === 'number' ? offH : null,
      },
    },
    life_events: events.map((e) => {
      const nz = normalizeCategory(e.category);
      return { year: e.year, event: String(e.event), category: nz.category ?? '其他', tags: nz.tags };
    }),
    note: x.note ?? null,
  };
  return { ok: true, errors: [], warnings, intake, id: sampleId(intake) };
}

/** 事件 ↔ 盘面 对齐（训练标签）：流年是否引动刑冲 / 该年所在大运 */
export function alignEvents(bazi, intake) {
  const pillars = bazi.pillars.map(splitPillar);
  const birth = new Date(`${intake.birth_date.date}T${intake.birth_date.time}:00`);
  let dy = null;
  try { dy = daYun(pillars, birth, intake.gender); } catch { dy = null; }
  return intake.life_events.map((e) => {
    const act = liuNianActivation(pillars, e.year, bazi.L4_spouse.zhi);
    const step = dy?.steps?.find((s) => e.year >= s.startYear && e.year < s.startYear + 10) ?? null;
    return {
      ...e,
      liuNian: { ganzhi: yearGanZhi(e.year), zhi: act.zhi },
      hits: act.hits,
      activation: act.activation,
      spouseHit: act.spouse,
      daYun: step ? { ganzhi: step.ganzhi, startYear: step.startYear, startAge: step.startAge } : null,
      // 流年天干对日主的十神（训练标签的一维）
      shiShen: (() => { try { return shiShen(bazi.dayMaster, yearGanZhi(e.year)[0]); } catch { return null; } })(),
    };
  });
}

/** 采集一个样本：双盘 + 八字 + 事件对齐 → 记录对象（不落盘） */
export function collectSample(raw, { houseSystem = 'porphyry', write = true, dbPath = SAMPLES_DB, dirPath = SAMPLES_DIR, noRules = false, libPath = LIB_PATH } = {}) {
  const v = validateSample(raw);
  if (!v.ok) throw new Error(`样本校验失败：\n- ${v.errors.join('\n- ')}`);
  const intake = v.intake;
  const [date, time] = [intake.birth_date.date, intake.birth_date.time];
  const at = `${date} ${time.length === 4 ? '0' + time : time}`;
  const pl = intake.birth_date.birth_place;

  // ★ R-T2：中国侧（八字）一律真太阳时；缺经度才退回民用时并告警
  const clock = baziClock({ date, time: intake.birth_date.time, lon: pl.longitude, tzName: pl.timezone, tz: pl.utc_offset_hours ?? 8 });
  const bazi = compileBazi({ at: clock.at, gender: intake.gender, matter: `${intake.name} ${date}` });
  const dual = computeDual({ at, lat: pl.latitude, lon: pl.longitude, tzName: pl.timezone, tz: pl.utc_offset_hours ?? undefined, name: intake.name, houseSystem });
  const events = alignEvents(bazi, intake);

  // 行星必然尊贵（B 族规则要用）
  const dignity = {};
  for (const [k, v] of Object.entries(dual.mine.planets)) if (v.sign) dignity[k] = dignityOf(k, v.sign).state;

  const recordBase = { id: v.id, name: intake.name, intake, events };
  const rules = verifySample({ ...recordBase, charts: { mine: dual.mine } }, { dignity });

  const record = {
    kind: 'sample',
    id: v.id,
    ts: new Date().toISOString(),
    name: intake.name,
    gender: intake.gender,
    intake,
    warnings: v.warnings,
    timeBase: clock,
    bazi: {
      pillars: bazi.pillars,
      dayMaster: bazi.dayMaster,
      verdict: bazi.L3_verdict.verdict,
      ratio: bazi.L3_verdict.ratio,
      distribution: bazi.L3_distribution.adjusted,
      yongJi: bazi.L5_yongJi,
      taiMingShen: { taiyuan: bazi.L4_taiYuan.ganzhi, minggong: bazi.L4_mingGong.ganzhi, shengong: bazi.L4_shenGong.ganzhi },
      patterns: bazi.L4_patterns.labels,
      spouse: { zhi: bazi.L4_spouse.zhi, types: bazi.L4_spouse.types },
    },
    charts: {
      primary: PRIMARY_BACKEND,
      mine: { planets: dual.mine.planets, angles: dual.mine.angles, cusps: dual.mine.cusps, meta: dual.mine.meta, aspectCount: dual.mine.aspects.length },
      kerykeion: dual.kerykeion ? { planets: dual.kerykeion.planets, angles: dual.kerykeion.angles, cusps: dual.kerykeion.cusps, meta: dual.kerykeion.meta, aspectCount: dual.kerykeion.aspects.length } : null,
      kerykeionError: dual.keryErr ?? null,
    },
    consistency: dual.consistency,
    consistencyOk: dual.ok,
    events,
    dignity,
    rules,
  };
  // 打通：A 族结论落成 rules 证据（走既有 observe()，因此受「≥3 盘且 0 反例」门槛约束）
  if (write && !noRules) {
    for (const ev of ruleEvidence(record, rules)) {
      try { observe({ claim: ev.claim, from: ev.from, to: ev.to, chartId: record.id, supports: ev.supports, note: ev.note }, libPath); } catch { /* 库不可写时不阻断采集 */ }
    }
  }
  if (write) writeSample(record, { dbPath, dirPath });
  return record;
}

export function writeSample(record, { dbPath = SAMPLES_DB, dirPath = SAMPLES_DIR } = {}) {
  mkdirSync(dirPath, { recursive: true });
  appendFileSync(dbPath, JSON.stringify(record) + '\n', 'utf8');
  writeFileSync(join(dirPath, `${record.id}.json`), JSON.stringify(record, null, 2), 'utf8');
  return record;
}

/** 回放样本库：同 id 只保留最新一次采集 */
export function loadSamples(path = SAMPLES_DB) {
  const map = new Map();
  for (const e of loadLines(path)) if (e.kind === 'sample') map.set(e.id, e);
  return [...map.values()];
}

export function sampleStats(path = SAMPLES_DB, libPath = LIB_PATH) {
  const all = loadSamples(path);
  const withK = all.filter((s) => s.charts.kerykeion);
  const okOnes = all.filter((s) => s.consistencyOk === true);
  const ev = all.flatMap((s) => s.events ?? []);
  const activationRate = ev.length ? ev.filter((e) => e.activation).length / ev.length : 0;
  const byCategory = {};
  for (const e of ev) byCategory[e.category ?? '未分类'] = (byCategory[e.category ?? '未分类'] ?? 0) + 1;
  const lib = buildLibrary(libPath);
  const ruleRows = sampleRuleStats(all, lib);
  return {
    total: all.length,
    withKerykeion: withK.length,
    consistencyPass: okOnes.length,
    consistencyFail: all.filter((s) => s.consistencyOk === false).length,
    events: ev.length,
    eventActivationRate: Math.round(activationRate * 1000) / 1000,
    byCategory,
    backends: BACKENDS,
    primary: PRIMARY_BACKEND,
    kerykeionAvailable: hasKerykeion(),
    rules: {
      total: ruleRows.length,
      aSupport: ruleRows.filter((r) => r.family === 'A').reduce((a, r) => a + r.support, 0),
      aContradict: ruleRows.filter((r) => r.family === 'A').reduce((a, r) => a + r.contradict, 0),
      verifiedInLib: ruleRows.filter((r) => r.libStatus === 'verified').length,
      rows: ruleRows,
    },
  };
}

/** 规则 × 样本 报表（打通后的核心视图） */
export function renderSampleRules(path = SAMPLES_DB) {
  const all = loadSamples(path);
  const lib = buildLibrary(LIB_PATH);
  const rows = sampleRuleStats(all, lib);
  const L = [];
  L.push(`# 规则复现统计 · ${all.length} 个样本｜rules 库 ${lib.size} 条｜门槛：≥3 盘且 0 反例 → verified`);
  L.push('');
  L.push(renderRuleStats(rows));
  L.push('');
  L.push('A 族为单样本可判（support/contradict 直接进 rules 证据链）；B 族需跨样本比较，样本 <2 时给出「样本不足」。');
  return L.join('\n');
}

export function renderSample(rec) {
  const L = [];
  L.push(`# 样本 ${rec.id} · ${rec.name}（${rec.gender}）`);
  L.push(`- 出生：${rec.intake.birth_date.calendar} ${rec.intake.birth_date.date} ${rec.intake.birth_date.time}（${rec.intake.birth_date.time_precision}）`);
  const p = rec.intake.birth_date.birth_place;
  L.push(`- 地点：${p.province ?? ''}${p.city ?? ''} ${p.longitude}E ${p.latitude}N ${p.timezone}`);
  L.push(`- 八字：${rec.bazi.pillars.join(' ')}｜日主 ${rec.bazi.dayMaster}｜${rec.bazi.verdict}(${rec.bazi.ratio})｜用 ${rec.bazi.yongJi.yong} 忌 ${rec.bazi.yongJi.ji}`);
  L.push(`- 胎命身：${rec.bazi.taiMingShen.taiyuan} / ${rec.bazi.taiMingShen.minggong} / ${rec.bazi.taiMingShen.shengong}｜格局 ${rec.bazi.patterns.join('/') || '常规'}`);
  L.push(`- 星盘主后端：**${rec.charts.primary}**（双独立实现并存）`);
  if (rec.charts.kerykeion) {
    const c = rec.consistency;
    L.push(`- 一致性：星体最大 Δ${c.maxBodyDelta}°｜上升 Δ${c.angles.asc}°｜天顶 Δ${c.angles.mc}°｜硬相位 ${c.aspect.covered}/${c.aspect.kerykeion} → ${rec.consistencyOk ? '✓ 通过' : '✗ 未通过'}`);
  } else L.push(`- kerykeion 后端不可用：${rec.charts.kerykeionError}`);
  L.push('');
  L.push('| 天体 | 本引擎 | 宫位 | kerykeion | 宫位 | Δ° |');
  L.push('|---|---|---|---|---|---|');
  for (const [b, v] of Object.entries(rec.charts.mine.planets)) {
    const k = rec.charts.kerykeion?.planets?.[b];
    const row = rec.consistency?.perBody?.find((x) => x.body === b);
    L.push(`| ${b} | ${v.sign}${v.deg}° | ${v.house ?? '—'} | ${k ? `${k.sign}${k.deg}°` : '—'} | ${k?.house ?? '—'} | ${row?.deltas ?? '—'} |`);
  }
  if (rec.events?.length) {
    L.push('');
    L.push('| 年份 | 事件 | 类别 | 流年 | 引动 | 冲夫妻宫 | 所在大运 |');
    L.push('|---|---|---|---|---|---|---|');
    for (const e of rec.events) L.push(`| ${e.year} | ${e.event} | ${e.category ?? '—'} | ${e.liuNian.ganzhi} | ${e.hits.map((h) => h.type + h.with).join('/') || '—'} | ${e.spouseHit ? '⚠' : ''} | ${e.daYun ? `${e.daYun.ganzhi}(${e.daYun.startYear}起)` : '—'} |`);
  }
  if (rec.warnings?.length) { L.push(''); L.push(`> 采集告警：${rec.warnings.join('；')}`); }
  if (rec.rules?.length) {
    L.push('');
    L.push('## 规则核验（A 族单样本可判 → 已写入 rules 证据链）');
    L.push('| 规则 | 结论 | 依据 |');
    L.push('|---|---|---|');
    for (const r of rec.rules) {
      const tag = { support: '✓ 支持', contradict: '✗ 反例', notApplicable: '· 不适用', 'pending-ensemble': '⏳ 待集合比较' }[r.status] ?? r.status;
      L.push(`| ${r.rule} | ${tag} | ${r.evidence ?? r.reason ?? ''}${r.metric != null ? `（占比 ${r.metric}）` : ''} |`);
    }
  }
  return L.join('\n');
}

export { yearGanZhi };
