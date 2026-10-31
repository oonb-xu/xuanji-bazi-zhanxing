// 修：draw(d) 带参数；分页按钮必须把数据传进去
import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-draw', t, 'utf8');
let n = 0;

/* ① 模块级 LAST */
if (!t.includes('var LAST = null;')) {
  const a = '  var PAGE = 0, PER_PAGE = 6;';
  if (!t.includes(a)) { console.error('❌ 找不到 PAGE 声明'); process.exit(1); }
  t = t.replace(a, a + '\n  var LAST = null;   /* 上次绘制用的数据（分页重绘用） */');
  n++; console.log('✅ 已加 LAST 缓存');
}

/* ② draw(d) 开头：无参会话时回落到 LAST/全局 */
const A = '    var natal = d && d.natal;';
if (!t.includes(A)) { console.error('❌ 找不到 natal 取值行'); process.exit(1); }
t = t.replace(A, '    if (!d) d = LAST || window.__fwLastData;\n    if (d) LAST = d;\n' + A);
n++; console.log('✅ draw() 已支持无参调用（回落 LAST）');

/* ③ 分页按钮传数据 */
const B = "        if (PAGE < 0) PAGE = 0;\n        draw();";
if (!t.includes(B)) { console.error('❌ 找不到按钮里的 draw() 调用'); process.exit(1); }
t = t.replace(B, "        if (PAGE < 0) PAGE = 0;\n        draw(window.__fwLastData || LAST);");
n++; console.log('✅ 分页按钮已传数据');

fs.writeFileSync(P, t, 'utf8');
console.log('dual-wheel.js', t.length, '字节，改动 ' + n + ' 处');
