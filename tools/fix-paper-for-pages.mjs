import fs from 'node:fs';

/* ① 找 paper.html 里的外链 */
const t = fs.readFileSync('web/paper.html', 'utf8');
const ext = [...t.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^#|^https?:|^mailto:|^data:/.test(u));
console.log('web/paper.html 外链：' + JSON.stringify(ext));
for (const u of ext) {
  const i = t.indexOf('"' + u + '"');
  console.log('  上下文: ' + JSON.stringify(t.slice(Math.max(0, i - 120), i + 60).replace(/\s+/g, ' ')));
}

/* ② 复制到 site/，把站内绝对链接改成相对 */
let s = t.replace(/(href|src)="\/(?![\/])/g, '$1="./');
fs.writeFileSync('site/paper.html', s, 'utf8');
const ext2 = [...s.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^#|^https?:|^mailto:|^data:/.test(u));
console.log('\n✅ site/paper.html 已生成，剩余外链：' + JSON.stringify(ext2));

/* ③ README 里把「快速开始」指向 USAGE.md */
{
  const P = 'README.md';
  let r = fs.readFileSync(P, 'utf8');
  if (!r.includes('USAGE.md')) {
    const anchor = '## 快速开始';
    const i = r.indexOf(anchor);
    if (i > 0) {
      const insert = '\n> 📖 **详细使用手册见 [USAGE.md](USAGE.md)** —— 含「不装 Node 怎么办」「能不能直接放 GitHub 上跑」「部署与备案」等。\n\n';
      r = r.slice(0, i) + insert + r.slice(i);
      fs.writeFileSync(P, r, 'utf8');
      console.log('✅ README 已链到 USAGE.md');
    }
  } else console.log('— README 已有 USAGE 链接');
}

/* ④ site/README（说明这是静态站） */
fs.writeFileSync('site/README.md', `# GitHub Pages 静态站

本目录只放**不需要后端**的内容：论文、宣传视频、项目介绍页。

## 为什么功能不在这里

完整功能（融合盘 / 合盘 / 六壬 / 生时矫正）依赖 \`server.mjs\` + \`src/\` 的 Node 引擎，
**GitHub Pages 无法执行后端进程**。要跑完整功能请在本机：

\`\`\`bash
npm install && npm start
\`\`\`

## 部署

推送到 \`main\` 分支即自动部署（见 \`.github/workflows/pages.yml\`）。
启用方式：仓库 Settings → Pages → Source 选 **GitHub Actions**。
`, 'utf8');
console.log('✅ site/README.md 已生成');
