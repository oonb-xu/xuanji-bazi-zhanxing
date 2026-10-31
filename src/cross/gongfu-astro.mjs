// 盲派做功 × 星盘能量流：为什么做功比子平法更贴星盘？
//
// ★ 用户裁定（2026-10-29）：
//   「子平法只用于八字测，不做融合；把盲派的做功理论融合，因为更贴切星盘的能量互动。」
//
// ── 为什么这个判断在结构上成立 ──────────────────
//   子平法（传统八字）的核心是**静态强弱**：
//     得令/得地/得势/得生 → 一个标量（身强/身弱）→ 再定喜忌。
//     它是"这台机器有多少马力"。
//
//   盲派做功的核心是**有向的能量传递**：
//     谁制谁、谁合谁、库被冲开向谁做功 —— 这是一张**有向图**。
//     它是"马力往哪儿去了、传给了谁"。
//
//   而星盘的相位输能也是**有向图**：
//     A→B 的输能量 = |尊贵差| × 相位权重 × orb 衰减。
//     同样是"能量从谁流到谁"。
//
//   ⇒ **盲派与星盘同构（都是有向能量流），子平法与星盘异构（标量 vs 有向图）。**
//     所以做功能融，子平法只能留在八字测里。

const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };   // A 克 ?
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // A 生 ?
const KE_BY = Object.fromEntries(Object.entries(KE).map(([a, b]) => [b, a]));      // ? 被谁克
const SHENG_BY = Object.fromEntries(Object.entries(SHENG).map(([a, b]) => [b, a])); // ? 被谁生

/* ══════════════════════════════════════════════
 * ① 盲派做功：从四柱提取「有向能量流」
 * ══════════════════════════════════════════════ */
const POS_NAME = ['年', '月', '日', '时'];

/**
 * @param pillars ['庚午','己卯','己卯','庚午']
 * @returns { flows: [{from, to, kind, wx, strength}], dm, summary }
 *   kind: 'ke'(克) | 'sheng'(生) | 'he'(合) | 'chong'(冲开库)
 */
export function gongFlows(pillars) {
  if (!Array.isArray(pillars) || pillars.length < 4) return null;
  const cells = pillars.map((p, i) => ({
    pos: POS_NAME[i], i,
    gan: p[0], zhi: p[1],
    ganWx: GAN_WX[p[0]], zhiWx: ZHI_WX[p[1]],
    isDayMaster: i === 2,
  }));
  const dm = cells[2].gan, dmWx = cells[2].ganWx;
  const flows = [];

  /* 天干之间的生克：干的能量流向最直接 */
  for (const a of cells) {
    for (const b of cells) {
      if (a === b) continue;
      if (a.ganWx === KE[b.ganWx]) {
        flows.push({
          from: `${a.pos}干${a.gan}`, to: `${b.pos}干${b.gan}`,
          kind: '克', wx: `${a.ganWx}克${b.ganWx}`,
          strength: b.isDayMaster ? 1.0 : 0.7,      // 克到日主最重
          note: b.isDayMaster ? '克日主 ⇒ 做功直接作用在"我"身上' : '制（做功）',
        });
      } else if (a.ganWx === SHENG[b.ganWx]) {
        flows.push({
          from: `${a.pos}干${a.gan}`, to: `${b.pos}干${b.gan}`,
          kind: '生', wx: `${a.ganWx}生${b.ganWx}`,
          strength: b.isDayMaster ? 0.9 : 0.6,
          note: b.isDayMaster ? '生日主 ⇒ 供给' : '生（输送）',
        });
      }
    }
  }

  /* 地支之间的冲：冲开库 ⇒ 库中藏干出来做功 */
  const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (CHONG[cells[i].zhi] === cells[j].zhi) {
        flows.push({
          from: `${cells[i].pos}支${cells[i].zhi}`, to: `${cells[j].pos}支${cells[j].zhi}`,
          kind: '冲', wx: `${cells[i].zhiWx}/${cells[j].zhiWx} 冲`,
          strength: 0.8, bidirectional: true,
          note: '冲开库 ⇒ 藏干被释放做功（双向）',
        });
      }
    }
  }

  /* 六合 */
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (LIUHE[cells[i].zhi] === cells[j].zhi) {
        flows.push({
          from: `${cells[i].pos}支${cells[i].zhi}`, to: `${cells[j].pos}支${cells[j].zhi}`,
          kind: '合', wx: `${cells[i].zhiWx}+${cells[j].zhiWx}`,
          strength: 0.7, bidirectional: true,
          note: '六合 ⇒ 两方能量合流（双向）',
        });
      }
    }
  }

  /* 汇总：日主得到多少、失去多少 */
  const intoDm = flows.filter((f) => f.to.includes('日干')).reduce((s, f) => s + (f.kind === '克' ? -f.strength : f.strength), 0);
  const outOfDm = flows.filter((f) => f.from.includes('日干')).reduce((s, f) => s + f.strength, 0);

  return {
    dm, dmWx, flows,
    summary: {
      total: flows.length,
      ke: flows.filter((f) => f.kind === '克').length,
      sheng: flows.filter((f) => f.kind === '生').length,
      chong: flows.filter((f) => f.kind === '冲').length,
      he: flows.filter((f) => f.kind === '合').length,
      netIntoDayMaster: Math.round(intoDm * 100) / 100,
      outOfDayMaster: Math.round(outOfDm * 100) / 100,
    },
  };
}

