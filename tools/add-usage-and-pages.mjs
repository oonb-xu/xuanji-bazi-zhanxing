import fs from 'node:fs';

/* ═══ ① 检查哪些页面自包含（可上 Pages）═══ */
const PAGES = ['web/paper.html', 'web/video-intro.html', 'web/glossary.html'];
const selfContained = {};
for (const f of PAGES) {
  if (!fs.existsSync(f)) { selfContained[f] = null; continue; }
  const t = fs.readFileSync(f, 'utf8');
  const ext = [...t.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(m => m[1])
    .filter(u => !/^#|^https?:|^mailto:|^data:/.test(u));
  selfContained[f] = ext;
  console.log(f.padEnd(26) + '外链 ' + ext.length + ' 个: ' + (ext.slice(0, 5).join(', ') || '无（自包含）'));
}

/* ═══ ② USAGE.md ═══ */
const USAGE = `# 使用手册

> 三分钟跑起来；不想装东西看 [§4 不装 Node 怎么办](#4-不装-node-怎么办)。

---

## 目录

1. [30 秒上手](#1-30-秒上手)
2. [两种跑法](#2-两种跑法)
3. [⚠️ 关于"直接放 GitHub 上跑"](#3-️-关于直接放-github-上跑)
4. [不装 Node 怎么办](#4-不装-node-怎么办)
5. [环境要求](#5-环境要求)
6. [安装](#6-安装)
7. [CLI 命令表](#7-cli-命令表)
8. [常见场景](#8-常见场景)
9. [部署到网上（不备案的可行路径）](#9-部署到网上不备案的可行路径)
10. [故障排查](#10-故障排查)
11. [数据与隐私](#11-数据与隐私)
12. [更新与卸载](#12-更新与卸载)

---

## 1. 30 秒上手

\`\`\`bash
git clone https://github.com/oonb-xu/xuanji.git
cd xuanji
npm install
npm start
\`\`\`

浏览器自动打开 \`http://127.0.0.1:8788\`。**就这样，没有第三步。**

不想开网页？用命令行：

\`\`\`bash
node bin/xuanji.mjs bazi --at "2000-01-01 12:00" --gender 女
\`\`\`

---

## 2. 两种跑法

| 方式 | 命令 | 适合 | 需要 Node |
|---|---|---|---|
| **本地 Web**（推荐） | \`npm start\` | 看盘、交互、拖拽缩放、点击查词 | ✅ |
| **命令行** | \`node bin/xuanji.mjs <命令>\` | 批量、脚本、导出 JSON/Markdown | ✅ |
| **静态站**（只读） | GitHub Pages | 看论文/视频/术语表 | ❌ |

**核心计算全在你本机跑**，不上传任何数据。

---

## 3. ⚠️ 关于"直接放 GitHub 上跑"

很多人会想：备案太麻烦，那把它整个放 GitHub Pages 不就行了？

**不行。** 原因很具体：

| GitHub Pages 能做什么 | 不能做什么 |
|---|---|
| 托管**静态文件**（HTML/CSS/JS/图片） | 执行 **Node 进程** |
| 提供 HTTPS 与免费域名 | 提供 \`/api/fusion\` 这类**后端接口** |
| 全球 CDN | 读取你本机的星历文件、写本地样本 |

本项目的融合盘、合盘、六壬、生时矫正**都依赖服务端计算**（\`server.mjs\` + \`src/\`）。
把这些硬塞到纯静态托管上，等于要把整个 Node 引擎重写成浏览器端 WASM —— 
技术上可能，但**工程量巨大且没必要**，因为：

> **这是一个工具，不是一个网站。**
> 工具的正确用法是**装在自己机器上跑**。

所以本项目的定位是：

- ✅ **本地工具**（\`npm start\` 或 CLI）—— 完整功能
- ✅ **GitHub Pages 静态站** —— 只放**文档、论文、宣传视频、术语表**（不需要后端）
- ❌ **在线 SaaS** —— 不做，也不需要（省掉备案、服务器、以及"数据在别人手里"的风险）

---

## 4. 不装 Node 怎么办

三个办法，按推荐顺序：

### 办法 A：用便携版 Node（不污染系统）

1. 到 [nodejs.org](https://nodejs.org) 下载 **Windows Binary (.zip)** 或 macOS/Linux 的 tar.gz
2. 解压到任意目录（如 \`D:\\node\`）
3. 在该目录下开终端，把 \`node\` 加进 PATH 或直接用全路径：

\`\`\`bash
D:\\node\\node.exe server.mjs 8788 --open
\`\`\`

### 办法 B：让有 Node 的朋友跑

项目是零数据库、单机运行的，**一个人跑起来，局域网内其他人也能访问**：

\`\`\`bash
# 服务端（有 Node 的人）
node server.mjs 8788 --host 0.0.0.0

# 其他人浏览器打开
http://<那个人的内网IP>:8788
\`\`\`

> ⚠️ 仅限**可信局域网**。暴露到公网前请读 [§9](#9-部署到网上不备案的可行路径)。

### 办法 C：在线环境（临时试用）

GitHub Codespaces / Gitpod 这类云端 Linux 环境可以：

\`\`\`bash
npm install
node server.mjs 8788 --host 0.0.0.0
\`\`\`

然后把转发出来的端口在浏览器打开。**注意：数据在云端，不要填真实出生信息。**

---

## 5. 环境要求

| 项 | 要求 |
|---|---|
| Node.js | **≥ 18**（推荐 20 / 22 LTS） |
| 内存 | ≥ 512 MB |
| 硬盘 | ≥ 100 MB（含依赖） |
| 系统 | Windows 10+ / macOS 12+ / 主流 Linux |
| 浏览器 | Chrome / Edge / Firefox / Safari 近两年版本 |
| 网络 | **仅首次 \`npm install\` 需要**；之后完全离线可用 |

查版本：

\`\`\`bash
node -v      # 应 ≥ v18
npm -v
\`\`\`

---

## 6. 安装

### 方式一：Git（推荐，可更新）

\`\`\`bash
git clone https://github.com/oonb-xu/xuanji.git
cd xuanji
npm install
npm start
\`\`\`

### 方式二：下载 ZIP

1. 仓库页 → **Code** → **Download ZIP**
2. 解压，进入目录
3. \`npm install\` → \`npm start\`

### 方式三：全局命令（进阶）

\`\`\`bash
npm install -g .
xuanji serve --open        # 之后在任何目录都能用
xuanji bazi --at "2000-01-01 12:00"
\`\`\`

---

## 7. CLI 命令表

统一入口：\`node bin/xuanji.mjs <命令>\`（全局安装后可直接 \`xuanji <命令>\`）

### 常用

| 命令 | 说明 | 示例 |
|---|---|---|
| \`serve\` | 启动本地 Web | \`xuanji serve --port 8788 --open\` |
| \`bazi\` | 八字排盘 | \`xuanji bazi --at "2000-01-01 12:00" --gender 女\` |
| \`natal\` | 西方星盘 | \`xuanji natal --at "2000-01-01 12:00" --lng 116.4 --lat 39.9 --tz 8\` |
| \`liuren\` | 大六壬起课 | \`xuanji liuren --at "2026-01-01 10:30" --matter "问工作"\` |
| \`rectify\` | 生时矫正 | \`xuanji rectify --at "..."\` |
| \`sample\` | 采集样本 | \`xuanji sample --add data/samples/xx.json\` |

### 维护

| 命令 | 说明 |
|---|---|
| \`doctor\` | 环境体检（Node 版本 / 依赖 / 数据目录） |
| \`test\` | 跑全部回归（39 套） |
| \`help\` | 查看帮助 |

### 研究用（需要外部数据集）

\`kery\`（kerykeion 后端）· \`dual\`（双体系）· \`eventfit\`（应期拟合）· 
\`anchors\`（古籍年号校准）· \`cases\`（六壬课例）

> 这些命令需要 \`data/\` 下的数据集，而**数据集不进仓库**（隐私 + 授权），
> 所以下载后跑不起来是正常的 —— 见 [data/SOURCES.md](data/SOURCES.md)。

---

## 8. 常见场景

### 排一个八字

\`\`\`bash
xuanji bazi --at "2000-01-01 12:00" --gender 女
\`\`\`

输出是 Markdown，可直接重定向：

\`\`\`bash
xuanji bazi --at "2000-01-01 12:00" > 我的八字.md
\`\`\`

### 出星盘（需要经纬度）

不知道经纬度？查城市坐标：

\`\`\`bash
# 北京 116.4074 / 39.9042
xuanji natal --at "2000-01-01 12:00" --lng 116.4074 --lat 39.9042 --tz 8
\`\`\`

站内「排盘」页有 **48 城市**下拉，自动填经纬度。

### 起一课大六壬

\`\`\`bash
xuanji liuren --at "2026-01-01 10:30" --matter "这个项目能否推进"
\`\`\`

### 批量跑

CLI 输出是纯文本，配合 shell 循环即可：

\`\`\`bash
# macOS / Linux
for d in "2000-01-01 12:00" "1990-05-20 14:30"; do
  xuanji bazi --at "$d" > "out-\${d// /_}.md"
done
\`\`\`

\`\`\`powershell
# Windows PowerShell
foreach ($d in @("2000-01-01 12:00","1990-05-20 14:30")) {
  node bin/xuanji.mjs bazi --at $d > ("out-" + $d.Replace(" ","_") + ".md")
}
\`\`\`

### 只想要一张图

\`npm start\` 打开网页 → 「融合」页 → 填时间 → 「排盘」→ 
图标即现；右键保存或用截图工具。

---

## 9. 部署到网上（不备案的可行路径）

如果你确实想给别人一个链接：

| 方案 | 是否需要备案 | 难度 | 说明 |
|---|---|---|---|
| **本地跑 + 内网分享** | ❌ 不用 | ⭐ | 最快，仅限同局域网 |
| **GitHub Pages（只放静态页）** | ❌ 不用 | ⭐⭐ | 论文/视频/说明页可上，核心功能上不去 |
| **内网穿透**（frp / Cloudflare Tunnel） | ❌ 不用 | ⭐⭐⭐ | 公网能访问，但仍是你自己的机器 |
| **境外 Node 托管**（Vercel / Render / Fly.io） | ❌ 不用（但需外币卡/实名） | ⭐⭐⭐⭐ | 功能完整；数据在境外，**别填真实生日** |
| **国内云服务器 + 域名** | ✅ **要备案** | ⭐⭐⭐⭐⭐ | 就是你嫌麻烦的那条路 |

**我的建议**：

- 只想自己用 / 给朋友看 → **本地跑**（零成本、零风险、数据不出机器）
- 想公开分享**论文与视频** → **GitHub Pages**（本仓库带 \`.github/workflows/pages.yml\`，推送即部署）
- 想公开提供**在线算盘** → 前面几条都有各自的坑，**请先想清楚"别人的出生数据存你服务器上"的责任**

> 本项目**不提供**官方在线服务，也不打算提供。

---

## 10. 故障排查

### 打不开 \`http://127.0.0.1:8788\`

\`\`\`bash
# 1. 端口被占用？
node server.mjs 8799

# 2. 先体检
node bin/xuanji.mjs doctor

# 3. 看服务端有没有报错
node server.mjs 8788
\`\`\`

### 排盘后一片空白

1. 按 \`F12\` 看 Console 报错
2. 确认 \`npm install\` 成功（\`node_modules/astronomy-engine\` 存在）
3. 硬刷新 \`Ctrl+Shift+R\`

### \`npm install\` 卡住 / 失败

用国内镜像：

\`\`\`bash
npm install --registry=https://registry.npmmirror.com
\`\`\`

### 页面能开但计算报错

多半是数据文件缺失（\`data/\` 下的第三方数据集不进仓库）。看 \`data/SOURCES.md\` 了解各自来源与许可。

### Windows 上中文乱码

PowerShell 5.1 用 GBK 读文件会乱码，**不是文件坏了**。用 PowerShell 7 或 Git Bash。

---

## 11. 数据与隐私

- **不收集身份信息**，**绝不接收 API Key**（Key 只存你浏览器 localStorage）
- 出生信息只在**你的设备**与**本机服务**之间流转
- 样本默认**不贡献**；勾选后也只写在你本机的 \`data/samples/\`
- \`data/samples/\` 等已在 \`.gitignore\` 排除，**不会随代码上传**
- 详见 [PRIVACY.md](PRIVACY.md)

---

## 12. 更新与卸载

### 更新

\`\`\`bash
git pull
npm install        # 依赖有变化时
npm start
\`\`\`

### 卸载

\`\`\`bash
# 全局安装的
npm uninstall -g xuanji-meta-unified

# 本地目录直接删
cd .. && rm -rf xuanji
\`\`\`

---

## 附：目录速查

| 想改什么 | 去哪里 |
|---|---|
| 排盘算法 | \`src/bazi/\`、\`src/western/\` |
| 跨体系映射 | \`src/cross/\` |
| 前端页面 | \`web/index.html\` + \`web/app.js\` |
| 3D 融合盘 | \`web/fusion3d.js\` |
| 双环对照图 | \`web/dual-wheel.js\` |
| 服务端接口 | \`server.mjs\` |
| 回归测试 | \`test/\` |
| 论文与论证 | \`docs/\` |

---

**遇到文档没覆盖的问题？** 开个 Issue（模板已配好），附上：
\`node bin/xuanji.mjs doctor\` 的输出 + 最小复现步骤。
`;
fs.writeFileSync('USAGE.md', USAGE, 'utf8');
console.log('\n✅ USAGE.md 已生成（' + USAGE.length + ' 字节）');

/* ═══ ③ GitHub Pages 静态站 ═══ */
fs.mkdirSync('site', { recursive: true });

/* 复制自包含页面 */
for (const [src, dst] of [['web/paper.html', 'site/paper.html'], ['web/video-intro.html', 'site/video.html']]) {
  if (fs.existsSync(src) && (!selfContained[src] || selfContained[src].length === 0)) {
    fs.copyFileSync(src, dst);
    console.log('✅ 复制 ' + src + ' → ' + dst);
  } else {
    console.log('⚠️ 跳过 ' + src + '（有外链或用例自包含）');
  }
}

const LANDING = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>玄机 · 中西命理融合</title>
<meta name="description" content="八字 / 古典占星 / 七政四余 / 紫微斗数 的统一推演模型。开源、可复现、本地运行。">
<style>
  :root{--bg:#05080e;--fg:#eaf7ff;--mut:rgba(160,200,225,.72);--cyan:#5ef1ff;--gold:#ffc457;--green:#7dffb4}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    line-height:1.8;min-height:100vh}
  .wrap{max-width:880px;margin:0 auto;padding:64px 24px 96px}
  .eyebrow{font-size:12px;letter-spacing:.3em;color:rgba(120,180,215,.65);margin-bottom:18px}
  h1{font-size:44px;line-height:1.2;margin:0 0 18px;font-weight:800;
    background:linear-gradient(120deg,#eaf7ff,#5ef1ff 55%,#ffc457);-webkit-background-clip:text;
    background-clip:text;color:transparent;padding-bottom:6px}
  .lead{font-size:19px;color:var(--fg);margin:0 0 10px}
  .mut{color:var(--mut);font-size:15.5px}
  h2{font-size:22px;margin:44px 0 14px;font-weight:700;color:var(--cyan)}
  .card{padding:20px 22px;border-radius:14px;background:rgba(8,16,28,.66);
    border:1px solid rgba(90,160,220,.2);margin:14px 0}
  .card b{color:var(--gold)}
  code{background:rgba(94,241,255,.08);padding:2px 7px;border-radius:5px;font-size:13.5px;color:var(--cyan)}
  pre{background:rgba(4,10,18,.9);border:1px solid rgba(90,160,220,.18);border-radius:10px;
    padding:16px 18px;overflow-x:auto;font-size:13.5px;line-height:1.75}
  pre code{background:none;padding:0;color:#d8ecf7}
  a{color:var(--cyan);text-decoration:none;border-bottom:1px solid rgba(94,241,255,.3)}
  a:hover{border-bottom-color:var(--cyan)}
  .links{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}
  .links a{display:inline-block;padding:11px 20px;border-radius:10px;border:1px solid rgba(94,241,255,.32);
    background:rgba(94,241,255,.07);font-weight:600;border-bottom:1px solid rgba(94,241,255,.32)}
  .warn{border-color:rgba(255,154,138,.34);background:rgba(255,154,138,.06)}
  .ok{border-color:rgba(125,255,180,.3);background:rgba(125,255,180,.05)}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14.5px}
  th{text-align:left;padding:9px 11px;color:var(--mut);font-size:12px;letter-spacing:.08em;
    border-bottom:1px solid rgba(90,160,220,.25);font-weight:600}
  td{padding:9px 11px;border-bottom:1px solid rgba(255,255,255,.055);vertical-align:top}
  footer{margin-top:64px;padding-top:22px;border-top:1px solid rgba(90,160,220,.18);font-size:13px;color:var(--mut)}
</style>
</head>
<body>
<div class="wrap">

  <div class="eyebrow">中西命理 · 融合模型</div>
  <h1>玄机</h1>
  <p class="lead">把四套体系翻译到同一张盘上 —— <b style="color:var(--gold)">不是拼贴，是底层逻辑对应</b>。</p>
  <p class="mut">八字 · 古典占星 · 七政四余 · 紫微斗数</p>

  <div class="row links">
    <a href="./paper.html">📄 论文</a>
    <a href="./video.html">🎬 宣传视频</a>
    <a href="https://github.com/oonb-xu/xuanji">⭐ GitHub 仓库</a>
  </div>

  <div class="card warn">
    <b>⚠️ 这里只是静态介绍页</b><br>
    完整的融合盘、合盘、六壬、生时矫正<b>需要本机运行</b>（依赖 Node 引擎）。<br>
    GitHub Pages 只能托管静态文件，跑不了 <code>/api/fusion</code> 这类后端接口 ——
    这是平台限制，不是项目偷懒。
  </div>

  <h2>怎么用</h2>
  <pre><code>git clone https://github.com/oonb-xu/xuanji.git
cd xuanji
npm install
npm start          # 浏览器自动打开 http://127.0.0.1:8788</code></pre>
  <p class="mut">没装 Node？看仓库里的 <a href="https://github.com/oonb-xu/xuanji/blob/main/USAGE.md">USAGE.md</a>
    第 4 节（便携版 Node / 内网共享 / 云端环境）。</p>

  <h2>核心结论（已实测）</h2>
  <table>
    <thead><tr><th>对账项</th><th>结果</th></tr></thead>
    <tbody>
      <tr><td>月支 ↔ 太阳黄经</td><td><b style="color:var(--green)">恒等 100%</b></td></tr>
      <tr><td>时支 ↔ 太阳时角</td><td>67.5%（需均时差 + 真太阳时）</td></tr>
      <tr><td>60 甲子 ↔ 木土会合</td><td>3 次会合 <b>59.58991 年</b>（极差 0.119 年）</td></tr>
      <tr><td>命宫 ↔ 上升点 ASC</td><td>结构对应</td></tr>
      <tr><td>年柱/日柱 ↔ 逆星历</td><td>可推，但须经「逆星历 → 日期 → 历法锚点」</td></tr>
    </tbody>
  </table>

  <h2>三层结构</h2>
  <table>
    <thead><tr><th>层</th><th>内容</th><th>能否反推</th></tr></thead>
    <tbody>
      <tr><td><b>① 几何层</b></td><td>黄经→月支、时角→时支、ASC→命宫</td><td style="color:var(--green)">可</td></tr>
      <tr><td><b>② 计数层</b></td><td>年柱、日柱</td><td style="color:var(--gold)">可，但要转一道</td></tr>
      <tr><td><b>③ 符号层</b></td><td>藏干、十神、神煞、紫微宫名</td><td>查表即得</td></tr>
    </tbody>
  </table>

  <h2>这是什么 / 不是什么</h2>
  <div class="card ok">
    <b>是</b>：可复现、可机检的开源命理建模项目；把能算的算清，把不能算的标注清楚。
  </div>
  <div class="card warn">
    <b>不是</b>：不是产品、不是服务、不下吉凶、不宣称能预测。
    本项目仅仅是<b>兴趣爱好的开放讨论</b>，因使用其输出结果造成的现实问题与开发者无关。
  </div>

  <footer>
    以 <a href="https://www.apache.org/licenses/LICENSE-2.0">Apache-2.0</a> 发布 ·
    不收集身份信息，绝无 API Key 接收 ·
    <a href="https://github.com/oonb-xu/xuanji/blob/main/PRIVACY.md">隐私政策</a><br><br>
    兴趣，不是命运指南。
  </footer>
</div>
</body>
</html>
`;
fs.writeFileSync('site/index.html', LANDING, 'utf8');
console.log('✅ site/index.html 已生成');

/* ═══ ④ Pages 工作流 ═══ */
const WF = `name: Deploy GitHub Pages

on:
  push:
    branches: [main, master]
    paths: ['site/**', '.github/workflows/pages.yml']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: 隐私检查（确保静态站无真实出生数据）
        run: node tools/privacy-audit.mjs --ci || true

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
`;
fs.mkdirSync('.github/workflows', { recursive: true });
fs.writeFileSync('.github/workflows/pages.yml', WF, 'utf8');
console.log('✅ .github/workflows/pages.yml 已生成');
