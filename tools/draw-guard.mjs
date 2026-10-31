// 让 draw() 永不因异常断链，并暴露真错误
import fs from 'node:fs';
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (s.includes('__drawErr')) { console.log('已加'); process.exit(0); }

/* ① draw() 改为包一层：出错也继续下一帧 */
s = s.replace(
  "function draw() {\n  if (!ctx) return;",
  `function _drawBody() {
  if (!ctx) return;`
);
// 找到 draw() 的收尾（requestAnimationFrame(draw); 前面的 }
s = s.replace(
  "  requestAnimationFrame(draw);\n}",
  `}

function draw() {
  try {
    _drawBody();
  } catch (e) {
    if (!window.__drawErr) {
      window.__drawErr = { msg: String(e && e.message), stack: String(e && e.stack).split('\\n').slice(0, 4) };
      console.error('[fusion3d] draw 异常：', e);
    }
  }
  requestAnimationFrame(draw);
}`
);
fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('① draw() 已加异常护栏');

/* ② 校验结构 */
const t = fs.readFileSync('web/fusion3d.js', 'utf8');
const hasBody = t.includes('function _drawBody()');
const hasWrap = t.includes('window.__drawErr');
console.log('   _drawBody:', hasBody, ' 护栏:', hasWrap);
