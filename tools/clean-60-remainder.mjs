// 清理剩余的「天空里不存在」断言：替换全部出现，并打印上下文确认通顺
import fs from 'node:fs';

const FILES = ['docs/41-仅凭落位推七柱.md', 'web/index.html', 'docs/42-融合路径论文.md', 'web/paper.html'];

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('天空里不存在')) { console.log('✅ 无残留:', f); continue; }

  console.log('\n--- ' + f + ' ---');
  const idxs = [];
  let p = 0;
  while ((p = s.indexOf('天空里不存在', p)) >= 0) { idxs.push(p); p += 6; }
  idxs.forEach((i) => console.log('  上下文:', JSON.stringify(s.slice(Math.max(0, i - 90), i + 130))));

  // 替换所有出现（含中英文引号变体）
  s = s.replace(/天空里不存在\s*[“"'‘']?\s*60\s*[”"'’']?\s*这个数/g, '星盘里给不出「这是第几个甲子」这个量');
  s = s.replace(/天空里不存在/g, '星盘里给不出「这是第几个甲子」');

  // 顺带把「人为计数」的绝对化说法降级（如果还在）
  s = s.replace(/60\s*甲子是人为计数/g, '「60」是计数（但有天文近似依据）');

  fs.writeFileSync(f, s, 'utf8');
  console.log('  ✅ 已清理');
}

console.log('\n=== 最终残留检查 ===');
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const r = [];
  if (s.includes('天空里不存在')) r.push('天空里不存在');
  if (/60\s*甲子是人为计数/.test(s)) r.push('60甲子是人为计数');
  if (r.length) bad++;
  console.log(' ', r.length ? '❌ ' + f + ' → ' + r.join(',') : '✅ ' + f);
}

/* HTML 安全闸 */
for (const f of ['web/index.html', 'web/paper.html']) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const c = (re) => (s.match(re) || []).length;
  const okD = c(/<div\b/g) === c(/<\/div>/g);
  const okS = c(/<strong>/g) === c(/<\/strong>/g);
  console.log(' ', okD && okS ? '✅' : '❌', f, '标签平衡', `(div ${c(/<div\b/g)}/${c(/<\/div>/g)} | strong ${c(/<strong>/g)}/${c(/<\/strong>/g)})`);
  if (!okD || !okS) bad++;
}
process.exit(bad ? 1 : 0);
