// 从 npmmirror 下载 ffmpeg / ffprobe（win32-x64 未压缩版）
import fs from 'node:fs';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BASE = 'https://registry.npmmirror.com/-/binary/ffmpeg-static/b6.1.1/';
const OUT = path.join(process.cwd(), '.tmp', 'bin');
fs.mkdirSync(OUT, { recursive: true });

async function get(name) {
  const url = BASE + name;
  const dest = path.join(OUT, name.replace('win32-x64', '') === name ? name : (name.startsWith('ffmpeg') ? 'ffmpeg.exe' : 'ffprobe.exe'));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 3_000_000) {
    console.log('  ↺ 已存在，跳过 ' + path.basename(dest) + ' (' + (fs.statSync(dest).size / 1048576).toFixed(1) + ' MB)');
    return dest;
  }
  process.stdout.write('  ↓ ' + name + ' ... ');
  const r = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const total = Number(r.headers.get('content-length') || 0);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
  const size = fs.statSync(dest).size;
  console.log((size / 1048576).toFixed(1) + ' MB' + (total ? ' / 预期 ' + (total / 1048576).toFixed(1) + ' MB' : ''));
  return dest;
}

const ff = await get('ffmpeg-win32-x64');
const fp = await get('ffprobe-win32-x64');
console.log('\n✅ 下载完成');
console.log('  ffmpeg  ' + ff);
console.log('  ffprobe ' + fp);
fs.writeFileSync('.tmp/ffmpeg-path.json', JSON.stringify({ ffmpeg: ff, ffprobe: fp }, null, 2), 'utf8');
