// Part 6：不协和相位 × 刑冲克害 交叉推演引擎（摩擦引擎）
// 6.1 映射 / 6.2 破坏值算法（等式 A/B/C）/ 6.4 修正系数 / 6.5 输出 / 6.6 警报
import { GAN_WU_XING, ZHI_WU_XING, KE, SHENG } from '../bazi/constants.mjs';
import { GUI_REN_BY_GAN } from '../constants.mjs';
import { intraRelations, isHarmonized, nobleRelief } from '../bazi/relations.mjs';
import { PLANET_TO_SHISHEN, normalizeAstro } from './calibration.mjs';
import { MALEFIC, BENEFIC, mutualReception, lonOfSignDegree } from '../western/zodiac.mjs';

/* ── 6.1 占星硬相位 → 八字关系映射（唯一真源） ── */
export const FRICTION_MAP = {
  对冲: { bazi: '地支六冲 / 天克地冲', energy: '正面对抗，两极撕裂，外部事件引发', real: '分离、异地、背叛、剧烈变动', base: 3, need: '冲' },
  四分相: { bazi: '三刑 / 自刑 / 天干相克', energy: '内部摩擦，反复拉扯，自我攻击', real: '内耗、精神折磨、慢性消耗', base: 2, need: '刑' },
  梅花相: { bazi: '地支相害', energy: '暗中算计，说不清的别扭，慢性毒药', real: '隐形刁难、关系不睦、莫名其妙的不顺', base: 1, need: '害' },
  合相: { bazi: '合而化忌 / 合中带刑（涉凶星）｜天干五合 / 地支六合（涉吉星）', energy: '深度绑定，互相吞噬，无法割舍', real: '虐恋、债务捆绑、强制共生', base: 2.5, need: '合忌' },
};
export const GAN_HE_BENEFIC_ROW = { bazi: '天干五合 / 地支六合', energy: '能量融合，互相成就', real: '合作共赢、情感顺遂、贵人相助' };

const r1 = (n) => Math.round(n * 10) / 10;

/** need（中文关系名）→ 八字侧布尔标志键 */
export const NEED_KEY = { 冲: 'chong', 刑: 'xing', 害: 'hai', 合忌: 'heJi' };

/* ── 6.2 破坏值等式 A / B / C ── */
export function baseValue(astroType, baziHas) {
  const m = FRICTION_MAP[astroType];
  if (!m) return null;
  if (astroType === '合相') return baziHas.heJi || baziHas.heXing ? m.base : null; // 需八字有「合而化忌/合中带刑」
  return baziHas[NEED_KEY[m.need]] ? m.base : null;
}

export function amplify(astroType, pair, baziHasChongXing) {
  const steps = [];
  let mult = 1;
  if (baziHasChongXing) {
    if (pair.includes('冥王星')) { mult *= 1.5; steps.push({ factor: 1.5, why: '涉及冥王星 ×1.5（深渊级拉扯）' }); }
    if (pair.includes('天王星')) { mult *= 1.2; steps.push({ factor: 1.2, why: '涉及天王星 ×1.2（突变级断裂）' }); }
    if (pair.includes('土星')) { mult *= 0.8; steps.push({ factor: 0.8, why: '涉及土星 ×0.8（现实规则压制，但不会崩盘）' }); }
    if (pair.includes('木星')) { mult *= 1.1; steps.push({ factor: 1.1, why: '涉及木星 ×1.1（乐观感掩盖冲突，最后爆发更狠）' }); }
  }
  return { mult, steps };
}

