// Step 6：结构化推演输出（去文言文，只输出可检验的代数结论）
import { DI_ZHI, TIAN_JIANG, ZHI_WU_XING, SHENG, KE, wuXingRelation } from './constants.mjs';

const JI = new Set(['贵人', '青龙', '六合', '太常']);
const XIONG = new Set(['白虎', '螣蛇', '朱雀', '勾陈']);
const AN = new Set(['玄武', '天空']);

export const jiangClass = (j) => (JI.has(j) ? '吉' : XIONG.has(j) ? '凶' : AN.has(j) ? '暗昧' : '中性');

/** 三传做功链条：逐段生克 → 通关/死克判定 */
export function chainAnalysis(chain) {
  const rels = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1];
    rels.push({ from: `${a.pos}${a.zhi}(${a.wuxing})`, to: `${b.pos}${b.zhi}(${b.wuxing})`, rel: wuXingRelation(a.wuxing, b.wuxing) });
  }
  const tags = [];
  const seq = chain.map((c) => c.wuxing);
  for (let i = 0; i < seq.length - 1; i++) {
    const r = wuXingRelation(seq[i], seq[i + 1]);
    if (r === 'a生b') tags.push(`${chain[i].pos}→${chain[i + 1].pos} 顺生（能量递送）`);
    else if (r === 'b生a') tags.push(`${chain[i + 1].pos}←${chain[i].pos} 逆生（回补，事有反复）`);
    else if (r === 'a克b' || r === 'b克a') tags.push(`${chain[i].pos}↔${chain[i + 1].pos} 相克（损耗/对抗）`);
    else tags.push(`${chain[i].pos}↔${chain[i + 1].pos} 同类（叠加，量变）`);
  }
  // 通关：初→中 被克，中→末 生回，视为有救
  const t = wuXingRelation(seq[0], seq[1]);
  const u = wuXingRelation(seq[1], seq[2]);
  if ((t === 'a克b' || t === 'b克a') && (u === 'a生b' || u === 'b生a')) tags.push('中传通关：阻而后通');
  if (t === 'a克b' && u === 'a克b') tags.push('⚠ 连克：死克链条，事情持续消耗');
  return { relations: rels, tags, chainFive: seq.join('→') };
}

export function render(r) {
  const L = [];
  L.push(`# 大六壬推演 · ${r.time.local ?? r.time.iso ?? '(干支输入)'}`);
  L.push('');
  L.push(`- 时间基座(L0)：中气=${r.time.zhongQi ?? '—'} · 占时=${r.L0_time.shiChen}时 · ${r.L0_time.dayNight}占`);
  L.push(`- 局(L1/L2)：月将=${r.L1_frame.yueJiang} · 天地盘旋转量=${r.L2_pan.rotation}（天盘=地盘+${r.L2_pan.rotation}）`);
  L.push(`- 贵人(L4)：日干${r.L4_guiRen.riGan} → 贵人${r.L4_guiRen.guiRenZhi}（昼夜对：${r.L4_guiRen.pair.join('/')}）落${r.L4_guiRen.landPos} → ${r.L4_guiRen.direction}`);
  L.push('');
  L.push('## 一、天盘 / 天将（地盘十二宫）');
  L.push('');
  L.push('| 地盘 | ' + DI_ZHI.join(' | ') + ' |');
  L.push('|---|' + DI_ZHI.map(() => '---').join('|') + '|');
  L.push('| 天盘 | ' + DI_ZHI.map((z) => r.L2_pan.tianPan[z]).join(' | ') + ' |');
  L.push('| 天将 | ' + DI_ZHI.map((z) => r.L4_tianJiang[z]).join(' | ') + ' |');
  L.push('');
  L.push('## 二、四课');
  L.push('');
  for (const [i, k] of r.siKe.entries()) {
    const rel = r.L3_relation.siKe[i].rel;
    const cls = jiangClass(r.L4_tianJiang[k.di]);
    L.push(`- 第${i + 1}课（${k.label}）：下「${k.bottom}(${k.wuxing[0]})」上「${k.top}(${k.wuxing[1]})」 · 生克:${rel} · 乘${r.L4_tianJiang[k.di]}(${cls})`);
  }
  L.push('');
  L.push('## 三、三传做功链条');
  L.push('');
  L.push(`- 课体：${r.L5_sanChuan.keTi}｜起法：${r.L5_sanChuan.method}｜权威源：${r.L5_sanChuan.authoritative}`);
  L.push(`- 本引擎推导：${r.L5_sanChuan.spec.chuChuan}/${r.L5_sanChuan.spec.zhongChuan}/${r.L5_sanChuan.spec.moChuan}｜第三方库：${r.L5_sanChuan.lib.chuChuan}/${r.L5_sanChuan.lib.zhongChuan}/${r.L5_sanChuan.lib.moChuan}｜对拍：${r.L5_sanChuan.agree ? '一致 ✓' : '不一致 ✗'}`);
  if (r.L5_sanChuan.special.length) L.push(`- 特殊课体提示：${r.L5_sanChuan.special.join('、')}（规则表 Step 4.6，已交专用规则，仅输出基础逻辑）`);
  const ca = chainAnalysis(r.L5_sanChuan.chain);
  L.push(`- 传链五行：${ca.chainFive}`);
  for (const rel of ca.relations) L.push(`  - ${rel.from} → ${rel.to}：${rel.rel}`);
  for (const t of ca.tags) L.push(`  - ${t}`);
  L.push('');
  L.push('## 四、事项定位');
  for (const c of r.L5_sanChuan.chain) {
    const j = r.L4_tianJiang[c.zhi];
    L.push(`- ${c.pos}「${c.zhi}·${c.wuxing}」乘${j}（${jiangClass(j)}）`);
  }
  if (r.input.matter) L.push(`- 所问：${r.input.matter} → 以初传为起因、末传为落点代入上表五行情景`);
  L.push('');
  L.push('## 五、协议自检');
  L.push(`- 置信度：${r.L5_sanChuan.confidence}`);
  return L.join('\n');
}
