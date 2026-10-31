// 八字子项目 · 推演编译器（规则表 Part 1 / Part 2 / Part 3）
// 输入：四柱干支（主路径）或出生时间（经 tyme4ts 定柱，含节气月）
// 输出：IR（含用神/忌神/格局/夫妻宫等 Part 5 交叉修正所需的最小充分字段）
import { SolarTime } from 'tyme4ts';
import {
  DI_ZHI, TIAN_GAN, ZHI_WU_XING, GAN_WU_XING, ZHI_YIN_YANG, GAN_YIN_YANG, SHENG, KE,
  LIU_CHONG, LIU_HE, XIANG_HAI, XIANG_XING, SAN_HE, GAN_HE,
  HIDE_GAN, HIDE_WEIGHT, HIDE_TIER, LU_WANG, WU_HU_DUN, GAN_ADV, ZHI_ADV3,
  shiShen, SHI_SHEN_WX, zhiIdx, ganIdx,
} from './constants.mjs';
import { WU_XING } from './wuxing.mjs';

const p2 = (n) => String(n).padStart(2, '0');
export const splitPillar = (gz) => {
  if (!gz || gz.length < 2) throw new Error(`非法干支：${gz}`);
  const gan = gz[0], zhi = gz[1];
  if (!GAN_WU_XING[gan]) throw new Error(`非法天干：${gan}`);
  if (zhiIdx(zhi) < 0) throw new Error(`非法地支：${zhi}`);
  return { gan, zhi, ganWx: GAN_WU_XING[gan], zhiWx: ZHI_WU_XING[zhi] };
};

/* ───────── Part 2：藏干引擎 ───────── */

/** R-B11：相冲力度按「柱距」分级——紧贴之冲最烈，隔柱之冲气势相连而根气不灭 */
export const CHONG_INTENSITY = {
  1: { main: 0.5, residual: 0 },     // 相邻（年月/月日/日时）：本气腰斩、中余气归零
  2: { main: 0.75, residual: 0.5 },  // 隔一柱（年日/月时）：本气留七五、中余气减半
  3: { main: 0.9, residual: 0.75 },  // 隔两柱（年时）：仅轻损
};

/**
 * 逐支提取藏干并按 Part 2.2 施加互动修正。
 * @returns { branches: [{pos,zhi,tierList,mods}], } 及五行增量
 */
export function hiddenStems(pillars) {
  const zhis = pillars.map((p) => p.zhi);
  const gans = pillars.map((p) => p.gan);
  const out = [];
  const mods = [];
  for (let i = 0; i < 4; i++) {
    const zhi = zhis[i];
    const pos = ['年', '月', '日', '时'][i];
    const list = HIDE_GAN[zhi].map((g, k) => (g ? { gan: g, wx: GAN_WU_XING[g], tier: HIDE_TIER[k], weight: HIDE_WEIGHT[k], mods: [] } : null)).filter(Boolean);

    // 2.2-a 天干透出藏干 → 该藏干力量翻倍
    for (const h of list) {
      if (gans.includes(h.gan)) { h.weight *= 2; h.mods.push('透干×2'); mods.push({ type: '透', pos, zhi, gan: h.gan }); }
    }
    // 2.2-b 被冲 → 按柱距分级（R-B11）
    let chongIdx = -1;
    for (let j = 0; j < 4; j++) if (j !== i && LIU_CHONG[zhi] === zhis[j]) { chongIdx = j; break; }
    if (chongIdx >= 0) {
      const dist = Math.abs(i - chongIdx);
      const { main, residual } = CHONG_INTENSITY[dist] ?? CHONG_INTENSITY[1];
      for (const h of list) {
        if (h.tier === '本气') { h.weight *= main; h.mods.push(`被冲×${main}`); }
        else { h.weight *= residual; h.mods.push(residual === 0 ? '被冲归零' : `被冲×${residual}`); }
      }
      mods.push({ type: '冲', pos, zhi, with: zhis[chongIdx], other: ['年', '月', '日', '时'][chongIdx], dist, main, residual });
    }
    // 2.2-c 被合 → 本气一半转向合化五行（合局双方须俱在原局）
    const heZhi = zhis.find((z, j) => j !== i && LIU_HE[zhi] === z);
    const heHua = heZhi ? huaOfBranchPair(zhi, heZhi) : null;
    if (heZhi && heHua) {
      const main = list.find((h) => h.tier === '本气');
      if (main) { main.halfTo = heHua; main.mods.push(`被合→半化${heHua}`); }
      mods.push({ type: '合', pos, zhi, with: heZhi, hua: heHua });
    }
    out.push({ pos, zhi, hide: list });
  }
  const sanhe = SAN_HE.find((s) => s.zhi.every((z) => zhis.includes(z))) ?? null;
  if (sanhe) mods.push({ type: '三合局', zhi: sanhe.zhi, hua: sanhe.wx });
  return { branches: out, mods, sanhe };
}

