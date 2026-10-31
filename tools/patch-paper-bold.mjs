// 把「跨行加粗」修复直接打进 fix-paper-formula.mjs，然后重跑它
import fs from 'node:fs';

const P = 'tools/fix-paper-formula.mjs';
let src = fs.readFileSync(P, 'utf8');
let changed = [];

/* ① 引用块：合并渲染再还原换行 */
const OLD_Q = `      out.push('<blockquote>' + buf.map((b) => inline(b)).join('<br>') + '</blockquote>');`;
const NEW_Q = `      // ★ 跨行加粗：先合并渲染再还原换行（逐行 inline 会漏掉跨行的 **…**）
      out.push('<blockquote>' + inline(buf.join('\\u0000')).split('\\u0000').join('<br>') + '</blockquote>');`;
if (src.includes(OLD_Q) && !src.includes(NEW_Q)) {
  src = src.replace(OLD_Q, NEW_Q);
  changed.push('引用块');
}

/* ② 普通段落 */
const OLD_P = `    out.push('<p>' + buf.map((b) => inline(b)).join('<br>') + '</p>');`;
const NEW_P = `    out.push('<p>' + inline(buf.join('\\u0000')).split('\\u0000').join('<br>') + '</p>');`;
if (src.includes(OLD_P)) {
  src = src.replace(OLD_P, NEW_P);
  changed.push('段落');
}

/* ③ 列表项也合并（保险） */
const OLD_L = `      out.push(\`<\${tag}>\` + items.map((t) => '<li>' + inline(t) + '</li>').join('') + \`</\${tag}>\`);`;
const NEW_L = `      out.push(\`<\${tag}>\` + items.map((t) => '<li>' + inline(t) + '</li>').join('') + \`</\${tag}>\`);`;
// 列表项不跨行，跳过

fs.writeFileSync(P, src, 'utf8');
console.log('已改：', changed.length ? changed.join(' / ') : '无');

/* 校验替换是否落地 */
const after = fs.readFileSync(P, 'utf8');
console.log('引用块已修:', after.includes('inline(buf.join('));
console.log('段落已修:', after.includes("out.push('<p>' + inline(buf.join("));
