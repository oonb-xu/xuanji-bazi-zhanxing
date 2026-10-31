import fs from 'node:fs';

const CLIS = fs.readdirSync('.').filter(f => /^cli.*\.mjs$/.test(f));
console.log('=== CLI 清单 (' + CLIS.length + ') ===');
for (const f of CLIS) {
  const t = fs.readFileSync(f, 'utf8');
  /* 抓 --xxx 参数 */
  const flags = [...new Set([...t.matchAll(/['"]--([a-z][a-z0-9-]*)['"]/g)].map(m => '--' + m[1]))].slice(0, 14);
  /* 抓首行注释 */
  const first = (t.split('\n').find(l => l.trim().startsWith('//')) || '').replace(/^\/\/\s*/, '').slice(0, 60);
  console.log('\n  ' + f.padEnd(28) + (first || ''));
  if (flags.length) console.log('    ' + flags.join(' '));
}

/* package.json 现状 */
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('\n=== package.json ===');
console.log('  name: ' + pkg.name + '  version: ' + pkg.version + '  type: ' + pkg.type);
console.log('  bin: ' + JSON.stringify(pkg.bin || null));
console.log('  main: ' + JSON.stringify(pkg.main || null));
console.log('  engines: ' + JSON.stringify(pkg.engines || null));
console.log('  scripts 数: ' + Object.keys(pkg.scripts || {}).length);
for (const k of ['start', 'serve', 'dev', 'test']) console.log('    ' + k + ': ' + (pkg.scripts?.[k] || '(无)'));

/* server.mjs 是否支持 --port / --open */
const s = fs.readFileSync('server.mjs', 'utf8');
console.log('\n=== server.mjs ===');
console.log('  --open: ' + (s.includes('--open') ? '✅' : '❌'));
console.log('  argv 端口解析: ' + (/(process\.argv\[2\]|--port)/.test(s) ? '✅' : '❌'));
console.log('  HOST 绑定: ' + (/0\.0\.0\.0|127\.0\.0\.1|localhost/.test(s) ? s.match(/['"](0\.0\.0\.0|127\.0\.0\.1|localhost)['"]/)?.[0] : '(未明确)'));
console.log('  长度: ' + s.length + ' 字节');

/* 是否有静态站点 / pages 工作流 */
console.log('\n=== 静态站/Pages ===');
for (const p of ['docs/index.html', 'site', '.github/workflows/pages.yml', 'gh-pages']) {
  console.log('  ' + (fs.existsSync(p) ? '✅' : '❌') + ' ' + p);
}
