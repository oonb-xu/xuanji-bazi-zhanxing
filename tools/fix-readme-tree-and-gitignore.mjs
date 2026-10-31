// 修正 README 目录结构 + 补充 .gitignore（web-lab / logs / leph-* 等）
import fs from 'node:fs';

/* ═══ ① README 目录结构改成实际结构 ═══ */
let r = fs.readFileSync('README.md', 'utf8');
const OLD_START = '```\nmeta-unified/';
const i = r.indexOf(OLD_START);
const j = r.indexOf('```', i + OLD_START.length);
if (i < 0 || j < 0) { console.error('❌ README 目录块定位失败'); process.exit(1); }

const NEW_TREE = `\`\`\`
meta-unified/
├── server.mjs              # 零依赖 HTTP 服务 + JSON API（端口 8788）
├── package.json
├── LICENSE                 # Apache-2.0
├── README.md / CONTRIBUTING.md / PRIVACY.md / SECURITY.md / CHANGELOG.md
│
├── src/                    # 引擎核心
│   ├── bazi/               # 八字：四柱 / 藏干 / 十神 / 大运 / 扶抑 / 断语 DAG
│   ├── western/            # 西方占星：星历 / 宫位 / 相位 / 尊贵
│   ├── cross/              # 跨体系：位置→七柱 / 双轴 / 映射库 / 实验性历法
│   ├── daliuren.mjs        # 大六壬
│   ├── divination/         # 占断辅助
│   ├── rectify/            # 生时矫正
│   ├── vedastro/           # VedAstro 适配
│   └── render.mjs          # 渲染层
│
├── web/                    # 前端（原生 HTML/CSS/JS，无框架）
│   ├── index.html          # 单页应用（9 个页面）
│   ├── paper.html          # 论文（含「七政四余逆向复现」）
│   ├── style.css / app.js
│   ├── fusion3d.js         # 3D 融合盘（Canvas + 真实星空）
│   ├── dual-wheel.js       # 双环对照图（SVG）
│   ├── fw-ring-overlay.js  # 融合盘外环层（非侵入叠加）
│   └── dw-interact.js      # 环上文字点击查词
│
├── ziwei/                  # 紫微斗数适配器（iztro）
├── test/                   # 回归测试
├── tools/                  # 构建 / 审计 / 诊断脚本
├── docs/                   # 设计与论证文档（44 篇）
├── examples/               # 最小可运行示例
└── data/                   # ⚠ 数据：真实样本与第三方集不入库（见 .gitignore）
    ├── schema/             # Schema 定义（入库）
    ├── SOURCES.md          # 数据来源登记（入库）
    └── samples/_demo-synthetic.json   # 虚构示例（入库）
\`\`\``;

r = r.slice(0, i) + NEW_TREE + r.slice(j + 3);
fs.writeFileSync('README.md', r, 'utf8');
console.log('✅ README 目录结构已按实际改写');

/* ═══ ② .gitignore 补充 ═══ */
let g = fs.readFileSync('.gitignore', 'utf8');
const ADD = `
# ── 实验副本与空目录（开发过程残留）──
web-lab/
logs/
leph-*/
video/
scripts/*.ps1

# ── Python 侧辅助（如需入库请显式放行）──
py/
*.pyc

# ── 本地环境变量示例之外的一切 ──
.env.local
`;
if (!g.includes('web-lab/')) {
  g = g.trimEnd() + '\n' + ADD;
  fs.writeFileSync('.gitignore', g, 'utf8');
  console.log('✅ .gitignore 已补充 web-lab/ logs/ leph-*/ video/ py/');
} else console.log('— .gitignore 已有补充项');

/* ═══ ③ 给 privacy-audit 加 --ci 模式（供 GitHub Actions）═══ */
const PA = 'tools/privacy-audit.mjs';
let pa = fs.readFileSync(PA, 'utf8');
if (!pa.includes('--ci')) {
  const TAIL = `/* 顶层结构 */`;
  const NEW_TAIL = `/* ── CI 模式：只在仓库实际会入库的文件里找真实隐私 ── */
const CI = process.argv.includes('--ci');
if (CI) {
  const IGNORE_TOP = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab', 'logs', 'video', 'py']);
  const SUSPECT = [];
  const walk2 = (dir) => {
    let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(dir, e.name);
      const rel = path.relative(ROOT, p);
      if (e.isDirectory()) {
        if (IGNORE_TOP.has(e.name)) continue;
        if (/^(samples|korean|vedastro|bazi-corpus|baziqa|yangyan|liuren|contrib|records|groundtruth|charts|cases)$/.test(e.name) && rel.startsWith('data')) continue;
        walk2(p);
      } else {
        if (/\\.bak|_dump\\.json|shortcut-result\\.json/.test(e.name)) continue;
        if (/\\.(js|mjs|json|jsonl|md|html|css|txt|yml|yaml)$/i.test(e.name)) SUSPECT.push(rel);
      }
    }
  };
  walk2(ROOT);
  const strong = ['APIKEY-SK', 'APIKEY-GH', 'APIKEY-AK', 'BEARER', 'PHONE', 'IDCARD'];
  const bad = [];
  for (const rel of SUSPECT) {
    if (rel === 'tools/privacy-audit.mjs' || rel === 'tools/privacy-gate-a.mjs') continue;
    let txt; try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
    for (const rule of RULES) {
      if (!strong.includes(rule.id)) continue;
      rule.re.lastIndex = 0;
      if (rule.re.test(txt)) bad.push(rel + '  [' + rule.id + ']');
    }
  }
  const addr = SUSPECT.filter(rel => {
    if (rel === 'tools/privacy-audit.mjs') return false;
    let txt; try { txt = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return false; }
    return /出\\s*生|birth_date|birthDate/.test(txt) && /\\d{4}-\\d{2}-\\d{2}.{0,12}\\d{2}:\\d{2}/.test(txt) && !/_demo-synthetic|DEMO|示例|虚构|schema|README|CONTRIBUTING|PRIVACY|CHANGELOG|paper/.test(rel + txt.slice(0, 400));
  });
  console.log('\\n=== CI 隐私闸 ===');
  console.log('  入库候选文件: ' + SUSPECT.length);
  if (bad.length) { console.log('  ❌ 命中强隐私规则:'); bad.forEach(x => console.log('     ' + x)); }
  else console.log('  ✅ 无 API Key / 手机号 / 身份证');
  if (addr.length) { console.log('  ❌ 疑似含真实出生时刻:'); addr.forEach(x => console.log('     ' + x)); }
  else console.log('  ✅ 无真实出生时刻');
  process.exit(bad.length || addr.length ? 1 : 0);
}

/* 顶层结构 */`;
  pa = pa.replace(TAIL, NEW_TAIL);
  fs.writeFileSync(PA, pa, 'utf8');
  console.log('✅ privacy-audit.mjs 已加 --ci 模式');
} else console.log('— privacy-audit 已有 --ci');

/* 校验 README 新结构 */
console.log('\nREADME 目录块行数: ' + (fs.readFileSync('README.md', 'utf8').match(/├──|└──/g) || []).length);
