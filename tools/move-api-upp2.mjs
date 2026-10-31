// 恢复 + 重做 API 块上移
// ★ 上次的错：先改 block（插入声明）再用改长后的 length 去删原位置 ⇒ 切错
// ★ 这次：先记「原始起止位置」→ 按位置删除 → 再改内容 → 插入
// ★ 安全闸：写盘前检查 div/h2/h3 平衡，不平衡就拒绝写
import fs from 'node:fs';

/* ① 从 dist 恢复 */
const GOOD = 'dist/web/index.html';
const TARGET = 'web/index.html';
if (!fs.existsSync(GOOD)) { console.error('❌ 无 dist 备份可用'); process.exit(1); }
let h = fs.readFileSync(GOOD, 'utf8');
console.log('已从 dist 恢复:', h.length, '字符');
fs.writeFileSync(TARGET, h, 'utf8');
console.log('✅ 已覆盖 web/index.html');

const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
let seg = h.slice(a0, a1);

/** 从 cStart 处的 <div 开始求配对 </div> 结束位置（不含） */
function matchDivEnd(html, cStart) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = cStart;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0 && m[0] === '</div>') return m.index + 6;
  }
  return -1;
}

/* ② 定位 API 块：从 sec-howto 所在卡的开始，到含「Key 怎么用」那张卡的结束 */
const howtoPos = seg.indexOf('id="sec-howto"');
if (howtoPos < 0) { console.error('❌ 未找到 sec-howto'); process.exit(1); }
const cardStart = seg.lastIndexOf('<div class="card', howtoPos);
if (cardStart < 0) { console.error('❌ 找不到 API 卡片起点'); process.exit(1); }

const keyPos = seg.indexOf('Key 怎么用');
if (keyPos < 0) { console.error('❌ 未找到 Key 段，说明恢复的版本不对'); process.exit(1); }
const keyCardStart = seg.lastIndexOf('<div class="card', keyPos);
const keyCardEnd = keyCardStart >= 0 ? matchDivEnd(seg, keyCardStart) : matchDivEnd(seg, keyPos);
if (keyCardEnd < 0) { console.error('❌ 求 Key 卡结束失败'); process.exit(1); }

const RANGE_START = cardStart;
const RANGE_END = keyCardEnd;          // ★ 记「位置」而不是「长度」
let origBlock = seg.slice(RANGE_START, RANGE_END);

console.log('\n=== 提取诊断 ===');
console.log('  范围:', RANGE_START, '→', RANGE_END, `(${origBlock.length} 字符)`);
console.log('  含 sec-howto :', origBlock.includes('sec-howto'));
console.log('  含 主流 API  :', origBlock.includes('主流 API'));
console.log('  含 Key 怎么用:', origBlock.includes('Key 怎么用'));
if (!origBlock.includes('sec-howto') || !origBlock.includes('Key 怎么用')) {
  console.error('❌ 提取范围不对，中止（不写盘）');
  process.exit(1);
}

/* ③ 按「位置」从原文删除 */
seg = seg.slice(0, RANGE_START) + seg.slice(RANGE_END);
console.log('\n已按位置删除，剩余:', seg.length, '字符');

/* ④ 只对副本加声明 */
const NOTICE = `<div class="note" style="font-size:13px;line-height:2;padding:13px 16px;margin-bottom:15px;
        border-radius:10px;background:rgba(255,196,87,.07);border:1px solid rgba(255,196,87,.32)">
        <b style="color:#ffc457;font-size:14px">想要精确度，建议必须接 API —— 无论你是什么用途。</b><br>
        本站内置算法足以把结构算完（八个字、行星度数、宫位、三传），这部分<b>不接 API 也是准的</b>。<br>
        但下面三项<b>依赖外部星历与更细的历法数据</b>，内置版只能给近似：<br>
        · <b>高精度行星位置</b>（内置与专业星历可能差角分级）<br>
        · <b>历史时区与夏令时</b>（尤其 1949 年前、境外出生）<br>
        · <b>边界情形</b>（出生时刻卡在时辰交界 / 星座交界）<br>
        所以：<b>只要你在意"准不准"，就接 API</b>——与用途无关，看盘、合盘、矫正、研究都一样。
      </div>
      `;
