// 构建「可部署包」：只复制运行 Web App 必需的三个部分，并在打包后**强制校验**不含任何真实生辰数据。
//
// 为什么需要它：仓库里 cli-*.mjs / examples/ / data/ / docs/ 含大量真实案例数据（研究用），
// 一旦整仓上传到云服务器就会泄露。本脚本只产出干净的最小部署面。
//
// 用法：node tools/make-dist.mjs [输出目录，默认 dist]
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'dist';

// 只打包这些（运行 Web App 的全部依赖）
const INCLUDE = [
  ['server.mjs', 'server.mjs'],
  ['web', 'web'],
  ['src/__noop', null], // 占位，下面单独处理 src
];

// 运行 App 真正 import 的模块（按 server.mjs 的 import 逐层展开）
const ENTRY = 'server.mjs';

// 隐私黑名单：这些字面量一旦出现在产出里就判失败
const FORBIDDEN = [
  /2007-12-25/, /2008-07-04/, /2008-04-16/,
  // ★ 必须加 (?![0-9])：否则 104.06 会误命中成都的公开经度 104.066（城市表本身就含它）
  /104\.06(?![0-9])/, /105\.05(?![0-9])/, /30\.67(?![0-9])/, /29\.58(?![0-9])/,
];

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'backups', '.npm-cache', '.tmp', '.venv', '.ephemeris'].includes(e.name)) continue;
      copyDir(s, d);
    } else if (e.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

/** 从入口开始递归收集 import（只收相对路径 .mjs/.js） */
function collectDeps(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    const re = /(?:from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) {
      const rel = m[1];
      let target = path.normalize(path.join(path.dirname(f), rel));
      if (!fs.existsSync(target) && fs.existsSync(target + '.mjs')) target += '.mjs';
      if (fs.existsSync(target) && fs.statSync(target).isFile()) queue.push(target);
    }
  }
  return seen;
}

// ── 清理输出 ──
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 复制静态外壳 ──
if (!fs.existsSync('web')) { console.error('缺 web/ 目录'); process.exit(1); }
copyDir('web', path.join(OUT, 'web'));

// ── 复制入口 + 递归依赖 ──
const deps = collectDeps(ENTRY);
const missing = [];
for (const f of deps) {
  if (!fs.existsSync(f)) { missing.push(f); continue; }
  copyFile(f, path.join(OUT, f));
}
// LICENSE 与 README：Apache-2.0 要求分发时附带许可证副本
for (const f of ['LICENSE']) {
  if (fs.existsSync(f)) copyFile(f, path.join(OUT, f));
}

// package.json（若 server 需要 type:module）
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  fs.writeFileSync(path.join(OUT, 'package.json'), JSON.stringify({ name: pkg.name ?? 'xuanji-app', version: pkg.version ?? '1.0.0', type: 'module', private: true }, null, 2) + '\n', 'utf8');
}

// ── 隐私校验 ──
// ★ 白名单：这些文件是**公开天文/几何数据**，天然含大量数值（赤纬、黄经），
//   会被坐标类规则误命中。它们不含任何出生信息，故跳过扫描。
const SCAN_SKIP = new Set(['stars.js']);
const hits = [];
function scan(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    if (!/\.(mjs|js|html|css|json|md)$/.test(e.name)) continue;
    if (SCAN_SKIP.has(e.name)) continue;
    const t = fs.readFileSync(p, 'utf8');
    for (const re of FORBIDDEN) {
      const m = t.match(re);
      if (m) hits.push(`${p} 含 ${m[0]}`);
    }
  }
}
scan(OUT);

// ── 报告 ──
const files = [];
function list(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? list(p) : files.push(p); } }
list(OUT);
const totalKB = (files.reduce((a, f) => a + fs.statSync(f).size, 0) / 1024).toFixed(0);

console.log(`部署包 → ${OUT}/  共 ${files.length} 个文件 / ${totalKB} KB`);
console.log('包含的模块：');
for (const f of [...deps].sort()) console.log('  ' + f);
if (missing.length) console.log('⚠️ 未找到（非致命）: ' + missing.join(', '));
console.log('');
if (hits.length) {
  console.log('❌ 隐私校验失败，产出含真实生辰数据：');
  for (const h of hits) console.log('   ' + h);
  process.exit(2);
}
console.log('✅ 隐私校验通过：产出中无任何真实生辰数据（时间/经纬度均已清除）');
console.log(`启动方式：cd ${OUT} && node server.mjs 8788`);
