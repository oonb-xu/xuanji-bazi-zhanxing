// Part 5：占星 ⟷ 八字 交叉修正引擎
// 规则表的 5.1/5.2/5.3 三张映射表与 5.4 修正规则 A–E 全部按原文实现；
// 星盘以结构化对象输入（schema 见 docs/03），不依赖任何占星库即可运行。
import { GAN_WU_XING, ZHI_WU_XING, SHENG, KE } from '../bazi/constants.mjs';
import { WU_XING } from '../bazi/wuxing.mjs';

/* ── 5.1 占星元素 → 八字十神 ── */
export const PLANET_TO_SHISHEN = {
  太阳: { shiShen: '日主 / 命宫', mean: '核心意志、灵魂剧本' },
  月亮: { shiShen: '身宫 / 印星', mean: '情绪需求、安全感来源' },
  上升: { shiShen: '年柱 / 命宫', mean: '人格面具、外在行动方式' },
  水星: { shiShen: '食伤 / 印星', mean: '思维、表达、信息处理' },
  金星: { shiShen: '财星 / 比劫', mean: '爱、审美、吸引、资源交换' },
  火星: { shiShen: '七杀 / 羊刃', mean: '行动力、性驱力、攻击性' },
  木星: { shiShen: '食伤 / 印星', mean: '扩张、贵人、幸运、信仰' },
  土星: { shiShen: '正官 / 七杀', mean: '规则、压力、边界、责任' },
  天王星: { shiShen: '食伤 / 偏印', mean: '创新、突变、反叛' },
  海王星: { shiShen: '偏印 / 印星', mean: '灵性、幻灭、消融' },
  冥王星: { shiShen: '七杀 / 偏财', mean: '权力、深渊、控制、生死' },
  北交点: { shiShen: '用神 / 通关用神', mean: '今生进化方向' },
  南交点: { shiShen: '忌神 / 业力', mean: '前世遗留习气、舒适区' },
};

/* ── 5.2 占星宫位 → 八字宫位 ── */
export const HOUSE_TO_BAZI = {
  1: { gong: '日柱 / 命宫', field: '自我、身体、行动方式' },
  2: { gong: '年柱 / 财帛', field: '财务、自我价值、物质安全' },
  3: { gong: '月柱 / 兄弟', field: '沟通、学习、同辈' },
  4: { gong: '年柱 / 印星', field: '原生家庭、根基、不动产' },
  5: { gong: '时柱 / 食伤', field: '创作、恋爱、子女' },
  6: { gong: '时柱 / 官杀', field: '工作、健康、日常服务' },
  7: { gong: '日支 / 正官', field: '伴侣、合作、深度同盟' },
  8: { gong: '日支 / 七杀', field: '共享资源、债务、生死转化' },
  9: { gong: '年柱 / 偏印', field: '远方、信仰、高等智慧' },
  10: { gong: '时柱 / 正官', field: '事业、社会地位、公众形象' },
  11: { gong: '月柱 / 偏财', field: '社群、朋友、集体利益' },
  12: { gong: '年柱 / 偏印', field: '潜意识、灵性、消融' },
};

/* ── 5.3 占星相位 → 八字刑冲合害 ── */
export const ASPECT_TO_RELATION = {
  合相: { rel: '天干五合 / 地支六合', feat: '能量融合，相互放大' },
  对冲: { rel: '地支六冲 / 天克地冲', feat: '两极拉扯，需要平衡' },
  四分相: { rel: '地支相刑 / 天干相克', feat: '摩擦、挑战、成长张力' },
  三分相: { rel: '地支三合 / 三会', feat: '能量顺畅，天赋所在' },
  六分相: { rel: '地支半合 / 暗合', feat: '温和机遇，隐性助力' },
  梅花相: { rel: '地支相害', feat: '暗中消耗，慢性磨损' },
};

const SIGN_ELEMENT = {
  白羊: '火', 狮子: '火', 射手: '火',
  金牛: '土', 处女: '土', 摩羯: '土',
  双子: '风', 天秤: '风', 水瓶: '风',
  巨蟹: '水', 天蝎: '水', 双鱼: '水',
};
/** 土象宫位（规则 A：结构性身旺的判据） */
export const EARTH_HOUSES = [2, 6, 10];
const HARD_TYPES = new Set(['对冲', '四分相']);

