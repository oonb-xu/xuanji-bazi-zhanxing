// Part 6.7.3 跨系统映射自发掘算法：采集样本 → 寻找共振点 → 提出假设 → 本次命局内验证 → 输出三类结论
// 诚实约束：单张命盘只能做「内部一致性」检验，故支持度只记为证据，升级为 verified 需 ≥3 张命盘且 0 反例（见 mapping-library 裁定 R-D3）
import { WU_XING } from '../bazi/wuxing.mjs';
import { GAN_WU_XING, SHENG, KE } from '../bazi/constants.mjs';
import { observe, buildLibrary } from './mapping-library.mjs';
import { correspondences } from './correspondence.mjs';
import { MALEFIC, mutualReception } from '../western/zodiac.mjs';

const HOUSE_NOBLE = [9, 4, 12];       // 偏印/印星域宫位
const HOUSE_CAREER = [10, 6, 2];      // 正官/事业域宫位
const HOUSE_RELATE = [7, 8];          // 日支/官杀域宫位

/** 假设表：每条都是「占星元素 ↔ 八字元素」的可检验命题 */
export const HYPOTHESES = [
  {
    id: 'H1', from: '太阳@7宫', to: '日支(夫妻宫)受引动',
    claim: '太阳落7宫 ⟺ 八字日支出现冲/合/刑/害',
    test({ A, bazi }) {
      const h7 = A.planets['太阳']?.house === 7;
      const act = bazi.L4_spouse.types.length > 0;
      if (!h7) return { checkable: false, note: '太阳不在7宫，本次不可检验' };
      return { checkable: true, supports: act, evidence: `太阳7宫=${h7}，日支${bazi.L4_spouse.zhi}关系=[${bazi.L4_spouse.types.join(',') || '无'}]` };
    },
  },
  {
    id: 'H2', from: '月亮×土星硬相位', to: '印星受克',
    claim: '月亮与土星/冥王星硬相位 ⟺ 八字印星五行权重 < 1.5',
    test({ A, bazi, weights, hard }) {
      const h = hard('月亮', '土星') || hard('月亮', '冥王星');
      const yinWx = bazi.L3_verdict.yinWx;
      const weak = weights[yinWx] < 1.5;
      return { checkable: true, supports: !!h === weak, evidence: `月-土/冥硬相位=${!!h}，印星(${yinWx})权重=${weights[yinWx]}→受克=${weak}` };
    },
  },
  {
    id: 'H3', from: '北交点落宫', to: '用神所属十神域',
    claim: '北交点落 9/4/12 宫（印星域）⟺ 八字用神为「生我」之五行',
    test({ A, bazi }) {
      const inNoble = HOUSE_NOBLE.includes(A.planets['北交点']?.house);
      if (A.planets['北交点']?.house == null) return { checkable: false, note: '未提供北交点宫位' };
      const yong = bazi.L5_yongJi.yong;
      const isYin = yong === bazi.L3_verdict.yinWx;
      return { checkable: true, supports: inNoble === isYin, evidence: `北交点${A.planets['北交点'].house}宫(印域=${inNoble})，用神${yong}(印=${isYin})` };
    },
  },
  {
    id: 'H4', from: '土星落宫', to: '官杀星状态',
    claim: '土星落 10/6/2 宫 ⟺ 八字官杀为忌/缺官杀',
    test({ A, bazi }) {
      const h = HOUSE_CAREER.includes(A.planets['土星']?.house);
      if (A.planets['土星']?.house == null) return { checkable: false, note: '未提供土星宫位' };
      const guanIsJi = bazi.L5_yongJi.ji === bazi.L3_verdict.guanWx;
      return { checkable: true, supports: h === (guanIsJi || bazi.L4_patterns.lackGuanSha), evidence: `土星${A.planets['土星'].house}宫，官杀为忌=${guanIsJi}，缺官杀=${bazi.L4_patterns.lackGuanSha}` };
    },
  },
  {
    id: 'H5', from: '冥王星硬相位', to: '七杀强度',
    claim: '冥王星存在硬相位 ⟺ 八字克我者（官杀）五行权重 ≥ 2.0',
    test({ A, bazi, weights, hardTo }) {
      const h = hardTo('冥王星');
      const strong = weights[bazi.L3_verdict.guanWx] >= 2.0;
      return { checkable: true, supports: h === strong, evidence: `冥王星硬相位=${h}，官杀(${bazi.L3_verdict.guanWx})权重=${weights[bazi.L3_verdict.guanWx]}→强=${strong}` };
    },
  },
  {
    id: 'H6', from: '10宫行星数', to: '官杀权重',
    claim: '10宫行星数 ≥2 ⟺ 八字官杀五行权重 ≥ 2.0',
    test({ A, bazi, weights }) {
      const n = Object.entries(A.planets).filter(([, v]) => v.house === 10).length;
      const strong = weights[bazi.L3_verdict.guanWx] >= 2.0;
      return { checkable: true, supports: (n >= 2) === strong, evidence: `10宫行星数=${n}，官杀(${bazi.L3_verdict.guanWx})权重=${weights[bazi.L3_verdict.guanWx]}` };
    },
  },
  {
    id: 'H7', from: '金星@8宫/天蝎', to: '财星受困',
    claim: '金星落8宫或天蝎 ⟺ 八字财星受困（财五行权重<1.0）',
    test({ A, bazi }) {
      const v = A.planets['金星'];
      if (!v) return { checkable: false, note: '未提供金星' };
      const h = v.house === 8 || v.sign === '天蝎';
      return { checkable: true, supports: h === bazi.L4_patterns.caiTrapped, evidence: `金星${v.house ?? '—'}宫/${v.sign ?? '—'}→${h}，财星受困=${bazi.L4_patterns.caiTrapped}(${bazi.L4_patterns.caiWeight})` };
    },
  },
  {
    id: 'H8', from: '融合点(合相)', to: '天干五合/地支六合',
    claim: '占星合相（涉吉星） ⟺ 八字存在天干五合或地支六合',
    test({ A, bazi, rel }) {
      const hasHe = (A.aspects ?? []).some((x) => x.type === '合相');
      if (!hasHe) return { checkable: false, note: '本次无合相' };
      return { checkable: true, supports: rel.he || rel.gan.some((g) => g.type === '五合'), evidence: `有合相=${hasHe}，八字六合=${rel.he}，天干五合=${rel.gan.some((g) => g.type === '五合')}` };
    },
  },
  {
    id: 'H9', from: '互容(接纳)', to: '合化降级',
    claim: '星盘存在行星互容 ⟺ 八字刑冲之支存在合化（可降级）',
    test({ A, bazi, mrList, rel }) {
      const hasMr = mrList.length > 0;
      const hasHeHua = rel.chongZhi.some((z) => rel.heZhi.includes(z)) || rel.heZhi.length > 0;
      if (!A.aspects?.length) return { checkable: false, note: '无相位数据' };
      return { checkable: true, supports: hasMr === hasHeHua, evidence: `互容=${hasMr}(${mrList.map((m) => `${m.a}/${m.b}`).join(',') || '无'})，八字合化=${hasHeHua}` };
    },
  },
];