let newBlock = origBlock.replace(/(<h2 id="sec-howto"[^>]*>)/, NOTICE + '$1');
if (newBlock === origBlock) { console.error('❌ 声明未插入（未匹配 sec-howto 标题），中止'); process.exit(1); }
console.log('✅ 声明已插入副本');

/* ⑤ 插到「这是什么」卡之后 */
const whatPos = seg.indexOf('id="sec-what-is-this"');
if (whatPos < 0) { console.error('❌ 找不到这是什么块'); process.exit(1); }
const whatCardStart = seg.lastIndexOf('<div class="card', whatPos);
const whatCardEnd = matchDivEnd(seg, whatCardStart);
if (whatCardEnd < 0) { console.error('❌ 求这是什么块结束失败'); process.exit(1); }
seg = seg.slice(0, whatCardEnd) + '\n\n      ' + newBlock.trim() + '\n\n      ' + seg.slice(whatCardEnd);
console.log('✅ 已插入到「这是什么」之后');

/* ⑥ 导航：把 API 项提到第 2 位并重编号 */
const tocRe = /<a href="#sec-[\w-]+" class="toc-i[^"]*"><b>\d+<\/b>[\s\S]*?<\/a>/g;
const items = seg.match(tocRe) || [];
console.log('\n导航项:', items.length);
if (items.length) {
  const idx = items.findIndex((x) => /sec-howto/.test(x));
  if (idx > 0) { const [t] = items.splice(idx, 1); items.splice(1, 0, t); }
  // 用占位符替换后重建
  const first = seg.indexOf(items[0]);
  let block0 = seg.slice(first, first);
  // 用整体替换：把所有 toc-i 项替换为占位，再填回
  seg = seg.replace(tocRe, '\u0001');
  let n = 0;
  const rebuilt = items.join('\n          ').replace(/(<b>)\d+(<\/b>)/g, (m2, p1, p2) => { n++; return p1 + n + p2; });
  seg = seg.replace('\u0001', rebuilt);
  console.log('已重排并重编号，共', n, '项');
}

h = h.slice(0, a0) + seg + h.slice(a1);

/* ⑦ 安全闸：写盘前自检 */
const cnt = (s, re) => (s.match(re) || []).length;
const divO = cnt(h, /<div\b/g), divC = cnt(h, /<\/div>/g);
const h2O = cnt(h, /<h2\b/g), h2C = cnt(h, /<\/h2>/g);
const h3O = cnt(h, /<h3\b/g), h3C = cnt(h, /<\/h3>/g);
console.log('\n=== 写盘前自检 ===');
console.log(`  div  ${divO}/${divC} ${divO === divC ? '✅' : '❌'}`);
console.log(`  h2   ${h2O}/${h2C} ${h2O === h2C ? '✅' : '❌'}`);
console.log(`  h3   ${h3O}/${h3C} ${h3O === h3C ? '✅' : '❌'}`);
if (divO !== divC || h2O !== h2C || h3O !== h3C) {
  console.error('❌ 标签不平衡 —— 拒绝写盘（web/index.html 保持 dist 恢复版）');
  process.exit(1);
}

fs.writeFileSync(TARGET, h, 'utf8');
console.log('\n✅ 已写入');

/* ⑧ 顺序与内容校验 */
const b0 = h.indexOf('data-page="about"');
const order = [
  ['page-title', h.indexOf('class="page-title"', b0)],
  ['这是什么', h.indexOf('这是什么', b0)],
  ['API 声明', h.indexOf('想要精确度', b0)],
  ['sec-howto', h.indexOf('id="sec-howto"', b0)],
  ['这不是拼贴', h.indexOf('这不是拼贴', b0)],
  ['方法论', h.indexOf('id="sec-method"', b0)],
];
console.log('\n关于页顺序：');
order.forEach(([nm, p], i) => console.log('  ' + (i + 1) + '. ' + nm + ' @' + p));
const okOrder = order.every((x, i) => i === 0 || (x[1] > 0 && x[1] > order[i - 1][1]));
console.log('\n  顺序正确:', okOrder ? '✅' : '❌');
console.log('  Key 段保留:', h.includes('Key 怎么用') ? '✅' : '❌');
console.log('  主流API 保留:', h.includes('主流 API 怎么拿') ? '✅' : '❌');
process.exit(okOrder && h.includes('Key 怎么用') ? 0 : 1);
