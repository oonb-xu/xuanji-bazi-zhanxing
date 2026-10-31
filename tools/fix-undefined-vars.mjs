// 修两个未定义变量：
//   ① _paused  —— L401 引用，无声明 ⇒ draw() 每帧抛错 ⇒ 3D 盘全空
//   ② AUX_NAMES —— L494 引用，无声明 ⇒ 行星层抛错
import fs from 'node:fs';

let s = fs.readFileSync('web/fusion3d.js', 'utf8');
let changed = [];

/* ① 以 import 行作为稳定锚点插入声明区 */
const IMPORT_ANCHOR = "import { initGL, resizeGL, clearGL, loadTexture, drawPlanet } from '/gl-planets.js';";
if (!s.includes(IMPORT_ANCHOR)) { console.error('❌ import 锚点未找到'); process.exit(1); }

const DEFS = `
// ══════════ 模块级常量与状态（缺一个都会让 draw() 每帧抛错）══════════
/** 需要跳过的虚点名（不是实体行星） */
const AUX_NAMES = new Set(['上升', '天顶', '下降', '天底', '北交点', '南交点']);
/** 页面隐藏时暂停渲染 */
let _paused = false;
document.addEventListener('visibilitychange', () => { _paused = document.hidden; });
`;

if (!s.includes('const AUX_NAMES')) {
  s = s.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + DEFS);
  changed.push('AUX_NAMES 已定义');
} 
if (!s.includes('let _paused')) {
  // 若 AUX_NAMES 刚插入，_paused 已在 DEFS 里；这里只处理未插入的情况
  s = s.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + '\nlet _paused = false;\ndocument.addEventListener(\'visibilitychange\', () => { _paused = document.hidden; });\n');
  changed.push('_paused 已定义');
}

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('改动:', changed.length ? changed.join(' / ') : '无');

/* 校验 */
const t = fs.readFileSync('web/fusion3d.js', 'utf8');
const checks = [
  ['AUX_NAMES 声明', /const AUX_NAMES\s*=/.test(t)],
  ['_paused 声明', /let _paused\s*=/.test(t)],
  ['visibilitychange 监听', /addEventListener\(\s*['"]visibilitychange['"]/.test(t)],
  ['AUX_NAMES 使用处', t.includes('AUX_NAMES.has(')],
  ['_paused 使用处', t.includes('if (_paused)')],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }

/* 常见未定义标识符粗筛 */
const RISKY = ['_paused', 'AUX_NAMES', 'PLANET_STYLE', 'PLANET_TEX', 'PLANET_RING_R', 'MULTI_MAP'];
console.log('\n标识符定义/使用对照：');
for (const id of RISKY) {
  const declared = new RegExp(`(const|let|var|function)\\s+${id}\\b`).test(t) || new RegExp(`import[^;]*\\b${id}\\b`).test(t);
  const used = new RegExp(`\\b${id}\\b`).test(t);
  if (used) console.log(' ', declared ? '✅' : '❌', id, declared ? '' : '← 使用了但没定义');
  if (used && !declared) bad++;
}
process.exit(bad ? 1 : 0);
