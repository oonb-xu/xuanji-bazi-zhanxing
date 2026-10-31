// 统一 CLI 入口：bin/xuanji.mjs + package.json 元数据
import fs from 'node:fs';

/* ═══ ① bin/xuanji.mjs ═══ */
const BIN = `#!/usr/bin/env node
/**
 * 玄机 · 统一命令行入口
 *
 * 用法：  xuanji <command> [options]
 *         node bin/xuanji.mjs <command> [options]
 *
 * 命令：
 *   serve    启动本地 Web 应用（默认 8788）
 *   bazi     八字排盘
 *   natal    西方星盘
 *   liuren   大六壬起课
 *   rectify  生时矫正 / 星盘反推八字
 *   sample   采集样本（出生时间 + 事例）
 *   doctor   环境体检
 *   test     回归测试
 *   help     帮助
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const C = {
  cyan: s => '\\x1b[36m' + s + '\\x1b[0m',
  gold: s => '\\x1b[33m' + s + '\\x1b[0m',
  dim: s => '\\x1b[2m' + s + '\\x1b[0m',
  red: s => '\\x1b[31m' + s + '\\x1b[0m',
  green: s => '\\x1b[32m' + s + '\\x1b[0m',
};

/* 命令表：cmd → { script, hint } */
const CMDS = {
  serve:   { script: 'server.mjs',          hint: '启动本地 Web（默认 8788）' },
  bazi:    { script: 'cli-bazi.mjs',        hint: '八字排盘 + 交叉修正' },
  natal:   { script: 'cli-natal.mjs',       hint: '西方星盘（出生时间 + 经纬度）' },
  liuren:  { script: 'cli.mjs',             hint: '大六壬起课（--at + --matter）' },
  rectify: { script: 'cli-rectify.mjs',     hint: '生时矫正 / 星盘反推八字' },
  sample:  { script: 'cli-sample.mjs',      hint: '采集样本（出生时间 + 事例）' },
  kery:    { script: 'cli-kerykeion.mjs',   hint: 'kerykeion 后端出盘' },
  dual:    { script: 'cli-dual.mjs',        hint: '双体系独立推理 + 摩擦检查' },
  eventfit:{ script: 'cli-eventfit.mjs',    hint: '重大事件应期拟合' },
  anchors: { script: 'cli-anchors.mjs',     hint: '古籍年号锚点校准（研究用）' },
  cases:   { script: 'cli-liuren-cases.mjs',hint: '六壬课例解析（研究用）' },
};

const HELP = \`
\${C.cyan('玄机 · 中西命理融合')}  \${C.dim('统一命令行')}

\${C.gold('用法')}
  xuanji <command> [options]
  node bin/xuanji.mjs <command> [options]

\${C.gold('常用命令')}
  \${C.cyan('serve')}    [--port 8788] [--open]     启动本地 Web 应用
  \${C.cyan('bazi')}     --at "2000-01-01 12:00"    八字排盘（可加 --gender 女）
  \${C.cyan('natal')}    --at "..." --lng 116.4 --lat 39.9 --tz 8   西方星盘
  \${C.cyan('liuren')}   --at "..." --matter "问事业"              大六壬起课
  \${C.cyan('rectify')}  --at "..."                 生时矫正 / 星盘反推八字
  \${C.cyan('sample')}   --add data/samples/xx.json 采集样本

\${C.gold('维护命令')}
  \${C.cyan('doctor')}                              环境体检（Node/依赖/数据目录）
  \${C.cyan('test')}                                跑全部回归（39 套）
  \${C.cyan('help')}                                查看本帮助

\${C.gold('研究用命令')}
  kery · dual · eventfit · anchors · cases

\${C.gold('示例')}
  # 起服务并自动开浏览器
  xuanji serve --open

  # 排一个八字
  xuanji bazi --at "2000-01-01 12:00" --gender 女

  # 出星盘（北京）
  xuanji natal --at "2000-01-01 12:00" --lng 116.4 --lat 39.9 --tz 8

\${C.dim('提示：所有子命令都支持 --help，参数会原样传给对应脚本。')}
\`;

function run(script, args) {
  const p = path.join(ROOT, script);
  if (!fs.existsSync(p)) {
    console.error(C.red('✗ 找不到脚本：' + script));
    process.exit(1);
  }
  const child = spawn(process.execPath, [p, ...args], { cwd: ROOT, stdio: 'inherit' });
  child.on('exit', code => process.exit(code ?? 0));
}

/* ── doctor ── */
function doctor() {
  const ok = (b) => (b ? C.green('✓') : C.red('✗'));
  console.log(C.cyan('\\n玄机 · 环境体检\\n'));

  const major = Number(process.versions.node.split('.')[0]);
  console.log('  ' + ok(major >= 18) + ' Node.js ' + process.versions.node + (major >= 18 ? '' : C.red('  （需要 ≥ 18）')));
  console.log('  ' + ok(true) + ' 工作目录 ' + ROOT);

  const need = ['package.json', 'server.mjs', 'src', 'web', 'test'];
  for (const n of need) console.log('  ' + ok(fs.existsSync(path.join(ROOT, n))) + ' ' + n);

  const nm = fs.existsSync(path.join(ROOT, 'node_modules'));
  console.log('  ' + ok(nm) + ' node_modules' + (nm ? '' : C.gold('  （运行 npm install）')));

  const deps = ['astronomy-engine', 'tyme4ts', 'liuren-ts-lib', 'csv-parse', 'iconv-lite'];
  for (const d of deps) {
    const p = path.join(ROOT, 'node_modules', d);
    console.log('  ' + ok(fs.existsSync(p)) + ' 依赖 ' + d);
  }

  const dataDirs = ['data/schema', 'data/SOURCES.md'];
  for (const d of dataDirs) console.log('  ' + ok(fs.existsSync(path.join(ROOT, d))) + ' ' + d);

  const samp = path.join(ROOT, 'data', 'samples');
  if (fs.existsSync(samp)) {
    const n = fs.readdirSync(samp).filter(f => f.endsWith('.json')).length;
    console.log('  ' + C.dim('i') + ' 本地样本 ' + n + ' 个（隐私：默认不入库）');
  }

  console.log(C.dim('\\n  体检完成。若缺依赖：npm install\\n'));
}

/* ── test ── */
function test() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const cmd = pkg.scripts?.test;
  if (!cmd) { console.error(C.red('✗ package.json 里没有 test 脚本')); process.exit(1); }
  console.log(C.cyan('\\n玄机 · 回归测试（39 套）\\n'));
  const child = spawn(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
  child.on('exit', code => process.exit(code ?? 0));
}

/* ── 主流程 ── */
const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') {
  console.log(HELP);
  process.exit(0);
}
if (cmd === 'doctor') { doctor(); }
else if (cmd === 'test') { test(); }
else if (CMDS[cmd]) { run(CMDS[cmd].script, rest); }
else {
  console.error(C.red('✗ 未知命令：' + cmd));
  console.log(C.dim('\\n可用命令：' + Object.keys(CMDS).join(' · ') + ' · doctor · test · help'));
  process.exit(1);
}
`;
fs.mkdirSync('bin', { recursive: true });
fs.writeFileSync('bin/xuanji.mjs', BIN, 'utf8');
console.log('✅ bin/xuanji.mjs 已生成');

