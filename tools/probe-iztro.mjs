// 探测 iztro 的 API 与输出结构
import { astro } from 'iztro';

console.log('iztro 导出:', Object.keys(astro).join(', '));

const a = astro.bySolar('1990-3-15', 6, '女', true, 'zh-CN');
console.log('\n=== 基本信息 ===');
for (const k of ['gender', 'solarDate', 'lunarDate', 'chineseDate', 'time', 'timeRange', 'sign', 'zodiac', 'earthlyBranchOfSoulPalace', 'earthlyBranchOfBodyPalace', 'fiveElementsClass', 'soul', 'body']) {
  if (a[k] !== undefined) console.log(`  ${k}: ${JSON.stringify(a[k])}`);
}

console.log('\n=== 十二宫（前 3 个）===');
for (const p of (a.palaces || []).slice(0, 3)) {
  console.log(`  ${p.name} (${p.heavenlyStem}${p.earthlyBranch}) 主星: ${(p.majorStars || []).map(s => s.name + '(' + s.brightness + ')').join(',') || '无'}`);
  console.log(`     辅星: ${(p.minorStars || []).map(s => s.name).join(',') || '无'}`);
  console.log(`     杂曜: ${(p.adjectiveStars || []).map(s => s.name).join(',') || '无'}`);
  console.log(`     宫位是否身宫: ${p.isBodyPalace}, 是否来因: ${p.isOriginalPalace}`);
}

console.log('\n=== 星曜完整结构（第一宫第一颗主星）===');
const s0 = (a.palaces?.[0]?.majorStars || [])[0];
console.log(JSON.stringify(s0, null, 2));

console.log('\n=== 四化 ===');
for (const p of (a.palaces || [])) {
  for (const s of [...(p.majorStars || []), ...(p.minorStars || [])]) {
    if (s.mutagen) console.log(`  ${s.name} 在 ${p.name} 化${s.mutagen}`);
  }
}

console.log('\n=== 干支 ===');
console.log('  chineseDate:', a.chineseDate);
console.log('  rawDates:', JSON.stringify(a.rawDates || {}).slice(0, 300));
