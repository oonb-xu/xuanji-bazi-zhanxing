// 西方占星 · 必然尊贵（庙/旺/陷/落）
// Part 8 的「金星落陷」等判据来源；同时补齐 6.7.4 第三问（十神强弱 ↔ 行星庙旺落陷）
// 争议标注：现代三王星的「旺/落」各家不一，本表取通说并置 disputed=true（裁定 R-W6）

/** 庙（domicile）——与星座守护星一致 */
export const DOMICILE = {
  太阳: ['狮子'], 月亮: ['巨蟹'], 水星: ['双子', '处女'], 金星: ['金牛', '天秤'],
  火星: ['白羊', '天蝎'], 木星: ['射手', '双鱼'], 土星: ['摩羯', '水瓶'],
  天王星: ['水瓶'], 海王星: ['双鱼'], 冥王星: ['天蝎'],
};
/** 旺（exaltation） */
export const EXALTATION = {
  太阳: ['白羊'], 月亮: ['金牛'], 水星: ['处女'], 金星: ['双鱼'],
  火星: ['摩羯'], 木星: ['巨蟹'], 土星: ['天秤'],
  天王星: ['天蝎'], 海王星: ['狮子'], 冥王星: ['白羊'],
};
/** 有分歧的条目（通说之外的其他说法），仅记录不参与判定 */
export const DISPUTED = {
  海王星: { 旺: ['狮子', '射手'], 落: ['水瓶', '摩羯'] },
  冥王星: { 旺: ['白羊', '狮子'], 落: ['天秤', '水瓶'] },
};
const OPP = { 白羊: '天秤', 金牛: '天蝎', 双子: '射手', 巨蟹: '摩羯', 狮子: '水瓶', 处女: '双鱼', 天秤: '白羊', 天蝎: '金牛', 射手: '双子', 摩羯: '巨蟹', 水瓶: '狮子', 双鱼: '处女' };

/** 陷（detriment）= 庙之对宫 */
export const DETRIMENT = Object.fromEntries(Object.entries(DOMICILE).map(([p, signs]) => [p, signs.map((s) => OPP[s])]));
/** 落（fall）= 旺之对宫 */
export const FALL = Object.fromEntries(Object.entries(EXALTATION).map(([p, signs]) => [p, signs.map((s) => OPP[s])]));

export const DIGNITY_STATES = ['庙', '旺', '陷', '落', '中性'];
/** 强弱映射（Part 8 一致性判定用）：庙+2 / 旺+1 / 中性 0 / 陷−1 / 落−2 */
export const DIGNITY_SCORE = { 庙: 2, 旺: 1, 中性: 0, 陷: -1, 落: -2 };

/** 判定某行星落某星座的必然尊贵 */
export function dignityOf(planet, sign) {
  if (!planet || !sign) return { state: '中性', score: 0, disputed: false };
  const hit = (tbl) => (tbl[planet] ?? []).includes(sign);
  if (hit(DOMICILE)) return { state: '庙', score: DIGNITY_SCORE['庙'], disputed: false };
  if (hit(EXALTATION)) return { state: '旺', score: DIGNITY_SCORE['旺'], disputed: !!DISPUTED[planet] };
  if (hit(DETRIMENT)) return { state: '陷', score: DIGNITY_SCORE['陷'], disputed: false };
  if (hit(FALL)) return { state: '落', score: DIGNITY_SCORE['落'], disputed: !!DISPUTED[planet] };
  return { state: '中性', score: 0, disputed: false };
}

/** 尊贵总览表（离线可读，便于人工核对） */
export function dignityTable() {
  const rows = [];
  for (const p of Object.keys(DOMICILE)) {
    rows.push({
      planet: p,
      庙: DOMICILE[p].join('/'), 旺: EXALTATION[p].join('/'),
      陷: DETRIMENT[p].join('/'), 落: FALL[p].join('/'),
      争议: DISPUTED[p] ? `旺/落有异说（${DISPUTED[p].旺.join('或')}／${DISPUTED[p].落.join('或')}）` : '',
    });
  }
  return rows;
}
