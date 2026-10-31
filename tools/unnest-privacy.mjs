// 把隐私卡从外层卡片里拿出来（消嵌套）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const INNER = '<div class="card prose privacy-card"';
const ip = h.indexOf(INNER);
if (ip < 0) { console.log('未找到隐私卡'); process.exit(0); }

// 往前找外层 <div class="card">
const outerOpen = h.lastIndexOf('<div class="card">', ip);
if (outerOpen < 0 || ip - outerOpen > 200) {
  console.log('未发现紧邻的外层卡片（或距离过远），不动');
  process.exit(0);
}

// 显示两者之间的内容，确认确实是"纯包裹"
const between = h.slice(outerOpen, ip);
console.log('外层与内层之间内容:', JSON.stringify(between.slice(0, 120)));

// 找到外层卡的配对 </div>
const re = /<div\b|<\/div>/g;
re.lastIndex = outerOpen;
let depth = 0, m, outerClose = -1;
while ((m = re.exec(h))) {
  depth += m[0] === '</div>' ? -1 : 1;
  if (depth === 0 && m[0] === '</div>') { outerClose = m.index; break; }
}
if (outerClose < 0) { console.error('❌ 求外层结束失败'); process.exit(1); }

// 内层卡的结束必须在 outerClose 之前，且中间没有别的内容
const innerEnd = (() => {
  const r2 = /<div\b|<\/div>/g; r2.lastIndex = ip;
  let d = 0, mm;
  while ((mm = r2.exec(h))) {
    d += mm[0] === '</div>' ? -1 : 1;
    if (d === 0 && mm[0] === '</div>') return mm.index + 6;
  }
  return -1;
})();

const afterInner = h.slice(innerEnd, outerClose).trim();
console.log('内层之后、外层关闭之前的内容:', JSON.stringify(afterInner.slice(0, 100)));
if (afterInner.length > 0) {
  console.log('⚠️ 外层还有其他内容，改为只删外层标签，不移动内容');
  // 只删外层 open 与 close 两个标签
  h = h.slice(0, outerClose) + h.slice(outerClose + 6);
  h = h.slice(0, outerOpen) + h.slice(outerOpen + '<div class="card">'.length);
} else {
  // 纯包裹：直接剥掉外层
  h = h.slice(0, outerClose) + h.slice(outerClose + 6);
  h = h.slice(0, outerOpen) + h.slice(outerOpen + '<div class="card">'.length);
  console.log('✅ 已剥掉纯包裹的外层');
}

/* 安全闸 */
const c = (re2) => (h.match(re2) || []).length;
const d = [c(/<div\b/g), c(/<\/div>/g)];
console.log(`\ndiv ${d[0]}/${d[1]} ${d[0] === d[1] ? '✅' : '❌'}`);
if (d[0] !== d[1]) { console.error('❌ 不平衡，拒绝写盘'); process.exit(1); }
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已写入');