export function normalizeAstro(astro) {
  if (!astro?.planets) return null;
  const planets = {};
  for (const [k, v] of Object.entries(astro.planets)) {
    planets[k] = { sign: v.sign ?? null, house: v.house ?? null, deg: v.deg ?? null, retro: !!v.retro };
  }
  return { planets, aspects: astro.aspects ?? [], raw: astro };
}

const houseOf = (A, n) => A?.planets?.[n]?.house ?? null;
const signOf = (A, n) => A?.planets?.[n]?.sign ?? null;
const inHouse = (A, n, hs) => hs.includes(houseOf(A, n));
const inSign = (A, n, ss) => ss.includes(signOf(A, n));
/** 硬相位：对冲/四分相；合相在涉及外行星（土/冥/天/海/火）时按硬相位计（裁定 R-C1） */
function hardAspect(A, a, b) {
  if (!A) return false;
  for (const asp of A.aspects) {
    const pair = [asp.a, asp.b];
    if (!pair.includes(a) || !pair.includes(b)) continue;
    if (HARD_TYPES.has(asp.type)) return { type: asp.type, a, b, note: '硬相位' };
    if (asp.type === '合相' && pair.some((p) => ['土星', '冥王星', '天王星', '海王星', '火星', '太阳', '月亮'].includes(p))) {
      return { type: asp.type, a, b, note: '合相按硬相位计（涉外行星/光体）' };
    }
  }
  return false;
}

/**
 * 交叉修正主入口
 * @param bazi compileBazi 的 IR
 * @param astro { planets:{名:{sign,house,deg}}, aspects:[{a,b,type}] }
 */