/** 六合合化五行：以「合化神＝局中更强一方」的固定口径取该支五行对（甲己合土式简化为支五行） */
function huaOfBranchPair(a, b) {
  const combo = [a, b];
  const hit = SAN_HE.find((s) => combo.every((z) => s.zhi.includes(z)));
  return hit ? hit.wx : (ZHI_WU_XING[a] === ZHI_WU_XING[b] ? ZHI_WU_XING[a] : null);
}

/** Part 1：五行权重分布（原始 + 修正后） */
export function wuXingDistribution(pillars) {
  const raw = WU_XING.zero();
  for (const p of pillars) raw[p.ganWx] += 1.0;
  for (const p of pillars) HIDE_GAN[p.zhi].forEach((g, k) => { if (g) raw[GAN_WU_XING[g]] += HIDE_WEIGHT[k]; });

  const hs = hiddenStems(pillars);
  const adj = WU_XING.zero();
  // 天干部分原样进入修正表
  for (const p of pillars) adj[p.ganWx] += 1.0;
  for (const b of hs.branches) {
    for (const h of b.hide) {
      const toHalf = h.halfTo ? h.weight * 0.5 : 0;
      adj[h.wx] += h.weight - toHalf;
      if (h.halfTo) adj[h.halfTo] += toHalf;
    }
  }
  if (hs.sanhe) adj[hs.sanhe.wx] += 1.0;
  // 天干五合标记（不改五行权重，仅标记，供 Part 5.3 相位映射）
  const ganHe = GAN_HE.find((g) => g.pair.every((p) => pillars.some((x) => x.gan === p)));
  return { raw, adjusted: adj, hidden: hs, ganHe, round: (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100])) };
}

/* ───────── Part 1.4：日主强弱 ───────── */

