# GitHub Pages 静态站

本目录只放**不需要后端**的内容：论文、宣传视频、项目介绍页。

## 为什么功能不在这里

完整功能（融合盘 / 合盘 / 六壬 / 生时矫正）依赖 `server.mjs` + `src/` 的 Node 引擎，
**GitHub Pages 无法执行后端进程**。要跑完整功能请在本机：

```bash
npm install && npm start
```

## 部署

推送到 `main` 分支即自动部署（见 `.github/workflows/pages.yml`）。
启用方式：仓库 Settings → Pages → Source 选 **GitHub Actions**。
