import fs from 'node:fs';

/* ① 删除会造成误伤的一次性脚本（保留 privacy-audit.mjs 供 CI 用） */
const DEL = [
  'tools/anonymize-names.mjs',
  'tools/check-anon-damage.mjs',
  'tools/repair-anon-damage.mjs',
  'tools/privacy-gate-c-redact.mjs',
  'tools/privacy-inspect-data.mjs',
  'tools/privacy-inspect-hits.mjs',
  'tools/privacy-gate-a.mjs',
  'tools/locate-contradiction-and-cards.mjs',
  'tools/inspect-video.mjs',
  'tools/survey-structure.mjs',
];
for (const f of DEL) {
  if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('🗑  已删 ' + f); }
}

/* ② GitHub 标准文件清单 */
const REQ = [
  ['README.md', '项目说明'],
  ['LICENSE', 'Apache-2.0 全文'],
  ['CONTRIBUTING.md', '贡献指南'],
  ['CODE_OF_CONDUCT.md', '行为准则'],
  ['SECURITY.md', '安全策略'],
  ['PRIVACY.md', '隐私政策'],
  ['CHANGELOG.md', '更新日志'],
  ['.gitignore', '忽略规则'],
  ['.editorconfig', '编辑器配置'],
  ['.github/workflows/ci.yml', 'CI'],
  ['.github/PULL_REQUEST_TEMPLATE.md', 'PR 模板'],
  ['.github/ISSUE_TEMPLATE/bug_report.yml', 'Issue: Bug'],
  ['.github/ISSUE_TEMPLATE/feature_request.yml', 'Issue: 功能'],
  ['.github/ISSUE_TEMPLATE/data_correction.yml', 'Issue: 纠错'],
  ['test/FIXTURES.md', '测试盘说明'],
  ['data/samples/_demo-synthetic.json', '虚构示例'],
];
console.log('\n=== GitHub 标准文件 ===');
let miss = 0;
for (const [f, d] of REQ) {
  const ok = fs.existsSync(f);
  if (!ok) miss++;
  const size = ok ? (fs.statSync(f).size > 1024 ? (fs.statSync(f).size / 1024).toFixed(1) + 'KB' : fs.statSync(f).size + 'B') : '';
  console.log('  ' + (ok ? '✅' : '❌') + ' ' + f.padEnd(46) + String(size).padStart(7) + '  ' + d);
}
console.log(miss ? '\n❌ 缺 ' + miss + ' 个' : '\n✅ 全部齐全');

/* ③ 视频摘要 */
const v = fs.readFileSync('web/video-intro.html', 'utf8');
const durs = [...v.matchAll(/data-dur="(\d+)"/g)].map(m => Number(m[1]));
console.log('\n=== 宣传视频 ===');
console.log('  分幕 ' + durs.length + ' 幕，总时长 ' + (durs.reduce((a, b) => a + b, 0) / 1000).toFixed(0) + ' 秒');
console.log('  人物姓名残留：' + (['张雪峰', '雷军', '马云'].filter(n => v.includes(n)).join('、') || '无 ✅'));

/* ④ .gitignore 关键项核查 */
const ig = fs.readFileSync('.gitignore', 'utf8');
const MUST = ['data/samples/', 'data/samples.jsonl', 'data/korean/', 'data/vedastro/', 'reports/', 'dist/',
  '.venv/', 'node_modules/', 'shot-*.png', '*.bak*', 'tools/shortcut-result.json'];
console.log('\n=== .gitignore 关键项 ===');
for (const m of MUST) console.log('  ' + (ig.includes(m) ? '✅' : '❌') + ' ' + m);
