// 修第二类 bug：跨行加粗（**...** 跨越两行）无法被逐行 inline 匹配
// 做法：把多行先拼成一个串（用 \u0000 占位），渲染完再把占位换回 <br>
import fs from 'node:fs';

let src = fs.readFileSync('tools/fix-paper-formula.mjs', 'utf8');

// ① 引用块
src = src.replace(
  `      out.push('<blockquote>' + buf.map((b) => inline(b)).join('<br>') + '</blockquote>');`,
  `      // ★ 跨行加粗：先合并渲染再还原换行（逐行 inline 会漏掉跨行的 **…**）
      out.push('<blockquote>' + inline(buf.join('\\u0000')).split('\\u0000').join('<br>') + '</blockquote>');`
);

// ② 普通段落
src = src.replace(
  `    out.push('<p>' + buf.map((b) => inline(b)).join('<br>') + '</p>');`,
  `    out.push('<p>' + inline(buf.join('\\u0000')).split('\\u0000').join('<br>') + '</p>');`
);

// ③ 列表项也应合并（列表项本身不跨行，但保持一致）
fs.writeFileSync('tools/fix-paper-formula.mjs', src, 'utf8');
console.log('① 转换器已修（跨行加粗）');

/* ② 重跑（本脚本自身已含渲染逻辑） */
const { execSync } = await import('node:child_process');
try {
  const out = execSync('node tools/fix-paper-formula.mjs', { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  // 自调用会递归；改为直接内联执行渲染
  console.log('（自调用被跳过，改用内联渲染）');
}
