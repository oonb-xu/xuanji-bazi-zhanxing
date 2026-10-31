// 审计：关于页与整体是否丢了内容
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
console.log('web/index.html 大小:', (h.length / 1024).toFixed(1), 'KB');

const MUST = [
  // 关于页各板块
  ['关于标题', 'class="page-title"'],
  ['这是什么', '这是什么'],
  ['一句话', 'id="sec-what-is-this"'],
  ['隐私承诺', '隐私承诺'],
  ['这不是拼贴', 'id="sec-not-collage"'],
  ['方法论', 'id="sec-method"'],
  ['59.58 假说', 'id="sec-59-58"'],
  ['体系冲突', 'id="sec-conflict"'],
  ['实验性板块', 'id="sec-experiment"'],
  ['开源署名', 'id="sec-credits"'],
  ['API 说明', 'id="sec-howto"'],
  ['精度声明', '想要精确度'],
  ['充值声明', 'api-pay-notice'],
  ['Key 怎么用', 'Key 怎么用'],
  ['导航索引', 'id="about-toc"'],
  // 融合页
  ['融合页', 'data-page="fusion"'],
  ['融合表单', 'id="f-fusion"'],
  ['数据上交选项', 'opt-contribute'],
  ['融合盘宿主', 'id="fusion-wheel-host"'],
  ['深度面板宿主', 'id="deep-host"'],
  // 其他页
  ['合盘页', 'data-page="synastry"'],
  ['六壬页', 'data-page="liuren"'],
  ['矫正页', 'data-page="rectify"'],
  ['时序页', 'data-page="timeline"'],
  // 脚本
  ['report.js', '/report.js'],
  ['share-birth.js', '/share-birth.js'],
  ['wizard.js', '/wizard.js'],
  ['fusion3d.js', '/fusion3d.js'],
  ['fw-fullscreen.js', '/fw-fullscreen.js'],
  ['deep-panel.js', '/deep-panel.js'],
  ['paper.html 入口', '/paper.html'],
];

console.log('\n=== 内容清单 ===');
const missing = [];
for (const [name, key] of MUST) {
  const ok = h.includes(key);
  if (!ok) missing.push(name);
  console.log(' ', ok ? '✅' : '❌', name);
}

/* 关于页标题清单 */
const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
const seg = h.slice(a0, a1);
const heads = [...seg.matchAll(/<(h2|h3)[^>]*>([^<]{0,42})/g)].map((m) => m[1] + ': ' + m[2].trim());
console.log('\n=== 关于页标题（共 ' + heads.length + ' 个）===');
heads.forEach((x, i) => console.log('  ' + (i + 1) + '. ' + x));
console.log('\n关于页长度:', seg.length, '字符');

/* 标签平衡 */
const c = (re) => (h.match(re) || []).length;
console.log('\n=== 标签 ===');
console.log(`  div     ${c(/<div\b/g)}/${c(/<\/div>/g)}  ${c(/<div\b/g) === c(/<\/div>/g) ? '✅' : '❌'}`);
console.log(`  section ${c(/<section\b/g)}/${c(/<\/section>/g)}  ${c(/<section\b/g) === c(/<\/section>/g) ? '✅' : '❌'}`);
console.log(`  h2      ${c(/<h2\b/g)}/${c(/<\/h2>/g)}  ${c(/<h2\b/g) === c(/<\/h2>/g) ? '✅' : '❌'}`);
console.log(`  h3      ${c(/<h3\b/g)}/${c(/<\/h3>/g)}  ${c(/<h3\b/g) === c(/<\/h3>/g) ? '✅' : '❌'}`);

console.log('\n=== 缺失合计: ' + missing.length + ' 项 ===');
if (missing.length) console.log('  ' + missing.join(' / '));

/* 与 dist 对比 */
const dp = 'dist/web/index.html';
if (fs.existsSync(dp)) {
  const d = fs.readFileSync(dp, 'utf8');
  console.log('\n=== 与 dist 对比 ===');
  console.log('  dist 大小:', (d.length / 1024).toFixed(1), 'KB', '| web 大小:', (h.length / 1024).toFixed(1), 'KB');
  const dMiss = MUST.filter(([, k]) => !d.includes(k)).map(([n]) => n);
  console.log('  dist 缺失:', dMiss.length ? dMiss.join(' / ') : '无');
  if (d.length > h.length) console.log('  ⚠️ dist 比 web 大 —— web 可能丢了内容');
}
process.exit(missing.length ? 1 : 0);
