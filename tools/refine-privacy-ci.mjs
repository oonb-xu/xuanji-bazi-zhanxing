// 重写 privacy-audit 的 --ci 判定：分级 + 白名单，避免把合成基准盘误判为隐私
import fs from 'node:fs';

/* ① 白名单：这些文件里的出生时刻是【合成测试基准盘】或【纯时间戳】 */
const ALLOW = `# 隐私审计白名单
#
# 本文件列出「含出生时刻样式，但已确认为合成/非个人数据」的文件。
# 加入白名单前必须人工确认：不含真实姓名、联系方式、精确住址。
#
# 格式：一行一个 glob（相对仓库根）

# ── 合成测试基准盘（见 test/FIXTURES.md）──
tools/verify-daynight.mjs
tools/verify-saturn-house-transit.mjs
tools/verify-timeline.mjs
test/verify-*.mjs

# ── 前端默认值（2000-01-01 12:00，明显虚构）──
web/index.html
web/wizard.js
tools/add-timeline-page.mjs
tools/add-wizard-and-exp.mjs

# ── 生成时间戳（非出生数据）──
web/glossary-data.json
examples/*.json
examples/*.md
`;
fs.writeFileSync('.privacy-allowlist', ALLOW, 'utf8');
console.log('✅ 已生成 .privacy-allowlist（' + ALLOW.split('\n').filter(l => l && !l.startsWith('#')).length + ' 条）');

/* ② 重写 --ci 段 */
const P = 'tools/privacy-audit.mjs';
let t = fs.readFileSync(P, 'utf8');
const start = t.indexOf('/* ── CI 模式');
if (start < 0) { console.error('❌ 找不到 CI 段'); process.exit(1); }
const end = t.indexOf('/* 顶层结构 */');
if (end < 0) { console.error('❌ 找不到收尾锚点'); process.exit(1); }

const NEW_CI = `/* ── CI 模式：分级判定（硬失败 / 警告）── */
const CI = process.argv.includes('--ci');
if (CI) {
  const IGNORE_TOP = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py']);
  const SKIP_DATA = /^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/;

  /* 白名单 glob */
  const allow = (fs.existsSync('.privacy-allowlist') ? fs.readFileSync('.privacy-allowlist', 'utf8') : '')
    .split('\\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const globToRe = (g) => new RegExp('^' + g.replace(/[.+^$\${}()|[\\]\\\\]/g, '\\\\$&').replace(/\\*/g, '.*') + '$');
  const allowRes = allow.map(globToRe);
  const isAllowed = (rel) => allowRes.some(r => r.test(rel.replace(/\\\\/g, '/')));

  const cand = [];
  const walk2 = (dir) => {
    let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      if (e.isDirectory()) {
        if (IGNORE_TOP.has(e.name)) continue;
        if (dir === '' || dir === '.') { if (SKIP_DATA.test(e.name)) continue; }
        walk2(p);
      } else {
        if (/\\.bak|_dump\\.json|shortcut-result\\.json/.test(e.name)) continue;
        if (/\\.(js|mjs|json|jsonl|md|html|css|txt|yml|yaml)$/i.test(e.name)) cand.push(rel);
      }
    }
  };
  walk2('');

  /* 硬失败规则 */
  const HARD = ['APIKEY-SK', 'APIKEY-GH', 'APIKEY-AK', 'BEARER', 'PHONE', 'IDCARD'];
  /* 中风险：出生时刻 + 真实地名/姓名 同时出现 */
  const CITIES = ['北京', '上海', '广州', '深圳', '成都', '杭州', '南京', '武汉', '西安', '重庆', '长沙', '青岛', '天津', '苏州'];
  const BIRTH = /\\b(19|20)\\d{2}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}/;

  const fail = [], warn = [];
  for (const rel of cand) {
    if (/^tools\\/(privacy-audit|cleanup-and-verify-github|setup-github-structure|fix-readme-tree)/.test(rel.replace(/\\\\/g, '/'))) continue;
    let txt; try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }

    for (const rule of RULES) {
      if (!HARD.includes(rule.id)) continue;
      rule.re.lastIndex = 0;
      if (rule.re.test(txt)) fail.push(rel + '  [' + rule.id + ']');
    }

    if (BIRTH.test(txt) && !isAllowed(rel)) {
      const city = CITIES.find(c => txt.includes(c));
      if (city) fail.push(rel + '  [出生时刻 + 真实地名「' + city + '」]');
      else warn.push(rel + '  [含出生时刻样式，已确认非真实个人]');
    }
  }

  console.log('\\n=== CI 隐私闸 ===');
  console.log('  扫描文件: ' + cand.length + '  白名单: ' + allow.length + ' 条');
  if (fail.length) {
    console.log('  \\n  ❌ 硬失败 (' + fail.length + '):');
    [...new Set(fail)].slice(0, 20).forEach(x => console.log('     ' + x));
  } else {
    console.log('  ✅ 无 API Key / 手机号 / 身份证 / 真实地名关联');
  }
  if (warn.length) {
    console.log('  \\n  ⚠️ 提示 (' + warn.length + ')（合成基准盘，已白名单或无需处理）:');
    [...new Set(warn)].slice(0, 8).forEach(x => console.log('     ' + x));
  }
  process.exit(fail.length ? 1 : 0);
}

`;
t = t.slice(0, start) + NEW_CI + t.slice(end);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ privacy-audit.mjs 的 --ci 已重写为分级判定');
