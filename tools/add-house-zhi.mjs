// 给宫位补十二地支标注（追加式，不改动已有 HOUSE_DOMAIN 结构）
import fs from 'node:fs';

let s = fs.readFileSync('src/cross/four-systems.mjs', 'utf8');

if (s.includes('HOUSE_ZHI_NOTE')) {
  console.log('已存在，跳过');
  process.exit(0);
}

const BLOCK = `

/* ══════════════════════════════════════════════
 * 十二宫的「地支」标注
 *   ★ 地支不是固定标签 —— 两套体系锚点不同：
 *     古典占星：第 1 宫地支 = 上升所在星座换算的月将支（相对坐标，随出生时刻变）
 *     紫微斗数：命宫地支由「月支 + 时支」算出，其余宫逆序排（地支是绝对空间格）
 *   换算函数见 pillar-derivation.mjs 的 houseZhiTable() / ziweiHouseZhi()
 * ══════════════════════════════════════════════ */
export const HOUSE_ZHI_NOTE = {
  1: { astro: '上升(ASC)所在支', ziwei: '命宫支', plain: '你是谁' },
  2: { astro: '上升 +30°', ziwei: '命宫逆一位', plain: '你的资源' },
  3: { astro: '上升 +60°', ziwei: '命宫逆二位', plain: '你的沟通' },
  4: { astro: '天底(IC)支', ziwei: '命宫逆三位', plain: '你的根' },
  5: { astro: '上升 +120°', ziwei: '命宫逆四位', plain: '你的创造' },
  6: { astro: '上升 +150°', ziwei: '命宫逆五位', plain: '你的日常' },
  7: { astro: '下降(DSC)支 = 上升对宫', ziwei: '命宫逆六位', plain: '你的关系' },
  8: { astro: '上升 +210°', ziwei: '命宫逆七位', plain: '共享与危机' },
  9: { astro: '上升 +240°', ziwei: '命宫逆八位', plain: '远行与信念' },
  10: { astro: '天顶(MC)支', ziwei: '命宫逆九位', plain: '你的事业' },
  11: { astro: '上升 +300°', ziwei: '命宫逆十位', plain: '你的群体' },
  12: { astro: '上升 +330°', ziwei: '命宫逆十一位', plain: '你的内在' },
};

/** 把 HOUSE_DOMAIN 与 HOUSE_ZHI_NOTE 合成一张完整表（供前端用） */
export function houseTableWithZhi() {
  return Object.entries(HOUSE_DOMAIN).map(([no, d]) => {
    const z = HOUSE_ZHI_NOTE[no] || {};
    return {
      no: Number(no),
      astro: d.astro, ziwei: d.ziwei, plain: d.plain,
      astroZhi: z.astro ?? '',       // 占星的支是相对上升的
      ziweiZhi: z.ziwei ?? '',       // 紫微的支是命宫起排的
      zhiKind: '相对（需出生时刻/月时支才能定位）',
    };
  });
}
`;

// 追加到文件末尾
s = s.trimEnd() + '\n' + BLOCK;
fs.writeFileSync('src/cross/four-systems.mjs', s, 'utf8');
console.log('✅ HOUSE_ZHI_NOTE + houseTableWithZhi 已追加');
