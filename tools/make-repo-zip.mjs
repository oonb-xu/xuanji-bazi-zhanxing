// 打一个只含「该公开」文件的 zip（结构与仓库一致），供网页单文件上传 + Actions 解包
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.tmp', 'repo.zip');
const STAGE = path.join(ROOT, '.tmp', 'stage');
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

const SKIP_DIR = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py', '.idea', '.vscode']);
const SKIP_DATA_SUB = /^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/;
const SKIP_FILE = /(\.bak|^_dump\.json$|^shortcut-result\.json$|\.out\.json$|^shot-.*\.png$|\.mp4$|\.wav$|\.log$)/;

let n = 0, bytes = 0;
function walk(dir, relBase) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const abs = path.join(dir, e.name);
    const rel = path.join(relBase, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      if (path.basename(dir) === 'data' && SKIP_DATA_SUB.test(e.name)) continue;
      walk(abs, rel);
    } else {
      if (path.basename(dir) === 'data' && /^(samples|korean|vedastro|bazi-corpus|baziqa|contrib|records|groundtruth|charts|cases)/.test(e.name)) continue;
      if (SKIP_FILE.test(rel.replace(/\\/g, '/'))) continue;
      if (!/\.(md|txt|json|jsonl|yml|yaml|js|mjs|cjs|html|css|svg|cmd|ps1|sh|py)$/i.test(e.name) && e.name !== 'LICENSE' && e.name !== '.gitignore') continue;
      const st = fs.statSync(abs);
      if (st.size > 20 * 1024 * 1024) continue;
      const dst = path.join(STAGE, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(abs, dst);
      n++; bytes += st.size;
    }
  }
}
walk(ROOT, '');

console.log(`准备 ${n} 个文件，${(bytes / 1048576).toFixed(2)} MB`);

/* 用 PowerShell Compress-Archive 打 zip */
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
execFileSync('powershell', ['-NoProfile', '-Command',
  `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${OUT}' -Force`], { stdio: 'inherit' });

const sz = fs.statSync(OUT).size;
console.log(`✅ ${OUT}  ${(sz / 1048576).toFixed(2)} MB`);
