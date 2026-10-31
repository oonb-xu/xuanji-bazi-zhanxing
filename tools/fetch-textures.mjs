// 下载行星纹理（solarsystemscope.com 2K），压缩到 1024×512 存 web/textures/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PY = process.env.XUANJI_PYTHON || 'python';   // 可用环境变量 XUANJI_PYTHON 指定解释器（不写死本机路径）
const OUT = 'web/textures';
fs.mkdirSync(OUT, { recursive: true });

const MAP = [
  ['太阳', '2k_sun.jpg'],
  ['月亮', '2k_moon.jpg'],
  ['水星', '2k_mercury.jpg'],
  ['金星', '2k_venus_atmosphere.jpg'],
  ['火星', '2k_mars.jpg'],
  ['木星', '2k_jupiter.jpg'],
  ['土星', '2k_saturn.jpg'],
  ['土星环', '2k_saturn_ring_alpha.png'],
  ['天王星', '2k_uranus.jpg'],
  ['海王星', '2k_neptune.jpg'],
  ['冥王星', '2k_pluto.jpg'],
];

const BASE = 'https://www.solarsystemscope.com/textures/download/';
const got = [];
for (const [name, file] of MAP) {
  const url = BASE + file;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) { console.log('❌', r.status, name, file); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    const tmp = path.join(OUT, '_tmp_' + file);
    fs.writeFileSync(tmp, buf);
    console.log('✅', name.padEnd(4), (buf.length / 1024).toFixed(0) + 'KB', file);
    got.push({ name, tmp, file });
  } catch (e) {
    console.log('❌ ERR', name, String(e.message).slice(0, 40));
  }
}

// 用 Pillow 压缩
const script = `
import sys, os
from PIL import Image
pairs = ${JSON.stringify(got.map((g) => [g.tmp, g.name]))}
os.makedirs(r'${OUT}', exist_ok=True)
for src, name in pairs:
    im = Image.open(src)
    is_ring = '环' in name
    if is_ring:
        im = im.convert('RGBA')
        im.thumbnail((1024, 1024), Image.LANCZOS)
        dst = os.path.join(r'${OUT}', name + '.png')
        im.save(dst, optimize=True)
    else:
        im = im.convert('RGB')
        im = im.resize((1024, 512), Image.LANCZOS)
        dst = os.path.join(r'${OUT}', name + '.jpg')
        im.save(dst, quality=82, optimize=True)
    print('  ->', os.path.basename(dst), str(round(os.path.getsize(dst)/1024)) + 'KB')
`;
const tmpPy = path.join(OUT, '_resize.py');
fs.writeFileSync(tmpPy, script, 'utf8');
try {
  execFileSync(PY, [tmpPy], { stdio: 'inherit' });
} catch (e) { console.log('Pillow 压缩失败:', e.message); }

// 清理临时
for (const f of fs.readdirSync(OUT)) {
  if (f.startsWith('_tmp_') || f === '_resize.py') fs.rmSync(path.join(OUT, f), { force: true });
}

const files = fs.readdirSync(OUT);
let total = 0;
for (const f of files) total += fs.statSync(path.join(OUT, f)).size;
console.log('\n纹理文件:', files.join('  '));
console.log('合计', (total / 1024 / 1024).toFixed(2), 'MB');
