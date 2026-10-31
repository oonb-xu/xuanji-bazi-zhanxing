// 星盘「互容结构」推演 —— 古典尊贵体系 + 能量输送
//
// 依据（用户 2026-10-25 命题 + 古典原文核对）：
//   用户：「把次运盘、行运盘、星盘的互容结构进行推演…这个有内在的分级，
//          分别是庙旺互换、庙旺对三分」
//   用户：「所有相位都会输送能量。例如男命木星虽然陷落，但和月亮对冲，
//          月亮巨蟹，同时也是木星的擢升，也能为木星输送能量」
//
//   古典佐证（Masha'allah《论接待》第一章，Dykes 译）：
//     · 「接待来自擢升与庙」
//     · 「若太阳在白羊、土星在天秤……彼此都不接待对方，则生怨憎与悖逆」
//       ⇒ 两者都在自家庙旺却无互容 = 冲突；说明**互容是相位能否产生效果的关键**
//     · 「若在四分相或对冲，主劳苦、错误、焦虑与悖逆；
//        在三分相、六分相与合相，则主顺遂、虔敬与高贵」
//       ⇒ 相位本身带方向性，但**互容决定它是否"通"**
//
// 本模块实现两种视角（**分开输出，不混算**）：
//   A. 接待视角（hospitality）：谁是主人、谁是客人 —— 古典正统
//   B. 输能视角（energy flow）：能量从尊贵方流向失势方 —— 用户命题的扩展

/* ══════════ 一、古典尊贵表（七政） ══════════ */
// 星座序号：白羊0 金牛1 双子2 巨蟹3 狮子4 处女5 天秤6 天蝎7 射手8 摩羯9 水瓶10 双鱼11
export const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];

// 庙（守护）
export const DOMICILE = {
  太阳: ['狮子'],
  月亮: ['巨蟹'],
  水星: ['双子', '处女'],
  金星: ['金牛', '天秤'],
  火星: ['白羊', '天蝎'],
  木星: ['射手', '双鱼'],
  土星: ['摩羯', '水瓶'],
};
// 旺（擢升）
export const EXALTATION = {
  太阳: '白羊', 月亮: '金牛', 水星: '处女', 金星: '双鱼',
  火星: '摩羯', 木星: '巨蟹', 土星: '天秤',
};
// 陷 = 庙的对宫
export const DETRIMENT = Object.fromEntries(
  Object.entries(DOMICILE).map(([p, arr]) => [p, arr.map((s) => SIGNS[(SIGNS.indexOf(s) + 6) % 12])])
);
// 落 = 旺的对宫
export const FALL = Object.fromEntries(
  Object.entries(EXALTATION).map(([p, s]) => [p, SIGNS[(SIGNS.indexOf(s) + 6) % 12]])
);

// 三分性主星（Dorothean 体系：昼 / 夜 / 参与）
export const TRIPLICITY = {
  火象: { signs: ['白羊', '狮子', '射手'], day: '太阳', night: '木星', part: '土星' },
  土象: { signs: ['金牛', '处女', '摩羯'], day: '金星', night: '月亮', part: '火星' },
  风象: { signs: ['双子', '天秤', '水瓶'], day: '土星', night: '水星', part: '木星' },
  水象: { signs: ['巨蟹', '天蝎', '双鱼'], day: '金星', night: '火星', part: '月亮' },
};

/** 判定日盘/夜盘：太阳在地平线以上（第 7–12 宫）为日盘 */
export function isDayChart(chart) {
  const P = chart?.planets;
  const sun = Array.isArray(P) ? P.find((x) => x?.name === '太阳') : P?.['太阳'];
  if (!sun || sun.house == null) return null;
  return sun.house >= 7;
}

/** 某星在某星座的尊贵类型（可能多重）
 *  @param {boolean|null} isDay 日盘=true 夜盘=false 未知=null（两者都算，但标"未判"） */
export function dignitiesOf(planet, sign, isDay = null) {
  const out = [];
  if (DOMICILE[planet]?.includes(sign)) out.push({ type: '庙', score: 5 });
  if (EXALTATION[planet] === sign) out.push({ type: '旺', score: 4 });
  for (const [el, t] of Object.entries(TRIPLICITY)) {
    if (t.signs.includes(sign)) {
      // ★ 昼夜盘决定取哪个三分主：日盘用昼主、夜盘用夜主（参与主两者皆可用，权重低）
      if (isDay === true) {
        if (t.day === planet) out.push({ type: '三分(昼)', score: 3 });
      } else if (isDay === false) {
        if (t.night === planet) out.push({ type: '三分(夜)', score: 3 });
      } else {
        // 未判昼夜：两者都给，但标"未判"，分值降半以免高估
        if (t.day === planet) out.push({ type: '三分(昼·未判)', score: 1.5 });
        else if (t.night === planet) out.push({ type: '三分(夜·未判)', score: 1.5 });
      }
      if (t.part === planet) out.push({ type: '三分(参)', score: 2 });
    }
  }
  if (DETRIMENT[planet]?.includes(sign)) out.push({ type: '陷', score: -4 });
  if (FALL[planet] === sign) out.push({ type: '落', score: -5 });
  return out;
}

