// Part 8 · 数据库自发掘引擎
// 每次推演后：① 提取「八字十神 ↔ 星盘行星」对应 ② 验证「冲合害 ↔ 硬相位」共振
// ③ 输出【本次新发现】【数据库更新建议】【待验证猜想】；④ 每 10 轮做矛盾复盘
import { normalizeAstro } from './calibration.mjs';
import { FRICTION_MAP } from './friction.mjs';
import { correspondences, shiShenWeights } from './correspondence.mjs';
import { discover as discover67 } from './discovery.mjs';
import { startRun, recordCorrespondence, recordResonance, proposeUpdate, contradictionReview, runCount } from './kb-db.mjs';
import { observe } from './mapping-library.mjs';
import { dignityOf, DIGNITY_SCORE } from '../western/dignity.mjs';

export { correspondences, shiShenWeights };


/**
 * ② 共振检测：bazi_relations（冲合害）× astro.aspects（硬相位）
 * 复用 Part 6 的映射与破坏值，不另立一套
 */
export function resonance(bazi, astroInput, frictionResult) {
  const rel = frictionResult?.baziSide?.detail ?? null;
  const baziRelations = rel ? {
    冲: rel.zhi.filter((z) => z.type === '冲').map((z) => `${z.a}${z.b}`),
    合: rel.zhi.filter((z) => z.type === '合').map((z) => `${z.a}${z.b}`),
    刑: rel.zhi.filter((z) => z.type === '刑' || z.type === '自刑').map((z) => `${z.a}${z.b}`),
    害: rel.zhi.filter((z) => z.type === '害').map((z) => `${z.a}${z.b}`),
  } : null;
  const A = astroInput?.planets ? normalizeAstro(astroInput) : null;
  const hardAspects = (A?.aspects ?? []).filter((x) => ['对冲', '四分相', '梅花相'].includes(x.type));

  const patterns = (frictionResult?.rows ?? []).map((r) => ({
    aspect: r.aspect, astroType: r.astroType, bazi: r.bazi, value: r.value, real: r.real,
    need: FRICTION_MAP[r.astroType]?.need ?? null, reliefs: r.reliefs,
  }));
  // 有硬相位但八字侧无对应关系 → 未共振
  const unmatched = hardAspects.filter((x) => !(frictionResult?.rows ?? []).some((r) => r.aspect.includes(x.a) && r.aspect.includes(x.b)));
  const score = Math.round(patterns.reduce((a, p) => a + p.value, 0) * 10) / 10;
  const level = score >= 6 ? '高' : score >= 3 ? '中' : score > 0 ? '低' : '无';
  return { baziRelations, hardAspects: hardAspects.map((x) => `${x.a}${x.type}${x.b}`), patterns, unmatched: unmatched.map((x) => `${x.a}${x.type}${x.b}`), score, level };
}

