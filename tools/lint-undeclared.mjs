// 静态检查：找出「使用了但没声明」的标识符
// 起因：我已经三次犯同类错误（_paused / AUX_NAMES / _heroEl / R），
//       每次都是补丁只插入了"使用"没插入"声明"。这个脚本一次扫全。
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'web';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));

const GLOBALS = new Set([
  'window','document','console','Math','JSON','Object','Array','String','Number','Boolean',
  'Date','Promise','Map','Set','WeakMap','Symbol','Error','TypeError','RangeError','RegExp',
  'parseInt','parseFloat','isNaN','isFinite','setTimeout','clearTimeout','setInterval','clearInterval',
  'requestAnimationFrame','cancelAnimationFrame','fetch','Image','ImageData','Uint8Array','Float32Array',
  'Int32Array','Uint16Array','Uint32Array','ArrayBuffer','DataView','performance','navigator','location',
  'history','localStorage','sessionStorage','CustomEvent','Event','HTMLElement','Node','Element',
  'MutationObserver','ResizeObserver','IntersectionObserver','WebGLRenderingContext','FileReader','Blob',
  'URL','URLSearchParams','TextEncoder','TextDecoder','globalThis','self','top','parent','frames',
  'Float64Array','BigInt','Proxy','Reflect','structuredClone','queueMicrotask','atob','btoa',
  'getComputedStyle','matchMedia','devicePixelRatio','innerWidth','innerHeight','alert','confirm',
  'undefined','null','true','false','this','arguments','eval','encodeURIComponent','decodeURIComponent',
  'encodeURI','decodeURI','Intl','AbortController','AbortSignal','Headers','Request','Response',
]);

/* 只检查"看起来像本模块内部变量"的名字：下划线开头、单字母大写、或 camelCase 且出现多次 */
function shouldCheck(name) {
  if (GLOBALS.has(name)) return false;
  if (name.length < 2) return false;
  // 下划线开头（我这类 bug 的高发区）
  if (/^_[a-zA-Z]/.test(name)) return true;
  // 全大写常量（如 AUX_NAMES / PLANET_TEX）
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(name)) return true;
  return false;
}

let total = 0;
const report = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const lines = src.split('\n');

  // 收集声明：const/let/var/function/class/import/参数/解构
  const declared = new Set();
  const declRe = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = declRe.exec(src))) declared.add(m[1]);
  // 解构声明
  const destrRe = /\b(?:const|let|var)\s*[{[]([^}\]]+)[}\]]\s*=/g;
  while ((m = destrRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const n = part.split(':').pop().trim().replace(/=.*$/, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n);
    }
  }
  // import
  const impRe = /import\s+\{([^}]+)\}\s+from/g;
  while ((m = impRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const n = part.split(/\s+as\s+/).pop().trim();
      if (n) declared.add(n);
    }
  }
  const impDef = /import\s+([A-Za-z_$][\w$]*)\s+from/g;
  while ((m = impDef.exec(src))) declared.add(m[1]);
  // 函数参数
  const fnRe = /function\s*[\w$]*\s*\(([^)]*)\)/g;
  while ((m = fnRe.exec(src))) {
    for (const p of m[1].split(',')) {
      const n = p.split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n);
    }
  }
  // 箭头函数参数
  const arrowRe = /\(([^()]*)\)\s*=>/g;
  while ((m = arrowRe.exec(src))) {
    for (const p of m[1].split(',')) {
      const n = p.split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) declared.add(n);
    }
  }

  // 检查使用
  const useRe = /\b([A-Za-z_$][\w$]*)\b/g;
  const seen = new Map();
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;         // 跳过注释行
    let mm;
    while ((mm = useRe.exec(line))) {
      const name = mm[1];
      if (!shouldCheck(name)) continue;
      if (declared.has(name)) continue;
      // 排除属性访问（前面是点）
      const idx = mm.index;
      if (idx > 0 && line[idx - 1] === '.') continue;
      // 排除对象字面量键（后面紧跟冒号且不在三元里）
      const after = line.slice(idx + name.length).trimStart();
      if (after.startsWith(':') && !line.slice(0, idx).trimEnd().endsWith('?')) continue;
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name).push(i + 1);
    }
  });

  for (const [name, ls] of seen) {
    total++;
    report.push({ file: f, name, lines: ls.slice(0, 6), count: ls.length });
  }
}

console.log(`扫描 ${files.length} 个文件，发现 ${total} 个可疑「使用了但没声明」的标识符\n`);
if (!total) { console.log('✅ 未发现'); process.exit(0); }
for (const r of report.sort((a, b) => b.count - a.count)) {
  console.log(`❌ ${r.file}  ${r.name}  出现 ${r.count} 次  行 ${r.lines.join(', ')}`);
}
process.exit(1);