export function dayMasterStrength(pillars) {
  const dm = pillars[2].gan;
  const dmWx = GAN_WU_XING[dm];
  const yueWx = ZHI_WU_XING[pillars[1].zhi];
  const yinWx = Object.keys(SHENG).find((k) => SHENG[k] === dmWx); // 生我
  const shiWx = SHENG[dmWx];       // 我生
  const caiWx = KE[dmWx];          // 我克
  const guanWx = KE[dmWx] && Object.keys(KE).find((k) => KE[k] === dmWx); // 克我

  const items = [];
  // 得令（月令）= 3
  let deLing = 0;
  if (yueWx === dmWx) { deLing = 3; items.push({ rule: '得令(月令同我)', w: 3, ev: `月支${pillars[1].zhi}(${yueWx})` }); }
  else if (yueWx === yinWx) { deLing = 2; items.push({ rule: '得令(月令生我)', w: 2, ev: `月支${pillars[1].zhi}(${yueWx})` }); }
  // 得地（地支有根）= 2
  // ★ 2026-10-20 修正（R-B14）：首版只查 [2,3] 日/时支，**漏了年支与月支**。
  //   「得地」在子平里指**四支皆有日主之根**，不限日时。
  //   反例（古籍 QLMG-PJ-063 甲戌 丁卯 甲申 庚午）：甲坐月支卯（帝旺本气），
  //   首版因只查日/时支 ⇒ deDi=0，配合占比算法得出 r=0.289「身弱」，
  //   与原文明言「甲生卯月，为至旺之乡…身既旺」直接冲突。
  let deDi = 0;
  for (const i of [0, 1, 2, 3]) {
    const z = pillars[i].zhi;
    if (HIDE_GAN[z].some((g) => g && GAN_WU_XING[g] === dmWx)) {
      // 月支已在「得令」计入，此处只补 1（避免与得令重复计满额）
      const w = i === 1 ? 1 : 2;
      deDi += w;
      items.push({ rule: i === 1 ? '得地(月支根,得令已计)' : '得地(有根)', w, ev: `${['年', '月', '日', '时'][i]}支${z}` });
    }
  }
  // 得势（天干有透）= 1
  let deShi = 0;
  for (const i of [0, 1, 3]) {
    const g = pillars[i].gan, wx = GAN_WU_XING[g];
    if (wx === dmWx || wx === yinWx) { deShi += 1; items.push({ rule: '得势(帮身透干)', w: 1, ev: `${['年', '月', '日', '时'][i]}干${g}(${wx})` }); }
  }
  // 被克 / 被泄 / 被耗（对 年/月/时天干 与 四支本气 逐项）
  let drain = 0;
  const drainDetail = [];
  const push = (wx, ev) => {
    if (wx === guanWx) { drain -= 2; drainDetail.push({ rel: '被克', w: -2, ev }); }
    else if (wx === shiWx) { drain -= 1; drainDetail.push({ rel: '被泄', w: -1, ev }); }
    else if (wx === caiWx) { drain -= 1; drainDetail.push({ rel: '被耗', w: -1, ev }); }
  };
  for (const i of [0, 1, 3]) push(GAN_WU_XING[pillars[i].gan], `${['年', '月', '日', '时'][i]}干${pillars[i].gan}`);
  for (const i of [0, 1, 2, 3]) push(ZHI_WU_XING[pillars[i].zhi], `${['年', '月', '日', '时'][i]}支${pillars[i].zhi}本气`);

  const helpScore = deLing + deDi + deShi;
  const score = helpScore + drain;
  return { dayMaster: dm, dayMasterWx: dmWx, deLing, deDi, deShi, helpScore, drain, score, items, drainDetail };
}

