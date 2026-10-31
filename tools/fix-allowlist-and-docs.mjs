import fs from 'node:fs';

/* ① 修 matchAllow（之前的正则构造有 bug） */
const P = 'tools/privacy-audit.mjs';
let t = fs.readFileSync(P, 'utf8');
const s = t.indexOf('  const matchAllow = (rel) => {');
const e = t.indexOf('  const cand = [];');
if (s < 0 || e < 0) { console.error('❌ 定位 matchAllow 失败'); process.exit(1); }
const NEWFN = `  const matchAllow = (rel) => {
    const r = rel.replace(/\\\\/g, '/');
    for (const g of allow) {
      if (!g.includes('*')) { if (r === g) return true; continue; }
      /* 先转义除 * 以外的正则元字符，再把 * 换成 .* */
      const rx = '^' + g.replace(/[.+?^\${}()|[\\]\\\\\\\\]/g, '\\\\$&').replace(/\\*/g, '.*') + '$';
      try { if (new RegExp(rx).test(r)) return true; } catch (err) { /* ignore */ }
    }
    return false;
  };

`;
t = t.slice(0, s) + NEWFN + t.slice(e);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ matchAllow 已修');

/* ② 三篇文档的合成盘城市「略去名字」 */
const DOCFIX = [
  ['docs/35-对应关系的置信度体系.md', '上海', '某市'],
  ['docs/36-互容结构与相位输能.md', '上海', '某市'],
  ['docs/37-三钟对齐.md', '北京', '某市'],
];
for (const [f, city, rep] of DOCFIX) {
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  let n = 0;
  const out = lines.map(l => {
    if (/\b(19|20)\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(l) && l.includes(city)) { n++; return l.split(city).join(rep); }
    return l;
  });
  if (n) { fs.writeFileSync(f, out.join('\n'), 'utf8'); console.log('✅ ' + f + ' 出生行城市 ' + city + '→' + rep + ' ×' + n); }
  else console.log('— ' + f + ' 无需改');
}

/* ③ 合成基准盘的测试/CLI 加入白名单 */
{
  let a = fs.readFileSync('.privacy-allowlist', 'utf8');
  const ADD = `
# ── 合成基准盘（上海 1990-05-20 / 成都 2008-07-04 等，见 test/FIXTURES.md）──
test/verify-kerykeion.mjs
cli-marriage-v2.mjs
`;
  if (!a.includes('test/verify-kerykeion.mjs')) {
    fs.writeFileSync('.privacy-allowlist', a.trimEnd() + '\n' + ADD, 'utf8');
    console.log('✅ 白名单已加 test/verify-kerykeion.mjs / cli-marriage-v2.mjs');
  }
}