/* ── 主入口 ── */
export function friction(bazi, astroInput, opts = {}) {
  const A = normalizeAstro(astroInput);
  if (!A) return { provided: false, hint: '未提供星盘；Part 6 需要 {planets:{…},aspects:[…]}', rows: [], alerts: [], benign: [] };

  const pillars = bazi.pillars.map((gz) => ({ gan: gz[0], zhi: gz[1] }));
  const rel = intraRelations(pillars);
  const jiWx = bazi.L5_yongJi.ji, yongWx = bazi.L5_yongJi.yong;
  const guiPair = GUI_REN_BY_GAN[pillars[2].gan];
  const baziHasChongXing = rel.chong || rel.xing;

  // 八字侧「合而化忌 / 合中带刑」判定
  const heJi = rel.gan.filter((g) => g.type === '五合' && g.hua === jiWx);
  const heZhiJi = rel.zhi.filter((z) => z.type === '合' && ZHI_WU_XING[z.a] === ZHI_WU_XING[z.b] && ZHI_WU_XING[z.a] === jiWx);
  const heXing = rel.heZhi.filter((z) => rel.xingZhi.includes(z));
  const has = { chong: rel.chong, xing: rel.xing, hai: rel.hai, heJi: heJi.length + heZhiJi.length > 0, heXing: heXing.length > 0, he: rel.he };

  const rows = [], benign = [], alerts = [];
  for (const asp of A.aspects) {
    const [pa, pb] = [asp.a, asp.b];
    const pair = [pa, pb];
    const malefic = pair.filter((p) => MALEFIC.includes(p));
    const benefic = pair.filter((p) => BENEFIC.includes(p));
    const isHe = asp.type === '合相';

    /* 吉相位：合相且只涉吉星 → 单列，不进入冲突表 */
    if (isHe && benefic.length && !malefic.length) { benign.push({ aspect: pair.join('合'), type: '合相·吉星', ...GAN_HE_BENEFIC_ROW, bazi: rel.he ? '地支六合/天干五合' : GAN_HE_BENEFIC_ROW.bazi }); continue; }

    const map = FRICTION_MAP[asp.type];
    if (!map) continue;
    const base = baseValue(asp.type, has);
    if (base === null) continue;                       // 等式 A 未命中 → 不构成摩擦点
    const { mult, steps } = amplify(asp.type, pair, baziHasChongXing);
    let value = base * mult;

    // 八字对应关系样本（用于展示与 6.4 修正）；冲支优先取「被合化」的那一侧，便于体现 6.4 降级
    let baziRel;
    if (asp.type === '对冲') {
      const cands = rel.zhi.filter((z) => z.type === '冲');
      const tk = rel.tianKeDiChong[0];
      let zhiSel = null, lab = null;
      for (const c of cands) {
        if (isHarmonized(c.a, rel)) { zhiSel = c.a; lab = `六冲 ${c.a}${c.b}`; break; }
        if (isHarmonized(c.b, rel)) { zhiSel = c.b; lab = `六冲 ${c.a}${c.b}`; break; }
      }
      if (!lab && tk) lab = `天克地冲 ${tk.from}${tk.ga}${tk.a}↔${tk.to}${tk.gb}${tk.b}`;
      if (!lab && cands[0]) lab = `六冲 ${cands[0].a}${cands[0].b}`;
      baziRel = lab ? { label: lab, zhi: zhiSel ?? tk?.a ?? cands[0]?.a ?? null } : null;
    } else if (asp.type === '四分相') {
      const c = rel.zhi.find((z) => z.type === '刑' || z.type === '自刑');
      baziRel = c ? { label: `${c.type} ${c.a}${c.b}`, zhi: c.a } : (rel.gan.find((g) => g.type === '相克') ? { label: `天干相克 ${rel.gan.find((g) => g.type === '相克').a}${rel.gan.find((g) => g.type === '相克').b}` } : null);
    } else if (asp.type === '梅花相') {
      const c = rel.zhi.find((z) => z.type === '害');
      baziRel = c ? { label: `相害 ${c.a}${c.b}`, zhi: c.a } : null;
    } else {
      baziRel = (heJi[0] && { label: `合而化忌 ${heJi[0].a}${heJi[0].b}→${heJi[0].hua}` }) || (heXing.length && { label: `合中带刑 ${heXing.join('')}` }) || null;
    }

    // 6.4 修正系数
    const mods = [];
    if (baziRel?.zhi && isHarmonized(baziRel.zhi, rel)) { value *= 0.5; mods.push({ factor: 0.5, why: `${baziRel.zhi}被合化（冲不动，合住了）` }); }
    const mr = mutualReception(
      { name: pa, sign: A.planets[pa]?.sign }, { name: pb, sign: A.planets[pb]?.sign });
    if (mr) { value *= 0.6; mods.push({ factor: 0.6, why: `${pa}/${pb} ${mr.system}互容（有缓冲余地）` }); }
    const nr = nobleRelief(pillars, guiPair, baziRel?.zhi ?? null);
    if (nr.hit) { value *= 0.3; mods.push({ factor: 0.3, why: `贵人兜底：${nr.hits.join('；')}` }); }

    const shiShenOf = (p) => PLANET_TO_SHISHEN[p]?.shiShen ?? '—';
    rows.push({
      aspect: `${pa}${asp.type === '合相' ? '合' : asp.type === '对冲' ? '冲' : asp.type === '四分相' ? '刑' : '梅花'}${pb}`,
      astroType: asp.type,
      planets: pair,
      nature: pair.map((p) => `${p}(${shiShenOf(p)})`).join(' + '),
      malefic, benefic,
      bazi: baziRel?.label ?? '（无对应刑冲）',
      baseValue: base, multipliers: [...steps, ...mods], value: r1(value),
      real: FRICTION_MAP[asp.type].real,
      energy: FRICTION_MAP[asp.type].energy,
      reliefs: mods.map((m) => m.why),
    });
  }

  rows.sort((a, b) => b.value - a.value);

  /* 6.6 宿命级摩擦警报：刑冲高度重合 且 无任何修正生效 */
  const fatal = rows.filter((r) => r.value >= 2.0 && r.reliefs.length === 0 && r.malefic.length > 0);
  if (fatal.length) {
    alerts.push({
      level: 'fatal',
      text: '⚠️ 【宿命级摩擦警报】：此盘存在「八字刑冲 + 星盘硬相位」叠加，且无有效通关（无合化、无贵人、无互容），建议用户在该领域（婚姻/事业/健康）采取绝对保守策略，切忌强行突破。',
      evidence: fatal.map((r) => `${r.aspect}=${r.value}（${r.bazi}）`),
    });
  }

  return {
    provided: true, rows, benign, alerts,
    baziSide: { chong: rel.chong, xing: rel.xing, hai: rel.hai, he: rel.he, heJi: has.heJi, heXing: has.heXing, detail: rel },
    yong: yongWx, ji: jiWx, guiPair,
  };
}

