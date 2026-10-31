// 紫微端适配器：iztro（第三方权威实现）→ 本项目统一格式
//
// 设计原则（复用优先）：
//   · **不改 iztro 内部逻辑** —— 它是 4275 星的成熟库，本项目只做「输出映射」
//   · 亮度用 iztro 的（它比我们自建的 14×12 表更可靠；我们的表标了「待校」）
//   · 主星 → 十神组 用本项目的映射（这是本项目的独有贡献）
//   · 四柱与命宫与本地引擎做**交叉校验**，不一致就报出来，不静默采用
import { astro } from 'iztro';

/** 十四主星 → 十神组（与 src/cross/four-systems.mjs 的 ZIWEI_STARS 保持一致） */
const STAR_TG = {
  紫微: '官杀', 天机: '食伤', 太阳: '比劫', 武曲: '财', 天同: '印', 廉贞: '官杀', 天府: '财',
  太阴: '印', 贪狼: '财', 巨门: '食伤', 天相: '印', 天梁: '印', 七杀: '官杀', 破军: '食伤',
};

/** iztro 的亮度用字 → 本项目七级 */
const BRIGHT_NORM = {
  庙: '庙', 旺: '旺', 得: '得地', 得地: '得地', 利: '利', 平: '平',
  不: '不得地', 不得地: '不得地', 陷: '陷', '': null,
};

/** 亮度 → 乘子（偶然层/物质轴，不替代本质尊贵） */
const BRIGHT_K = { 庙: 1.30, 旺: 1.18, 得地: 1.08, 利: 1.00, 平: 0.95, 不得地: 0.88, 陷: 0.78 };

/**
 * 排一张紫微盘
 * @param {object} o { date:'YYYY-M-D', hour:0-23 或 时辰序号0-11, gender:'男'|'女', fixLeap?:bool }
 */
export function ziweiChart(o) {
  const date = o.date;
  const hourIdx = o.hourIndex ?? toShiChenIndex(o.hour ?? 0);
  const gender = o.gender === '男' ? '男' : '女';

  const a = astro.bySolar(date, hourIdx, gender, o.fixLeap ?? true, 'zh-CN');

  const palaces = (a.palaces || []).map((p) => {
    const stars = (p.majorStars || []).map((s) => {
      const b = BRIGHT_NORM[s.brightness ?? ''] ?? null;
      return {
        name: s.name,
        brightness: b,
        factor: b ? BRIGHT_K[b] : 1.0,
        tg: STAR_TG[s.name] ?? null,          // ★ 本项目的贡献：主星→十神组
        mutagen: s.mutagen ? '化' + s.mutagen : null,   // 禄/权/科/忌
        type: 'major',
      };
    });
    const minors = [
      ...(p.minorStars || []).map((s) => ({ name: s.name, mutagen: s.mutagen ? '化' + s.mutagen : null, type: 'minor' })),
      ...(p.adjectiveStars || []).map((s) => ({ name: s.name, type: 'adjective' })),
    ];
    return {
      name: p.name,
      zhi: p.earthlyBranch,
      ganZhi: (p.heavenlyStem ?? '') + (p.earthlyBranch ?? ''),
      isSoul: p.name === '命宫',
      isBody: !!p.isBodyPalace,
      major: stars,
      minor: minors,
      // 该宫的主星十神分布（多个主星就都列）
      tgList: stars.map((s) => s.tg).filter(Boolean),
    };
  });

  return {
    engine: 'iztro',
    engineVersion: 'iztro (npm)',
    solarDate: a.solarDate,
    lunarDate: a.lunarDate,
    chineseDate: a.chineseDate,          // ← 用于与本地八字引擎交叉校验
    time: a.time,
    timeRange: a.timeRange,
    gender: a.gender,
    sign: a.sign,
    zodiac: a.zodiac,
    soulPalaceZhi: a.earthlyBranchOfSoulPalace,
    bodyPalaceZhi: a.earthlyBranchOfBodyPalace,
    fiveElementsClass: a.fiveElementsClass,   // 五行局
    soulStar: a.soul,                          // 命主
    bodyStar: a.body,                          // 身主
    palaces,
    // 汇总：哪些宫有主星、四化落点
    summary: {
      palaceCount: palaces.length,
      emptyPalaces: palaces.filter((p) => p.major.length === 0).map((p) => p.name),
      mutagenMap: palaces.flatMap((p) => [...p.major, ...p.minor].filter((s) => s.mutagen)
        .map((s) => ({ star: s.name, mutagen: s.mutagen, palace: p.name }))),
      // 十神组在十二宫的分布
      tgByPalace: palaces.map((p) => ({ palace: p.name, zhi: p.zhi, tg: p.tgList })),
    },
  };
}

/** 0-23 小时 → 时辰序号 0-11（子=0, 丑=1 …） */
export function toShiChenIndex(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  return Math.floor(((h + 1) % 24) / 2);
}

/**
 * 交叉校验：iztro 的 chineseDate（四柱）是否与本地八字引擎一致
 * @returns {ok, iztro: string[], local: string[], diff: string[]}
 */
export function crossCheckPillars(ziwei, localPillars) {
  const iz = String(ziwei.chineseDate || '').trim().split(/\s+/);
  const lo = (localPillars || []).slice(0, 4);
  const diff = [];
  for (let i = 0; i < Math.min(iz.length, lo.length); i++) {
    if (iz[i] !== lo[i]) diff.push(`第${i + 1}柱 iztro=${iz[i]} 本地=${lo[i]}`);
  }
  return { ok: diff.length === 0 && iz.length >= 4, iztro: iz, local: lo, diff };
}

export { STAR_TG, BRIGHT_K };
