// 把关于页最底部的「这是什么 / 一句话 / 三种办法 / 出生时间 / 哪些能信 / 最后」整组提到最前
// 并统一模板（h3 → .about-sec，外层用 .card + .note 与其他区块一致）
// 同时删掉我之前加的重复块「先看这里」
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
let seg = h.slice(a0, a1);

/* ① 定位「这是什么」 */
const pos = seg.indexOf('<h3>这是什么</h3>');
if (pos < 0) { console.error('❌ 未找到「这是什么」'); process.exit(1); }

/* ② 求包含它的卡片的结束位置（div 配对） */
function cardEnd(html, from) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = from;
  let depth = 1, m;   // ★ 从元素内部开始扫，所以初始深度是 1
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0 && m[0] === '</div>') return m.index + 6;
  }
  return -1;
}
// 从 pos 往后没有未闭合的 div，说明这组内容与前面的内容同在一个卡内
// 直接找它所在卡片的收尾：从 pos 起扫，第一个让 depth 归零的 </div>
const endPos = cardEnd(seg, pos);
if (endPos < 0) { console.error('❌ 求块结尾失败'); process.exit(1); }
let block = seg.slice(pos, endPos);
console.log('提取块长度:', block.length, '字符');
console.log('块内 h3:', [...block.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1]).join(' | '));

/* ③ 统一模板 */
block = block
  .replace(/<h3>/g, '<h3 class="about-sec">')
  .replace(/\n\s*\n/g, '\n        ');
const WRAPPED =
  `<div class="card" id="sec-what-is-this" style="margin-bottom:16px;border-color:rgba(94,241,255,.3)">
        <div class="note">
        ${block.trim()}
        </div>
      </div>

      `;

/* ④ 从原位置移除 */
seg = seg.slice(0, pos) + seg.slice(endPos);
console.log('已从原位置移除；剩余长度:', seg.length);

/* ⑤ 删掉重复的「先看这里」块（功能已被这是什么覆盖） */
const plainPos = seg.indexOf('id="sec-plain-start"');
if (plainPos > 0) {
  const cStart = seg.lastIndexOf('<div class="card"', plainPos);
  if (cStart >= 0) {
    const cEnd = cardEnd(seg, cStart + 4);
    if (cEnd > cStart) {
      seg = seg.slice(0, cStart) + seg.slice(cEnd);
      console.log('✅ 已删除重复块「先看这里」');
    }
  }
}
/* 导航里对应的项也删掉 */
seg = seg.replace(/\s*<a href="#sec-plain-start" class="toc-i ok">[\s\S]*?<\/a>/, '');
/* 重编号 */
let n = 0;
seg = seg.replace(/(<a href="#sec-[\w-]+" class="toc-i[^"]*"><b>)(\d+)(<\/b>)/g, (m, a, _o, c) => { n++; return a + n + c; });

/* ⑥ 插到「关于」标题之后 */
const titleEnd = seg.indexOf('</h2>') + 5;
seg = seg.slice(0, titleEnd) + '\n      ' + WRAPPED + seg.slice(titleEnd);
console.log('✅ 已插入到标题之后');

h = h.slice(0, a0) + seg + h.slice(a1);
fs.writeFileSync(P, h, 'utf8');

/* ⑦ 校验 */
const out = fs.readFileSync(P, 'utf8');
const b0 = out.indexOf('data-page="about"');
const order = [
  ['page-title', out.indexOf('class="page-title"', b0)],
  ['这是什么', out.indexOf('这是什么', b0)],
  ['这不是拼贴', out.indexOf('这不是拼贴', b0)],
  ['导航索引', out.indexOf('id="about-toc"', b0)],
  ['方法论', out.indexOf('id="sec-method"', b0)],
];
console.log('\n关于页顺序：');
order.forEach(([nm, p], i) => console.log('  ' + (i + 1) + '. ' + nm + ' @' + p));
const okOrder = order.every((x, i) => i === 0 || (x[1] > 0 && x[1] > order[i - 1][1]));
const divOk = (out.match(/<div\b/g) || []).length === (out.match(/<\/div>/g) || []).length;
const h3Ok = (out.match(/<h3\b/g) || []).length === (out.match(/<\/h3>/g) || []).length;
const plainGone = !out.includes('id="sec-plain-start"');
const cntWhat = (out.split('这是什么').length - 1);
console.log('\n  顺序正确:', okOrder ? '✅' : '❌');
console.log('  div 平衡:', divOk ? '✅' : '❌');
console.log('  h3 平衡:', h3Ok ? '✅' : '❌');
console.log('  重复块已删:', plainGone ? '✅' : '❌');
console.log('  「这是什么」出现次数:', cntWhat, cntWhat >= 1 && cntWhat <= 2 ? '✅' : '❌');
process.exit(okOrder && divOk && h3Ok && plainGone ? 0 : 1);