/** ③ 生成三类输出（全部落库；更新建议只进 proposal，待人工裁决） */
export function runDbDiscovery({ bazi, astroInput, frictionResult, chartId, write = true, kbPath, libPath }) {
  const corr = correspondences(bazi, astroInput);
  const res = resonance(bazi, astroInput, frictionResult);
  const d67 = discover67({ bazi, astroInput, friction: frictionResult, write: false, chartId });

  const findings = [];
  const conjectures = [];
  const suggestions = [];

  if (!corr.meta.hasAstro) {
    return { skipped: true, reason: '未提供星盘：Part 8 需要双侧数据', correspondences: corr, resonance: res, findings: [], suggestions: [], conjectures: [], discovery67: d67 };
  }

  // 本次新发现：十神×行星 共振且非基础表已知
  for (const r of corr.rows) {
    if (r.verdict !== '共振' && r.verdict !== '背离') continue;
    const line = `${r.planet}(${r.sign}${r.dignity ? '·' + r.dignity : ''}) ↔ ${r.shiShen}：十神${r.shiShenLevel} vs 行星尊贵${r.dignityScore > 0 ? '强' : r.dignityScore < 0 ? '弱' : '中'} → ${r.verdict}`;
    findings.push({ kind: '十神×行星', text: line, data: r });
    if (r.verdict === '共振' && r.dignity && r.dignity !== '中性') {
      suggestions.push({
        target: 'rules', op: 'append',
        entry: `${r.planet}落${r.sign}（${r.dignity}） ⟺ 八字${r.shiShen}${r.shiShenLevel}`,
        reason: `本命局共振（十神${r.shiShenValue} vs 尊贵分${r.dignityScore}）`,
        evidence: line,
      });
    }
    // 待验证猜想：背离项转成可证伪命题
    if (r.verdict === '背离') {
      conjectures.push({ text: `${r.planet}落${r.sign}（${r.dignity}）与八字${r.shiShen}${r.shiShenLevel}背离——是否「十神强而星盘失势」是常态而非例外？`, from: `${r.planet}@${r.sign}`, to: r.shiShen, basis: '本次命局内部不一致' });
    }
  }
  // 共振点
  for (const p of res.patterns) findings.push({ kind: '冲合害×硬相位', text: `${p.aspect} ↔ ${p.bazi} ⇒ 破坏值 ${p.value}｜${p.real}`, data: p });
  // jishen_alert 更新建议：破坏值 ≥2.0
  for (const p of res.patterns.filter((x) => x.value >= 2.0)) {
    suggestions.push({
      target: 'jishen_alert', op: 'append',
      entry: `${p.aspect} + ${p.bazi} → 破坏值 ${p.value}｜${p.real}`,
      reason: `本次推演实测破坏值 ${p.value} ≥ 2.0${p.reliefs.length ? `（已有缓解：${p.reliefs.join('；')}）` : '（无缓解）'}`,
      evidence: p.real,
    });
  }
  // 6.7 的待验证猜想并入
  for (const x of d67.pending ?? []) conjectures.push({ text: x.claim, from: x.from, to: x.to, basis: x.note ?? '数据不足' });
  // 胎命身 ↔ 三星 的本次猜想
  const A = normalizeAstro(astroInput);
  const north = A.planets['北交点'];
  conjectures.push({ text: `胎元 ${bazi.L4_taiYuan.ganzhi} 是否对应星盘北交点 ${north ? `${north.sign}${north.house}宫` : '（缺）'}？`, from: `胎元${bazi.L4_taiYuan.ganzhi}`, to: `北交点${north?.sign ?? '—'}`, basis: '6.7.2 表：胎元↔太阳/南交点，与北交点互为对宫，需跨盘统计验证' });
  conjectures.push({ text: `命宫 ${bazi.L4_mingGong.ganzhi} 是否对应星盘太阳（${A.planets['太阳']?.sign ?? '—'}）与上升（${A.planets['上升']?.sign ?? '—'}）？`, from: `命宫${bazi.L4_mingGong.ganzhi}`, to: `太阳${A.planets['太阳']?.sign ?? '—'}`, basis: '6.7.4 第一问' });
  conjectures.push({ text: `身宫 ${bazi.L4_shenGong.ganzhi} 是否对应星盘月亮（${A.planets['月亮']?.sign ?? '—'}）？`, from: `身宫${bazi.L4_shenGong.ganzhi}`, to: `月亮${A.planets['月亮']?.sign ?? '—'}`, basis: '6.7.4 第一问' });
  // 6.7.4 第三问：十神强弱 ↔ 庙旺落陷
  const synced = corr.rows.filter((r) => r.verdict === '共振').length;
  const compared = corr.rows.filter((r) => r.verdict !== '不可比').length;
  conjectures.push({ text: `十神强弱与行星庙旺落陷是否同步？本次 ${synced}/${compared} 同步。`, from: '十神强弱', to: '庙旺落陷', basis: '6.7.4 第三问，需跨盘统计同步率' });

  // 落库（kbPath / libPath 可注入，便于测试与多库并行）
  let run = { index: runCount(kbPath) + 1, isReviewTick: false };
  let review = null;
  if (write) {
    run = startRun({ chartId, bazi: bazi.pillars.join(' '), astroMeta: astroInput?.meta ?? null }, kbPath);
    recordCorrespondence(corr.rows.map((r) => ({ planet: r.planet, shiShen: r.shiShen, verdict: r.verdict, sign: r.sign, dignity: r.dignity, shiShenLevel: r.shiShenLevel })), chartId, kbPath);
    recordResonance({ chartId, patterns: res.patterns.map((p) => p.aspect), score: res.score, level: res.level }, kbPath);
    for (const s of suggestions) proposeUpdate({ chartId, ...s }, kbPath);
    // 8.2：新映射追加到 rules（走 6.7 映射库的证据链，不直接改结论）
    for (const r of corr.rows.filter((x) => x.verdict === '共振' && x.dignity && x.dignity !== '中性')) {
      observe({ claim: `${r.planet}落${r.sign}（${r.dignity}） ⟺ 八字${r.shiShen}${r.shiShenLevel}`, from: `${r.planet}@${r.sign}`, to: r.shiShen, chartId, supports: true, note: `尊贵分${r.dignityScore}/十神${r.shiShenValue}` }, libPath);
    }
    if (run.isReviewTick) review = contradictionReview({ runIndex: run.index }, kbPath);
  }

  return {
    skipped: false, run, correspondences: corr, resonance: res,
    findings, suggestions, conjectures, review, discovery67: d67,
  };
}

