// 生活事件：受控类别枚举 + 可检验规则规格（样本 → rules 证据的桥）
//
// 设计要点：
//   · category 是**受控枚举**（R-S6），跨样本聚合才有意义；历史复合写法（"家庭/健康"）由
//     normalizeCategory 拆成 主类别 + tags，不丢信息。
//   · 规则分两族：
//     A 族（单样本可判，存在性）：若事件年满足条件 P，则事件里应出现类别 C
//     B 族（跨样本可判，比较）：特征 F 为真的样本，类别 C 的占比应高于其他样本
//   · 每采一个样本就把 A 族结论写进 rules 证据链（observe），
//     于是 6.7 的「≥3 张不同命盘且 0 反例 → verified」门槛**自动适用于样本**。

export const EVENT_CATEGORIES = ['家庭', '健康', '学业', '事业', '婚恋', '子女', '财运', '官非', '迁移', '人际', '意外', '其他'];

/** 把任意写法归一：主类别取第一个可识别值，其余进 tags；全不可识别则 category=null */
export function normalizeCategory(raw) {
  if (raw === null || raw === undefined || raw === '') return { category: null, tags: [], unknown: [] };
  const parts = String(raw).split(/[/、,，·+＋&]|\s+/).map((s) => s.trim()).filter(Boolean);
  const known = parts.filter((p) => EVENT_CATEGORIES.includes(p));
  const unknown = parts.filter((p) => !EVENT_CATEGORIES.includes(p));
  return { category: known[0] ?? null, tags: [...known.slice(1), ...unknown], unknown };
}

/**
 * 规则规格
 *  A 族 predicate: (event, sampleCtx) => boolean  —— 判断"该事件年是否满足前提 P"
 *  B 族 feature  : (sample) => boolean            —— 判断样本是否具备特征 F
 */
export const RULE_SPECS = [
  // ── A 族：单样本可判 ──
  {
    id: 'A1', family: 'A', target: '婚恋类事件', claim: '流年冲夫妻宫之年，事件中应出现「婚恋」',
    predicate: (e) => e.spouseHit === true,
  },
  {
    id: 'A2', family: 'A', target: '健康/家庭类事件', claim: '流年与原局相冲或相害之年，事件中应出现「健康」或「家庭」',
    predicate: (e) => (e.hits ?? []).some((h) => h.type === '冲' || h.type === '害'),
    categories: ['健康', '家庭'],
  },
  {
    id: 'A3', family: 'A', target: '事业/学业类事件', claim: '流年与原局相合（合=机会）之年，事件中应出现「事业」或「学业」',
    predicate: (e) => (e.hits ?? []).some((h) => h.type === '合'),
    categories: ['事业', '学业'],
  },
  {
    id: 'A4', family: 'A', target: '官非/意外类事件', claim: '流年刑（含自刑）之年，事件中应出现「官非」或「意外」',
    predicate: (e) => (e.hits ?? []).some((h) => h.type === '刑' || h.type === '自刑'),
    categories: ['官非', '意外'],
  },
  // ── B 族：跨样本比较 ──
  {
    id: 'B1', family: 'B', target: '婚恋+财运占比', claim: '金星处于陷/落的样本，「婚恋」「财运」类事件占比高于其他样本',
    categories: ['婚恋', '财运'],
    feature: (s) => ['陷', '落'].includes(s.dignity?.金星),
  },
  {
    id: 'B2', family: 'B', target: '意外+健康占比', claim: '火星处于陷/落的样本，「意外」「健康」类事件占比高于其他样本',
    categories: ['意外', '健康'],
    feature: (s) => ['陷', '落'].includes(s.dignity?.火星),
  },
  {
    id: 'B3', family: 'B', target: '事业+官非占比', claim: '土星处于陷/落的样本，「事业」「官非」类事件占比高于其他样本',
    categories: ['事业', '官非'],
    feature: (s) => ['陷', '落'].includes(s.dignity?.土星),
  },
];

/** 从样本记录里取出该样本的行星尊贵（用主后端 mine） */
export function dignityOfSample(sample) {
  const p = sample.charts?.mine?.planets ?? {};
  const D = {}; // 只关心 B 族用到的三颗
  for (const k of ['金星', '火星', '土星']) {
    const sign = p[k]?.sign;
    if (sign) D[k] = sample._dignity?.[k] ?? null;
  }
  return D;
}

/**
 * 单样本规则核验
 * A 族给 support / contradict / notApplicable；B 族只记录可观测量（feature 与占比），判定留给集合比较。
 */