/* ══════════════════════════════════════════════
 * ② 星盘能量流：从相位与尊贵差提取有向流
 * ══════════════════════════════════════════════ */
const ASPECT_WEIGHT = { 合相: 1.0, 三分相: 0.85, 对冲: 0.75, 四分相: 0.7, 六分相: 0.6 };
const HARD = new Set(['对冲', '四分相']);
const SOFT = new Set(['三分相', '六分相']);

/**
 * @param planets [{name, sign, lon}]
 * @param aspects [{a,b,type,orb}]
 * @param dignityOf (name, sign) => {tier, k}
 */
export function astroFlows(planets, aspects, dignityOf) {
  const list = Array.isArray(planets)
    ? planets
    : Object.entries(planets || {}).map(([k, v]) => ({ name: v?.name ?? k, ...v }));
  const byName = new Map(list.map((p) => [p.name, p]));
  const flows = [];

  for (const a of (aspects || [])) {
    const pa = byName.get(a.a), pb = byName.get(a.b);
    if (!pa || !pb) continue;
    const w = ASPECT_WEIGHT[a.type] ?? 0.5;
    const orbFade = Math.max(0.05, 1 - Math.min(1, (a.orb ?? 0) / 8));
    const dA = dignityOf ? dignityOf(pa.name, pa.sign) : { k: 1, tier: '平' };
    const dB = dignityOf ? dignityOf(pb.name, pb.sign) : { k: 1, tier: '平' };

    // 有向输能：强者 → 弱者（尊贵差驱动）
    const diff = dA.k - dB.k;
    const strong = diff >= 0 ? pa : pb;
    const weak = diff >= 0 ? pb : pa;
    const amount = Math.abs(diff) * w * orbFade;

    // 相位本身的力量（"做功"的量），与方向无关
    const work = w * orbFade;

    flows.push({
      from: strong.name, to: weak.name,
      type: a.type, orb: a.orb,
      work: Math.round(work * 1000) / 1000,
      transfer: Math.round(amount * 1000) / 1000,
      polarity: HARD.has(a.type) ? 'hard' : SOFT.has(a.type) ? 'soft' : 'conj',
      note: amount > 0.05
        ? `${a.type} ${a.orb}° ⇒ ${strong.name}→${weak.name} 输能 ${Math.round(amount * 1000) / 1000}`
        : `${a.type} ${a.orb}° ⇒ 尊贵相当，无定向输能`,
    });
  }

  return {
    flows,
    summary: {
      total: flows.length,
      hard: flows.filter((f) => f.polarity === 'hard').length,
      soft: flows.filter((f) => f.polarity === 'soft').length,
      conj: flows.filter((f) => f.polarity === 'conj').length,
      totalWork: Math.round(flows.reduce((s, f) => s + f.work, 0) * 100) / 100,
      totalTransfer: Math.round(flows.reduce((s, f) => s + f.transfer, 0) * 100) / 100,
      topTransfers: flows.filter((f) => f.transfer > 0.05).sort((x, y) => y.transfer - x.transfer).slice(0, 5),
    },
  };
}