export function calibrate(bazi, astroInput) {
  const A = normalizeAstro(astroInput);
  if (!A) return { provided: false, hint: '未提供星盘；需 {planets:{太阳:{sign,house,deg},…},aspects:[{a,b,type}]}', rules: [], table: null };

  const v = bazi.L3_verdict, yj = bazi.L5_yongJi, sp = bazi.L4_spouse, pat = bazi.L4_patterns;
  const yong = yj.yong, ji = yj.ji;
  const rules = [];
  const add = (id, cond, hit, from, to, note) => rules.push({ id, cond, hit, from: from ?? null, to: to ?? null, note: note ?? null });

  /* A. 日主强弱修正 */
  add('A1', '八字身旺 ∧ 太阳/月亮落土象宫(2/6/10)', v.verdict === '身旺' && (inHouse(A, '太阳', EARTH_HOUSES) || inHouse(A, '月亮', EARTH_HOUSES)),
    v.verdict, '结构性身旺', '有现实底盘承载');
  const hardA2 = hardAspect(A, '土星', '太阳') || hardAspect(A, '土星', '月亮') || hardAspect(A, '冥王星', '太阳') || hardAspect(A, '冥王星', '月亮');
  add('A2', '八字身弱 ∧ 土星/冥王星刑克太阳或月亮', v.verdict === '身弱' && !!hardA2,
    v.verdict, '结构性身弱', `受压迫严重，需外力支撑${hardA2 ? `（${hardA2.a}${hardA2.type}${hardA2.b}）` : ''}`);
  add('A3', '八字从格 ∧ 太阳/月亮与冥王星硬相位', /^从/.test(v.verdict) && !!hardAspect(A, '冥王星', '太阳') || (/^从/.test(v.verdict) && !!hardAspect(A, '冥王星', '月亮')),
    v.verdict, '假从格', '潜意识有强烈自我意识，无法真正放弃抵抗');

  /* B. 用神修正 */
  add('B1', '用神=木 ∧ 北交点落9宫/双鱼座', yong === '木' && (inHouse(A, '北交点', [9]) || inSign(A, '北交点', ['双鱼'])), '木', '远方、信仰、高等智慧', '兑现路径，非仅食伤输出');
  add('B2', '用神=火 ∧ 太阳落7宫/摩羯座', yong === '火' && (inHouse(A, '太阳', [7]) || inSign(A, '太阳', ['摩羯'])), '火', '深度关系、体制权威', '兑现路径，非仅财富欲望');
  add('B3', '用神=土 ∧ 土星落4宫/处女座', yong === '土' && (inHouse(A, '土星', [4]) || inSign(A, '土星', ['处女'])), '土', '原生家庭责任、技术规则、不动产', '兑现路径，非仅官杀权力');
  add('B4', '用神=金 ∧ 天王星落10宫/水瓶座', yong === '金' && (inHouse(A, '天王星', [10]) || inSign(A, '天王星', ['水瓶'])), '金', '技术革新、非传统体制路径', '兑现路径，非仅传统正印学历');

  /* C. 忌神修正 */
  add('C1', '忌神=水 ∧ 月亮落2宫/巨蟹座', ji === '水' && (inHouse(A, '月亮', [2]) || inSign(A, '月亮', ['巨蟹'])), '水', '情绪安全感缺失引发的财务焦虑与过度付出', '需警惕「男妈妈模式」');
  add('C2', '忌神=金 ∧ 土星落4宫/处女座', ji === '金' && (inHouse(A, '土星', [4]) || inSign(A, '土星', ['处女'])), '金', '原生家庭的过度规训', '需警惕「完美主义自缚」');
  add('C3', '忌神=土 ∧ 冥王星落7宫/射手座', ji === '土' && (inHouse(A, '冥王星', [7]) || inSign(A, '冥王星', ['射手'])), '土', '关系中的权力斗争与控制', '需警惕「被伴侣吞噬」');

  /* D. 婚姻宫修正 */
  const p7 = ['冥王星', '土星'].filter((n) => houseOf(A, n) === 7);
  add('D1', '夫妻宫被冲 ∧ 7宫有冥王星/土星', sp.chong && p7.length > 0, `日支${sp.zhi}${sp.types.join('/') || '无'}`, '动荡程度加倍', '晚婚 + 找情绪稳定伴侣（双保险）');
  const jx8 = houseOf(A, '金星') === 8 || signOf(A, '金星') === '天蝎';
  add('D2', '夫妻宫被合 ∧ 金星落8宫/天蝎座', sp.he && jx8, `日支${sp.zhi}${sp.types.join('/') || '无'}`, '深度绑定与财务纠缠', '提前建立「财务独立契约」');
  const jiWx = ji, dayZhiWx = ZHI_WU_XING[sp.zhi];
  add('D3', '夫妻宫为忌神 ∧ 月亮落2宫/巨蟹座', dayZhiWx === jiWx && (inHouse(A, '月亮', [2]) || inSign(A, '月亮', ['巨蟹'])), `日支${sp.zhi}(${dayZhiWx})`, '安全感危机直接触发财务底线', '「钱不能被骗」列为婚姻第一原则');

  /* E. 事业路径修正 */
  const p10 = Object.keys(A.planets).filter((n) => houseOf(A, n) === 10);
  add('E1', '建禄格 ∧ 10宫有天王星', pat.jianLu && houseOf(A, '天王星') === 10, pat.labels.join('/') || '非建禄格', '体制内技术革新者', '既非纯体制官僚，也非纯自由职业');
  add('E2', '缺官杀 ∧ 土星落4宫', pat.lackGuanSha && houseOf(A, '土星') === 4, '缺官杀', '通过原生家庭现实重担逼出规则感', '非外部权威授予');
  add('E3', '财星受困 ∧ 木星落7宫/摩羯座', pat.caiTrapped && (houseOf(A, '木星') === 7 || signOf(A, '木星') === '摩羯'), `财星${pat.caiWeight}`, '深度合作、伴侣资源、体制红利', '非个人单打独斗');

  /* 5.5 交叉验证表 */
  const hits = rules.filter((r) => r.hit);
  const find = (id) => hits.find((r) => r.id === id);
  const table = [
    { dim: '日主强弱', bazi: v.verdict, astro: `太阳${houseOf(A, '太阳') ?? '—'}宫/${signOf(A, '太阳') ?? '—'}，月亮${houseOf(A, '月亮') ?? '—'}宫/${signOf(A, '月亮') ?? '—'}`, fixed: find('A1')?.to ?? find('A2')?.to ?? find('A3')?.to ?? `${v.verdict}（未触发修正）` },
    { dim: '核心用神', bazi: yong, astro: `北交点${houseOf(A, '北交点') ?? '—'}宫/${signOf(A, '北交点') ?? '—'}`, fixed: find('B1')?.to ?? find('B2')?.to ?? find('B3')?.to ?? find('B4')?.to ?? `${yong}（按常规食伤/财官路径兑现）` },
    { dim: '核心忌神', bazi: ji, astro: `土星${houseOf(A, '土星') ?? '—'}宫/冥王星${houseOf(A, '冥王星') ?? '—'}宫`, fixed: (() => { const r = find('C1') ?? find('C2') ?? find('C3'); return r ? `${r.to}｜${r.note}` : `${ji}（无特殊显化路径）`; })() },
    { dim: '婚姻宫', bazi: `日支${sp.zhi}：${sp.types.join('/') || '无冲合刑害'}`, astro: `7宫：${p7.join('/') || '无土冥'}；金星${houseOf(A, '金星') ?? '—'}宫`, fixed: [find('D1'), find('D2'), find('D3')].filter(Boolean).map((r) => r.to).join('；') || '风险等级：常态' },
    { dim: '事业路径', bazi: `格局：${pat.labels.join('/') || '常规'}`, astro: `10宫：${p10.join('/') || '无行星'}`, fixed: [find('E1'), find('E2'), find('E3')].filter(Boolean).map((r) => r.to).join('；') || '常规赛道' },
  ];

  const taiMingShen = [
    { p: '胎元', a: '南交点 / 4宫', mean: '先天根基与业力', real: '祖辈福报、原生家庭底色', val: bazi.L4_taiYuan.ganzhi, astro: `南交点${houseOf(A, '南交点') ?? '—'}宫` },
    { p: '命宫', a: '太阳', mean: '灵魂剧本与核心意志', real: '人生终极追求、不可妥协之处', val: bazi.L4_mingGong.ganzhi, astro: `太阳${signOf(A, '太阳') ?? '—'}` },
    { p: '身宫', a: '月亮', mean: '情绪防御与行为模式', real: '安全感来源、压力下的本能反应', val: bazi.L4_shenGong.ganzhi, astro: `月亮${signOf(A, '月亮') ?? '—'}` },
  ];

  return { provided: true, rules, hits, table, taiMingShen, earthHouses: EARTH_HOUSES, planetsIn10: p10 };
}

