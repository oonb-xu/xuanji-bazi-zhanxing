// 八字子项目 · Part 4 结构化输出
import { WU_XING } from './wuxing.mjs';
import { GAN_WU_XING, ZHI_WU_XING, SHENG, KE } from './constants.mjs';

const rel = (a, b) => {
  if (a === b) return '同气（叠加）';
  if (SHENG[a] === b) return 'a生b';
  if (SHENG[b] === a) return 'b生a';
  if (KE[a] === b) return 'a克b';
  if (KE[b] === a) return 'b克a';
  return '无关系';
};
/** a = 外部五行（胎元/命宫/身宫），b = 日主五行 */
const relWord = (a, b) => {
  if (a === b) return '同气叠加（帮身）';
  if (SHENG[a] === b) return '生扶（补我）';
  if (SHENG[b] === a) return '泄我（我生它）';
  if (KE[a] === b) return '克我（受制）';
  if (KE[b] === a) return '我克它（耗我）';
  return '无关系';
};

export function renderBazi(r) {
  const L = [];
  const a = r.L3_distribution.adjusted;
  const strongest = WU_XING.strongest(a), weakest = WU_XING.weakest(a);

  L.push(`# 八字推演 · ${r.meta.local ?? '(干支输入)'}`);
  L.push('');
  L.push('## 【排盘基础】');
  L.push(`- 原局：${r.pillars.map((p, i) => `${['年', '月', '日', '时'][i]}柱 ${p}`).join(' / ')}`);
  L.push(`- 日主：${r.dayMaster}（${r.L3_strength.dayMasterWx}）`);
  L.push(`- 胎元：${r.L4_taiYuan.ganzhi}（${r.L4_taiYuan.shiShen}）  ${r.L4_taiYuan.rule}`);
  L.push(`- 命宫：${r.L4_mingGong.ganzhi}（${r.L4_mingGong.shiShen}）  ${r.L4_mingGong.rule}`);
  L.push(`- 身宫：${r.L4_shenGong.ganzhi}（${r.L4_shenGong.shiShen}）  ${r.L4_shenGong.rule}`);
  L.push(`- 格局标记：${r.L4_patterns.labels.length ? r.L4_patterns.labels.join('、') : '无'}`);
  L.push('');

  L.push('## 【五行力量分析】');
  L.push(`- 原始分布：${WU_XING.LIST.map((w) => `${w}${r.L3_distribution.raw[w]}`).join(' ')}`);
  L.push(`- 修正分布：${WU_XING.LIST.map((w) => `${w}${a[w]}`).join(' ')}`);
  L.push(`- 帮身(印比)=${r.L3_verdict.support} vs 耗身(食财官)=${r.L3_verdict.oppose} → 占比 ${r.L3_verdict.ratio}`);
  const s = r.L3_strength;
  L.push(`- 日主强弱判定：**${r.L3_verdict.verdict}**（${r.L3_verdict.note}）`);
  L.push(`- Part1.4 权重明细：得令${s.deLing} + 得地${s.deDi} + 得势${s.deShi} = 帮身 ${s.helpScore}；被克泄耗 ${s.drain}；合计 ${s.score}`);
  for (const d of s.drainDetail) L.push(`  - ${d.rel} ${d.w}：${d.ev}`);
  L.push('');

  L.push('## 【地支藏干拆解】');
  for (const z of r.L1_zhi) {
    L.push(`- ${z.pos} ${z.zhi}（${z.wx}）：` + z.hide.map((h) => `${h.tier}**${h.gan}**(${h.wx},${h.shiShen},w=${h.weight}${h.mods.length ? ',' + h.mods.join('/') : ''})`).join(' · '));
  }
  if (r.L2_hidden.mods.length) L.push(`- 互动：${r.L2_hidden.mods.map((m) => (m.type === '冲' ? `${m.pos}${m.zhi}冲${m.with}` : m.type === '合' ? `${m.pos}${m.zhi}合${m.with}→${m.hua}` : m.type === '透' ? `${m.pos}${m.zhi}藏${m.gan}透干` : `三合局${m.zhi.join('')}→${m.hua}`)).join('；')}`);
  if (r.L2_hidden.ganHe) L.push(`- 天干五合：${r.L2_hidden.ganHe.pair.join('')}→${r.L2_hidden.ganHe.hua}`);
  L.push('');

  L.push('## 【做功链条推演】');
  L.push(`- 命局最强能量：**${strongest}**（${a[strongest]}）`);
  L.push(`- 其宣泄口（我生）：**${SHENG[strongest]}**（${a[SHENG[strongest]]}）`);
  L.push(`- 其受害星（我克）：**${KE[strongest]}**（${a[KE[strongest]]}）`);
  const flow = []; let cur = strongest;
  for (let i = 0; i < 5; i++) { flow.push(`${cur}(${a[cur]})`); cur = SHENG[cur]; }
  L.push(`- 五行流通图：${flow.join(' → ')}`);
  L.push(`- 链条诊断：${rel(strongest, SHENG[strongest]) === 'a生b' ? '最强能量有明确宣泄出口，气机流通' : '气机壅塞'}；最弱者 **${weakest}**（${a[weakest]}）为整局短板`);
  L.push(`- 用神/忌神（裁定 R-B3 扶抑法）：用 **${r.L5_yongJi.yong}** / 忌 **${r.L5_yongJi.ji}**（${r.L5_yongJi.why}）`);
  L.push('');

  L.push('## 【胎命身与八字共振】');
  for (const [name, obj, role] of [['胎元', r.L4_taiYuan, '先天根基'], ['命宫', r.L4_mingGong, '核心自我'], ['身宫', r.L4_shenGong, '后天行为']]) {
    const wx = GAN_WU_XING[obj.gan];
    const zwx = ZHI_WU_XING[obj.zhi];
    const isYong = wx === r.L5_yongJi.yong || zwx === r.L5_yongJi.yong;
    const isJi = wx === r.L5_yongJi.ji || zwx === r.L5_yongJi.ji;
    const fill = [wx, zwx].includes(weakest);
    const load = [wx, zwx].includes(strongest);
    L.push(`- ${name} ${obj.ganzhi}（干${wx}/${obj.shiShen}，支${zwx}）：对日主 ${relWord(wx, r.L3_strength.dayMasterWx)}；${isYong ? '落用神 ✅' : isJi ? '落忌神 ⚠' : '中性'}；${fill ? `补足原局最缺【${weakest}】` : ''}${load ? `加重原局最旺【${strongest}】` : ''}${!fill && !load ? '不改变命局结构' : ''}（${role}）`);
  }
  L.push('');

  L.push('## 【落地建议】');
  L.push(`- 补用神【${r.L5_yongJi.yong}】：在现实层面主动引入该五行对应的人/事/环境/节律，作为长期主配置。`);
  L.push(`- 泄忌神【${r.L5_yongJi.ji}】：不与忌神正面对抗，改走"${SHENG[strongest]} 出口"——把 ${strongest} 的过剩能量导向其生出的 ${SHENG[strongest]}。`);
  L.push(`- 结构短板：${weakest} 最弱，避免长期单点透支该维度；决策节奏上以"先补 ${weakest}、后动用神"为序。`);
  if (r.L4_spouse.types.length) L.push(`- 夫妻宫（日支${r.L4_spouse.zhi}）关系：${r.L4_spouse.rel.map((x) => `${x.type}${x.with}`).join('、')}`);
  return L.join('\n');
}
