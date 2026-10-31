// 修 paper.html 的公式块解析 bug：单行 $$...$$ 会把后面全部吞进公式
// 根因：md2html 只处理 `$$` 独占一行的多行写法，
//       遇到行内 `$$I(A;B|t)=0$$` 会把它当开头，然后一直吞到下一个 `$$` 行，
//       导致其后所有 markdown（表格/加粗/标题）都成了未渲染的"公式" ⇒ 用户看到乱码。
import fs from 'node:fs';

/* ══════════ ① 修 md2html 的公式处理 ══════════ */
let src = fs.readFileSync('tools/add-paper-and-api-note.mjs', 'utf8');

const OLD = `    // 公式块
    if (/^\\$\\$/.test(L)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^\\$\\$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<div class="formula">' + esc(buf.join(' ')) + '</div>');
      continue;
    }`;

const NEW = `    // 公式：先判单行 $$...$$，再判多行
    const mSingle = L.match(/^\\$\\$(.+?)\\$\\$\\s*$/);
    if (mSingle) {
      out.push('<div class="formula">' + esc(mSingle[1].trim()) + '</div>');
      i++;
      continue;
    }
    if (/^\\$\\$\\s*$/.test(L)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^\\$\\$\\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;      // 吃掉闭合的 $$
      out.push('<div class="formula">' + esc(buf.join(' ')) + '</div>');
      continue;
    }`;

if (src.includes(NEW)) {
  console.log('① 转换器已修过');
} else if (src.includes(OLD)) {
  src = src.replace(OLD, NEW);
  fs.writeFileSync('tools/add-paper-and-api-note.mjs', src, 'utf8');
  console.log('① 转换器已修（支持单行 $$...$$）');
} else {
  console.log('① 源脚本已是修复版，继续（不退出）');
}

/* ══════════ ② 重新生成 paper.html ══════════ */
// 直接内联执行同一个转换逻辑，避免再起一次插入流程（关于页已插过，幂等）
const md = fs.readFileSync('docs/42-融合路径论文.md', 'utf8');

function md2html(mdText) {
  const lines = mdText.split('\n');
  const out = [];
  let i = 0;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\$([^$\n]{1,40})\$/g, '<code>$1</code>')   // 行内 LaTeX 降级
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  while (i < lines.length) {
    const L = lines[i];

    if (/^```/.test(L)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    // ★ 单行公式
    const mSingle = L.match(/^\$\$(.+?)\$\$\s*$/);
    if (mSingle) {
      out.push('<div class="formula">' + esc(mSingle[1].trim()) + '</div>');
      i++;
      continue;
    }
    // ★ 多行公式
    if (/^\$\$\s*$/.test(L)) {
      i++;
      const buf = [];
      while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++;
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
    const h = L.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(L)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(L)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      // ★ 跨行加粗：先合并渲染再还原换行（逐行 inline 会漏掉跨行的 **…**）
      out.push('<blockquote>' + inline(buf.join('\u0000')).split('\u0000').join('<br>') + '</blockquote>');
      continue;
    }
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
    if (!L.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||>|```|\$\$|---)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push('<p>' + inline(buf.join('\u0000')).split('\u0000').join('<br>') + '</p>');
  }
  return out.join('\n');
}

const body = md2html(md);

// 保留原 paper.html 的 <head>/<style>，只替换正文
let html = fs.readFileSync('web/paper.html', 'utf8');
const mBody = html.match(/<div class="wrap">([\s\S]*?)<\/div>\s*<a class="back"/);
if (!mBody) { console.error('❌ 未定位正文区'); process.exit(1); }
html = html.replace(mBody[0], '<div class="wrap">\n' + body + '\n</div>\n<a class="back"');
fs.writeFileSync('web/paper.html', html, 'utf8');
console.log('② paper.html 已重新生成');

/* ══════════ ③ 校验 ══════════ */
const out = fs.readFileSync('web/paper.html', 'utf8');
console.log('\n校验：');
const checks = [
  ['公式块不再吞内容', (out.match(/class="formula"/g) || []).length <= 3],
  ['第八节标题是一级标题', out.includes('<h2>八、边界')],
  ['第八节表格已渲染', /<h2>八、边界[\s\S]{0,4000}<table>/.test(out)],
  ['表格总数为正', (out.match(/<table>/g) || []).length >= 5],
  ['没有裸露的 ** 加粗标记', !/\*\*[^*\n]{2,}\*\*/.test(out.replace(/<pre[\s\S]*?<\/pre>/g, ''))],
  ['没有裸露的表格管道符', !/\|\s*---\s*\|/.test(out.replace(/<pre[\s\S]*?<\/pre>/g, ''))],
  ['七节标题存在', out.includes('<h2>七、置信度')],
];
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
console.log(`\n公式块数：${(out.match(/class="formula"/g) || []).length}；表格数：${(out.match(/<table>/g) || []).length}；h2 数：${(out.match(/<h2>/g) || []).length}`);
process.exit(bad ? 1 : 0);
