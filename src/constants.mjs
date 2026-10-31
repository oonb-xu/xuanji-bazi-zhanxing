// 阶段一 · 底层规则 · 常量表（唯一真源，禁止在别处硬编码）
// 统一模型：中国玄学 ⟷ 西方占星学 共用的 12 分基与五行/相位关系代数

/** 地盘固定十二支，索引即方位（子=0 北，顺时针） */
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 十二天干 */
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/** 十二天将，严格按用户规则表的顺序（贵人起，顺时针为序） */
export const TIAN_JIANG = [
  '贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙',
  '天空', '白虎', '太常', '玄武', '太阴', '天后',
];

/** 天将异名归一（第三方库用「腾蛇」等写法） */
export const JIANG_ALIAS = { 腾蛇: '螣蛇' };

export const ZHI_WU_XING = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

export const GAN_WU_XING = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

/** 地支阴阳：子寅辰午申戌为阳 */
export const ZHI_YIN_YANG = Object.fromEntries(
  DI_ZHI.map((z, i) => [z, i % 2 === 0 ? '阳' : '阴']),
);
/** 天干阴阳：甲丙戊庚壬为阳 */
export const GAN_YIN_YANG = Object.fromEntries(
  TIAN_GAN.map((g, i) => [g, i % 2 === 0 ? '阳' : '阴']),
);

export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 五行 → 克我者（被谁克） */
export const BEI_KE = Object.fromEntries(Object.entries(KE).map(([a, b]) => [b, a]));

/** 十二支六冲（对宫，索引差 6）——与占星对分相 180° 同构 */
export const LIU_CHONG = Object.fromEntries(
  DI_ZHI.map((z, i) => [z, DI_ZHI[(i + 6) % 12]]),
);

/** 天干寄宫（十干寄十二宫；用户规则表记作「日干寄宫」） */
export const GAN_JI_GONG = {
  甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳',
  己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑',
};

/** Step 1 月将映射表：中气 → 月将地支（太阳所躔之次） */
export const YUE_JIANG_BY_QI = {
  雨水: '亥', 春分: '戌', 谷雨: '酉', 小满: '申', 夏至: '未', 大暑: '午',
  处暑: '巳', 秋分: '辰', 霜降: '卯', 小雪: '寅', 冬至: '丑', 大寒: '子',
};

/** 十二中气顺序（自冬至起，与太阳黄经 270° 对齐） */
export const ZHONG_QI_ORDER = [
  '冬至', '大寒', '雨水', '春分', '谷雨', '小满',
  '夏至', '大暑', '处暑', '秋分', '霜降', '小雪',
];

/** Step 2 天乙贵人等式：日干 → (昼贵, 夜贵) */
export const GUI_REN_BY_GAN = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
  辛: ['午', '寅'],
};

/** 八专日（干寄宫与日支同宫） */
export const BA_ZHUAN_RI = ['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑'];

/** 需专用规则、规则表 Step 4.6 明确交后端的特殊课体 */
export const SPECIAL_KETI_RE = /伏吟|返吟|别责|八专|无禄|绝嗣/;

export const zhiIndex = (z) => DI_ZHI.indexOf(z);
export const mod12 = (n) => ((n % 12) + 12) % 12;
export const zhiAt = (n) => DI_ZHI[mod12(n)];

/** 五行生克判定：返回 'a克b' | 'b克a' | 'a生b' | 'b生a' | '同类' */
export function wuXingRelation(a, b) {
  if (a === b) return '同类';
  if (KE[a] === b) return 'a克b';
  if (KE[b] === a) return 'b克a';
  if (SHENG[a] === b) return 'a生b';
  if (SHENG[b] === a) return 'b生a';
  return '无关系';
}
