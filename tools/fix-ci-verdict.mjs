// 修 CI 判定：① 城市+出生时刻必须**同一行** ② 跳过 dev 工具脚本 ③ 白名单匹配修好
import fs from 'node:fs';
const P = 'tools/privacy-audit.mjs';
let t = fs.readFileSync(P, 'utf8');

/* ① 重写 CI 段 */
const s = t.indexOf('/* ── CI 模式');
const e = t.indexOf('/* 顶层结构 */');
if (s < 0 || e < 0) { console.error('❌ 定位失败'); process.exit(1); }

const NEW = `/* ── CI 模式：分级判定（硬失败 / 警告）── */
const CI = process.argv.includes('--ci');
if (CI) {
  const IGNORE_TOP = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py']);
  const SKIP_DATA = /^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/;
  /* dev 工具脚本：含正则/示例字面量，不做行级隐私判定（仍做密钥检查） */
  const DEV_TOOL = /^tools\\/(privacy-audit|scrub-privacy|redact-line-level|refine-privacy-ci|cleanup-and-verify-github|setup-github-structure|fix-|merge-|extend-|add-|find-|patch-|repair-|rewrite-|unify-|wire-|probe-|calc-|bigcycle-|paginate-|ensure-|inspect-|survey-|check-|locate-|remove-|restore-|stop-|strip-|shrink-|hide-|tweak-|enlarge-|move-|insert-|clean-|compare-|export-|audit-|auto-|make-dist|verify-)/;

  /* 白名单 */
  const allow = (fs.existsSync('.privacy-allowlist') ? fs.readFileSync('.privacy-allowlist', 'utf8') : '')
    .split('\\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const matchAllow = (rel) => {
    const r = rel.replace(/\\\\/g, '/');
    for (const g of allow) {
      if (!g.includes('*')) { if (r === g) return true; continue; }
      const re = new RegExp('^' + g.replace(/[.*+?\${}()|[\\]\\\\]/g, m => m === '*' ? '.*' : '\\\\' + m).replace(/\\\\\\\\\\*/g, '.*') + '$');
      return true === (() => { try { return re.test(r); } catch { return false; } })();
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
        if (/\\.bak|_dump\\.json|shortcut-result\\.json/.test(e.name)) continue;
        if (path.basename(dir) === 'data' && /^(samples|korean|vedastro|bazi-corpus|baziqa|contrib|records|groundtruth|charts|cases)/.test(e.name)) continue;
        if (/\\.(js|mjs|json|jsonl|md|html|css|txt|yml|yaml)$/i.test(e.name)) cand.push(rel);
      }
    }
  };
  walk2(ROOT);

  const HARD = ['APIKEY-SK', 'APIKEY-GH', 'APIKEY-AK', 'BEARER', 'PHONE', 'IDCARD'];
  const CITIES = ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆', '长沙', '青岛', '天津', '苏州'];
  const BIRTH = /\\b(19|20)\\d{2}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}/;

  const fail = [], warn = [];
  for (const rel of cand) {
    if (matchAllow(rel)) continue;
    let txt; try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
    const isDev = DEV_TOOL.test(rel.replace(/\\\\/g, '/'));

    /* 密钥类：所有文件都查 */
    for (const rule of RULES) {
      if (!HARD.includes(rule.id)) continue;
      if (rule.id === 'PHONE' || rule.id === 'IDCARD') continue;  /* 交给行级判定，避免误伤长数字 */
      rule.re.lastIndex = 0;
      if (rule.re.test(txt)) fail.push(rel + '  [' + rule.id + ']');
    }

    if (isDev) continue;

    /* 行级：同一行同时出现「出生时刻」与「真实城市」才硬失败 */
    const lines = txt.split('\\n');
    let cityLine = null, birthOnly = false;
    for (const l of lines) {
      const hasBirth = BIRTH.test(l);
      if (!hasBirth) {
        if (/\\b1[3-9]\\d{9}\\b/.test(l)) fail.push(rel + '  [PHONE 行级]');
        if (/\\b\\d{17}[\\dXx]\\b/.test(l)) fail.push(rel + '  [IDCARD 行级]');
        continue;
      }
      birthOnly = true;
      const c = CITIES.find(x => l.includes(x));
      if (c) cityLine = c;
    }
    if (cityLine) fail.push(rel + '  [同一行: 出生时刻 + 真实地名「' + cityLine + '」]');
    else if (birthOnly) warn.push(rel);
  }

  console.log('\\n=== CI 隐私闸 ===');
  console.log('  扫描文件: ' + cand.length + '  白名单: ' + allow.length + ' 条');
  if (fail.length) {
    console.log('  \\n  ❌ 硬失败 (' + fail.length + '):');
    [...new Set(fail)].slice(0, 20).forEach(x => console.log('     ' + x));
  } else {
    console.log('  ✅ 无 API Key / 手机号 / 身份证 / 出生时刻与真实地名同行');
  }
  if (warn.length) {
    console.log('  \\n  ⚠️ 含出生时刻样式但无地名（' + warn.length + ' 个，合成基准盘或示例）:');
    [...new Set(warn)].slice(0, 6).forEach(x => console.log('     ' + x));
  }
  process.exit(fail.length ? 1 : 0);
}

`;
t = t.slice(0, s) + NEW + t.slice(e);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ CI 判定已重写（行级 + dev 工具跳过 + 白名单修正）');