/* ══════════════════════════════════════════════
 * ③ 对应层：做功 ⇄ 星盘能量流
 * ══════════════════════════════════════════════ */
export const GONGFU_ASTRO_MAP = {
  title: '盲派做功 ⇄ 星盘能量流',
  thesis: '两者都是**有向图**（能量从谁流到谁），所以可融；子平法给出的是标量强弱，与星盘异构，故不融。',
  rows: [
    { gong: '克（制）', astro: '硬相位（对冲/四分）', why: '都是压制性、单向、消耗型的力量传递', kind: 'hard' },
    { gong: '生（输送）', astro: '和谐相位（三分/六分）', why: '都是供给性、顺势的力量传递', kind: 'soft' },
    { gong: '冲开库', astro: '合相（同度共处）', why: '都是"封闭的东西被打开/被看见"', kind: 'conj' },
    { gong: '合', astro: '合相 + 单向输能', why: '合 = 位置合并；单向输能 = 强者补给弱者', kind: 'conj' },
    { gong: '做功方向（谁制谁）', astro: '输能方向（强者→弱者）', why: '都由"强弱差"决定方向', kind: 'dir' },
    { gong: '功神（有效做功）', astro: '高输能源（尊贵强且 orb 紧）', why: '有效输出', kind: 'dir' },
    { gong: '废神（无效做功）', astro: '弱源（陷落且 orb 宽）', why: '名义上有相位但输不出能量', kind: 'dir' },
  ],
  /** 结构性差异，必须承认 */
  differences: [
    '做功是**离散关系**（克/生/冲/合），星盘是**连续角度**（有 orb）',
    '做功的"库"概念星盘没有直接对应（只能类比"合相的开放"）',
    '盲派的"宾主"（谁为主）在星盘里没有原生对应，只能借"角宫 vs 果宫"近似',
  ],
};

/**
 * 把两边的流放在一起对照，给出「同构度」
 */
export function compareFlows(gong, astro) {
  if (!gong || !astro) return null;
  const g = gong.summary, a = astro.summary;
  // 粗对应：克的占比 vs 硬相位占比；生的占比 vs 和谐相位占比
  const gTotal = Math.max(1, g.ke + g.sheng + g.chong + g.he);
  const aTotal = Math.max(1, a.hard + a.soft + a.conj);
  const rows = [
    { dim: '压制型流占比', gong: g.ke / gTotal, astro: a.hard / aTotal, pair: '克 ⇄ 硬相位' },
    { dim: '供给型流占比', gong: g.sheng / gTotal, astro: a.soft / aTotal, pair: '生 ⇄ 和谐相位' },
    { dim: '合流型流占比', gong: (g.chong + g.he) / gTotal, astro: a.conj / aTotal, pair: '冲/合 ⇄ 合相' },
  ].map((r) => ({ ...r, gongPct: Math.round(r.gong * 100), astroPct: Math.round(r.astro * 100), delta: Math.round((r.gong - r.astro) * 100) }));

  // 简单同构度：1 - 平均绝对差
  const mad = rows.reduce((s, r) => s + Math.abs(r.gong - r.astro), 0) / rows.length;
  return {
    rows,
    isomorphism: Math.round((1 - mad) * 1000) / 1000,
    verdict: mad < 0.12 ? '高度同构' : mad < 0.25 ? '大体同构' : '差异明显',
    note: '⚠️ 这是**结构指标**，不是预测力证明。两边都由同一时刻决定（I(A;B|t)=0），'
      + '同构度只说明"能量流的形状像不像"，不代表断语等价。置信度 ≤0.6。',
  };
}

export { KE, SHENG, KE_BY, SHENG_BY };
