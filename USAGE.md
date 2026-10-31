# 使用手册

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

```bash
git clone https://github.com/YOUR_NAME/xuanji.git
cd xuanji
npm install
npm start
```

浏览器自动打开 `http://127.0.0.1:8788`。**就这样，没有第三步。**

不想开网页？用命令行：

```bash
node bin/xuanji.mjs bazi --at "2000-01-01 12:00" --gender 女
```

---

## 2. 两种跑法

| 方式 | 命令 | 适合 | 需要 Node |
|---|---|---|---|
| **本地 Web**（推荐） | `npm start` | 看盘、交互、拖拽缩放、点击查词 | ✅ |
| **命令行** | `node bin/xuanji.mjs <命令>` | 批量、脚本、导出 JSON/Markdown | ✅ |
| **静态站**（只读） | GitHub Pages | 看论文/视频/术语表 | ❌ |

**核心计算全在你本机跑**，不上传任何数据。

---

## 3. ⚠️ 关于"直接放 GitHub 上跑"

很多人会想：备案太麻烦，那把它整个放 GitHub Pages 不就行了？

**不行。** 原因很具体：

| GitHub Pages 能做什么 | 不能做什么 |
|---|---|
| 托管**静态文件**（HTML/CSS/JS/图片） | 执行 **Node 进程** |
| 提供 HTTPS 与免费域名 | 提供 `/api/fusion` 这类**后端接口** |
| 全球 CDN | 读取你本机的星历文件、写本地样本 |

本项目的融合盘、合盘、六壬、生时矫正**都依赖服务端计算**（`server.mjs` + `src/`）。
把这些硬塞到纯静态托管上，等于要把整个 Node 引擎重写成浏览器端 WASM —— 
技术上可能，但**工程量巨大且没必要**，因为：

> **这是一个工具，不是一个网站。**
> 工具的正确用法是**装在自己机器上跑**。

所以本项目的定位是：

- ✅ **本地工具**（`npm start` 或 CLI）—— 完整功能
- ✅ **GitHub Pages 静态站** —— 只放**文档、论文、宣传视频、术语表**（不需要后端）
- ❌ **在线 SaaS** —— 不做，也不需要（省掉备案、服务器、以及"数据在别人手里"的风险）

---

## 4. 不装 Node 怎么办

三个办法，按推荐顺序：

### 办法 A：用便携版 Node（不污染系统）

