// 把「拒收」改成「分级照收 + 告知误差」
//
// 用户裁定（2026-10-22）：「并非拒收吧，只不过要告知用户可能的误差」
// 依据本项目的既有原则：不丢弃数据，而是**标注可靠性**（同 status: hypothesis_under_validation）
//
// 新语义：
//   A 级 = 已矫正 + ≥3 条矫正事件 + ≥2 条决定性大事件  → 可直接参与校准
//   B 级 = 已矫正 + 门槛基本满足但样本薄（决定性 1 条 / 矫正事件 3 条）→ 参与校准但**降权**
//   C 级 = 未矫正 或 决定性事件为 0                      → **照收**，只作结构参考，不参与校准
//   X 级 = 四柱无法复算（数据本身是坏的）                → 唯一真正的拒收
import fs from 'node:fs';
import path from 'node:path';

export const DECISIVE_EVENTS = {
  婚姻: '结婚 / 离婚 / 复婚',
  生育: '子女出生（含流产/难产）',
  重疾: '确诊重大疾病 / 重大手术 / 意外伤残',
  丧亲: '父母/配偶/子女去世',
  事业: '升职 / 被裁 / 创业 / 破产 / 转行',
  迁移: '移民 / 迁居异地 / 长期出国',
  学业: '升学 / 落榜 / 退学',
  财务: '暴富 / 破产 / 重大投资盈亏',
};

const hasYear = (e) => Number.isInteger(e?.year) && e.year >= 1900 && e.year <= 2100;

/**
 * ★ 质量分级（**不拒收**，只判等级并给出"误差告知"）
 * @returns {{tier:'A'|'B'|'C'|'X', label:string, score:number, weight:number,
 *            advisories:string[], missing:string[], impact:string}}
 */
export function qualityAssess(payload) {
  const advisories = [], missing = [];
  const rectified = payload?.rectified === true;
  const re = Array.isArray(payload?.rectifyEvents) ? payload.rectifyEvents : [];
  const oe = Array.isArray(payload?.outcomeEvents) ? payload.outcomeEvents : [];
  const decisive = oe.filter((e) => DECISIVE_EVENTS[e?.category]);
  const badYear = ![...re, ...oe].every(hasYear);

  if (!rectified) {
    advisories.push('出生时间未做生时矫正 —— **时柱可能整柱错位**（民用时与真太阳时在中国可差 1 小时以上），四柱的后半部分与所有依赖时柱的结论都可能有偏差。');
    missing.push('生时矫正');
  }
  if (re.length < 3) {
    advisories.push(`矫正用事件仅 ${re.length} 条（建议 ≥3 条）。事件越少，"反推出的时间"越不可靠 —— 矫正本身是一个统计最优，不是真值。`);
    missing.push(`矫正事件 ≥3（现 ${re.length}）`);
  }
  if (badYear) advisories.push('有事件缺确切年份 —— 年份是矫正的唯一输入，缺年份的事件会被忽略。');
  if (decisive.length === 0) {
    advisories.push('没有决定性大事件（婚姻/生育/重疾/丧亲/事业/迁移/学业/财务）。**没有结局标签的盘只能看结构，无法用来校准"算得准不准"**。');
    missing.push('≥1 条决定性大事件');
  } else if (decisive.length < 2) {
    advisories.push(`决定性事件仅 ${decisive.length} 条。单条事件可能只是巧合，建议补到 2–3 条以便交叉验证。`);
  }

  // 分档
  let tier, label, weight, impact;
  if (!Array.isArray(payload?.pillars) || payload.pillars.length !== 4) {
    tier = 'X'; label = '数据不完整（缺四柱）'; weight = 0;
    impact = '无法使用：四柱是记录的主键。';
  } else if (!rectified) {
    tier = 'C'; label = '未矫正 · 仅供参考'; weight = 0.2;
    impact = '会入库并保留，但**不参与准确率校准**；可以用于观察结构分布。';
  } else if (decisive.length === 0) {
    tier = 'C'; label = '已矫正但无结局 · 仅结构参考'; weight = 0.3;
    impact = '会入库；因缺结局标签，**不参与"算得准不准"的校准**，只用于人群结构统计。';
  } else if (re.length >= 3 && decisive.length >= 2) {
    tier = 'A'; label = '已矫正 + 多事件 · 可校准'; weight = 1.0;
    impact = '会入库并**以全权重参与校准**。';
  } else {
    tier = 'B'; label = '已矫正 + 事件偏少 · 降权使用'; weight = 0.6;
    impact = '会入库并**以 0.6 权重参与校准**（样本薄，避免单条噪声主导）。';
  }

  const score = Math.max(0, 100 - advisories.length * 15 - (tier === 'C' ? 20 : 0) - (tier === 'X' ? 100 : 0));
  return { tier, label, score, weight, advisories, missing, impact };
}

