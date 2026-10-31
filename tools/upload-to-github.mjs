#!/usr/bin/env node
/**
 * 无需 git：用 GitHub REST API 一次性创建仓库并上传整棵树
 *
 * 用法：
 *   set GITHUB_TOKEN=ghp_xxx  &&  node tools/upload-to-github.mjs
 *   或  node tools/upload-to-github.mjs <token> <repo-name>
 *
 * 只上传「该公开」的文件：遵循 .gitignore 的排除规则（真实样本/第三方数据集/构建产物都不上传）。
 */
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.argv[2] || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPO = process.argv[3] || process.env.REPO_NAME || 'xuanji';
const BRANCH = 'main';
const ROOT = process.cwd();

if (!TOKEN) {
  console.error('✗ 缺少 token。用法：node tools/upload-to-github.mjs <token> [repo-name]');
  process.exit(1);
}

const API = 'https://api.github.com';
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'xuanji-uploader',
  'Content-Type': 'application/json',
};

async function api(method, url, body) {
  const r = await fetch(API + url, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const txt = await r.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* ignore */ }
  if (!r.ok) {
    throw new Error(`${method} ${url} → ${r.status} ${(json && json.message) || txt.slice(0, 200)}`);
  }
  return json;
}

/* ── 1. 收集要上传的文件（硬编码排除，与 .gitignore 对应）── */
const SKIP_DIR = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py', '.idea', '.vscode']);
const SKIP_DATA_SUB = /^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/;
const SKIP_FILE = /(\.bak|\.bak-|^_dump\.json$|^shortcut-result\.json$|\.out\.json$|^shot-.*\.png$|\.mp4$|\.wav$|\.log$)/;

const files = [];
function walk(dir) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p).replace(/\\/g, '/');
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      if (path.basename(dir) === 'data' && SKIP_DATA_SUB.test(e.name)) continue;
      walk(p);
    } else {
      if (path.basename(dir) === 'data' && /^(samples|korean|vedastro|bazi-corpus|baziqa|contrib|records|groundtruth|charts|cases)/.test(e.name)) continue;
      if (SKIP_FILE.test(rel)) continue;
      const sz = fs.statSync(p).size;
      if (sz > 20 * 1024 * 1024) { console.log('  ⚠ 跳过超大文件 ' + rel + ' (' + (sz / 1048576).toFixed(1) + 'MB)'); continue; }
      /* 只收文本类，二进制仅收必要图片 */
      if (!/\.(md|txt|json|jsonl|yml|yaml|js|mjs|cjs|html|css|svg|cmd|ps1|sh|py)$/i.test(e.name) && e.name !== 'LICENSE') {
        continue;
      }
      files.push({ rel, abs: p, size: sz });
    }
  }
}
walk(ROOT);

const totalSize = files.reduce((a, f) => a + f.size, 0);
console.log(`① 待上传 ${files.length} 个文件，共 ${(totalSize / 1048576).toFixed(2)} MB`);

/* ── 2. 取当前用户 ── */
const me = await api('GET', '/user');
console.log(`② 已认证：${me.login}`);

/* ── 3. 建仓库（已存在则跳过）── */
let repo;
try {
  repo = await api('POST', '/user/repos', {
    name: REPO,
    description: '玄机 · 中西命理融合 —— 八字 / 古典占星 / 七政四余 / 紫微斗数 的统一推演模型',
    homepage: '',
    private: false,
    has_issues: true,
    has_wiki: false,
    license_template: 'apache-2.0',
  });
  console.log(`③ 已创建仓库：${repo.full_name}`);
} catch (e) {
  if (String(e.message).includes('422')) {
    repo = await api('GET', `/repos/${me.login}/${REPO}`);
    console.log(`③ 仓库已存在：${repo.full_name}`);
  } else throw e;
}

/* ── 4. 建立 tree（一次调用带全部内容）── */
console.log('④ 上传文件树…');
const tree = files.map(f => ({
  path: f.rel,
  mode: '100644',
  type: 'blob',
  content: fs.readFileSync(f.abs, 'utf8'),
}));

let baseTree = undefined;
try {
  const ref = await api('GET', `/repos/${me.login}/${REPO}/git/ref/heads/${BRANCH}`);
  baseTree = ref.object.sha;
  console.log('  （仓库已有内容，基于现有 commit）');
} catch { /* 空仓库 */ }

const newTree = await api('POST', `/repos/${me.login}/${REPO}/git/trees`, {
  ...(baseTree ? { base_tree: baseTree } : {}),
  tree,
});
console.log(`  ✓ tree ${newTree.sha.slice(0, 10)} · ${tree.length} 项`);

/* ── 5. 提交 ── */
const commit = await api('POST', `/repos/${me.login}/${REPO}/git/commits`, {
  message: '玄机 v0.4.0 · 中西命理融合模型（开源发布）\n\n- 四体系统一：八字 / 古典占星 / 七政四余 / 紫微斗数\n- 三层结构：几何层 / 计数层 / 符号层\n- 七政四余逆向复现方法论\n- 大周期模型：3 次木土会合 59.58991 年\n- 统一 CLI、使用手册、GitHub Pages 静态站\n- Apache-2.0',
  tree: newTree.sha,
  ...(baseTree ? { parents: [baseTree] } : {}),
});
console.log(`⑤ 已提交 ${commit.sha.slice(0, 10)}`);

/* ── 6. 指向分支 ── */
if (baseTree) {
  await api('PATCH', `/repos/${me.login}/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
} else {
  await api('POST', `/repos/${me.login}/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
}
console.log(`⑥ 分支 ${BRANCH} → ${commit.sha.slice(0, 10)}`);

console.log('\n✅ 完成！');
console.log('   仓库：https://github.com/' + me.login + '/' + REPO);
console.log('   Pages：Settings → Pages → Source 选 GitHub Actions');
console.log('   提示：记得把文件里的 YOUR_NAME 换成 ' + me.login + '，YOUR_ID 换成你的爱发电 ID');
