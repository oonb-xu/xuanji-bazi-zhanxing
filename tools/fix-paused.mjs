// 补上 _paused 的声明（之前只有引用没有定义，导致 draw() 每帧抛错、3D 盘全空）
import fs from 'node:fs';

let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (s.includes('let _paused')) { console.log('已定义，无需修改'); process.exit(0); }

const ANCHOR = "const AUX_NAMES = new Set(['上升', '天顶', '下降', '天底', '北交点', '南交点']);";
if (!s.includes(ANCHOR)) { console.error('❌ 锚点未找到'); process.exit(1); }

const ADD = `

// ★ 页面隐藏时暂停渲染（省内存/省电）
let _paused = false;
document.addEventListener('visibilitychange', () => { _paused = document.hidden; });`;

s = s.replace(ANCHOR, ANCHOR + ADD);
fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('✅ _paused 已定义 + visibilitychange 已挂');

// 校验
const after = fs.readFileSync('web/fusion3d.js', 'utf8');
const lines = after.split('\n');
const hits = [];
lines.forEach((l, i) => { if (l.includes('_paused')) hits.push(`L${i + 1}: ${l.trim()}`); });
console.log('相关行：');
hits.forEach((h) => console.log('  ' + h));
console.log('声明存在:', after.includes('let _paused = false'));
