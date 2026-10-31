// 把 API 说明整块（怎么用·需要接API吗 + 主流API怎么拿 + Key怎么用）搬到最上面
// 位置：紧跟「这是什么」声明块之后（即最上面声明下面一个）
// 并在该块开头加一句明确声明：想要精确度，建议必须接 API
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
let seg = h.slice(a0, a1);

/** 从 from 处向前找最近的 <div class="card，再求其配对 </div> 的结束位置 */
function enclosingCardEnd(html, innerPos) {
  const cStart = html.lastIndexOf('<div class="card', innerPos);
  if (cStart < 0) return { start: innerPos, end: -1 };
  const re = /<div\b|<\/div>/g;
  re.lastIndex = cStart;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0 && m[0] === '</div>') return { start: cStart, end: m.index + 6 };
  }
  return { start: cStart, end: -1 };
}

/* ① 定位 API 块 */
const howtoPos = seg.indexOf('id="sec-howto"');
if (howtoPos < 0) { console.error('❌ 未找到 sec-howto'); process.exit(1); }

// 它的卡片从 h2 前开始；且该卡可能还含 主流API / Key 两段 —— 求卡片范围
const card = enclosingCardEnd(seg, howtoPos);
if (card.end < 0) { console.error('❌ 求 API 块范围失败'); process.exit(1); }

let block = seg.slice(card.start, card.end);
console.log('API 块长度:', block.length, '字符');
console.log('块内包含:', ['sec-howto', '主流 API 怎么拿', 'Key 怎么用'].filter((k) => block.includes(k)).join(' | '));

/* ② 如果 主流API / Key 有各自独立的卡（不在同一张卡里），把它们也带上 */
function takeThrough(segText, startIdx, lastHeadingText) {
  const lp = segText.indexOf(lastHeadingText, startIdx);
  if (lp < 0) return null;
  const c = enclosingCardEnd(segText, lp);
  return c.end > 0 ? { start: startIdx, end: c.end } : null;
}
if (!block.includes('Key 怎么用')) {
  const wider = takeThrough(seg, card.start, '<h2>Key 怎么用');
  if (wider) { block = seg.slice(wider.start, wider.end); console.log('已扩展范围以含 Key 段'); }
}

/* ③ 在该块开头插入明确声明 */
const NOTICE = `<div class="note" style="font-size:13px;line-height:2;padding:12px 15px;margin-bottom:14px;
        border-radius:10px;background:rgba(255,196,87,.07);border:1px solid rgba(255,196,87,.3)">
        <b style="color:#ffc457;font-size:14px">想要精确度，建议必须接 API —— 无论你是什么用途。</b><br>
        本站内置的算法足以把结构算完（八个字、行星度数、宫位、三传），这部分<b>不接 API 也是准的</b>。<br>
        但以下三项<b>依赖外部星历与更细的历法数据</b>，内置版只能给近似：<br>
        · <b>高精度行星位置</b>（内置 vs 专业星历可能差角分级）<br>
        · <b>历史时区与夏令时</b>（尤其 1949 年前、境外出生）<br>
        · <b>边界情形</b>（出生时刻卡在时辰交界 / 星座交界）<br>
        所以：<b>只要你在意"准不准"，就接 API。</b>与用途无关——看盘、合盘、矫正、学术研究都一样。
      </div>
      `;
block = block.replace(/(<h2 id="sec-howto"[^>]*>)/, NOTICE + '$1');

/* ④ 从原位置移除 */
seg = seg.slice(0, card.start) + seg.slice(card.start + block.length);
console.log('已从底部移除');

/* ⑤ 插到「这是什么」块之后 */
const whatStart = seg.indexOf('id="sec-what-is-this"');
if (whatStart < 0) { console.error('❌ 找不到这是什么块'); process.exit(1); }
const whatCard = enclosingCardEnd(seg, whatStart);
if (whatCard.end < 0) { console.error('❌ 求这是什么块范围失败'); process.exit(1); }
seg = seg.slice(0, whatCard.end) + '\n\n      ' + block.trim() + '\n\n      ' + seg.slice(whatCard.end);
console.log('✅ 已插入到「这是什么」之后');

/* ⑥ 导航重排：把「怎么用·API」提到第 2 项 */
seg = seg.replace(/<!--\s*导航[^\n]*-->\s*/, '');
const tocRe = /(<a href="#sec-[^"]+" class="toc-i[^"]*"><b>\d+<\/b><span>)([^<]+)(<\/span>)/g;
// 先抽出所有导航项
const items = [];
seg = seg.replace(tocRe, (m, pre, name, post) => { items.push({ m, name }); return '\u0000TOC\u0000'; });
if (items.length) {
  // 把 API 项提前到第 2 位
  const idx = items.findIndex((x) => /API|怎么用/.test(x.name));
  if (idx > 0) { const [t] = items.splice(idx, 1); items.splice(1, 0, t); }
  let n = 0;
  const rebuilt = items.map((x) => x.m).join('\n          ').replace(
    /(<b>)\d+(<\/b>)/g, (m2, p1, p2) => { n++; return p1 + n + p2; }
  );
  seg = seg.replace('\u0000TOC\u0000', rebuilt);
  console.log('导航已重排（共 ' + n + ' 项）');
}

h = h.slice(0, a0) + seg + h.slice(a1);
fs.writeFileSync(P, h, 'utf8');

/* ⑦ 校验 */
const out = fs.readFileSync(P, 'utf8');
const b0 = out.indexOf('data-page="about"');
const order = [
  ['page-title', out.indexOf('class="page-title"', b0)],
  ['这是什么', out.indexOf('这是什么', b0)],
  ['API 声明', out.indexOf('想要精确度', b0)],
  ['sec-howto', out.indexOf('id="sec-howto"', b0)],
  ['这不是拼贴', out.indexOf('这不是拼贴', b0)],
  ['方法论', out.indexOf('id="sec-method"', b0)],
];
console.log('\n关于页顺序：');
order.forEach(([nm, p], i) => console.log('  ' + (i + 1) + '. ' + nm + ' @' + p));
const okOrder = order.every((x, i) => i === 0 || (x[1] > 0 && x[1] > order[i - 1][1]));
const divOk = (out.match(/<div\b/g) || []).length === (out.match(/<\/div>/g) || []).length;
console.log('\n  顺序正确:', okOrder ? '✅' : '❌');
console.log('  div 平衡:', divOk ? '✅' : '❌');
console.log('  精确度声明:', out.includes('想要精确度，建议必须接 API') ? '✅' : '❌');
console.log('  Key 段仍在:', out.includes('Key 怎么用') ? '✅' : '❌');
process.exit(okOrder && divOk ? 0 : 1);
