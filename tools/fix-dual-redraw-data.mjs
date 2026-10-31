// 修：分页重绘时拿不到数据 → 缓存「上次成功的数据」作为兜底
import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let t = fs.readFileSync(P, 'utf8');

/* ① 模块级缓存 */
if (!t.includes('var LAST_GOOD = null;')) {
  const a = '  var PAGE = 0, PER_PAGE = 6;';
  const i = t.indexOf(a);
  if (i < 0) { console.error('❌ 找不到 PAGE 声明'); process.exit(1); }
  t = t.replace(a, a + '\n  var LAST_GOOD = null;   /* 上次成功绘制用的数据（分页重绘兜底） */');
  console.log('✅ 已加 LAST_GOOD 缓存变量');
}

/* ② 取值时兜底 + 成功后写回 */
const OLD = '    var d = window.__fwLastData || D;';
const NEW = '    var d = window.__fwLastData || D || LAST_GOOD;\n    if (d && d.natal && d.natal.angles) LAST_GOOD = d;';
if (!t.includes(OLD)) { console.error('❌ 未匹配取值行'); process.exit(1); }
t = t.replace(OLD, NEW);
console.log('✅ 取值已加 LAST_GOOD 兜底并写回');

fs.writeFileSync(P, t, 'utf8');
console.log('dual-wheel.js', t.length, '字节');