/**
 * 执行自发掘：本命局内部验证 + 写入映射库
 * @param ctx { bazi, astroInput, calibration, friction }
 * @returns { findings:[], verified:[], pending:[], contradicted:[], qa:[] }
 */
export function discover({ bazi, astroInput, friction: f, write = true, chartId }) {
  // 无星盘 → 不做自发掘（避免在无数据时产出任何"发现"）
  if (!astroInput?.planets || Object.keys(astroInput.planets).length === 0) {
    return { chartId: null, skipped: true, reason: '未提供星盘，自发掘需要双侧数据', findings: [], verified: [], pending: [], contradicted: [], qa: [], mrList: [] };
  }
  const A = astroInput ?? { planets: {}, aspects: [] };
  const weights = bazi.L3_distribution.adjusted;
  const rel = f?.baziSide?.detail ?? null;
  const hard = (a, b) => (A.aspects ?? []).some((x) => [x.a, x.b].includes(a) && [x.a, x.b].includes(b) && ['对冲', '四分相', '合相'].includes(x.type));
  const hardTo = (p) => (A.aspects ?? []).some((x) => [x.a, x.b].includes(p) && ['对冲', '四分相'].includes(x.type));
  const mrList = [];
  const names = Object.keys(A.planets ?? {});
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const m = mutualReception({ name: names[i], sign: A.planets[names[i]].sign }, { name: names[j], sign: A.planets[names[j]].sign });
    if (m) mrList.push({ a: names[i], b: names[j], system: m.system });
  }
  const cid = chartId ?? `${bazi.pillars.join('')}-${A.planets?.['太阳']?.sign ?? 'x'}`;
  const ctx = { A, bazi, weights, rel, hard, hardTo, mrList };
  const lib = buildLibrary();

  const findings = [], verified = [], pending = [], contradicted = [];
  for (const h of HYPOTHESES) {
    let r;
    try { r = h.test(ctx); } catch (e) { r = { checkable: false, note: `检验异常：${e.message}` }; }
    const item = { id: h.id, claim: h.claim, from: h.from, to: h.to, ...r };
    if (!r.checkable) { pending.push({ ...item, status: 'insufficient' }); continue; }
    if (write) {
      const st = observe({ claim: h.claim, from: h.from, to: h.to, chartId: cid, supports: r.supports, note: r.evidence });
      item.library = st;
    }
    const prev = lib.get(`${h.from}→${h.to}`);
    if (r.supports === false) contradicted.push(item);
    else if (prev?.status === 'verified') verified.push(item);
    else if (prev?.seed) verified.push({ ...item, note: '基础表条目且本次支持' });
    else findings.push(item);
  }

  const qa = [
    { q: '八字中的胎元/命宫/身宫，在星盘中分别对应哪些行星或宫位？本次数据是否支持？',
      a: `按 6.7.2 表：胎元↔太阳/南交点、命宫↔太阳、身宫↔月亮。本次星盘 太阳${A.planets?.['太阳']?.sign ?? '—'}/${A.planets?.['太阳']?.house ?? '—'}宫、月亮${A.planets?.['月亮']?.sign ?? '—'}/${A.planets?.['月亮']?.house ?? '—'}宫；八字胎元${bazi.L4_taiYuan.ganzhi}、命宫${bazi.L4_mingGong.ganzhi}、身宫${bazi.L4_shenGong.ganzhi}。${A.planets?.['太阳'] ? '本次可检验（见 H1/H3）' : '本次无星盘数据，标记为待验证'}。` },
    { q: '八字中的刑冲克害，在星盘中对应哪些相位？本次数据是否一致？',
      a: f?.provided
        ? `八字侧：冲=${f.baziSide.chong}、刑=${f.baziSide.xing}、害=${f.baziSide.hai}、合=${f.baziSide.he}；星盘侧命中摩擦点 ${f.rows.length} 条${f.rows.length ? '（' + f.rows.map((r) => `${r.aspect}=${r.value}`).join('；') + '）' : ''}。`
        : '未提供星盘，无法比对。' },
    { q: '八字中的十神强弱，与星盘中行星庙旺落陷是否同步？',
      a: (() => {
        if (!A.planets || !Object.keys(A.planets).length) return '未提供星盘，无法比对。';
        const c = correspondences(bazi, A);
        return `按必然尊贵表（庙/旺/陷/落）逐项比对：可比的 ${c.meta.comparable} 项中，共振 ${c.meta.syncCount}、背离 ${c.meta.divergeCount}（同步率 ${c.meta.comparable ? (c.meta.syncCount / c.meta.comparable * 100).toFixed(0) : 0}%）。单项见 Part 8 的【本次新发现】；跨盘统计同步率需持续喂盘。`;
      })() },
  ];

  return { chartId: cid, findings, verified, pending, contradicted, qa, mrList };
}

