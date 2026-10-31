// 干跑：按 upload-to-github.mjs 的同一套规则统计会上传哪些文件（不联网）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIR = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py', '.idea', '.vscode']);
const SKIP_DATA_SUB = /^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/;
const SKIP_FILE = /(\.bak|\.bak-|^_dump\.json$|^shortcut-result\.json$|\.out\.json$|^shot-.*\.png$|\.mp4$|\.wav$|\.log$)/;

const files = [];
const skipped = {};
function bump(k) { skipped[k] = (skipped[k] || 0) + 1; }
function walk(dir) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) { bump('目录:' + e.name); continue; }
      if (path.basename(dir) === 'data' && SKIP_DATA_SUB.test(e.name)) { bump('数据:' + e.name); continue; }
      walk(p);
    } else {
      if (path.basename(dir) === 'data' && /^(samples|korean|vedastro|bazi-corpus|baziqa|contrib|records|groundtruth|charts|cases)/.test(e.name)) { bump('数据根文件'); continue; }
      if (SKIP_FILE.test(rel)) { bump('产物/备份'); continue; }
      const sz = fs.statSync(p).size;
      if (sz > 20 * 1024 * 1024) { bump('超大'); continue; }
      if (!/\.(md|txt|json|jsonl|yml|yaml|js|mjs|cjs|html|css|svg|cmd|ps1|sh|py)$/i.test(e.name) && e.name !== 'LICENSE') { bump('非文本'); continue; }
      files.push({ rel, size: sz });
    }
  }
}
walk(ROOT);

const total = files.reduce((a, f) => a + f.size, 0);
console.log(`会上传 ${files.length} 个文件，共 ${(total / 1048576).toFixed(2)} MB\n`);

console.log('排除统计：');
for (const [k, v] of Object.entries(skipped).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);

console.log('\n顶层分布：');
const top = {};
for (const f of files) { const k = f.rel.split('/')[0]; top[k] = (top[k] || 0) + 1; }
for (const [k, v] of Object.entries(top).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);

console.log('\n抽样 20 个：');
files.slice(0, 20).forEach(f => console.log('  ' + f.rel));

/* 敏感路径复查 */
const danger = files.filter(f => /samples\/|korean|vedastro|bazi-corpus|reports\/|\.bak|shortcut-result|shot-/.test(f.rel));
console.log('\n敏感路径命中：' + (danger.length ? danger.slice(0, 10).map(d => d.rel).join(', ') : '无 ✅'));
