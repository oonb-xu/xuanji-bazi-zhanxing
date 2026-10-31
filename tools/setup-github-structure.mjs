// 阶段 B：GitHub 标准开源结构
import fs from 'node:fs';

const write = (p, c, note) => {
  const dir = p.split('/').slice(0, -1).join('/');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
  console.log('✅ ' + p.padEnd(46) + note);
};

/* ══════════ README.md ══════════ */
write('README.md', `# 玄机 · 中西命理融合

> 把四套体系（八字 / 古典占星 / 七政四余 / 紫微斗数）翻译到同一张盘上 ——
> 不是拼贴，是**底层逻辑对应**。

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-39%20suites%20pass-brightgreen.svg)](#测试)

---

## 这是什么

一个**可投喂、可复现、可机检**的命理模型。它做三件事：

1. **对账** —— 把每个命理量标注它锚定在哪个物理量上（黄经 / 时角 / 计数 / 查表），能算的算，不能算的明确标"计数"，绝不假装差一点。
2. **分层** —— 几何层（可逆）、计数层（不可逆）、符号层（查表），各层不越界。
3. **融合** —— 以**七政四余为骨架做逆向复现**：它是四套里唯一保持「天体位置 → 宫次宿度 → 人事」全程可追溯的体系；其余三套各自切断了一环。

## 它不是什么

- ❌ **不下吉凶**：只呈现结构，结论留给你
- ❌ **不收集真实身份**：只收匿名出生信息，绝不收 API Key
- ❌ **不宣称能预测**：所有跨体系结论都标注置信度，非恒等类一律封顶 0.6
- ❌ **不是"更准的算命"**：这是一个建模与验证项目，不是产品承诺

---

## 核心结论（已实测，可复核）

| 对账项 | 结果 | 复核方式 |
|---|---|---|
| **月支 ↔ 太阳黄经** | **恒等 100%** | 节气就是黄经 30° 刻度 |
| **时支 ↔ 太阳时角** | **67.5%** | 需均时差 + 真太阳时，边界附近差一位 |
| **60 甲子 ↔ 木土会合** | 3 次会合 **59.58991 年**，极差 **0.119 年** | 实扫 1702–2298 年 31 次会合 |
| **命宫 ↔ 上升点 ASC** | 结构对应 | 命宫 = f(月支, 时支) ≈ ASC 的粗糙算法 |
| **年柱/日柱 ↔ 逆星历** | **可推，但要转一道** | 星位 → 绝对日期 → 历法锚点 → 干支 |

### 三层结构

| 层 | 内容 | 能否由星盘反推 |
|---|---|---|
| **① 几何层** | 黄经 → 月支、时角 → 时支、ASC → 命宫/身宫 | **可反推** |
| **② 计数层** | 年柱、日柱（含日主） | **可反推，但须经逆星历 + 历法锚点** |
| **③ 符号层** | 藏干、十神、神煞、紫微宫名 | **查表即得** |

> 所以「能不能用行星宫位反推八字」应拆成三问 —— 几何层能、计数层能但要转一道、符号层不用推。

---

## 快速开始

\`\`\`bash
# 1. 安装依赖（仅 5 个）
npm install

# 2. 启动（零依赖静态服务 + JSON API，端口 8788）
node server.mjs 8788 --open

# 3. 打开
#    http://127.0.0.1:8788
\`\`\`

无需数据库，无需构建步骤。前端是原生 HTML/CSS/JS + Canvas/SVG。

### 命令行

\`\`\`bash
npm run bazi      # 八字排盘
npm run natal     # 西方占星本命盘
npm run chart     # 融合盘
npm run rectify   # 生时矫正
npm test          # 39 套回归
\`\`\`

---

## 功能

| 模块 | 说明 |
|---|---|
| **融合盘 3D** | 真实星空背景 + 七柱 + 十二宫 + 行星；可拖拽/缩放 |
| **双环对照** | 外环地支+藏干（静态锚黄经）/ 内环宫位+紫微宫名（动态锚 ASC），ASC 为旋转接缝 |
| **合盘** | 互补度 + 星盘互涉 + 适婚窗口 + 15 类事件采集 |
| **大六壬** | 四课三传，古典课例对拍 95.1% |
| **时序** | 大运换运 / 木星土星换宫 / 次运月亮太阳换座 |
| **生时矫正** | 弹层式，事件驱动，±5 分钟收敛判据 |
| **API 配置** | 本机保存（localStorage），仅用于可选的 LLM 解读 |

所有环上的文字（地支/藏干/宫位/紫微宫名/行星）**都可点击查详情**。

---

## 目录结构

\`\`\`
meta-unified/
├── server.mjs              # 零依赖 HTTP 服务 + JSON API
├── package.json
├── LICENSE                 # Apache-2.0
├── src/                    # 引擎核心
│   ├── bazi/               # 八字：四柱/藏干/十神/大运/扶抑
│   ├── astro/              # 占星：星历/宫位/相位/尊贵
│   ├── cross/              # 跨体系：位置→七柱/双轴/映射
│   ├── liuren/             # 大六壬
│   ├── ziwei/              # 紫微适配器
│   └── kb/                 # 知识库与规则库
├── web/                    # 前端（原生，无框架）
│   ├── index.html          # 单页应用（9 个页面）
│   ├── paper.html          # 论文
│   ├── style.css
│   ├── app.js
│   ├── fusion3d.js         # 3D 融合盘
│   ├── dual-wheel.js       # 双环对照图
│   ├── fw-ring-overlay.js  # 融合盘外环层
│   └── dw-interact.js      # 点击查词
├── tools/                  # 构建/审计/诊断脚本
├── test/                   # 39 套回归
├── docs/                   # 设计与论证文档
├── data/                   # ⚠ 数据（真实样本与第三方集不入库，见 .gitignore）
└── .github/                # CI / Issue / PR 模板
\`\`\`

---

## 数据与隐私

**这是本项目最严肃的约束。**

| 原则 | 做法 |
|---|---|
| 只收匿名出生信息 | 不要求姓名、不用手机号/邮箱注册 |
| 绝不收 API Key | Key 只存你本机 localStorage，从不经服务端 |
| 真实样本不入库 | \`data/samples/\` 等目录已在 \`.gitignore\` 排除 |
| 入库示例是虚构的 | \`data/samples/_demo-synthetic.json\` 全部编造 |
| 第三方数据集不入库 | 韩式 Saju / VedAstro / 语料均本地持有，各自授权 |

详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

> ⚠️ **贡献数据前请读 [CONTRIBUTING.md](CONTRIBUTING.md) 的隐私条款** ——
> 训练单位是「**出生时间 + 事例**」，不含任何身份信息。

---

## 测试

\`\`\`bash
npm test
\`\`\`

39 套回归，覆盖：编码一致性 / 八字 / 摩擦引擎 / 星盘 / 六壬 / 生时矫正 /
拓扑 / 隔离 / 一致性 / DAG / 十神 / 星宫 / 做功 / 应期 / 实验性历法。

---

## 文档

| 文档 | 内容 |
|---|---|
| [docs/42-融合路径论文.md](docs/42-融合路径论文.md) | 主论文（含「七政四余逆向复现」方法论） |
| [docs/39-四系统统一.md](docs/39-四系统统一.md) | 四系统对照总表 |
| [docs/40-双轴模型.md](docs/40-双轴模型.md) | 心理轴 / 物质轴 |
| [data/SOURCES.md](data/SOURCES.md) | 数据来源逐条登记 |

站内「关于」页有完整可读版（含导航索引）。

---

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。欢迎：
- 🐛 报 Bug（附最小复现）
- 📊 贡献匿名样本（出生时间 + 事例）
- 📚 指出文献与史实错误
- 🔬 复核我们的"对账"数据

---

## 许可

[Apache License 2.0](LICENSE) —— 允许商用与闭源分发，须保留版权与许可声明。

---

## 免责声明

本项目用于**学术研究与技术验证**，不构成任何形式的预测、诊断或决策建议。
命理体系的有效性在科学上尚无定论；本项目旨在**把可说的说清楚、把不可说的标出来**，
不宣称任何超自然能力。使用者需自行承担据此做出判断的风险。
`, '主页');

