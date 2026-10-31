import fs from 'node:fs';
const P = 'tools/make-dist.mjs';
let t = fs.readFileSync(P, 'utf8');

if (t.includes("['LICENSE', 'README.md']")) { console.log('— 已加 LICENSE 复制'); process.exit(0); }

const anchor = '// package.json';
const i = t.indexOf(anchor);
if (i < 0) { console.error('❌ 找不到锚点 // package.json'); process.exit(1); }

const ADD = `// LICENSE 与 README：Apache-2.0 要求分发时附带许可证副本
for (const f of ['LICENSE', 'README.md']) {
  if (fs.existsSync(f)) copyFile(f, path.join(OUT, f));
}

`;
fs.writeFileSync(P + '.bak-lic', t, 'utf8');
t = t.slice(0, i) + ADD + t.slice(i);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ make-dist.mjs 已插入 LICENSE/README 复制（在 // package.json 之前）');