/** 强弱判定：以「印比 vs 财官食伤」的修正后权重占比为准（阈值见 docs 裁定） */
export function strengthVerdict(pillars, dist) {
  const dmWx = GAN_WU_XING[pillars[2].gan];
  const yinWx = Object.keys(SHENG).find((k) => SHENG[k] === dmWx);
  const shiWx = SHENG[dmWx], caiWx = KE[dmWx];
  const guanWx = Object.keys(KE).find((k) => KE[k] === dmWx);
  const a = dist.adjusted;
  const S = a[dmWx] + a[yinWx];
  const T = a[shiWx] + a[caiWx] + a[guanWx];
  const r = S + T === 0 ? 0.5 : S / (S + T);
  const rooted = pillars.some((p, i) => i !== 2 && HIDE_GAN[p.zhi].some((g) => g && GAN_WU_XING[g] === dmWx));
  // R-B9（2026-10-08 修正）：从强格不能只看占比——「满盘印比、全局顺其势」还须**克泄耗无力**。
  // 判据取经典口径：克泄耗**不透干、且无本气之根**（中/余气之根不算，否则寅中丙火就会否定一切从旺格）。
  // 反例（本机实测）：癸巳日 印比占比 0.841，但丁火透干且巳本气为丙 → 不作从格，只判身旺。
  const opposing = [shiWx, caiWx, guanWx];
  const oppMax = Math.max(...opposing.map((w) => a[w]));
  const oppTouGan = pillars.some((p, i) => i !== 2 && opposing.includes(GAN_WU_XING[p.gan]));
  // 注意：日支**要计入**——它是日主的坐下，其本气同样构成克泄耗之根（曾误按「有根」的旧惯例排除日支）
  const oppBenqiRooted = pillars.some((p) => HIDE_GAN[p.zhi][0] && opposing.includes(GAN_WU_XING[HIDE_GAN[p.zhi][0]]));
  const canFollow = !oppTouGan && !oppBenqiRooted;      // 克泄耗既不透干、又无本气之根 → 方可论从
  let verdict, note;
  // ★ 2026-10-20 新增（R-B14）：「月令为纲」门 —— 得令且有根者**不得判身弱**
  //   子平以月令司权为纲（《子平真诠》《穷通宝鉴》）。纯占比算法把月支当普通地支，
  //   导致「甲生卯月（帝旺）」被算成 r=0.289 身弱，与古籍明言「为至旺之乡…身既旺」相悖。
  //   故：月令同我(临官/帝旺) 或 月令生我(相)，且日主有根 ⇒ 下界抬到「中和偏旺」。
  const yueWx = ZHI_WU_XING[pillars[1].zhi];
  const deLingSelf = yueWx === dmWx;
  const deLingYin = yinWx !== undefined && yueWx === yinWx;
  const lingGate = (deLingSelf || deLingYin) && rooted;
  if (r >= 0.8 && canFollow) { verdict = '从强格'; note = '印比占比≥0.80 且克泄耗不透干、无本气之根'; }
  else if (r >= 0.8) { verdict = '身旺'; note = `印比占比 ${r.toFixed(3)} 虽高，但克泄耗${[oppTouGan ? '有透干' : null, oppBenqiRooted ? '有本气之根' : null].filter(Boolean).join('、')}（最强 ${oppMax}）→ 不作从格`; }
  else if (r <= 0.2 && !rooted) { verdict = '从弱格'; note = '财官食伤占比≥0.80 且日主无根'; }
  else if (r >= 0.55) { verdict = '身旺'; note = '印比占比≥0.55'; }
  else if (r <= 0.45) {
    if (lingGate) { verdict = '中和偏旺'; note = `占比 ${r.toFixed(3)}≤0.45，但${deLingSelf ? '月令同我(得令)' : '月令生我(相)'}且有根 ⇒ 月令为纲，不判身弱`; }
    else { verdict = '身弱'; note = '印比占比≤0.45'; }
  }
  else {
    if (lingGate) { verdict = '中和偏旺'; note = `占比 ${r.toFixed(3)} 在 0.45–0.55，且月令助身有根 ⇒ 偏旺`; }
    else { verdict = r > 0.5 ? '中和偏旺' : '中和偏弱'; note = '印比占比在 0.45–0.55 之间'; }
  }
  return { verdict, ratio: Math.round(r * 1000) / 1000, support: Math.round(S * 100) / 100, oppose: Math.round(T * 100) / 100, rooted, yinWx, shiWx, caiWx, guanWx, note, lingGate, yueWx, follow: { canFollow, oppMax: Math.round(oppMax * 100) / 100, oppTouGan, oppBenqiRooted } };
}

/* ───────── Part 3：胎元 / 命宫 / 身宫 ───────── */

export function taiYuan(pillars) {
  const m = pillars[1];
  return { gan: GAN_ADV[m.gan], zhi: ZHI_ADV3[m.zhi], rule: '月柱天干进一位、地支进三位' };
}

/** 五虎遁：由年干与目标地支定位天干 */
export function wuHuDun(yearGan, targetZhi) {
  const start = WU_HU_DUN[yearGan];             // 寅月之干
  const shift = (zhiIdx(targetZhi) - zhiIdx('寅') + 12) % 12;
  return TIAN_GAN[(ganIdx(start) + shift) % 10];
}