/* ══════════ CONTRIBUTING.md ══════════ */
write('CONTRIBUTING.md', `# 贡献指南

感谢参与。本项目对"证据"的要求高于对"热情"的要求 —— 请先读下面三条。

## 一、三条铁律

1. **不下吉凶**：不要提交"某人会发财""这个盘必离"这类断言。
2. **不编数据**：没有来源就说没有。检索不到就登记为"未找到"（见 \`data/SOURCES.md\`）。
3. **不传隐私**：绝不提交任何真实姓名、手机号、身份证、邮箱、住址。

## 二、隐私条款（提交数据前必读）

训练单位是「**出生时间 + 事例**」，**不含任何身份信息**。

提交前请确认：

- [ ] 时间已脱敏（可保留年月日时，但**不要**附姓名/联系方式）
- [ ] 地点只到城市级（不要精确到门牌）
- [ ] 事例描述里**不含**可识别个人的细节（单位名、家庭住址、他人姓名）
- [ ] 已获得当事人同意，或数据为虚构合成

**禁止**提交：身份证、手机号、邮箱、社交账号、照片、真实姓名、精确住址。

维护者会在合并前做隐私复核；不合格的 PR 直接关闭，不解释。

## 三、开发流程

\`\`\`bash
git clone <repo>
cd meta-unified
npm install
node server.mjs 8788 --open   # 开发
npm test                      # 提交前必须全绿
\`\`\`

### 提交信息

采用 Conventional Commits：

\`\`\`
feat(bazi): 支持从格判定
fix(astro): 修正夏令时回退
docs(paper): 补充超辰论证
test(cross): 增加位置→七柱用例
\`\`\`

### Code Review 关注点

| 关注 | 说明 |
|---|---|
| 是否引入未论证的"对应" | 新映射必须有证据等级（恒等/结构/文献/经验/巧合） |
| 是否越界 | 符号层的结论不得冒充几何层证据 |
| 是否有测试 | 新增规则必须附回归用例 |
| 是否含隐私 | 见上 |

## 四、新增一条"对应"的门槛

任何 \`A ↔ B\` 的对应，必须给出：

1. **证据类型**（五类之一）与**置信度**（恒等 0.95 / 结构 0.6 / 文献 0.4 / 经验 0.2 / 巧合 0）
2. **可复现的检验**（脚本 + 数据，或明确的文献出处）
3. **反例检查**（至少说明为什么不是巧合）

非恒等类**一律封顶 0.6**，低于 0.30 直接丢弃。

## 五、报告问题

用 Issue 模板。Bug 请附：
- 最小复现（出生时间可换成虚构的等价盘）
- 期望 vs 实际
- \`node --version\` 与操作系统
`, '贡献指南');

