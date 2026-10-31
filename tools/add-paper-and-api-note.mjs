// 【任务4+5】论文页 + 关于页接入 + API 说明补充
import fs from 'node:fs';

/* ══════════ ① 极简 Markdown → HTML（够用即可）══════════ */
function md2html(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  while (i < lines.length) {
    const L = lines[i];

    // 代码块
    if (/^```/.test(L)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    // 公式：先判单行 $...$，再判多行
    const mSingle = L.match(/^\$\$(.+?)\$\$\s*$/);
    if (mSingle) {
      out.push('<div class="formula">' + esc(mSingle[1].trim()) + '</div>');
      i++;
      continue;
    }
    if (/^\$\$\s*$/.test(L)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;      // 吃掉闭合的 $
      out.push('<div class="formula">' + esc(buf.join(' ')) + '</div>');
      continue;
    }
    // 表格
    if (/^\|/.test(L) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
      const head = L.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push('<table><thead><tr>' + head.map((h) => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('')
        + '</tbody></table>');
      continue;
    }
    // 标题
    const h = L.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lv = h[1].length;
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      i++;
      continue;
    }
    // 分割线
    if (/^---+\s*$/.test(L)) { out.push('<hr>'); i++; continue; }
    // 引用
    if (/^>/.test(L)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push('<blockquote>' + buf.map((b) => inline(b)).join('<br>') + '</blockquote>');
      continue;
    }
    // 有序/无序列表
    if (/^(\s*)([-*]|\d+\.)\s+/.test(L)) {
      const ordered = /^\s*\d+\./.test(L);
      const items = [];
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^(\s*)([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>` + items.map((t) => '<li>' + inline(t) + '</li>').join('') + `</${tag}>`);
      continue;
    }
    // 空行
    if (!L.trim()) { i++; continue; }
    // 段落
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||>|```|\$\$|---)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push('<p>' + buf.map((b) => inline(b)).join('<br>') + '</p>');
  }
  return out.join('\n');
}

const md = fs.readFileSync('docs/42-融合路径论文.md', 'utf8');
const body = md2html(md);

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>论中西命理体系的融合路径</title>
<style>
:root{--bg:#04070d;--fg:#dfeaf5;--mut:#93aec5;--line:rgba(90,160,220,.18);--gold:#ffc457;--cyan:#5ef1ff;--green:#7dffb4}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 800px at 50% -10%,#0a1524,#04070d 60%);color:var(--fg);
  font:15px/1.9 -apple-system,"Segoe UI","Microsoft YaHei",serif;padding:40px 20px 100px}
.wrap{max-width:880px;margin:0 auto}
h1{font-size:26px;line-height:1.5;margin:0 0 28px;padding-bottom:18px;border-bottom:1px solid var(--line);color:#eaf7ff}
h2{font-size:19px;margin:38px 0 14px;color:var(--cyan);letter-spacing:.02em}
h3{font-size:16px;margin:26px 0 10px;color:var(--gold)}
h4{font-size:14.5px;margin:20px 0 8px;color:var(--fg)}
p{margin:11px 0;color:rgba(220,234,245,.92)}
strong{color:#fff}
em{color:var(--mut)}
a{color:var(--cyan)}
code{background:rgba(94,241,255,.1);padding:1px 6px;border-radius:4px;font-family:Consolas,monospace;font-size:12.5px;color:#9fe8ff}
pre{background:rgba(2,6,12,.85);border:1px solid var(--line);border-radius:9px;padding:14px 16px;overflow-x:auto;margin:14px 0}
pre code{background:none;padding:0;color:#9fe8ff;font-size:12px;line-height:1.8}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
th{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(94,241,255,.3);color:rgba(150,205,235,.8);font-size:11.5px;letter-spacing:.06em}
td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top;line-height:1.75}
tr:last-child td{border-bottom:none}
blockquote{margin:16px 0;padding:12px 18px;border-left:3px solid var(--gold);background:rgba(255,196,87,.05);color:rgba(240,225,190,.95);border-radius:0 8px 8px 0}
blockquote strong{color:var(--gold)}
ul,ol{margin:11px 0;padding-left:26px}
li{margin:5px 0;color:rgba(220,234,245,.9)}
hr{border:none;border-top:1px solid var(--line);margin:34px 0}
.formula{background:rgba(94,241,255,.05);border:1px solid rgba(94,241,255,.18);border-radius:8px;
  padding:14px;margin:14px 0;text-align:center;font-family:Consolas,monospace;font-size:13.5px;color:#9fe8ff}
.back{position:fixed;bottom:18px;right:18px;padding:9px 16px;border-radius:9px;background:rgba(8,16,28,.94);
  border:1px solid var(--line);color:var(--cyan);text-decoration:none;font-size:12.5px}
@media(max-width:640px){body{padding:22px 14px 80px}h1{font-size:21px}h2{font-size:17px}}
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<a class="back" href="/">← 回主界面</a>
</body>
</html>`;

fs.writeFileSync('web/paper.html', HTML, 'utf8');
console.log(`① /paper.html 已生成（${(HTML.length / 1024).toFixed(1)} KB）`);

/* ══════════ ② 关于页：加论文入口 + 补 API 说明 ══════════ */
let html = fs.readFileSync('web/index.html', 'utf8');
let changed = [];

// 2a 论文入口（插在「查术语」之前）
if (!html.includes('/paper.html')) {
  const anchor = '<h2>怎么用 · 需要接 API 吗</h2>';
  const card = `<h2>方法论 · 融合路径论文</h2>
      <div class="card" style="margin-bottom:16px">
        <div class="note" style="font-size:13px;line-height:2">
          这套系统为什么这样设计、边界在哪里，都写在
          <a href="/paper.html" style="color:#5ef1ff"><b>《论中西命理体系的融合路径》</b></a> 里。<br>
          核心结论：<b>七政四余与古典占星同源</b>（均出自巴比伦黄道十二宫）；
          两套体系的底层差异不在文化而在<b>编码类型</b>——
          占星是纯几何编码（位置自足），八字是几何+计数混合编码（含人为甲子原点）。<br>
          这条差异可以严格证明：<b>月支 100% 可从太阳黄经推出，而年柱日柱原理上不可推</b>
          （60 有天文近似依据：= LCM(12木,30土) ≈ 3×木土会合 59.577 年；但它是**计数**，星盘里给不出「这是第几个甲子」）。
        </div>
      </div>

      `;
  if (html.includes(anchor)) {
    html = html.replace(anchor, card + anchor);
    changed.push('论文入口');
  }
}

// 2b API 说明补充（生时矫正 + 精度仍建议接入 API）
if (!html.includes('生时矫正也建议接入 API')) {
  const anchor = '只有「AI 解读」这一层需要 API';
  const add = `只有「AI 解读」这一层需要 API`;
  // 在原说明后追加一段
  const target = '不接 API，前面的计算和图表全部照常可用，只是没有那段文字解读。';
  const extra = `<br><br>
          <b style="color:#ffd58a">另外两类场景也建议接入 API：</b><br>
          · <b>生时矫正</b>：本地算法只能给出<b>候选时间集</b>（用事件反推，命中区间可能不止一个）；
          要让模型综合多个事件做全局约束求解、收敛到唯一解，需要 API。<br>
          · <b>模型精确度</b>：本地是确定性规则引擎，精度是"给定输入必得同一结果"的精确；
          但<b>断语的取舍与组合</b>（哪条更重要、冲突怎么权衡）本地只能给并列，不会替你排序——
          这一步建议交给模型。<br>
          <b style="color:#7dffb4">本机实测参考</b>：月支可从行星位置 100% 推出；
          时支经均时差修正后约 67.5%（边界附近可能差一位）⇒ <b>高标准场景请接入 API 复核</b>。`;
  if (html.includes(target)) {
    html = html.replace(target, target + extra);
    changed.push('API 说明补充');
  }
}

fs.writeFileSync('web/index.html', html, 'utf8');
console.log('② 关于页改动：', changed.length ? changed.join(' / ') : '无');

/* 校验 */
const after = fs.readFileSync('web/index.html', 'utf8');
const checks = [
  ['含 paper.html 链接', after.includes('/paper.html')],
  ['含 API 补充说明', after.includes('生时矫正也建议接入 API')],
  ['div 开闭平衡', (after.match(/<div\b/g) || []).length === (after.match(/<\/div>/g) || []).length],
  ['paper.html 存在', fs.existsSync('web/paper.html')],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
