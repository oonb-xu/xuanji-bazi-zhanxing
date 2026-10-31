// 星宫分层（缺口 #1）：星 = 十神，宫 = 宫位
//
// 杨炎高频判据「星宫交战」的可执行版。两层：
//   · 星：该宫**本气藏干**对日主的十神（tenGod）+ 十神组（TG_GROUP）
//   · 宫：年/月/日/时 四宫位（祖上/父母 · 父母/兄弟 · 夫妻 · 子女）
//
// ★ 标度纪律：本模块**只**用 tenGod + CANG + 关系表自算，**不读 L3_distribution**。
//   引擎的藏干加权分布（L3_distribution）与自算藏干是两套标度，禁止跨标度替换（项目铁律）。
//
// 交战四判（判夫妻宫＝日支）：
//   ① 日支被 CHONG 冲            → 『夫妻宫被冲』
//   ② 日支本气五行 == 忌神 ji     → 『夫妻宫坐忌』
//   ③ 配偶星（男财/女官杀）落在被 冲/六合/刑 命中的宫 → 『配偶星被引动交战』
//   ④ 配偶星五行 与 夫妻宫本气五行 KE 相克 → 『星宫相克』
//      （说明：宫本气藏干五行恒等于该支五行，用「宫自身之星」与宫对比必同气、永不触发，
//        故 ④ 取**配偶星**为星、宫本气为宫。）
import { CANG, CHONG, LIUHE, XING3, POS_W, GAN_WX, KE } from './dag.mjs';
import { tenGod, TG_GROUP } from './ten-gods.mjs';

/** 宫位：四柱位置 → 六亲宫 */
export const PALACE = { 年: '祖上/父母宫', 月: '父母/兄弟宫', 日: '夫妻宫', 时: '子女宫' };

/** 柱序 → 位置名 */
const POS = ['年', '月', '日', '时'];

/** 本气藏干（CANG[zhi][0]）—— 宫位之星与宫本气五行都从这里取 */
export function mainGanOf(zhi) {
  return (CANG[zhi] ?? [])[0] ?? null;
}

/** 两两地支关系（只取星宫交战所需三类：冲 / 六合 / 刑） */
function pairRelations(branches) {
  const out = [];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i], b = branches[j];
      if (CHONG[a] === b) out.push({ k: '冲', i, j, pair: a + b });
      if (LIUHE[a] === b) out.push({ k: '六合', i, j, pair: a + b });
      for (const g of XING3) {
        if (a !== b && g.includes(a) && g.includes(b)) out.push({ k: '刑', i, j, pair: a + b, set: g.join('') });
      }
    }
  }
  return out;
}

/**
 * ★ 星宫分层表：逐柱给出 { pos, palace, zhi, mainGan, star, group, posW }
 * @param bazi compileBazi() 的结果（只读 pillars[2] 作日干）
 */
export function starPalace(bazi) {
  const pillars = bazi?.pillars;
  if (!Array.isArray(pillars) || pillars.length !== 4) throw new Error('starPalace 需要含 4 柱的 bazi.pillars');
  const dmGan = pillars[2][0];
  return pillars.map((pillar, i) => {
    const pos = POS[i];
    const zhi = pillar[1];
    const mainGan = mainGanOf(zhi);
    const star = mainGan ? tenGod(mainGan, dmGan) : null;
    return {
      pos, palace: PALACE[pos], zhi, mainGan, star,
      group: star ? (TG_GROUP[star] ?? null) : null,
      posW: POS_W[pos],
    };
  });
}

/**
 * ★ 星宫交战（夫妻宫为主）：冲 / 坐忌 / 配偶星被引动 / 星宫相克
 * @param bazi compileBazi() 结果
 * @param opts { gender } 缺省 '男'；干支输入且未给 gender 时标 genderAssumed
 * @returns { war, reasons, verdict, palace, gender, genderAssumed, spouseStar, evidence }
 */