export function mingGong(pillars) {
  const s = (zhiIdx(pillars[1].zhi) + 1) + (zhiIdx(pillars[3].zhi) + 1); // 月支数 + 时支数（子=1）
  const n = s <= 14 ? 14 - s : 26 - s;
  const num = n === 0 ? 12 : n;                 // 裁定 R-B2：得 0 时取 12（亥）
  const zhi = DI_ZHI[num - 1];
  return { zhi, gan: wuHuDun(pillars[0].gan, zhi), sum: s, num, rule: '和≤14→14−和；和>14→26−和；0 取 12' };
}

export function shenGong(pillars) {
  const s = (zhiIdx(pillars[1].zhi) + 1) + (zhiIdx(pillars[3].zhi) + 1);
  const n = s <= 12 ? s : s - 12;
  const zhi = DI_ZHI[n - 1];
  return { zhi, gan: wuHuDun(pillars[0].gan, zhi), sum: s, num: n, rule: '和≤12→取和；和>12→和−12' };
}

/* ───────── 格局 / 夫妻宫 / 用神忌神（Part 5 交叉修正的前置量） ───────── */

export function patterns(pillars, dist, verdict) {
  const dm = pillars[2].gan, dmWx = GAN_WU_XING[dm];
  const guanWx = Object.keys(KE).find((k) => KE[k] === dmWx);
  const caiWx = KE[dmWx];
  const has = (wx) => pillars.some((p) => p.ganWx === wx) || pillars.some((p) => HIDE_GAN[p.zhi].some((g) => g && GAN_WU_XING[g] === wx));
  const jianLu = pillars[1].zhi === LU_WANG[dm];
  const out = {
    jianLu, jianLuEv: jianLu ? `月支${pillars[1].zhi}为日主${dm}之禄` : null,
    lackGuanSha: !has(guanWx),
    caiWeight: Math.round(dist.adjusted[caiWx] * 100) / 100,
    caiTrapped: dist.adjusted[caiWx] < 1.0,
    guanWx, caiWx,
  };
  out.labels = [jianLu && '建禄格', out.lackGuanSha && '缺官杀', out.caiTrapped && '财星受困'].filter(Boolean);
  return out;
}

export function spousePalace(pillars) {
  const zhi = pillars[2].zhi;
  const others = pillars.filter((_, i) => i !== 2).map((p) => p.zhi);
  const rel = [];
  for (const z of others) {
    if (LIU_CHONG[zhi] === z) rel.push({ type: '冲', with: z });
    else if (LIU_HE[zhi] === z) rel.push({ type: '合', with: z });
    if (XIANG_HAI[zhi] === z) rel.push({ type: '害', with: z });
    if (XIANG_XING[zhi] === z) rel.push({ type: '刑', with: z });
  }
  const types = [...new Set(rel.map((r) => r.type))];
  return { zhi, wx: ZHI_WU_XING[zhi], rel, types, chong: types.includes('冲'), he: types.includes('合') };
}

/** 扶抑用神/忌神（规则表未给等式，按裁定 R-B3 生成，见 docs） */
export function yongJiShen(dist, verdict) {
  const dmWx = verdict.dayMasterWx ?? GAN_WU_XING[verdict.dayMaster];
  const yinWx = verdict.yinWx, shiWx = verdict.shiWx, caiWx = verdict.caiWx, guanWx = verdict.guanWx;
  const a = dist.adjusted;
  const pick = (list) => list.slice().sort((x, y) => a[x] - a[y])[0];              // 最缺者 → 用于「用神」
  const pickMax = (list) => list.slice().sort((x, y) => a[y] - a[x])[0];           // 最旺者 → 用于「忌神」
  let yong, ji, why;
  if (verdict.verdict === '身旺' || verdict.verdict === '中和偏旺' || verdict.verdict === '从弱格') {
    yong = pick([guanWx, caiWx, shiWx]); ji = pickMax([dmWx, yinWx]); why = '身旺宜泄耗克：用神取候选中原局最缺者，忌神取印比中最旺者'; }
  else if (verdict.verdict === '从强格') {
    yong = dmWx; ji = pickMax([guanWx, caiWx, shiWx]); why = '从强顺其势：用同我，忌克泄耗中最旺者'; }
  else {
    yong = pick([yinWx, dmWx]); ji = pickMax([guanWx, caiWx, shiWx]); why = '身弱宜生扶：用神取候选中原局最缺者，忌神取克泄耗中最旺者'; }
  return { yong, ji, why, candidates: { yinWx, dmWx, shiWx, caiWx, guanWx } };
}

