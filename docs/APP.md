# 玄机 · 中西命理融合 App

本地 Web App。零依赖（只用 Node 内置模块），无构建步骤，无 npm 包。
所有数值来自 `meta-unified` 既有引擎的**可复算输出**，不是话术生成。

## 启动

```powershell
cd C:\Users\yk610\Documents\deepseek-harness\default-workspace\meta-unified
node server.mjs            # 默认 8788
node server.mjs 9000       # 指定端口
```

打开 <http://127.0.0.1:8788>

**停服务**：在任务管理器结束 node，或
```powershell
Get-NetTCPConnection -LocalPort 8788 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
> ⚠️ 用 `Start-Job` 起服务时 `Stop-Job` **只杀 pwsh 外壳，node 子进程仍在**——端口会一直占用。
> 必须按 PID 杀 node（上面这行），否则重启报 `EADDRINUSE`。

## 三个功能页

| 页 | 作用 | 用到哪些引擎 |
|---|---|---|
| **融合** | 同一个人：八字全息 + 占星盘并列 | `compileBazi` / `profileOf` / `structuralVerdict` / `controlAnalysis` / `hanNuan` / `kuGong` / `dayunSupplement` / `computeNatal` / `aspectTopology` |
| **合盘** | 两人：互补度 + 星盘结构 + 适婚窗口 + M 值 | `complementarity` / `couplingOf` / `dayunAlignment`（含 R-G17 适婚窗口） |
| **六壬** | 断事：三传四课 | `compile`（src/daliuren.mjs） |

## API

| 方法 | 路径 | 入参 | 说明 |
|---|---|---|---|
| GET | `/api/health` | — | 服务状态 + 路由表 |
| POST | `/api/bazi` | `{at}` 或 `{pillars:[4]}`, `gender` | 四柱/强弱/用忌/气势四维/十神/制化/寒暖/库/大运/命宫身宫胎元/五行分布 |
| POST | `/api/natal` | `{at,lng,lat,tz}` | 行星/相位/四轴/宫头/相位拓扑 |
| POST | `/api/fusion` | `{at,lng,lat,tz,gender}` | 八字 + 星盘 + 融合对照 |
| POST | `/api/synastry` | `{a:{...},b:{...}}` | 双向供给/互补度/星盘耦合/适婚窗口/veto/M |
| POST | `/api/liuren` | `{at,matter}` | 天地盘/四课/贵人/天将/三传 |

示例：
```powershell
curl.exe -s -X POST http://127.0.0.1:8788/api/synastry -H "content-type: application/json" -d '{\"a\":{\"at\":\"【已脱敏】\",\"lng\":116.407,\"lat\":39.904,\"gender\":\"男\"},\"b\":{\"at\":\"2008-07-04 16:45\",\"lng\":121.474,\"lat\":31.230,\"gender\":\"女\"}}'
```

## 可视化

- **星盘轮**：纯 SVG，330×330。黄道十二宫刻度、宫位数字（1–12）、行星落点+逆行标记 R、ASC/MC/DSC 标记、相位连线（红=对冲/四分、绿=三分、蓝=六分）。
- **五行条**：八字侧五行分布横向条，按五行着色。
- **四柱卡**：天干/地支分别按五行着色。
- 四轴卡：上升/天顶/下降/天底 + ASC/MC/RAMC 原始黄经。

## 铁律（代码里已落实）

1. **不编造**：接口返回 null 时，前端显示「不可用」+ 原因，**不填假值**。目前「凯龙」走这条路径。
2. **四轴降级**：合盘的星盘耦合**剔除四轴/交点边**（R-G8：±3 分钟可能换座）。
3. **话术纪律**：合盘 M 标注为「结构描述」，未经真实结局校准（R-G16）。
4. **口径并列不合并**：融合页把「八字五元素（木火土金水）」与「星盘四元素（火土风水）」**并列展示**，明确写出两者标度不同、不做加权合成。

## ⚠️ 已知限制（必须知道）

| # | 限制 | 影响 |
|---|---|---|
| 1 | **八字输入的是民用时，未做真太阳时换算** | 违反项目 R-G2 铁律。同一时刻民用 17:30 得「辛酉」时柱，换算真太阳时 16:26 得「庚申」——**时柱会变**。当前用于演示可以，**正式排盘必须换算**。 |
| 2 | **凯龙星未接入** | `attachChiron` 的结果不落在 `chart.planets` 上，服务端读到 null，前端如实显示「不可用」。 |
| 3 | **合盘基线与 M 的 CDF 是近似** | `pctApprox` 用 logistic 代替真实人群分布 CDF，导致 M 与 CLI 版差约 0.001（0.841 vs 0.840）。要精确需把 128 对的分位表内置。 |
| 4 | **无鉴权、只监听 127.0.0.1** | 本地工具，不对外网暴露。 |
| 5 | **占星四轴未在轮盘上画十字** | 只在下方「四轴·角度」卡里给数值。 |

## 验证记录（2026-10-22）

| 项 | 结果 |
|---|---|
| `/api/health` | OK |
| `/api/bazi` | OK，15 个字段 |
| `/api/natal` | OK，16 行星 / 38 相位 / 12 轮盘点 / 12 宫头 |
| `/api/fusion` | OK，14 个区块 / 16 KPI / 23 五行条 |
| `/api/synastry` | OK，M=0.841，veto=normal，核心窗 53.8%，互补 3.481 |
| `/api/liuren` | OK，四柱 丙午 戊戌 己巳 辛未，月将 辰（10/22 在秋分后霜降前，正确） |
| 前端渲染 | 三页均实机截图验证通过 |

## 文件

```
server.mjs        API 服务（零依赖）
web/index.html    4 页外壳 + 表单
web/style.css     深色主题
web/app.js        全部前端逻辑 + SVG 星盘轮（45KB）
```
