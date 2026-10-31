import fs from 'node:fs';
let a = fs.readFileSync('.privacy-allowlist', 'utf8');
/* 把所有 tools/verify-*.mjs 合成基准盘脚本合并成通配 */
const lines = a.split('\n');
const out = [];
let inserted = false;
for (const l of lines) {
  /* 删掉原先逐条列出的 verify 脚本 */
  if (/^tools\/verify-[a-z-]+\.mjs$/.test(l.trim())) {
    if (!inserted) { out.push('# 所有 tools/verify-*.mjs 均为合成基准盘（北京默认坐标）'); out.push('tools/verify-*.mjs'); inserted = true; }
    continue;
  }
  out.push(l);
}
if (!inserted) { out.push('tools/verify-*.mjs'); }
fs.writeFileSync('.privacy-allowlist', out.join('\n'), 'utf8');
const n = out.filter(l => l.trim() && !l.startsWith('#')).length;
console.log('✅ 白名单已合并 verify 脚本为通配，共 ' + n + ' 条规则');