/** 综合尊贵分（-5 ~ +5，取最强项） */
export function dignityScore(planet, sign, isDay = null) {
  const d = dignitiesOf(planet, sign, isDay);
  if (!d.length) return 0;
  return d.reduce((best, x) => (Math.abs(x.score) > Math.abs(best) ? x.score : best), 0);
}

/* ══════════ 二、互容判定（用户指定的分级） ══════════ */
// 分级：I 庙庙 > II 庙旺 > III 旺旺 > IV 庙旺对三分(弱) > 单向
export const RECEPTION_GRADE = {
  I: { name: '庙庙互换', score: 1.00, note: '彼此都在对方庙中——古典最强接待' },
  II: { name: '庙旺互换', score: 0.85, note: '一方庙、一方旺，互为接待' },
  III: { name: '旺旺互换', score: 0.70, note: '彼此都在对方旺中' },
  IV: { name: '庙旺对三分', score: 0.45, note: '一方庙/旺，另一方仅三分——弱互容' },
  oneway: { name: '单向接待', score: 0.30, note: '只有一方在对方尊贵中' },
  none: { name: '无互容', score: 0.00, note: '彼此都不在对方尊贵中' },
};

const hasDignity = (planet, sign, kinds, isDay = null) => {
  const d = dignitiesOf(planet, sign, isDay);
  // ★ 失势守卫：若该星在此星座处于「陷/落」，则此地不能作为它的"待客之所"
  //   —— 古典语义：一个星球不会在自己的败落之处好客（否则土星在白羊也能"接待"）
  if (d.some((x) => x.type === '陷' || x.type === '落')) return false;
  return d.some((x) => kinds.includes(x.type));
};

/**
 * 互容判定
 * @returns {{grade, name, score, aInB, bInA, note}}
 *   aInB: A 星是否落在 B 星的尊贵中（⇒ B 接待 A）
 */
export function mutualReception(pa, sa, pb, sb, isDay = null) {
  const TRIP = ['三分(昼)', '三分(夜)', '三分(参)', '三分(昼·未判)', '三分(夜·未判)'];
  // ★ 方向定义（此前写反过，已修）：
  //   aInB = 「A 所在的星座 sa 是否为 B 星(pb) 的尊贵」⇒ 是则 B 接待 A
  //   bInA = 「B 所在的星座 sb 是否为 A 星(pa) 的尊贵」⇒ 是则 A 接待 B
  const aInB = {
    domicile: !!DOMICILE[pb]?.includes(sa),
    exalt: EXALTATION[pb] === sa,
    trip: hasDignity(pb, sa, TRIP, isDay),
  };
  const bInA = {
    domicile: !!DOMICILE[pa]?.includes(sb),
    exalt: EXALTATION[pa] === sb,
    trip: hasDignity(pa, sb, TRIP, isDay),
  };

  const aStrong = aInB.domicile ? '庙' : aInB.exalt ? '旺' : aInB.trip ? '三分' : null;
  const bStrong = bInA.domicile ? '庙' : bInA.exalt ? '旺' : bInA.trip ? '三分' : null;

  let grade = 'none';
  if (aStrong && bStrong) {
    if (aStrong === '庙' && bStrong === '庙') grade = 'I';
    else if ((aStrong === '庙' && bStrong === '旺') || (aStrong === '旺' && bStrong === '庙')) grade = 'II';
    else if (aStrong === '旺' && bStrong === '旺') grade = 'III';
    else grade = 'IV';   // 任一方仅三分
  } else if (aStrong || bStrong) grade = 'oneway';

  const g = RECEPTION_GRADE[grade];
  return {
    grade, name: g.name, score: g.score, note: g.note,
    aInB: aStrong, bInA: bStrong,
    // 谁接待谁：落在对方尊贵里的那颗星是"客人"，被落的那位是"主人"
    hostFor: aStrong ? pb : (bStrong ? pa : null),
    guestFor: aStrong ? pa : (bStrong ? pb : null),
    oneWayTo: aStrong && !bStrong ? pa : (!aStrong && bStrong ? pb : null),
  };
}

/* ══════════ 三、相位输能（用户核心命题） ══════════ */
// 「所有相位都会输送能量」——即便落陷，只要对方携带着它的尊贵，就能回输
export const ASPECT_INFO = {
  合相: { flow: 1.00, smooth: true },
  三分相: { flow: 0.85, smooth: true },
  六分相: { flow: 0.60, smooth: true },
  四分相: { flow: 0.70, smooth: false },
  对冲: { flow: 0.75, smooth: false },
};

/**
 * 计算一张盘的「相位输能」
 * 逻辑：
 *   1. 每颗星先算自身尊贵分 dignity（-5..+5）
 *   2. 对每条相位，按古典规则判断是否构成互容/单向接待
 *   3. 能量流向：**尊贵高的一方 → 尊贵低的一方**
 *      其中若低方处于对方尊贵之中（aInB/bInA），输能额外加成（这就是用户说的"月亮巨蟹送能给落陷的木星"）
 * @returns {{flows:Array, netByPlanet:Object, receptions:Array}}
 */
