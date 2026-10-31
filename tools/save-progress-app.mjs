// 保存项目：把「阶段一·App 端」的完整状态追加进 PROGRESS.md（断点续传入口）
import fs from 'node:fs';

const P = 'PROGRESS.md';
let s = fs.readFileSync(P, 'utf8');
if (s.includes('## 8 阶段一·App 端（玄机）')) { console.log('App 章节已存在，跳过'); process.exit(0); }

const SECTION = `

---

## 8 阶段一·App 端（玄机）— 2026-10-22 交付

> 一句话：把前面所有引擎包成一个本地 Web App，**零依赖、无构建、不编造、可部署**。

### 8.1 启动

\`\`\`powershell
cd meta-unified
node server.mjs            # 默认 8788
# 打开 http://127.0.0.1:8788
\`\`\`

停服务（**必须按 PID 杀 node**，Stop-Job 只杀 pwsh 外壳）：
\`\`\`powershell
Get-NetTCPConnection -LocalPort 8788 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
\`\`\`

### 8.2 文件

| 文件 | 作用 |
|---|---|
| \`server.mjs\` | 零依赖 node:http，**9 个 API** + 静态服务 |
| \`web/index.html\` | 6 页外壳 + 表单 |
| \`web/style.css\` | 深色主题、双列布局、藏气/总览样式 |
| \`web/app.js\` | 全部前端逻辑 + SVG 星盘轮 + 藏气渲染 + 合计总览 |
| \`web/cities.js\` | **48 个城市**经纬度（真太阳时换算用） |
| \`src/app/collect-endpoints.mjs\` | 生时矫正 + 采集质量分级（A/B/C/X） |
| \`tools/make-dist.mjs\` | 构建可部署包 + **强制隐私校验** |
| \`tools/verify-no-codes.mjs\` | 机检：**服务端不得返回项目编号** |
| \`docs/APP.md\` | App 文档（启动/API/限制） |

### 8.3 六个页面

| 页 | 内容 |
|---|---|
| **融合** | 八字全息（四柱含**地支藏气+十神**、气势四维、用忌、十神克泄、寒暖库、大运、命宫身宫胎元）+ 星盘（SVG 轮盘含宫位数字、四轴、行星、相位三色线）+ 融合对照 |
| **合盘** | **综合结构契合度百分比** + 三路分项（互补度/星盘/适婚窗口）+ M/z 白话解释 + 否决判定 |
| **六壬** | 天地盘、四课、贵人、天将、三传 |
| **矫正** | 生时矫正窗口（≥3 条带年份事件 → 反推时刻） |
| **反馈** | 盘 + 结局采集，**分级照收**（A/B/C/X），逐条误差告知 |
| **关于** | 全白话：这是什么 / 怎么用 / 出生时间最要紧 / 哪些能信 / 隐私 |

### 8.4 九个 API

\`GET /api/health\`｜\`GET /api/contrib-stats\`
\`POST /api/bazi\`｜\`/api/natal\`｜\`/api/fusion\`｜\`/api/synastry\`｜\`/api/liuren\`
\`POST /api/timecheck\`（时间风险自检）｜\`/api/rectify\`（生时矫正）｜\`/api/contribute\`（分级采集）

### 8.5 本轮新增的四条硬规则

| 规则 | 内容 |
|---|---|
| **真太阳时（R-G2 落地）** | \`at\` 默认视为**民用时**，自动换算后再排盘；返回 \`clock{civilInput,baziInput,offsetMinutes}\` —— **不静默改时间**。实测：成都 17:30 → 16:21，**时柱 乙酉→甲申** |
| **服务端禁出现项目编号** | 返回 JSON **一律不得**含 \`R-G2/R-G8/R-G16/R-G17/R-B14\`、\`基线 v2.7\`、\`hypothesis_under_validation\`。机检 \`tools/verify-no-codes.mjs\`（9 接口全干净才过） |
| **采集分级照收** | A（1.0）/B（0.6）/C（0.3·0.2）/X（0，四柱非法才拒）。**不拒收，只告知误差**，校准按权重降权 |
| **隐私** | 运行时代码零真实生辰；\`make-dist\` 打包后**强制校验**，命中即 exit 2。**上云只传 \`dist/\`** |

### 8.6 已知限制（必须随包说明）

| # | 限制 |
|---|---|
| 1 | **凯龙星未接入**（\`attachChiron\` 结果不在 \`chart.planets\`，前端如实显示「不可用」） |
| 2 | 合盘 M 的 CDF 用逻辑斯蒂近似，与 CLI 版差约 0.001 |
| 3 | 无鉴权、只监听 127.0.0.1（本地工具） |
| 4 | 四轴未在轮盘上画十字（只在下方卡里给数值） |
| 5 | **权重 0.50/0.25/0.25 与适婚窗口阈值均为先验，未经真实结局校准** |

### 8.7 验证记录（2026-10-22）

| 项 | 结果 |
|---|---|
| \`npm test\` | **29 套全绿** |
| 9 个 API | 全部返回正常，**全部无项目编号** |
| 最合盘实测 | 综合 **57.8%**（互补 62.4 / 星盘 26.2 / 适婚窗 85.3） |
| 藏气十神校验 | 戊土日主：申→庚食神/壬偏财/戊比肩；辰→戊比肩/乙正官/癸正财；午→丁正印/己劫财 **全对** |
| 六壬月将 | 2026-10-22 → 月将**辰**（秋分后霜降前，正确） |
| 部署包 | \`dist/\` 32 文件，**隐私校验通过** |
| 三轮实机截图 | 融合 / 合盘 / 六壬 / 矫正 / 反馈 / 关于 全部验证 |

### 8.8 下一步（唯一升级路径）

**采集「盘 + 结局」成对样本**（反馈页已就位，分 A/B/C 三级）。
没有它，权重与阈值永远只能是先验——这是本项目从第一天起就标注的限制。
`;

// 追加到文件末尾
s = s.replace(/\s*$/, '\n') + SECTION;
fs.writeFileSync(P, s, 'utf8');
console.log('PROGRESS.md 已追加「阶段一·App 端」章节（' + SECTION.split('\n').length + ' 行）');
console.log('当前总行数:', s.split('\n').length);