/* ═══ ② package.json 元数据 ═══ */
const P = 'package.json';
const pkg = JSON.parse(fs.readFileSync(P, 'utf8'));
fs.writeFileSync(P + '.bak-bin', fs.readFileSync(P, 'utf8'));

pkg.name = 'xuanji-meta-unified';
pkg.version = pkg.version || '0.4.0';
pkg.description = '玄机 · 中西命理融合 —— 八字 / 古典占星 / 七政四余 / 紫微斗数 的统一推演模型';
pkg.type = 'module';
pkg.license = 'Apache-2.0';
pkg.bin = { xuanji: 'bin/xuanji.mjs' };
pkg.main = 'server.mjs';
pkg.engines = { node: '>=18' };
pkg.keywords = ['八字', 'bazi', '占星', 'astrology', '七政四余', '紫微斗数', 'ziwei', '大六壬', 'liuren', '命理', '开源'];
pkg.homepage = 'https://github.com/oonb-xu/xuanji#readme';
pkg.repository = { type: 'git', url: 'git+https://github.com/oonb-xu/xuanji.git' };
pkg.bugs = { url: 'https://github.com/oonb-xu/xuanji/issues' };
pkg.scripts = pkg.scripts || {};
pkg.scripts.start = 'node server.mjs 8788 --open';
pkg.scripts.serve = 'node server.mjs 8788';
pkg.scripts.dev = 'node server.mjs 8788 --open';
pkg.scripts.doctor = 'node bin/xuanji.mjs doctor';
pkg.scripts.help = 'node bin/xuanji.mjs help';

/* files：npm publish 时只带这些 */
pkg.files = ['bin/', 'src/', 'web/', 'ziwei/', 'server.mjs', 'cli-*.mjs', 'LICENSE', 'README.md', 'USAGE.md', 'PRIVACY.md'];

fs.writeFileSync(P, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('✅ package.json 已补：bin / main / engines / keywords / homepage / repository / start / serve / dev / doctor / help / files');