export function xingGongWar(bazi, opts = {}) {
  const palace = starPalace(bazi);
  const pillars = bazi.pillars;
  const branches = pillars.map((p) => p[1]);
  const dmGan = pillars[2][0];
  const dmWx = GAN_WX[dmGan];
  const rels = pairRelations(branches);

  // gender：显式入参 > bazi.meta.gender > 原始输入 > 缺省 '男'
  const explicit = opts?.gender ?? bazi?.meta?.gender ?? bazi?.input?.raw?.gender ?? null;
  const gender = explicit ?? '男';
  const genderAssumed = explicit == null;

  const DAY = 2;
  const dayRow = palace[DAY];
  const dayZhi = dayRow.zhi;
  const gongWx = dayRow.mainGan ? GAN_WX[dayRow.mainGan] : null;   // 夫妻宫本气五行
  const dayStarWx = gongWx;

  // 配偶星：男取财（我克），女取官杀（克我）
  const caiWx = KE[dmWx] ?? null;
  const guanWx = Object.keys(KE).find((w) => KE[w] === dmWx) ?? null;
  const spouseWx = gender === '女' ? guanWx : caiWx;
  const spouseGroup = gender === '女' ? '官杀' : '财';

  const reasons = [];
  const evidence = [];
  const relOf = (idx) => rels.filter((r) => r.i === idx || r.j === idx);
  const otherOf = (r, idx) => (r.i === idx ? r.j : r.i);

  // ① 夫妻宫被冲
  const dayChong = relOf(DAY).filter((r) => r.k === '冲');
  if (dayChong.length) {
    reasons.push('夫妻宫被冲');
    evidence.push(`① 日支${dayZhi}被${dayChong.map((r) => `${POS[otherOf(r, DAY)]}支${branches[otherOf(r, DAY)]}(${r.pair})`).join('、')}冲 → 夫妻宫被冲`);
  }

  // ② 日支本气星五行 == 忌神
  const ji = bazi?.L5_yongJi?.ji ?? null;
  if (ji && dayStarWx === ji) {
    reasons.push('夫妻宫坐忌');
    evidence.push(`② 日支${dayZhi}本气${dayRow.mainGan}(${dayStarWx})＝忌神${ji} → 夫妻宫坐忌`);
  }

  // ③ 配偶星落在被 冲/六合/刑 命中的宫
  const spouseHits = [];
  for (let i = 0; i < palace.length; i++) {
    if (palace[i].group !== spouseGroup) continue;
    const hit = relOf(i);
    if (!hit.length) continue;
    spouseHits.push({ pos: palace[i].pos, zhi: palace[i].zhi, star: palace[i].star, rels: [...new Set(hit.map((r) => r.k))] });
  }
  if (spouseHits.length) {
    reasons.push('配偶星被引动交战');
    evidence.push(`③ 配偶星${spouseGroup}在${spouseHits.map((h) => `${h.pos}支${h.zhi}${h.star}(${h.rels.join('/')})`).join('、')} 被命中 → 配偶星被引动交战`);
  }

  // ④ 配偶星五行 与 夫妻宫本气五行 相克
  if (spouseWx && gongWx && (KE[spouseWx] === gongWx || KE[gongWx] === spouseWx)) {
    reasons.push('星宫相克');
    evidence.push(`④ 配偶星${spouseWx} 与 夫妻宫${dayZhi}本气${gongWx} 相克（${KE[spouseWx] === gongWx ? `${spouseWx}克${gongWx}` : `${gongWx}克${spouseWx}`}）→ 星宫相克`);
  }

  const war = reasons.length > 0;
  return {
    war,
    reasons,
    verdict: war ? '星宫交战' : '星宫安和',
    palace,
    gender,
    genderAssumed,
    spouseStar: { gender, group: spouseGroup, wx: spouseWx, hits: spouseHits },
    evidence,
  };
}
