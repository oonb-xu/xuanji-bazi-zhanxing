import fs from 'node:fs';
let a = fs.readFileSync('.privacy-allowlist', 'utf8');
const ADD = `
# ── 文档里的「北京」是默认占位坐标（39.9042N/116.4074E），不是真人出生地 ──
docs/05-本命盘-规则冻结表.md
docs/09-西方星盘双后端-kerykeion接入.md
docs/37-三钟对齐.md

# ── 使用示例中的假日期（2000-01-01 等）──
cli-*.mjs
.github/ISSUE_TEMPLATE/*.yml
README.md
KNOWLEDGE-BASE.md
PROGRESS.md
`;
if (!a.includes('docs/05-本命盘')) {
  a = a.trimEnd() + '\n' + ADD;
  fs.writeFileSync('.privacy-allowlist', a, 'utf8');
  console.log('✅ 白名单已补充（默认占位坐标说明）');
} else console.log('— 白名单已有');
