// 最终清理：去掉嵌套括号，读顺
import fs from 'node:fs';
const FILES = ['docs/41-仅凭落位推七柱.md', 'docs/42-融合路径论文.md', 'web/index.html', 'web/paper.html',
  'tools/add-core-declaration.mjs', 'tools/add-paper-and-api-note.mjs'];

const MD = '60 有天文近似依据：= LCM(12木,30土) ≈ 3×木土会合 59.577 年；但它是**计数**，星盘里给不出「这是第几个甲子」';
const HTML = MD.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

let changed = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  const isHtml = /\.html$/.test(f);
  const T = isHtml ? HTML : MD;
  const before = s;

  // 匹配「（60 确有天文近似依据（...），但它是…这个量）」整段，换成干净版
  s = s.replace(/（60\s*确有天文近似依据（[^）]*）[^）]*）/g, '（' + T + '）');
  // 兜底：单括号版本
  s = s.replace(/（60\s*确有天文近似依据[^）]*）/g, '（' + T + '）');

  if (s !== before) {
    if (isHtml) {
      const c = (re) => (s.match(re) || []).length;
      if (c(/<div\b/g) !== c(/<\/div>/g) || c(/<strong>/g) !== c(/<\/strong>/g)) {
        console.error('❌', f, '标签不平衡，跳过'); continue;
      }
    }
    fs.writeFileSync(f, s, 'utf8');
    changed++;
    console.log('✅', f);
  }
}
console.log('共改', changed);

console.log('\n=== 最终检查 ===');
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const r = [];
  if (/（60\s*确有天文近似依据（/.test(s)) r.push('嵌套括号');
  if (s.includes('这个量）')) r.push('冗余"这个量）"');
  if (s.includes('天空里不存在')) r.push('天空里不存在');
  if (/60\s*与所有行星周期不可通约/.test(s)) r.push('旧断言');
  if (r.length) { bad++; console.log('  ❌', f, '→', r.join(',')); }
  else console.log('  ✅', f);
}

/* 打印两处最终文本 */
for (const f of ['docs/41-仅凭落位推七柱.md', 'web/index.html']) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const i = s.indexOf('60 有天文近似依据');
  if (i > 0) console.log('\n[' + f + ']\n  ' + s.slice(Math.max(0, i - 70), i + 150).replace(/\n/g, ' '));
}
process.exit(bad ? 1 : 0);