export function renderDiscovery(d) {
  const L = [];
  L.push('');
  L.push('## 【跨系统映射自发掘】');
  if (d.skipped) { L.push(`- 跳过：${d.reason}`); return L.join('\n'); }
  L.push(`- 样本：${d.chartId}`);
  L.push('');
  L.push('### 【本次发现的新映射】');
  L.push(d.findings.length ? d.findings.map((x) => `- ${x.claim}　←　${x.evidence}`).join('\n') : '- 无（本次所有可检验命题均已入库或未被支持）');
  L.push('');
  L.push('### 【已验证的旧映射】');
  L.push(d.verified.length ? d.verified.map((x) => `- ${x.claim}　←　${x.evidence}`).join('\n') : '- 无（映射库中暂无 verified 条目，需 ≥3 张命盘一致支持）');
  L.push('');
  L.push('### 【待验证的猜想】');
  L.push(d.pending.length ? d.pending.map((x) => `- ${x.claim}　（${x.note ?? '本次数据不足'}）`).join('\n') : '- 无');
  if (d.contradicted.length) {
    L.push('');
    L.push('### 【反例 · 需进一步验证】');
    L.push(d.contradicted.map((x) => `- ${x.claim}　←　${x.evidence}`).join('\n'));
  }
  L.push('');
  L.push('### 自问自答（6.7.4）');
  for (const x of d.qa) { L.push(`- Q：${x.q}`); L.push(`  A：${x.a}`); }
  return L.join('\n');
}