1. 到 [nodejs.org](https://nodejs.org) 下载 **Windows Binary (.zip)** 或 macOS/Linux 的 tar.gz
2. 解压到任意目录（如 `D:\node`）
3. 在该目录下开终端，把 `node` 加进 PATH 或直接用全路径：

```bash
D:\node\node.exe server.mjs 8788 --open
```

### 办法 B：让有 Node 的朋友跑

项目是零数据库、单机运行的，**一个人跑起来，局域网内其他人也能访问**：

```bash
# 服务端（有 Node 的人）
node server.mjs 8788 --host 0.0.0.0

# 其他人浏览器打开
http://<那个人的内网IP>:8788
```

> ⚠️ 仅限**可信局域网**。暴露到公网前请读 [§9](#9-部署到网上不备案的可行路径)。

### 办法 C：在线环境（临时试用）

GitHub Codespaces / Gitpod 这类云端 Linux 环境可以：

```bash
npm install
node server.mjs 8788 --host 0.0.0.0
```

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
| 网络 | **仅首次 `npm install` 需要**；之后完全离线可用 |

查版本：

```bash
node -v      # 应 ≥ v18
npm -v
```

---

## 6. 安装

### 方式一：Git（推荐，可更新）

```bash
git clone https://github.com/YOUR_NAME/xuanji.git
cd xuanji
npm install
npm start
```

### 方式二：下载 ZIP

1. 仓库页 → **Code** → **Download ZIP**
2. 解压，进入目录
3. `npm install` → `npm start`

### 方式三：全局命令（进阶）

```bash
npm install -g .
xuanji serve --open        # 之后在任何目录都能用
xuanji bazi --at "2000-01-01 12:00"
```

---

## 7. CLI 命令表

统一入口：`node bin/xuanji.mjs <命令>`（全局安装后可直接 `xuanji <命令>`）

### 常用

| 命令 | 说明 | 示例 |
|---|---|---|
| `serve` | 启动本地 Web | `xuanji serve --port 8788 --open` |
| `bazi` | 八字排盘 | `xuanji bazi --at "2000-01-01 12:00" --gender 女` |
| `natal` | 西方星盘 | `xuanji natal --at "2000-01-01 12:00" --lng 116.4 --lat 39.9 --tz 8` |
| `liuren` | 大六壬起课 | `xuanji liuren --at "2026-01-01 10:30" --matter "问工作"` |
| `rectify` | 生时矫正 | `xuanji rectify --at "..."` |
| `sample` | 采集样本 | `xuanji sample --add data/samples/xx.json` |

### 维护

| 命令 | 说明 |
|---|---|
| `doctor` | 环境体检（Node 版本 / 依赖 / 数据目录） |
| `test` | 跑全部回归（39 套） |
| `help` | 查看帮助 |

### 研究用（需要外部数据集）

`kery`（kerykeion 后端）· `dual`（双体系）· `eventfit`（应期拟合）· 
`anchors`（古籍年号校准）· `cases`（六壬课例）

> 这些命令需要 `data/` 下的数据集，而**数据集不进仓库**（隐私 + 授权），
> 所以下载后跑不起来是正常的 —— 见 [data/SOURCES.md](data/SOURCES.md)。

---

## 8. 常见场景

### 排一个八字

```bash
xuanji bazi --at "2000-01-01 12:00" --gender 女
```

输出是 Markdown，可直接重定向：

```bash
xuanji bazi --at "2000-01-01 12:00" > 我的八字.md
```

### 出星盘（需要经纬度）

不知道经纬度？查城市坐标：

```bash
# 北京 116.4074 / 39.9042
xuanji natal --at "2000-01-01 12:00" --lng 116.4074 --lat 39.9042 --tz 8
```

站内「排盘」页有 **48 城市**下拉，自动填经纬度。

### 起一课大六壬

```bash
xuanji liuren --at "2026-01-01 10:30" --matter "这个项目能否推进"
```

### 批量跑

CLI 输出是纯文本，配合 shell 循环即可：

```bash
# macOS / Linux
for d in "2000-01-01 12:00" "1990-05-20 14:30"; do
  xuanji bazi --at "$d" > "out-${d// /_}.md"
done
```

```powershell
# Windows PowerShell
foreach ($d in @("2000-01-01 12:00","1990-05-20 14:30")) {
  node bin/xuanji.mjs bazi --at $d > ("out-" + $d.Replace(" ","_") + ".md")
}
```

### 只想要一张图

`npm start` 打开网页 → 「融合」页 → 填时间 → 「排盘」→ 
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
- 想公开分享**论文与视频** → **GitHub Pages**（本仓库带 `.github/workflows/pages.yml`，推送即部署）
- 想公开提供**在线算盘** → 前面几条都有各自的坑，**请先想清楚"别人的出生数据存你服务器上"的责任**

> 本项目**不提供**官方在线服务，也不打算提供。

---

## 10. 故障排查

### 打不开 `http://127.0.0.1:8788`

```bash
# 1. 端口被占用？
node server.mjs 8799

# 2. 先体检
node bin/xuanji.mjs doctor

# 3. 看服务端有没有报错
node server.mjs 8788
```

### 排盘后一片空白

1. 按 `F12` 看 Console 报错
2. 确认 `npm install` 成功（`node_modules/astronomy-engine` 存在）
3. 硬刷新 `Ctrl+Shift+R`

### `npm install` 卡住 / 失败

用国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

### 页面能开但计算报错

多半是数据文件缺失（`data/` 下的第三方数据集不进仓库）。看 `data/SOURCES.md` 了解各自来源与许可。

### Windows 上中文乱码

PowerShell 5.1 用 GBK 读文件会乱码，**不是文件坏了**。用 PowerShell 7 或 Git Bash。

---

## 11. 数据与隐私

- **不收集身份信息**，**绝不接收 API Key**（Key 只存你浏览器 localStorage）
- 出生信息只在**你的设备**与**本机服务**之间流转
- 样本默认**不贡献**；勾选后也只写在你本机的 `data/samples/`
- `data/samples/` 等已在 `.gitignore` 排除，**不会随代码上传**
- 详见 [PRIVACY.md](PRIVACY.md)

---

## 12. 更新与卸载

### 更新

```bash
git pull
npm install        # 依赖有变化时
npm start
```

### 卸载

```bash
# 全局安装的
npm uninstall -g xuanji-meta-unified

# 本地目录直接删
cd .. && rm -rf xuanji
```

---

## 附：目录速查

| 想改什么 | 去哪里 |
|---|---|
| 排盘算法 | `src/bazi/`、`src/western/` |
| 跨体系映射 | `src/cross/` |
| 前端页面 | `web/index.html` + `web/app.js` |
| 3D 融合盘 | `web/fusion3d.js` |
| 双环对照图 | `web/dual-wheel.js` |
| 服务端接口 | `server.mjs` |
| 回归测试 | `test/` |
| 论文与论证 | `docs/` |

---

**遇到文档没覆盖的问题？** 开个 Issue（模板已配好），附上：
`node bin/xuanji.mjs doctor` 的输出 + 最小复现步骤。
