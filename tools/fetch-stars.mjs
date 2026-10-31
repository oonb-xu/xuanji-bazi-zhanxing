// 取真实星表：从 npmmirror 下 d3-celestial，抽出 stars.6.json，滤出亮星（mag ≤ 4.5）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = 'web/stars.js';
const URL = 'https://registry.npmmirror.com/d3-celestial/-/d3-celestial-0.7.35.tgz';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'celestial-'));
const tgz = path.join(tmp, 'p.tgz');
console.log('下载…');
const r = await fetch(URL, { signal: AbortSignal.timeout(120000) });
if (!r.ok) { console.error('HTTP', r.status); process.exit(1); }
fs.writeFileSync(tgz, Buffer.from(await r.arrayBuffer()));
console.log('大小', (fs.statSync(tgz).size / 1024 / 1024).toFixed(1), 'MB');

const x = path.join(tmp, 'x');
fs.mkdirSync(x);
execFileSync('tar', ['-xzf', tgz, '-C', x], { stdio: 'inherit' });

// 找星表文件
const cands = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/^stars.*\.json$/.test(f.name)) cands.push(p);
  }
})(x);
console.log('找到星表:', cands.map((p) => path.basename(p)).join(', '));
if (!cands.length) { console.error('无星表文件'); process.exit(1); }

// 优先 stars.6.json（6 等）
const src = cands.find((p) => p.endsWith('stars.6.json')) ?? cands[0];
const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
const feats = raw.features ?? [];
console.log('原始星数:', feats.length);

// 滤亮星：mag ≤ 4.5，取 [ra(度), dec(度), mag]
const picked = [];
for (const f of feats) {
  const p = f.geometry?.coordinates;
  const mag = f.properties?.mag;
  const name = f.properties?.name;
  if (!Array.isArray(p) || typeof mag !== 'number') continue;
  if (mag > 4.5) continue;
  picked.push([Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100, Math.round(mag * 100) / 100, name ?? '']);
}
console.log('亮星(mag≤4.5):', picked.length);

const js = `// 真实星表（源自 d3-celestial stars.6.json，滤镜 mag ≤ 4.5）
// 每条：[赤经 RA(度), 赤纬 Dec(度), 星等 mag, 专名(可空)]
// 共 ${picked.length} 颗
export const STARS = ${JSON.stringify(picked)};
`;
fs.writeFileSync(OUT, js, 'utf8');
console.log('已写入', OUT, (fs.statSync(OUT).size / 1024).toFixed(1), 'KB');
fs.rmSync(tmp, { recursive: true, force: true });
