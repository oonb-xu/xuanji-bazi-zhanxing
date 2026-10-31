// 给 service 加 --open（启动后自动开浏览器）与端口占用处理
// 目的：桌面快捷方式直接指向已签名的 node.exe，绕过被 Smart App Control 拦的 .cmd
import fs from 'node:fs';

let s = fs.readFileSync('server.mjs', 'utf8');
if (s.includes('OPEN_BROWSER')) { console.log('已支持'); process.exit(0); }

/* ① 顶部加开关与开浏览器工具 */
s = s.replace(
  "import fs from 'node:fs';",
  `import fs from 'node:fs';
import { spawn } from 'node:child_process';

// ★ OPEN_BROWSER：命令行带 --open 时，服务起来后自动打开浏览器
const OPEN_BROWSER = process.argv.includes('--open');

/** 用 explorer.exe 打开 URL（explorer 是微软签名程序，不会被 Smart App Control 拦） */
function openBrowser(url) {
  try {
    spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch (e) {
    console.error('打开浏览器失败：', e.message);
    return false;
  }
}`
);

/* ② listen 回调里打开浏览器 */
s = s.replace(
  ".listen(PORT, '127.0.0.1', () => {\n  console.log(`玄机·融合 → http://127.0.0.1:${PORT}`);\n  console.log(`健康检查 → http://127.0.0.1:${PORT}/api/health`);\n});",
  `.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      // 端口已占用：说明服务已在跑，直接开浏览器然后退出
      const url = \`http://127.0.0.1:\${PORT}\`;
      console.log(\`端口 \${PORT} 已被占用 —— 服务应已在运行，直接打开浏览器\`);
      if (OPEN_BROWSER) openBrowser(url);
      setTimeout(() => process.exit(0), 600);
      return;
    }
    console.error('服务启动失败：', e.message);
    process.exit(1);
  })
  .listen(PORT, '127.0.0.1', () => {
    const url = \`http://127.0.0.1:\${PORT}\`;
    console.log(\`玄机·融合 → \${url}\`);
    console.log(\`健康检查 → \${url}/api/health\`);
    if (OPEN_BROWSER) {
      console.log('正在打开浏览器…');
      setTimeout(() => openBrowser(url), 500);
    }
  });`
);

fs.writeFileSync('server.mjs', s, 'utf8');
console.log('① server.mjs 已支持 --open 与 EADDRINUSE 处理');