/* ══════════ CODE_OF_CONDUCT.md ══════════ */
write('CODE_OF_CONDUCT.md', `# 行为准则

## 我们的承诺

为了营造开放、友好的环境，我们承诺：不论年龄、体型、残障、族裔、性别认同与表达、
经验水平、国籍、外貌、种族、宗教或性取向，参与本项目的每个人都**不受骚扰**。

## 期望行为

- 用**证据**说话，不用资历压人
- 批评**观点**，不批评**人**
- 承认自己可能错 —— 本项目已多次公开推翻自己此前的结论
- 尊重不同体系的传统与其从业者
- 对新手耐心：门槛高不是优越感的理由

## 不可接受的行为

- 人身攻击、侮辱、贬低（包括针对某个命理体系的群体性嘲讽）
- 性骚扰、性暗示
- 未经许可公开他人隐私信息
- 宣扬"某派唯一正确"并封杀异见
- 其他在专业场合明显不当的行为

## 执行

违规可向维护者举报。维护者有权删除、编辑或拒绝不符合本准则的评论、提交、代码与 Issue。

## 归属

本准则改编自 [Contributor Covenant](https://www.contributor-covenant.org) v2.1。
`, '行为准则');

/* ══════════ SECURITY.md ══════════ */
write('SECURITY.md', `# 安全策略

## 报告漏洞

**请勿公开提交安全 Issue。** 请通过 GitHub 的 Security Advisory（私有）或邮件联系维护者。
我们会在 48 小时内回应。

## 隐私设计（为什么本项目的"数据"风险较低）

| 设计 | 说明 |
|---|---|
| 无账号系统 | 不需要注册，不存密码 |
| API Key 只在本机 | 存 \`localStorage['xuanji-api-config']\`，**从不经服务端** |
| 出生信息不落库 | 服务端只在请求内计算，不持久化 |
| 采集需显式同意 | 样本提交必须带 \`consent\` 字段 |
| 真实样本不入库 | \`data/samples/\` 等在 \`.gitignore\` 排除 |

## 已知边界

- 本项目**不是**密码学工具，不要用它处理机密信息
- 若你部署到公网，请自行加上鉴权与 HTTPS（本项目默认只监听本机）
- 星历数据来自第三方库，其正确性不由本项目担保

## 支持的版本

仅最新主分支维护安全更新。
`, '安全策略');