/** 输出格式化（严格按 8.1 三类） */
export function renderDbDiscovery(d) {
  const L = [];
  L.push('');
  L.push('## 【Part 8 · 数据库自发掘】');
  if (d.skipped) { L.push(`- 跳过：${d.reason}`); return L.join('\n'); }
  L.push(`- 轮次：第 ${d.run.index} 次推演${d.run.isReviewTick ? '（**满 10 轮，已触发矛盾复盘**）' : `（距复盘还需 ${10 - (d.run.index % 10)} 轮）`}`);
  L.push(`- 共振：八字侧 冲[${d.resonance.baziRelations.冲.join(',') || '无'}] 合[${d.resonance.baziRelations.合.join(',') || '无'}] 刑[${d.resonance.baziRelations.刑.join(',') || '无'}] 害[${d.resonance.baziRelations.害.join(',') || '无'}] × 星盘硬相位 ${d.resonance.hardAspects.length} 条 → 命中 ${d.resonance.patterns.length} 条，得分 ${d.resonance.score}（${d.resonance.level}）`);
  L.push('');
  L.push('### 【本次新发现】');
  L.push(d.findings.length ? d.findings.map((f) => `- [${f.kind}] ${f.text}`).join('\n') : '- 无');
  L.push('');
  L.push('### 【数据库更新建议】');
  L.push(d.suggestions.length
    ? d.suggestions.map((s) => `- 在 \`${s.target}\` 中追加：${s.entry}　（理由：${s.reason}）`).join('\n') + '\n- ⚠ 以上仅入 `proposal` 集合（status=pending-human），**未自动生效**；用 `--kb-accept <id>` / `--kb-reject <id>` 裁决。'
    : '- 无');
  L.push('');
  L.push('### 【待验证猜想】');
  L.push(d.conjectures.length ? d.conjectures.map((c) => `- ${c.text}　（依据：${c.basis}）`).join('\n') : '- 无');
  if (d.review) {
    L.push('');
    L.push(`### 【矛盾复盘 · 第 ${d.review.runIndex} 轮】`);
    L.push(`- 扫描 rules ${d.review.scanned} 条，标记「${d.review.mark}」${d.review.flagged} 条`);
    for (const f of d.review.flags.slice(0, 12)) L.push(`  - ${f.claim}（支持 ${f.sup}/反例 ${f.con}/命盘 ${f.charts}）：${f.reasons.join('；')}`);
  }
  return L.join('\n');
}

export { dignityOf, DIGNITY_SCORE };
