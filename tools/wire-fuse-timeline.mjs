import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
if (h.includes('/fuse-timeline.js')) { console.log('— 已引入'); process.exit(0); }
const b = h.lastIndexOf('</body>');
if (b < 0) { console.error('❌ 无 </body>'); process.exit(1); }
h = h.slice(0, b) + '  <script src="/fuse-timeline.js"></script>\n' + h.slice(b);
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已引入 fuse-timeline.js，index.html', h.length, '字节');

/* 校验脚本引用顺序 */
const scripts = [...h.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
console.log('脚本列表:', scripts.join(' → '));