/* ══════════ PRIVACY.md ══════════ */
write('PRIVACY.md', `# 隐私政策

## 一句话

**我们只收"匿名出生时间 + 事例"，不收任何身份信息，绝不收 API Key。**

## 收什么 / 不收什么

| 收（可选，需你主动勾选） | 不收（任何情况下） |
|---|---|
| 出生年月日时 | 真实姓名 |
| 性别 | 手机号 / 邮箱 |
| 出生城市与经纬度（城市级） | 身份证 / 护照号 |
| 人生事例（类型 + 年份） | 住址 / 工作单位 |
| 你填的 API 配置（**只存你本机**） | 照片 / 社交账号 |
| — | 你与模型的对话内容 |

## 数据流向

\`\`\`
你填写 → 浏览器内存 → （可选）POST /api/fusion → 服务端即时计算 → 返回结果 → 不落库
                                    ↓
                          只有你勾选「数据贡献」时才写入本地 data/samples/
\`\`\`

**默认不贡献。** 勾选后数据也只落在**你自己的机器**上（\`data/samples/\`），
该目录已在 \`.gitignore\` 中排除，**不会随代码上传到 GitHub**。

## 仓库里的示例数据

\`data/samples/_demo-synthetic.json\` 是**完全虚构**的合成样本，
出生时间、地点、经纬度、事件全部编造，不对应任何真实人物。

## 你的权利

- 随时删除本地 \`data/samples/\` 下的任何文件
- 随时清空浏览器 \`localStorage\` 中的 API 配置
- 无需申请、无需理由

## 儿童

本项目不面向 14 岁以下儿童，不主动收集其信息。

## 变更

本政策的重大变更会在 Release Notes 中说明。
`, '隐私政策');

/* ══════════ CHANGELOG.md ══════════ */
write('CHANGELOG.md', `# 更新日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增
- **融合路径论述重构**：以七政四余为骨架的「逆向复现」方法论（四步：坐标还原 → 截断点识别 → 按链重装 → 精进补正）
- **三层结构**：几何层 / 计数层 / 符号层，明确各层可推性
- **大周期精确模型**：实扫 1702–2298 年 31 次木土会合，3 次会合 59.58991 年（极差 0.119 年）、间隔自相关 r=0.992
- **融合盘双环**：外环地支+藏干（锚黄经）/ 内环宫位+紫微宫名（锚 ASC），ASC 为旋转接缝；全文字可点击
- **七柱分页**：四柱组 / 胎元命宫身宫组，绕环均分
- **发展论章节**：七政四余失传六因、融合四难、双方偏见、底层原因（未从天文数据核算）、发展四步
- **Apache-2.0 开源**：LICENSE 全文 + 关于页许可说明

### 修正
- **「年柱日柱原理上不可推」的错误表述** → 改为「可推，但须经逆星历 → 绝对日期 → 历法锚点」
- 行星标记与"领域"文字行同半径导致叠字

### 安全 / 隐私
- \`.gitignore\` 全面重写：真实样本、第三方数据集、构建产物、截图、备份、本机路径全部排除
- 移除 \`tools/shortcut-result.json\`（含本机用户名路径）
- \`tools/fetch-textures.mjs\` 写死的本机 Python 路径改为环境变量
- 新增虚构示例 \`data/samples/_demo-synthetic.json\`

## [0.4.0]
- 阶段一交付：融合盘 / 合盘 / 六壬 / 时序 / 生时矫正 / API 配置
`, '更新日志');

