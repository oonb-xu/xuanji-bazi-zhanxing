// 重做：API 块 = 从 sec-howto 所在卡片 → 关于 section 末尾（它本来就是最后一段）
// 目标：插到「这是什么」卡之后；并在开头加精度声明
import fs from 'node:fs';
const TARGET = 'web/index.html';
let h = fs.readFileSync(TARGET, 'utf8');

const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
let seg = h.slice(a0, a1);

console.log('=== 恢复确认 ===');
console.log('  about 段长度:', seg.length);
console.log('  含 sec-plain-start:', seg.includes('sec-plain-start'));
console.log('  含 sec-what-is-this:', seg.includes('sec-what-is-this'));

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

/* ① 边界：sec-howto 卡起点 → seg 末尾 */
const howtoPos = seg.indexOf('id="sec-howto"');
if (howtoPos < 0) { console.error('❌ 无 sec-howto'); process.exit(1); }
const RANGE_START = seg.lastIndexOf('<div class="card', howtoPos);
if (RANGE_START < 0) { console.error('❌ 找不到卡起点'); process.exit(1); }

/* 段末尾可能带 </div></section>，要保留 */
const tailMatch = seg.slice(RANGE_START).match(/<\/div>\s*$/);
const RANGE_END = seg.length - (tailMatch ? tailMatch[0].length : 0);

let origBlock = seg.slice(RANGE_START, RANGE_END);
console.log('\n=== 提取 ===');
console.log('  范围:', RANGE_START, '→', RANGE_END, `(${origBlock.length} 字符)`);
for (const k of ['sec-howto', '主流 API', 'Key 怎么用']) {
  console.log('  含', k + ':', origBlock.includes(k));
}
if (!origBlock.includes('sec-howto') || !origBlock.includes('Key 怎么用')) {
  console.error('❌ 范围仍不对，中止');
  process.exit(1);
}

/* ② 按位置删除 */
seg = seg.slice(0, RANGE_START) + seg.slice(RANGE_END);
console.log('已删除，剩余:', seg.length);

/* ③ 副本加声明 */
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
const newBlock = origBlock.replace(/(<h2 id="sec-howto"[^>]*>)/, NOTICE + '$1');
if (newBlock === origBlock) { console.error('❌ 声明未插入'); process.exit(1); }

/* ④ 插到「这是什么」卡之后 */
const whatPos = seg.indexOf('id="sec-what-is-this"');
const whatCardStart = seg.lastIndexOf('<div class="card', whatPos);
const whatCardEnd = matchDivEnd(seg, whatCardStart);
if (whatCardEnd < 0) { console.error('❌ 求这是什么块结束失败'); process.exit(1); }
seg = seg.slice(0, whatCardEnd) + '\n\n      ' + newBlock.trim() + '\n\n      ' + seg.slice(whatCardEnd);
console.log('✅ 已插入到「这是什么」之后');

/* ⑤ 导航重排 */
const tocRe = /<a href="#sec-[\w-]+" class="toc-i[^"]*"><b>\d+<\/b>[\s\S]*?<\/a>/g;
const items = seg.match(tocRe) || [];
if (items.length) {
  const idx = items.findIndex((x) => /sec-howto/.test(x));
  if (idx > 0) { const [t] = items.splice(idx, 1); items.splice(1, 0, t); }
  seg = seg.replace(tocRe, '\u0001');
  let n = 0;
  const rebuilt = items.join('\n          ').replace(/(<b>)\d+(<\/b>)/g, (m2, p1, p2) => { n++; return p1 + n + p2; });
  seg = seg.replace('\u0001', rebuilt);
  console.log('导航重排，共', n, '项');
}

h = h.slice(0, a0) + seg + h.slice(a1);

/* ⑥ 安全闸 */
const cnt = (s, re) => (s.match(re) || []).length;
const d = [cnt(h, /<div\b/g), cnt(h, /<\/div>/g)];
const c2 = [cnt(h, /<h2\b/g), cnt(h, /<\/h2>/g)];
const c3 = [cnt(h, /<h3\b/g), cnt(h, /<\/h3>/g)];
const sec = [cnt(h, /<section\b/g), cnt(h, /<\/section>/g)];
console.log('\n=== 写盘前自检 ===');
console.log(`  div     ${d[0]}/${d[1]} ${d[0] === d[1] ? '✅' : '❌'}`);
console.log(`  h2      ${c2[0]}/${c2[1]} ${c2[0] === c2[1] ? '✅' : '❌'}`);
console.log(`  h3      ${c3[0]}/${c3[1]} ${c3[0] === c3[1] ? '✅' : '❌'}`);
console.log(`  section ${sec[0]}/${sec[1]} ${sec[0] === sec[1] ? '✅' : '❌'}`);
if (d[0] !== d[1] || c2[0] !== c2[1] || c3[0] !== c3[1] || sec[0] !== sec[1]) {
  console.error('❌ 不平衡 —— 拒绝写盘');
  process.exit(1);
}
fs.writeFileSync(TARGET, h, 'utf8');
console.log('\n✅ 已写入');

/* ⑦ 顺序 */
const b0 = h.indexOf('data-page="about"');
const order = [
  ['page-title', h.indexOf('class="page-title"', b0)],
  ['这是什么', h.indexOf('这是什么', b0)],
  ['API 精度声明', h.indexOf('想要精确度', b0)],
  ['sec-howto', h.indexOf('id="sec-howto"', b0)],
  ['主流 API', h.indexOf('主流 API', b0)],
  ['Key 怎么用', h.indexOf('Key 怎么用', b0)],
  ['这不是拼贴', h.indexOf('这不是拼贴', b0)],
  ['方法论', h.indexOf('id="sec-method"', b0)],
];
console.log('\n关于页顺序：');
order.forEach(([nm, p], i) => console.log('  ' + (i + 1) + '. ' + nm + ' @' + p));
const okOrder = order.every((x, i) => i === 0 || (x[1] > 0 && x[1] > order[i - 1][1]));
console.log('\n  顺序正确:', okOrder ? '✅' : '❌');
process.exit(okOrder ? 0 : 1);