export function aspectEnergyFlow(chart) {
  const planets = chart?.planets ?? {};
  const aspects = chart?.aspects ?? [];
  const P = Array.isArray(planets) ? Object.fromEntries(planets.map((p) => [p.name, p])) : planets;

  // ★ 先判昼夜盘（三分性取主的前提）
  const isDay = isDayChart(chart);
  const dign = {};
  for (const [name, p] of Object.entries(P)) {
    if (!p?.sign) continue;
    dign[name] = { score: dignityScore(name, p.sign, isDay), sign: p.sign, items: dignitiesOf(name, p.sign, isDay) };
  }

  const flows = [], receptions = [];
  for (const asp of aspects) {
    const { a, b, type, orb } = asp;
    const pa = P[a], pb = P[b];
    if (!pa?.sign || !pb?.sign) continue;
    const info = ASPECT_INFO[type];
    if (!info) continue;

    const rec = mutualReception(a, pa.sign, b, pb.sign, isDay);
    if (rec.grade !== 'none') receptions.push({ a, b, type, ...rec, aSign: pa.sign, bSign: pb.sign });

    const da = dign[a]?.score ?? 0, db = dign[b]?.score ?? 0;
    const gap = da - db;                       // 正 ⇒ a 更强
    const strong = gap > 0 ? a : b, weak = gap > 0 ? b : a;
    const strongSign = gap > 0 ? pa.sign : pb.sign;
    const weakSign = gap > 0 ? pb.sign : pa.sign;

    // 基础流量：强度差 × 相位权重 × orb 衰减
    const orbW = Math.max(0.15, 1 - Math.abs(orb ?? 0) / 10);
    let amount = Math.abs(gap) * 0.12 * info.flow * orbW;
    // 互容加成：古典说"互容让相位通"
    amount *= (1 + rec.score * 0.6);
    // ★ 关键：弱方若身处强方尊贵中，强方"带着它的尊贵"来输能（用户命题）
    const carrying = (gap > 0) ? rec.bInA : rec.aInB;
    if (carrying) amount *= 1.5;

    if (amount > 0.001) {
      flows.push({
        from: strong, to: weak, type,
        fromSign: strongSign, toSign: weakSign,
        fromDignity: Math.max(da, db), toDignity: Math.min(da, db),
        reception: rec.grade, receptionName: rec.name,
        carryingDignity: !!carrying,
        amount: Math.round(amount * 1000) / 1000,
        smooth: info.smooth,
      });
    }
  }

  // 净收支
  const netByPlanet = {};
  for (const name of Object.keys(dign)) netByPlanet[name] = { dignity: dign[name].score, in: 0, out: 0, net: 0 };
  for (const f of flows) {
    netByPlanet[f.from].out += f.amount;
    netByPlanet[f.to].in += f.amount;
  }
  for (const v of Object.values(netByPlanet)) v.net = Math.round((v.in - v.out) * 1000) / 1000;

  return { flows: flows.sort((x, y) => y.amount - x.amount), receptions, netByPlanet, dignities: dign, isDay };
}

/* ══════════ 四、次运盘 / 行运盘 ══════════ */
/** 次运（secondary progression）：1 天 = 1 年 ⇒ 出生后 N 年对应出生后第 N 天的天象 */
export function progressionDate(birthAt, ageYears) {
  const d = new Date(birthAt);
  d.setDate(d.getDate() + Math.floor(ageYears));      // 简化：1 天=1 年
  return d;
}

/* ══════════ 五、对外摘要（自然语言，服务端输出用） ══════════ */
export function summarizeReception(chart) {
  const e = aspectEnergyFlow(chart);
  const gname = (g) => (RECEPTION_GRADE[g]?.name ?? '无互容');

  const receptions = e.receptions.map((r) => ({
    a: r.a + '@' + r.aSign,
    b: r.b + '@' + r.bSign,
    aspect: r.type,
    grade: r.grade,
    gradeName: gname(r.grade),
    score: r.score,
    aInB: r.aInB ?? null,
    bInA: r.bInA ?? null,
    note: r.note,
  }));

  const flows = e.flows.slice(0, 12).map((f) => ({
    from: f.from,
    to: f.to,
    aspect: f.type,
    fromDignity: f.fromDignity,
    toDignity: f.toDignity,
    amount: f.amount,
    carryingDignity: f.carryingDignity,
    reception: f.reception === 'none' ? null : gname(f.reception),
    smooth: f.smooth,
  }));

  const byGrade = {};
  for (const r of e.receptions) { const k = gname(r.grade); byGrade[k] = (byGrade[k] ?? 0) + 1; }

  return {
    receptions,
    flows,
    netByPlanet: e.netByPlanet,
    summary: {
      chartType: e.isDay === true ? '日盘（昼）' : e.isDay === false ? '夜盘' : '未判定',
      receptionCount: receptions.length,
      flowCount: e.flows.length,
      byGrade,
      note: '互容按古典尊贵体系判定（庙>旺>三分）；失势星（陷/落）不作为待客之所。相位全程输送能量，落陷亦可经由「携带其尊贵」的星获得补给。',
    },
  };
}