/* ══════════ ⑦ 生时矫正 ══════════ */
export function apiRectify(b, deps) {
  const { rectify } = deps;
  if (!b?.date || !b?.time) throw new Error('需要 date 与 time（候选出生时刻）');
  const events = (b.events ?? []).map((e) => ({ year: Number(e.year), category: e.category ?? '人生事件', note: e.note ?? null }));
  const r = rectify(
    { date: b.date, time: b.time, lon: b.lon ?? 116.4, lat: b.lat ?? 39.9, tzName: b.tzName ?? 'Asia/Shanghai', events },
    { windowMin: Math.min(120, Number(b.windowMin ?? 60)), stepMin: Math.max(1, Number(b.stepMin ?? 1)), orb: Number(b.orb ?? 3) },
  );
  if (!r || r.ok === false) {
    return { ok: false, ...r, hint: '生时矫正至少需要 3 条带确切年份的人生事件；事件类别越多样（婚姻/事业/重疾/迁移）区分度越高。' };
  }
  return {
    ok: true,
    original: r.original_time ?? b.time,
    corrected: r.corrected_time ?? null,
    confidence: r.confidence ?? null,
    converged: r.converged ?? null,
    method: r.method ?? null,
    window: r.window ?? null,
    best: r.best ? { time: r.best.time, localTime: r.best.localTime, score: Math.round(r.best.score * 100) / 100, parts: r.best.parts, contacts: (r.best.contacts ?? []).slice(0, 6) } : null,
    plateau: r.plateau ?? null,
    top: (r.top ?? []).slice(0, 5).map((x) => ({ time: x.time, score: Math.round(x.score * 100) / 100 })),
    eventCount: (r.input_events ?? events).length,
    caveat: '矫正结果是**统计最优**，不等于真值。看 `confidence` 与 `plateau`：平台越窄越可信；未收敛请补更多样化的事件（婚姻/事业/重疾/迁移 跨类别区分度最高）。',
  };
}

/* ══════════ ⑧ 语料采集（分级照收） ══════════ */
export function apiContribute(b, deps) {
  const { compileBazi } = deps;
  const q = qualityAssess(b);

  // 唯一的硬拒：四柱无法复算（数据本身坏了，存进去只会污染）
  let recomputed = null, mismatch = false;
  if (q.tier !== 'X') {
    try {
      const o = compileBazi({ pillars: b.pillars, gender: b.gender ?? '女' });
      recomputed = o.pillars.map((x) => (typeof x === 'string' ? x : x.gan + x.zhi));
      mismatch = recomputed.join('') !== b.pillars.join('');
    } catch (e) {
      return { accepted: false, tier: 'X', quality: { ...q, tier: 'X', label: '四柱非法，无法复算' }, reason: '四柱非法：' + e.message, whatToFix: ['检查四柱是否为 4 组合法干支'] };
    }
  } else {
    return { accepted: false, tier: 'X', quality: q, reason: q.label, whatToFix: q.missing };
  }

  const rec = {
    id: 'C-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    collectedAt: new Date().toISOString(),
    tier: q.tier, qualityScore: q.score, calibrationWeight: q.weight,
    pillars: b.pillars, gender: b.gender ?? null, birthPlace: b.birthPlace ?? null,
    timeMode: b.timeMode ?? 'civil', trueSolarAt: b.trueSolarAt ?? null,
    rectified: b.rectified === true,
    rectifyEvents: b.rectifyEvents ?? [], outcomeEvents: b.outcomeEvents ?? [],
    decisiveCount: (b.outcomeEvents ?? []).filter((e) => DECISIVE_EVENTS[e.category]).length,
    advisories: q.advisories,
    recomputed, mismatch,
    consent: { anonymous: true, at: new Date().toISOString(), scope: '仅用于模型校准，不含姓名/联系方式' },
  };
  const dir = path.join(deps.ROOT, 'data', 'contrib');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'queue.jsonl'), JSON.stringify(rec) + '\n', 'utf8');

  return {
    accepted: true,
    id: rec.id,
    tier: q.tier, label: q.label, qualityScore: q.score, calibrationWeight: q.weight,
    impact: q.impact,
    advisories: q.advisories,
    missing: q.missing,
    note: '已入库（匿名，append-only）。上面的提示是**误差告知**，不是拒绝——你的数据已保存，我们会按等级决定它在校准时占多少权重。',
  };
}

/** 采集库统计（按等级分层） */
export function contribStats(deps) {
  const f = path.join(deps.ROOT, 'data', 'contrib', 'queue.jsonl');
  if (!fs.existsSync(f)) return { total: 0, byTier: {}, decisive: {}, categories: {} };
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  const byTier = {}, decisive = {}, categories = {};
  for (const r of rows) {
    byTier[r.tier ?? '?'] = (byTier[r.tier ?? '?'] ?? 0) + 1;
    for (const e of r.outcomeEvents ?? []) {
      categories[e.category] = (categories[e.category] ?? 0) + 1;
      if (DECISIVE_EVENTS[e.category]) decisive[e.category] = (decisive[e.category] ?? 0) + 1;
    }
  }
  const usable = (byTier.A ?? 0) * 1.0 + (byTier.B ?? 0) * 0.6 + (byTier.C ?? 0) * 0.3;
  return { total: rows.length, byTier, decisive, categories, effectiveSamples: Math.round(usable * 10) / 10, file: f };
}