export function verifySample(sample, { dignity = {} } = {}) {
  const events = sample.events ?? [];
  const cats = events.map((e) => e.category).filter(Boolean);
  const share = (list) => (cats.length ? list.filter((c) => cats.includes(c)).length / cats.length : null);
  const out = [];
  for (const r of RULE_SPECS) {
    if (r.family === 'A') {
      const matched = events.filter((e) => { try { return r.predicate(e, sample); } catch { return false; } });
      if (!matched.length) { out.push({ rule: r.id, status: 'notApplicable', applicable: 0, reason: '该样本无事件年满足前提' }); continue; }
      const want = r.categories ?? [r.target.match(/^(.+?)类/)?.[1]].filter(Boolean);
      const hit = matched.some((e) => want.includes(e.category));
      out.push({
        rule: r.id, claim: r.claim, status: hit ? 'support' : 'contradict',
        applicable: matched.length, want,
        evidence: `前提命中 ${matched.length} 年（${matched.map((e) => `${e.year}${e.liuNian?.ganzhi ?? ''}:${e.category ?? '未分类'}`).join('、')}）`,
      });
    } else {
      const f = (() => { try { return r.feature({ dignity }); } catch { return null; } })();
      out.push({
        rule: r.id, claim: r.claim, status: 'pending-ensemble', feature: f,
        metric: share(r.categories), categories: r.categories,
        reason: f === null ? '缺行星尊贵数据' : '需跨样本比较',
      });
    }
  }
  return out;
}

/** 把 A 族结论落成 rules 证据（走既有 observe()，因此受 ≥3 盘门槛约束） */
export function ruleEvidence(sample, results) {
  return results.filter((r) => r.status === 'support' || r.status === 'contradict').map((r) => {
    const spec = RULE_SPECS.find((x) => x.id === r.rule);
    return {
      claim: spec.claim,
      from: `规则:${spec.id}`,
      to: spec.target,
      supports: r.status === 'support',
      note: r.evidence ?? null,
    };
  });
}

/**
 * 跨样本规则统计：A 族看支持/反例，B 族做两组占比比较
 * @param samples 样本数组
 * @param lib     映射库（rules）回放结果 Map
 */
export function sampleRuleStats(samples, lib = new Map()) {
  const rows = [];
  for (const spec of RULE_SPECS) {
    if (spec.family === 'A') {
      let sup = 0, con = 0, na = 0;
      for (const s of samples) {
        const r = (s.rules ?? []).find((x) => x.rule === spec.id);
        if (!r || r.status === 'notApplicable') { na++; continue; }
        if (r.status === 'support') sup++; else if (r.status === 'contradict') con++;
      }
      const item = lib.get(`规则:${spec.id}→${spec.target}`);
      rows.push({ rule: spec.id, family: 'A', claim: spec.claim, target: spec.target, samples: samples.length, applicable: sup + con, support: sup, contradict: con, notApplicable: na, libStatus: item?.status ?? null, libCharts: item?.chartCount ?? 0 });
    } else {
      const withF = [], withoutF = [];
      for (const s of samples) {
        const r = (s.rules ?? []).find((x) => x.rule === spec.id);
        if (!r || r.feature === null || r.metric === null) continue;
        (r.feature ? withF : withoutF).push(r.metric);
      }
      const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
      const a1 = avg(withF), a0 = avg(withoutF);
      const enough = withF.length >= 1 && withoutF.length >= 1;
      rows.push({
        rule: spec.id, family: 'B', claim: spec.claim, target: spec.target, samples: samples.length,
        withFeature: withF.length, withoutFeature: withoutF.length,
        avgWith: a1 === null ? null : Math.round(a1 * 1000) / 1000,
        avgWithout: a0 === null ? null : Math.round(a0 * 1000) / 1000,
        verdict: !enough ? '样本不足' : (a1 > a0 ? '支持' : a1 < a0 ? '反例' : '无差异'),
      });
    }
  }
  return rows;
}

export function renderRuleStats(rows) {
  const L = [];
  L.push('| 规则 | 族 | 陈述 | 样本 | 支持 | 反例 | 不适用 | rules状态 |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    if (r.family === 'A') L.push(`| ${r.rule} | A | ${r.claim} | ${r.samples} | ${r.support} | ${r.contradict} | ${r.notApplicable} | ${r.libStatus ?? '未入库'}(${r.libCharts}盘) |`);
    else L.push(`| ${r.rule} | B | ${r.claim} | ${r.samples} | 有特征${r.withFeature}/无${r.withoutFeature} | 占比 ${r.avgWith ?? '—'} vs ${r.avgWithout ?? '—'} | ${r.verdict} | — |`);
  }
  return L.join('\n');
}