/* ══════════ .editorconfig ══════════ */
write('.editorconfig', `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.{ps1,cmd}]
end_of_line = crlf
`, '编辑器配置');

/* ══════════ .github/workflows/ci.yml ══════════ */
write('.github/workflows/ci.yml', `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    name: 回归测试 (Node \${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: ['18', '20', '22']
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}

      - name: 安装依赖
        run: npm install

      - name: 运行回归测试
        run: npm test

  privacy:
    name: 隐私审计
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 检查仓库中是否含真实出生数据 / 密钥 / 本机路径
        run: node tools/privacy-audit.mjs --ci
`, 'CI 工作流');

/* ══════════ Issue 模板 ══════════ */
write('.github/ISSUE_TEMPLATE/bug_report.yml', `name: 🐛 Bug 报告
description: 报告一个可复现的问题
title: "[Bug] "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        感谢报告！请**务必**用虚构的等价盘代替真实出生时间，避免隐私泄漏。
  - type: textarea
    id: what
    attributes:
      label: 现象
      description: 发生了什么？期望是什么？
      placeholder: 排盘后……期望……实际……
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: 最小复现
      description: 步骤或命令。出生时间请换成虚构的等价盘。
      placeholder: |
        1. 打开 / 页
        2. 输入 2000-01-01 12:00（虚构）
        3. 点「排盘」
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: 环境
      placeholder: Node 20.11 / Windows 11 / Chrome 120
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: 报错信息 / 截图
      description: 若有控制台报错请贴上（请先确认不含个人信息）
    validations:
      required: false
`, 'Issue 模板：Bug');

write('.github/ISSUE_TEMPLATE/feature_request.yml', `name: ✨ 功能建议
description: 提出一个新功能或改进
title: "[Feat] "
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: 要解决的问题
      description: 现在有什么不便？
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: 你的方案
    validations:
      required: true
  - type: dropdown
    id: layer
    attributes:
      label: 涉及哪一层？
      options:
        - 几何层（黄经/时角/ASC）
        - 计数层（年柱/日柱）
        - 符号层（藏干/十神/神煞/宫名）
        - 前端/交互
        - 文档
        - 不确定
    validations:
      required: true
`, 'Issue 模板：功能');

write('.github/ISSUE_TEMPLATE/data_correction.yml', `name: 📚 文献 / 数据纠错
description: 指出史实、文献或数据上的错误
title: "[Data] "
labels: ["data", "documentation"]
body:
  - type: textarea
    id: claim
    attributes:
      label: 我们错在哪
      description: 引用站内原文或文档位置
    validations:
      required: true
  - type: textarea
    id: source
    attributes:
      label: 正确的说法与出处
      description: 请给出可核对的文献/链接/页码
    validations:
      required: true
  - type: markdown
    attributes:
      value: |
        > 本项目对"编造来源"零容忍 —— 宁可写"未找到"，也不虚构出处。
`, 'Issue 模板：纠错');

/* ══════════ PR 模板 ══════════ */
write('.github/PULL_REQUEST_TEMPLATE.md', `## 这个 PR 做了什么

<!-- 一句话 -->

## 类型

- [ ] 🐛 Bug 修复
- [ ] ✨ 新功能
- [ ] 📚 文档
- [ ] 🔬 实验 / 数据
- [ ] 🔒 安全 / 隐私

## 自检清单

- [ ] \`npm test\` 全绿（39 套）
- [ ] 没有引入未论证的「对应」（若引入，已标注证据等级与置信度）
- [ ] 没有把符号层结论冒充几何层证据
- [ ] **隐私**：提交内容不含真实姓名/手机号/邮箱/身份证/精确住址
- [ ] **隐私**：示例数据为虚构，或已脱敏
- [ ] 没有提交 \`data/samples/\` 等已在 \`.gitignore\` 排除的真实数据
- [ ] 新增规则附带了回归用例

## 相关 Issue

Closes #
`, 'PR 模板');

console.log('\n全部文件已生成。');
