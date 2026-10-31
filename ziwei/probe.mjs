// 探测 iztro 的 API 与输出结构（放在 ziwei/ 内才能解析到 node_modules）
import { astro } from 'iztro';

console.log('iztro 导出:', Object.keys(astro).join(', '));

const a = astro.bySolar('1990-3-15', 6, '女', true, 'zh-CN');
console.log('\n=== 基本信息 ===');
for (const k of ['gender', 'solarDate', 'lunarDate', 'chineseDate', 'time', 'timeRange', 'sign', 'zodiac',
  'earthlyBranchOfSoulPalace', 'earthlyBranchOfBodyPalace', 'fiveElementsClass', 'soul', 'body']) {
  if (a[k] !== undefined) console.log(`  ${k}: ${JSON.stringify(a[k])}`);
}

console.log('\n=== 十二宫 ===');
for (const p of (a.palaces || [])) {
  const maj = (p.majorStars || []).map((s) => s.name + (s.brightness ? '(' + s.brightness + ')' : '')).join(',') || '无主星';
  const min = (p.minorStars || []).map((s) => s.name + (s.mutagen ? '·化' + s.mutagen : '')).join(',') || '—';
  console.log(`  ${p.name.padEnd(3)} ${p.heavenlyStem}${p.earthlyBranch}  主星:${maj}`);
  console.log(`       辅星:${min}  ${p.isBodyPalace ? '【身宫】' : ''}`);
}

console.log('\n=== 主星完整结构（第一颗）===');
const s0 = (a.palaces?.[0]?.majorStars || [])[0];
console.log(JSON.stringify(s0, null, 2));

console.log('\n=== 四化 ===');
for (const p of (a.palaces || [])) {
  for (const s of [...(p.majorStars || []), ...(p.minorStars || [])]) {
    if (s.mutagen) console.log(`  ${s.name} 在 ${p.name} → 化${s.mutagen}`);
  }
}
