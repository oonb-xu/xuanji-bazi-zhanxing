// 隐私与敏感信息审计（上传 GitHub 前的硬闸）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git']);
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.json', '.jsonl', '.md', '.html', '.css', '.yml', '.yaml', '.txt', '.cmd', '.ps1', '.sh', '.csv']);

const RULES = [
  { id: 'APIKEY-SK', re: /sk-[A-Za-z0-9]{16,}/g, sev: 'HIGH', note: '疑似 API Key' },
  { id: 'APIKEY-GH', re: /gh[pousr]_[A-Za-z0-9]{20,}/g, sev: 'HIGH', note: '疑似 GitHub Token' },
  { id: 'APIKEY-AK', re: /AKIA[0-9A-Z]{16}/g, sev: 'HIGH', note: '疑似 AWS Key' },
  { id: 'BEARER', re: /Bearer\s+[A-Za-z0-9._-]{20,}/g, sev: 'HIGH', note: 'Bearer Token' },
  { id: 'DATETIME', re: /\b(19|20)\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/g, sev: 'MID', note: '完整出生时刻样式' },
  { id: 'DATETIME-LOCAL', re: /type="datetime-local"[^>]*value="[^"]+"/g, sev: 'MID', note: '表单预填出生时间' },
  { id: 'LONLAT', re: /\b(1[0-3]\d\.\d{2,6})\s*[,，]\s*(1?\d\.\d{2,6})\b/g, sev: 'MID', note: '经纬度对' },
  { id: 'LNG-KEY', re: /"(?:lng|lon|longitude)"\s*:\s*\d+\.\d{3,}/g, sev: 'MID', note: 'lng 字段带小数' },
  { id: 'LAT-KEY', re: /"(?:lat|latitude)"\s*:\s*\d+\.\d{3,}/g, sev: 'MID', note: 'lat 字段带小数' },
  { id: 'PHONE', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, sev: 'HIGH', note: '手机号' },
  { id: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, sev: 'MID', note: '邮箱' },
  { id: 'IDCARD', re: /(?<!\d)\d{17}[\dXx](?!\d)/g, sev: 'HIGH', note: '身份证号' },
  { id: 'ABS-PATH', re: /C:\\\\Users\\\\[A-Za-z0-9_\u4e00-\u9fa5]+/g, sev: 'LOW', note: '本机绝对路径（含用户名）' },
  { id: 'LOCALSTORAGE', re: /xuanji-api-config/g, sev: 'LOW', note: '本地 API 配置键（仅键名，确认无值）' },
];

const results = { HIGH: [], MID: [], LOW: [] };
const filesScanned = [];
const dirsSeen = [];

function walk(dir) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      dirsSeen.push(path.relative(ROOT, p));
      walk(p);
    } else {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      const ext = path.extname(e.name).toLowerCase();
      const size = fs.statSync(p).size;
      /* 文本文件才扫内容 */
      if (TEXT_EXT.has(ext) && size < 8 * 1024 * 1024) {
        filesScanned.push(rel);
        let txt;
        try { txt = fs.readFileSync(p, 'utf8'); } catch { continue; }
        for (const r of RULES) {
          r.re.lastIndex = 0;
          let m, n = 0;
          while ((m = r.re.exec(txt)) && n < 6) {
            n++;
            const line = txt.slice(0, m.index).split('\n').length;
            results[r.sev].push({ file: rel, line, rule: r.id, sample: String(m[0]).slice(0, 70) });
          }
        }
      } else if (size >= 8 * 1024 * 1024) {
        results.LOW.push({ file: rel, line: 0, rule: 'BIGFILE', sample: (size / 1048576).toFixed(1) + ' MB' });
      }
    }
  }
}
walk(ROOT);

/* 汇总 */
const out = { scanned: filesScanned.length, dirs: dirsSeen.length, HIGH: results.HIGH, MID: results.MID, LOW: results.LOW };
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/privacy-audit.json', JSON.stringify(out, null, 2), 'utf8');

console.log('扫描文件 ' + filesScanned.length + ' 个，目录 ' + dirsSeen.length + ' 个\n');
for (const sev of ['HIGH', 'MID', 'LOW']) {
  const arr = results[sev];
  console.log('=== ' + sev + ' (' + arr.length + ') ===');
  const byRule = {};
  for (const x of arr) byRule[x.rule] = (byRule[x.rule] || 0) + 1;
  console.log('  按规则: ' + Object.entries(byRule).map(([k, v]) => k + '=' + v).join('  '));
  const byFile = {};
  for (const x of arr) byFile[x.file] = (byFile[x.file] || 0) + 1;
  Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([f, n]) => console.log('   ' + String(n).padStart(4) + '  ' + f));
  if (sev === 'HIGH') {
    arr.slice(0, 8).forEach(x => console.log('     ⚠ ' + x.file + ':' + x.line + '  [' + x.rule + ']  ' + x.sample));
  }
  console.log('');
}

