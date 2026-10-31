// 藏干透出（占星实现） + 土星双角色
//
// ★ 用户命题 1（2026-10-27）：「土星也有一部分印的作用」
//   形式化：土星是「自我与世界的边界」——
//     边界保护你 ⇒ 印（结构 / 承载 / 根基 / 资历 / 庇护）
//     边界压迫你 ⇒ 官杀（约束 / 责任 / 压力 / 权威）
//   方向由它在盘上的状态决定，不是固定标签。
//
// ★ 用户命题 2：「占星有没有办法把藏干透出的效果做出来」
//   对应关系：
//     地支（30° 黄道段） ≙ 一个星座区间
//     藏干（本气/中气/余气） ≙ 落在该区间里的行星
//     透出 ≙ 该行星被「显位」激活：落角宫 / 与上升·天顶合相 / 得时(昼·夜盘匹配)
//     不透 ≙ 只落果宫且无相位 ⇒ 纯藏
//   本气/中气/余气的等级 ≙ 该行星的本质尊贵（庙 > 旺 > 三分 > 无）
//
// ⚠️ 纪律：这是**结构类比**，不是恒等式。置信度 ≤ 0.6（非恒等封顶）。

const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const SIGN_ZHI = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥']; // 星座→地支（春分点对应戌/卯之类按节气近似）
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const ANGULAR = new Set([1, 4, 7, 10]);
const SUCCEDENT = new Set([2, 5, 8, 11]);

/** 本质尊贵（简化：只判庙/旺，用于给"藏干"定等级） */
const DOMICILE = { 太阳: ['狮子'], 月亮: ['巨蟹'], 水星: ['双子', '处女'], 金星: ['金牛', '天秤'], 火星: ['白羊', '天蝎'], 木星: ['射手', '双鱼'], 土星: ['摩羯', '水瓶'] };
const EXALT = { 太阳: ['白羊'], 月亮: ['金牛'], 水星: ['处女'], 金星: ['双鱼'], 火星: ['摩羯'], 木星: ['巨蟹'], 土星: ['天秤'] };

function dignityGrade(name, sign) {
  if ((DOMICILE[name] || []).includes(sign)) return { grade: '本气', weight: 3 };
  if ((EXALT[name] || []).includes(sign)) return { grade: '中气', weight: 2 };
  return { grade: '余气', weight: 1 };
}

const norm = (d) => ((d % 360) + 360) % 360;
const sep = (a, b) => { const d = Math.abs(norm(a) - norm(b)) % 360; return d > 180 ? 360 - d : d; };

/* ══════════════════════════════════════════════
 *  ① 藏干透出
 * ══════════════════════════════════════════════ */
/**
 * @param planets [{name, lon, sign, house}]
 * @param angles  {asc, mc}
 * @param isDay   昼盘?
 * @returns { sections: [{sign, zhi, from, to, stems:[...]}], revealed: [...], hiddenOnly: [...] }
 */
export function hiddenStemReveal(planets, angles = {}, isDay = true) {
  // 兼容 planets 为数组或对象两种形态
  const list = Array.isArray(planets)
    ? planets
    : Object.entries(planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);
  const real = list.filter((p) => typeof p?.lon === 'number' && !['上升', '天顶', '下降', '天底', '北交点', '南交点'].includes(p.name));

  // 12 个 30° 段 = 12 地支
  const sections = [];
  for (let i = 0; i < 12; i++) {
    const from = i * 30, to = from + 30;
    const inside = real.filter((p) => norm(p.lon) >= from && norm(p.lon) < to);
    sections.push({
      sign: SIGNS[i],
      zhi: SIGN_ZHI[i],
      from, to,
      stems: inside.map((p) => {
        const g = dignityGrade(p.name, p.sign ?? SIGNS[i]);
        // 透出强度
        let reveal = 0;
        const why = [];
        if (ANGULAR.has(p.house)) { reveal += 3; why.push('角宫'); }
        else if (SUCCEDENT.has(p.house)) { reveal += 1; why.push('续宫'); }
        else if (p.house) { reveal -= 1; why.push('果宫'); }

        if (typeof angles.asc === 'number' && sep(p.lon, angles.asc) <= 5) { reveal += 3; why.push('合上升'); }
        if (typeof angles.mc === 'number' && sep(p.lon, angles.mc) <= 5) { reveal += 2; why.push('合天顶'); }

        // 得时：昼盘见日/木/土，夜盘见月/金/火（古典 hayz 的简化）
        const daySet = new Set(['太阳', '木星', '土星']);
        const nightSet = new Set(['月亮', '金星', '火星']);
        if ((isDay && daySet.has(p.name)) || (!isDay && nightSet.has(p.name))) { reveal += 1; why.push('得时'); }

        const revealed = reveal >= 2;
        return {
          planet: p.name, lon: Math.round(p.lon * 100) / 100, house: p.house ?? null,
          grade: g.grade, weight: g.weight,
          revealScore: reveal, revealed, why,
          label: revealed ? `${p.name}(${g.grade}·透出)` : `${p.name}(${g.grade}·藏)`,
        };
      }),
    });
  }

  const flat = sections.flatMap((s) => s.stems.map((x) => ({ ...x, sign: s.sign, zhi: s.zhi })));
  return {
    sections,
    revealed: flat.filter((x) => x.revealed),
    hiddenOnly: flat.filter((x) => !x.revealed),
    note: '藏干 ≙ 区间内行星；透出 ≙ 被角宫/合轴/得时激活。属结构类比，非恒等。',
  };
}

