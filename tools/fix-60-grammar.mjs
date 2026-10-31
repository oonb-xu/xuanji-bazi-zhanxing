// 修因替换产生的语病 + 改掉「60 与所有行星周期不可通约」这个已被推翻的断言
import fs from 'node:fs';

const FILES = ['docs/41-仅凭落位推七柱.md', 'docs/42-融合路径论文.md', 'web/index.html', 'web/paper.html',
  'tools/add-core-declaration.mjs', 'tools/add-paper-and-api-note.mjs'];

// ★ 核心修正短语（与实验性板块一致）
const TRUTH_MD = '60 确有天文近似依据（= LCM(12木, 30土) ≈ 3×木土会合 59.577 年），但它是**计数**、不是可测的几何量';
const TRUTH_HTML = TRUTH_MD.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

let changed = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  const isHtml = /\.html$/.test(f);
  const T = isHtml ? TRUTH_HTML : TRUTH_MD;
  const before = s;

  // ① 语病：「这个起点在星盘里给不出「这是第几个甲子」」
  s = s.replace(/而\*\*这个起点在星盘里给不出「这是第几个甲子」\*\*/g,
    '而**这个起点不在星盘里**');
  s = s.replace(/而<b>这个起点在星盘里给不出「这是第几个甲子」<\/b>/g,
    '而<b>这个起点不在星盘里</b>');
  s = s.replace(/这个起点在星盘里给不出「这是第几个甲子」/g, '这个起点不在星盘里');

  // ② 已被推翻的断言：60 与所有行星周期不可通约
  s = s.replace(/60\s*与所有行星周期不可通约/g, T);

  // ③ 残留的括号式重复（避免「不可通约」与真相互相矛盾）
  s = s.replace(/（\s*60\s*确有天文近似依据[^）]*不可通约[^）]*）/g, '（' + T + '）');

  if (s !== before) {
    if (isHtml) {
      const c = (re) => (s.match(re) || []).length;
      if (c(/<div\b/g) !== c(/<\/div>/g) || c(/<strong>/g) !== c(/<\/strong>/g)) {
        console.error('❌', f, '标签不平衡，跳过');
        continue;
      }
    }
    fs.writeFileSync(f, s, 'utf8');
    changed++;
    console.log('✅', f);
  }
}
console.log('\n共改', changed, '个文件');

/* 验证 */
console.log('\n=== 残留与语病检查 ===');
let bad = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const r = [];
  if (/60\s*与所有行星周期不可通约/.test(s)) r.push('旧断言「不可通约」');
  if (s.includes('这个起点在星盘里给不出')) r.push('语病');
  if (s.includes('天空里不存在')) r.push('天空里不存在');
  if (r.length) { bad++; console.log('  ❌', f, '→', r.join(',')); }
  else console.log('  ✅', f);
}

/* 打印关键上下文确认通顺 */
for (const f of ['docs/41-仅凭落位推七柱.md', 'web/index.html']) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const i = s.indexOf('这个起点不在星盘里');
  if (i > 0) console.log('\n[' + f + '] 上下文:\n  ' + JSON.stringify(s.slice(Math.max(0, i - 100), i + 180)));
  const j = s.indexOf('60 确有天文近似依据');
  if (j > 0) console.log('\n[' + f + '] 新表述:\n  ' + JSON.stringify(s.slice(j, j + 190)));
}
process.exit(bad ? 1 : 0);
