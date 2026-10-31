// 乱码硬闸：扫源码里的 UTF-8→GBK 乱码与替换字符
// 由来：本会话内三次用 PowerShell（Set-Content / -replace / here-string）改写含中文的源文件，
//       每次都把整份中文变成「鏄熺洏」这类乱码，而且**不报错**——只有运行到才炸。
// 判据：① U+FFFD 替换字符；② 常见乱码串（UTF-8 字节被按 GBK 解读后的特征字）。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXT = new Set(['.mjs', '.js', '.json', '.md', '.py', '.txt']);
const SKIP = new Set(['node_modules', '.venv', '.ephemeris', '.tmp', '.npm-cache', '.git', 'backups']);

// 这些字只在"UTF-8 被误当 GBK"时成串出现，正常中文里几乎不会连续出现
const SIGNS = ['鏄', '锛', '鐢', '涓', '鈥', '鍏', '瀛', '瀹', '鏂', '鐨', '鍜', '鎴', '璁', '鍒', '鐜', '铏', '绋', '鏃', '閫', '鍥', '鐗', '璺', '鎵', '鍑', '鐩', '绠', '鏋'];
const REPL = '\uFFFD';

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(extname(n))) out.push(p);
  }
  return out;
}

const bad = [];
const SELF = fileURLToPath(import.meta.url);
for (const f of walk(ROOT)) {
  if (f === SELF) continue;                                // 本文件故意含有乱码特征字，跳过自检
  const t = readFileSync(f, 'utf8');
  const hits = [];
  if (t.includes(REPL)) hits.push(`U+FFFD×${t.split(REPL).length - 1}`);
  const found = SIGNS.filter((s) => t.includes(s));
  if (found.length >= 3) hits.push(`乱码串 ${found.slice(0, 6).join('')}`);
  if (hits.length) bad.push(`${f.replace(ROOT + '\\', '')} → ${hits.join(' / ')}`);
}

if (bad.length) {
  console.log('检测到乱码文件（很可能被 PowerShell 改写破坏）：');
  for (const b of bad) console.log('  x ' + b);
  console.log('\n修复：用 write/edit 工具重写该文件（不要用 Set-Content / -replace / here-string 改中文文件）');
  console.log(`\nRESULT: FAIL (${bad.length})`);
  process.exit(1);
}
console.log('[mojibake] 未发现乱码源文件');
console.log('\nRESULT: PASS');