/* ══════════════════════════════════════════════
 *  ② 土星双角色
 * ══════════════════════════════════════════════ */
/**
 * 判定土星此刻更偏「印」还是偏「官杀」
 * @param saturn {name:'土星', sign, house, retro}
 * @param isDay  昼盘?
 */
export function saturnDualRole(saturn, isDay = true) {
  if (!saturn) return null;
  let score = 0;                 // >0 ⇒ 偏印（保护）；<0 ⇒ 偏官杀（压迫）
  const why = [];

  // ① 宫位：角宫 = 结构立在台面（可依靠）；果宫 = 结构沉在暗处（压着但不显）
  const h = saturn.house;
  if (ANGULAR.has(h)) { score += 2; why.push('落角宫：结构可依靠 → 印'); }
  else if (SUCCEDENT.has(h)) { score += 0; why.push('落续宫：中性'); }
  else if (h) { score -= 2; why.push('落果宫：结构沉暗 → 官杀'); }

  // ② 尊贵：庙/旺 = 它有资格做承载；陷/落 = 结构失效转为消耗
  const dom = (DOMICILE['土星'] || []).includes(saturn.sign);
  const exa = (EXALT['土星'] || []).includes(saturn.sign);
  const det = ['巨蟹', '狮子'].includes(saturn.sign);
  const fal = ['白羊'].includes(saturn.sign);
  if (dom) { score += 3; why.push('入庙：承载有力 → 印'); }
  else if (exa) { score += 2; why.push('曜升：承载顺畅 → 印'); }
  else if (det) { score -= 3; why.push('入陷：结构失效 → 官杀'); }
  else if (fal) { score -= 3; why.push('落陷：结构崩解 → 官杀'); }

  // ③ 顺逆：逆行 = 向内收紧，偏印（自我约束）；顺行 = 向前施压，偏官杀
  if (saturn.retro === true) { score += 1; why.push('逆行：向内收紧 → 印'); }
  else if (saturn.retro === false) { score -= 1; why.push('顺行：向外施压 → 官杀'); }

  // ④ 昼夜：土星为昼星，昼盘得时 = 正用其力
  if (isDay) { score += 1; why.push('昼盘：土星得时 → 印'); }
  else { score -= 1; why.push('夜盘：土星失时 → 官杀'); }

  let primary, secondary, ratio;
  if (score >= 3) { primary = '印'; secondary = '官杀'; ratio = 0.8; }
  else if (score >= 1) { primary = '印'; secondary = '官杀'; ratio = 0.6; }
  else if (score <= -3) { primary = '官杀'; secondary = '印'; ratio = 0.85; }
  else if (score <= -1) { primary = '官杀'; secondary = '印'; ratio = 0.65; }
  else { primary = '官杀'; secondary = '印'; ratio = 0.5; }

  return {
    score,
    primary, secondary, ratio,
    // 双角色：始终两者都在，只是配比不同
    groups: { [primary]: ratio, [secondary]: 1 - ratio },
    why,
    note: '土星 = 自我与世界的边界：保护你则为印，压迫你则为官杀。',
  };
}

export { SIGNS, SIGN_ZHI, ZHI, dignityGrade };