/* ───────── 编译主入口 ───────── */

export function compileBazi(input) {
  let pillars, meta = { source: 'ganzhi' };
  if (input.pillars) {
    if (input.pillars.length !== 4) throw new Error('需要 4 柱');
    pillars = input.pillars.map(splitPillar);
  } else {
    const d = input.at instanceof Date ? input.at : new Date(input.at);
    if (Number.isNaN(d.getTime())) throw new Error(`无法解析时间：${input.at}`);
    const ec = SolarTime.fromYmdHms(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), 0).getLunarHour().getEightChar();
    const gz = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getHour()].map((c) => c.getName());
    pillars = gz.map(splitPillar);
    meta = {
      source: 'date', local: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`,
      pillars: gz, gender: input.gender ?? null,
      lib: { taiYuan: ec.getFetalOrigin().getName(), mingGong: ec.getOwnSign().getName(), shenGong: ec.getBodySign().getName() },
    };
  }

  const dist = wuXingDistribution(pillars);
  const strength = dayMasterStrength(pillars);
  const verdict = strengthVerdict(pillars, dist);
  const ty = taiYuan(pillars), mg = mingGong(pillars), sg = shenGong(pillars);
  const dm = pillars[2].gan;
  const shiShenOf = (g) => shiShen(dm, g);
  const pats = patterns(pillars, dist, verdict);
  const spouse = spousePalace(pillars);
  const yj = yongJiShen(dist, { ...verdict, dayMaster: dm });

  const posName = ['年柱', '月柱', '日柱', '时柱'];
  const ganList = pillars.map((p, i) => ({ pos: posName[i], gan: p.gan, wx: p.ganWx, shiShen: i === 2 ? '日主' : shiShenOf(p.gan) }));
  const zhiList = pillars.map((p, i) => ({
    pos: posName[i], zhi: p.zhi, wx: p.zhiWx,
    hide: dist.hidden.branches[i].hide.map((h) => ({ gan: h.gan, wx: h.wx, tier: h.tier, weight: Math.round(h.weight * 100) / 100, shiShen: shiShenOf(h.gan), mods: h.mods })),
  }));

  return {
    model: 'meta-unified/bazi',
    version: '1.0.0',
    layer: 'L0-L5',
    input: { raw: input, matter: input.matter ?? null },
    meta,
    pillars: pillars.map((p) => p.gan + p.zhi),
    L1_gan: ganList,
    L1_zhi: zhiList,
    L2_hidden: { mods: dist.hidden.mods, sanhe: dist.hidden.sanhe, ganHe: dist.ganHe },
    L3_distribution: { raw: dist.round(dist.raw), adjusted: dist.round(dist.adjusted) },
    L3_strength: strength,
    L3_verdict: verdict,
    L4_taiYuan: { ...ty, ganzhi: ty.gan + ty.zhi, shiShen: shiShenOf(ty.gan) },
    L4_mingGong: { ...mg, ganzhi: mg.gan + mg.zhi, shiShen: shiShenOf(mg.gan) },
    L4_shenGong: { ...sg, ganzhi: sg.gan + sg.zhi, shiShen: shiShenOf(sg.gan) },
    L4_patterns: pats,
    L4_spouse: spouse,
    L5_yongJi: yj,
    dayMaster: dm,
  };
}