/* ── 6.5 输出 ── */
export function renderFriction(f, bazi) {
  const L = [];
  L.push('');
  L.push('## 【摩擦点交叉拓扑图】');
  if (!f.provided) { L.push(`- ${f.hint}`); return L.join('\n'); }
  if (!f.rows.length) L.push('- 未检出「占星硬相位 ∧ 八字刑冲克害」的叠加点。');
  else {
    L.push('| 占星硬相位 | 行星性质 | 八字对应刑冲 | 破坏值 | 现实显化 |');
    L.push('|-----------|---------|-------------|--------|---------|');
    for (const r of f.rows) L.push(`| ${r.aspect} | ${r.nature} | ${r.bazi} | **${r.value}** | ${r.real} |`);
    L.push('');
    L.push('### 破坏值拆解');
    for (const r of f.rows) {
      L.push(`- ${r.aspect}：基础 ${r.baseValue} × ${r.multipliers.map((m) => m.factor).join(' × ') || '1'} = **${r.value}**　${r.multipliers.map((m) => m.why).join('；') || ''}`);
    }
  }
  if (f.benign.length) {
    L.push('');
    L.push('### 吉相位（合相涉吉星，不计入摩擦）');
    for (const b of f.benign) L.push(`- ${b.aspect}：${b.energy} → ${b.real}`);
  }
  L.push('');
  L.push('## 【化解建议】');
  const yong = f.yong, ji = f.ji;
  const chongZhi = f.baziSide.detail.chongZhi;
  L.push(`- 八字侧：补用神【${yong}】、通关（取「${SHENG[ji] ?? '—'}」路线化解 ${ji} 的压迫）；${chongZhi.length ? `对 ${chongZhi.join('、')} 之冲，用合化（六合/三合）或贵人方位作缓冲。` : '原局无冲，无需合化缓冲，重点放在补用神。'}`);
  const maleficSet = [...new Set(f.rows.flatMap((r) => r.malefic))];
  const convert = { 土星: '压抑转为纪律', 冥王星: '控制转为深度洞察', 天王星: '突变转为创新', 海王星: '消融转为灵感', 火星: '攻击转为驱动力' };
  L.push(maleficSet.length
    ? `- 星盘侧：相位转化——把 ${maleficSet.map((p) => `${p} 的${convert[p] ?? '张力转为结构'}`).join('；')}。`
    : '- 星盘侧：未检出摩擦点，无需相位转化；保持现有节奏，把资源投在吉相位所指的领域。');
  L.push(f.rows.length
    ? `- 交叉策略：用八字用神【${yong}】去弥补星盘短板——把星盘硬相位所涉领域（${[...new Set(f.rows.map((r) => r.real))].slice(0, 3).join('、')}）的资源配置，统一改走「${yong}」属性的现实路径。`
    : `- 交叉策略：两系统本次无冲突叠加，用神【${yong}】可直接作为主配置推进；标注为低摩擦期，适合扩张而非防守。`);
  for (const a of f.alerts) { L.push(''); L.push(`> ${a.text}`); L.push(`> 证据：${a.evidence.join('；')}`); }
  return L.join('\n');
}
