// 相位体系的两种口径（R-G4）：容许度制（orb）与整宫制（whole-sign）
//
// 为什么需要：专家档案把「太阳摩羯 7 宫 / 月亮巨蟹 2 宫」称为**日月冲**，
//   而引擎的 R-V6 容许度制给出"非冲"（实测黄经差 161.7°，离 180° 差 18.3°）。
//   **两种口径都合法**：整宫制只看**星座对宫**，容许度制看**实际角度差**。
//   ⇒ 本项目此前只实现了容许度制且从未登记整宫制 ⇒ 属**口径未登记**，不是算错。
import { SIGNS } from './zodiac.mjs';

/** 十二星座序（0=白羊） */
const SIGN_ORDER = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];

/** 整宫制相位表（按星座间距）：0=合、3=刑、6=冲、4/8=拱、2/10=六合 */
export const WHOLE_SIGN_ASPECTS = {
  0: '合相', 2: '六分相', 3: '四分相', 4: '三分相',
  6: '对冲', 8: '三分相', 10: '六分相',
};

/**
 * 整宫制相位（whole-sign）：只由**所在星座**决定，与容许度无关
 * @param chart `computeNatal()` 的返回值
 * @param bodies 参与的天体（默认十大行星，排除轴点/交点 —— 与 R-V6 同口径）
 */
export function wholeSignAspects(chart, bodies = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星']) {
  const out = [];
  const list = bodies.filter((b) => chart?.planets?.[b]?.sign);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const sa = SIGN_ORDER.indexOf(chart.planets[a].sign), sb = SIGN_ORDER.indexOf(chart.planets[b].sign);
      if (sa < 0 || sb < 0) continue;
      const dist = Math.min((sb - sa + 12) % 12, (sa - sb + 12) % 12);
      const type = WHOLE_SIGN_ASPECTS[dist];
      if (!type) continue;
      out.push({ a, b, type, system: 'whole-sign', signDistance: dist, orb: null, exact: null });
    }
  }
  return out;
}

/**
 * 双口径对照（R-G4 要求的"必须并列标注"）
 * @returns { same, onlyOrb, onlyWholeSign, orbCount, wholeSignCount }
 */
export function compareAspectSystems(chart, { orbAspects = null } = {}) {
  const orb = orbAspects ?? (chart?.aspects ?? []);
  const ws = wholeSignAspects(chart);
  const key = (x) => `${[x.a, x.b].sort().join('—')}|${x.type}`;
  const KO = new Set(orb.map(key)), KW = new Set(ws.map(key));
  return {
    orbCount: orb.length,
    wholeSignCount: ws.length,
    same: [...KO].filter((k) => KW.has(k)),
    onlyOrb: [...KO].filter((k) => !KW.has(k)),
    onlyWholeSign: [...KW].filter((k) => !KO.has(k)),
    note: '两套口径都合法：整宫制看星座对宫，容许度制看实际角度差（R-V6 用 orb）。输出时必须并列标注。',
  };
}