/* ── CI 模式：分级判定（硬失败 / 警告）── */
const CI = process.argv.includes('--ci');
if (CI) {
  const IGNORE_TOP = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py']);
  const SKIP_DATA = /^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/;
  /* dev 工具脚本：含正则/示例字面量，不做行级隐私判定（仍做密钥检查） */
  const DEV_TOOL = /^tools\/(privacy-audit|scrub-privacy|redact-line-level|refine-privacy-ci|cleanup-and-verify-github|setup-github-structure|fix-|merge-|extend-|add-|find-|patch-|repair-|rewrite-|unify-|wire-|probe-|calc-|bigcycle-|paginate-|ensure-|inspect-|survey-|check-|locate-|remove-|restore-|stop-|strip-|shrink-|hide-|tweak-|enlarge-|move-|insert-|clean-|compare-|export-|audit-|auto-|make-dist|verify-)/;

  /* 白名单 */
  const allow = (fs.existsSync('.privacy-allowlist') ? fs.readFileSync('.privacy-allowlist', 'utf8') : '')
    .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const matchAllow = (rel) => {
    const r = rel.replace(/\\/g, '/');
    for (const g of allow) {
      if (!g.includes('*')) { if (r === g) return true; continue; }
      /* 先转义除 * 以外的正则元字符，再把 * 换成 .* */
      const rx = '^' + g.replace(/[.+?^${}()|[\]\\\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      try { if (new RegExp(rx).test(r)) return true; } catch (err) { /* ignore */ }
    }
    return false;
  };

  const cand = [];
  const walk2 = (dir) => {
    let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      if (e.isDirectory()) {
        if (IGNORE_TOP.has(e.name)) continue;
        if (path.basename(dir) === 'data' && SKIP_DATA.test(e.name)) continue;
        walk2(p);
      } else {
        if (/\.bak|_dump\.json|shortcut-result\.json/.test(e.name)) continue;
        if (path.basename(dir) === 'data' && /^(samples|korean|vedastro|bazi-corpus|baziqa|contrib|records|groundtruth|charts|cases)/.test(e.name)) continue;
        if (/\.(js|mjs|json|jsonl|md|html|css|txt|yml|yaml)$/i.test(e.name)) cand.push(rel);
      }
    }
  };
  walk2(ROOT);

  const HARD = ['APIKEY-SK', 'APIKEY-GH', 'APIKEY-AK', 'BEARER', 'PHONE', 'IDCARD'];
  const CITIES = ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆', '长沙', '青岛', '天津', '苏州'];
  const BIRTH = /\b(19|20)\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

  const fail = [], warn = [];
  for (const rel of cand) {
    if (matchAllow(rel)) continue;
    let txt; try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
    const isDev = DEV_TOOL.test(rel.replace(/\\/g, '/'));

    /* 密钥类：所有文件都查 */
    for (const rule of RULES) {
      if (!HARD.includes(rule.id)) continue;
      if (rule.id === 'PHONE' || rule.id === 'IDCARD') continue;  /* 交给行级判定，避免误伤长数字 */
      rule.re.lastIndex = 0;
      if (rule.re.test(txt)) fail.push(rel + '  [' + rule.id + ']');
    }

    if (isDev) continue;

    /* 行级：同一行同时出现「出生时刻」与「真实城市」才硬失败 */
    const lines = txt.split('\n');
    let cityLine = null, birthOnly = false;
    for (const l of lines) {
      const hasBirth = BIRTH.test(l);
      if (!hasBirth) {
        if (/\b1[3-9]\d{9}\b/.test(l)) fail.push(rel + '  [PHONE 行级]');
        if (/\b\d{17}[\dXx]\b/.test(l)) fail.push(rel + '  [IDCARD 行级]');
        continue;
      }
      birthOnly = true;
      const c = CITIES.find(x => l.includes(x));
      if (c) cityLine = c;
    }
    if (cityLine) fail.push(rel + '  [同一行: 出生时刻 + 真实地名「' + cityLine + '」]');
    else if (birthOnly) warn.push(rel);
  }

  console.log('\n=== CI 隐私闸 ===');
  console.log('  扫描文件: ' + cand.length + '  白名单: ' + allow.length + ' 条');
  if (fail.length) {
    console.log('  \n  ❌ 硬失败 (' + fail.length + '):');
    [...new Set(fail)].slice(0, 20).forEach(x => console.log('     ' + x));
  } else {
    console.log('  ✅ 无 API Key / 手机号 / 身份证 / 出生时刻与真实地名同行');
  }
  if (warn.length) {
    console.log('  \n  ⚠️ 含出生时刻样式但无地名（' + warn.length + ' 个，合成基准盘或示例）:');
    [...new Set(warn)].slice(0, 6).forEach(x => console.log('     ' + x));
  }
  process.exit(fail.length ? 1 : 0);
}

/* 顶层结构 */
console.log('=== 顶层条目 ===');
for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (SKIP_DIRS.has(e.name)) continue;
  let info = '';
  if (e.isFile()) { const s = fs.statSync(path.join(ROOT, e.name)).size; info = (s > 1048576 ? (s / 1048576).toFixed(1) + 'MB' : Math.round(s / 1024) + 'KB'); }
  else {
    try { const n = fs.readdirSync(path.join(ROOT, e.name)).length; info = n + ' 项'; } catch { info = '?'; }
  }
  console.log('  ' + (e.isDirectory() ? '📁 ' : '📄 ') + e.name.padEnd(34) + info);
}