export function renderCalibration(c, bazi) {
  const L = [];
  L.push('');
  L.push('## 【占星八字交叉验证表】');
  if (!c.provided) { L.push(`- ${c.hint}`); return L.join('\n'); }
  L.push('| 维度 | 八字判定 | 星盘判定 | 修正后结论 |');
  L.push('|------|---------|---------|-----------|');
  for (const r of c.table) L.push(`| ${r.dim} | ${r.bazi} | ${r.astro} | **${r.fixed}** |`);
  L.push('');
  L.push('## 【胎命身与占星三星对照表】');
  L.push('| 胎命身 | 干支 | 对应占星 | 核心含义 | 现实显化 | 星盘落点 |');
  L.push('|--------|------|---------|---------|---------|---------|');
  for (const t of c.taiMingShen) L.push(`| ${t.p} | ${t.val} | ${t.a} | ${t.mean} | ${t.real} | ${t.astro} |`);
  L.push('');
  L.push('## 【跨系统落地建议】');
  const a = bazi.L3_distribution.adjusted;
  const strongest = WU_XING.strongest(a), weakest = WU_XING.weakest(a);
  L.push(`- 八字做功链条：命局最强 **${strongest}(${a[strongest]})**，需向其宣泄口「${SHENG[strongest]}」方向配置；最弱 **${weakest}(${a[weakest]})** 为结构短板，先补短板再用用神【${bazi.L5_yongJi.yong}】。`);
  L.push(`- 占星修正：命中 ${c.hits.length} 条修正规则 → ${c.hits.map((r) => `${r.id}(${r.to})`).join('；') || '无'}。按上表"修正后结论"重写自我叙事，避免用旧剧本解释现实阻力。`);
  L.push('- 交叉验证：两套系统共同指向的结论优先执行；仅单系统命中的条目作为观察项，不作决策依据。');
  return L.join('\n');
}
