import fs from 'node:fs';

/* ① 先看 docs/05、docs/09 里的"北京"到底是哪张盘 */
for (const f of ['docs/05-本命盘-规则冻结表.md', 'docs/09-西方星盘双后端-kerykeion接入.md']) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, 'utf8');
  console.log('\n── ' + f);
  const L = t.split('\n');
  L.forEach((l, i) => {
    if (l.includes('北京')) console.log('   L' + (i + 1) + ': ' + l.trim().slice(0, 150));
  });
}

/* ② 修 walk 的目录跳过逻辑 */
const P = 'tools/privacy-audit.mjs';
let t = fs.readFileSync(P, 'utf8');
const OLD = `      if (e.isDirectory()) {
        if (IGNORE_TOP.has(e.name)) continue;
        if (dir === '' || dir === '.') { if (SKIP_DATA.test(e.name)) continue; }
        walk2(p);
      } else {`;
const NEW = `      if (e.isDirectory()) {
        if (IGNORE_TOP.has(e.name)) continue;
        /* 在 data/ 下、且名字属于敏感数据集 → 整个目录跳过 */
        if (path.basename(dir) === 'data' && SKIP_DATA.test(e.name)) continue;
        walk2(p);
      } else {`;
if (t.includes(OLD)) { t = t.replace(OLD, NEW); console.log('\n✅ 目录跳过逻辑已修（按 basename(dir)===\'data\' 判断）'); }
else console.log('\n⚠️ 未匹配目录跳过代码');

/* ③ data/ 根下的敏感文件也跳过 */
const OLD2 = `        if (/\\.bak|_dump\\.json|shortcut-result\\.json/.test(e.name)) continue;`;
const NEW2 = `        if (/\\.bak|_dump\\.json|shortcut-result\\.json/.test(e.name)) continue;
        /* data/ 根下的样本汇总等敏感文件 */
        if (path.basename(dir) === 'data' && /^(samples|korean|vedastro|bazi-corpus|baziqa|contrib|records|groundtruth|charts|cases)/.test(e.name)) continue;`;
if (t.includes(OLD2)) { t = t.replace(OLD2, NEW2); console.log('✅ data/ 根下的敏感文件已跳过'); }
else console.log('⚠️ 未匹配文件跳过代码');

fs.writeFileSync(P, t, 'utf8');
