// 从 npmmirror 找 ffmpeg 静态构建并下载
import fs from 'node:fs';

const CANDIDATES = [
  'https://registry.npmmirror.com/-/binary/ffmpeg-static/',
  'https://cdn.npmmirror.com/binaries/ffmpeg-static/',
  'https://registry.npmmirror.com/-/binary/ffmpeg/',
];

for (const u of CANDIDATES) {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
    console.log('\n' + u + '  →  HTTP ' + r.status);
    const t = await r.text();
    const items = [...t.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
    console.log('  条目 ' + items.length + ' 个: ' + items.slice(0, 14).join(', '));
  } catch (e) {
    console.log('\n' + u + '  →  失败: ' + (e.message || e).toString().slice(0, 80));
  }
}
