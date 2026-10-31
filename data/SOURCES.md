# 数据源登记表（本地知识库 · 只记查证过的事实）

> 纪律：**每个数据源都必须写清"查证到什么、能不能用、限制在哪"**。找不到就写"未找到"，绝不含糊过去。
> 本表由每轮接入时更新；条目按接入时间排列。

---

## 1 VedAstro · 15,807 盘（✅ 已接入，本地可用）

| 项 | 值 |
|---|---|
| 位置 | `data/vedastro/PersonList-15k.csv`（3.5 MB）+ `MarriageInfoDataset.csv`（5.3 MB） |
| 出处 | HuggingFace `vedastro-org/15000-Famous-People-Birth-Date-Location` / `…-Marriage-Divorce-Info` |
| 镜像 | **GitHub/HF 直连不通 → 走 `hf-mirror.com`**（API 元数据：`https://hf-mirror.com/api/datasets/<org>/<name>`） |
| 许可 | MIT（VedAstro 为非营利开源项目） |
| 内容 | 出生时刻 + **显式时差（已按 DST 校正）** + 经纬度；**Rodden 评级在 `Notes` 字段**（`{'rodden':'AA'}`） |
| **AA 级（出生证明）** | **15,790 / 15,807 = 99.9%** |
| 标签 | 真实婚姻记录：类型/配偶/**结婚年**/离婚年/结局/可信度 |
| 限制 | ① 是**吠陀（恒星黄道 Lahiri）**语境，本引擎星盘是热带；② 离婚标签基线 95% 无对比度；③ 人物多为欧美名人 |

## 2 Korean Public Figures with Saju · 39,494 人（✅ 已接入，本地可用）

| 项 | 值 |
|---|---|
| 位置 | `data/korean/persons.xlsx`（7.1 MB）+ `README.md` |
| 出处 | HuggingFace **`brandonrhie/korean-public-figures-saju`**（另有 `train.parquet`） |
| 镜像 | 同走上表镜像 |
| 内容 | 39,494 名韩国公众人物（政治/演艺/体育等），**日精度**出生日期 + 职业 + **已算好的三柱** |
| 已含列 | `year/month/day_stem+branch`、三柱的 `_element`（五行）、`_polarity`（阴阳）、`_animal`（生肖）、`occupations_raw`、`birth_place`、`in_track_a` |
| 来源 | Wikidata + 韩语维基，**用途即"实证检验四柱能否预测职业"** |
| **关键限制** | **只有日精度 → 无出生时刻 → 时柱不可用**。本引擎对三柱（年/月/日）可用，**时柱与大运一律不可算**；凡涉及时柱的规则在此数据集上**不得评估** |
| 价值 | ① 极佳的**职业类别**标签（数万级）；② 提供了第三方算好的三柱，可与本引擎**对拍排盘正确性**（可 100% 机检） |

## 3 Starlight Notable Database（❌ 未找到）

- 检索：GitHub `starlight` / `notable` / `astro-databank` 三个关键词、HuggingFace `starlight` / `notable` 数据集索引。
- 结果：HF `starlight` 命中 9 条（全是大模型与无关项目）；`notable` 命中 7 条（皮肤病变、欧洲名人名单等）；**`astro-databank` 命中 0 条**。
- **结论：按此名不存在可下载的数据集。** 如你有确切链接/论文出处，给我即可接入。
- 替代：**Astro-Databank 的实际内容已通过 VedAstro 的 AA 子集（15,790 条）落地**，无需再爬 astro.com 的 wiki。

## 4 classical-ai-astrology（⚠️ 仓库存在，但"规则库"未入库）

| 项 | 值 |
|---|---|
| 仓库 | [`zenohouse/classical-ai-astrology`](https://github.com/zenohouse/classical-ai-astrology)（⭐1） |
| 自述 | "database-first framework for classical astrology … Swiss Ephemeris + **local SQLite rulesets** + LLM synthesis" |
| **实际内容** | **仅 5 个文件**：`README.md` + `src/{batch_extract_gemini,ephemeris_reader,find_election,orchestrator}.py`（最大 9.7 KB） |
| **结论** | **声称的 SQLite 规则集并未提交到仓库** → 无可导入的规则数据。可作为"数据库优先 + 消除幻觉"的**架构参考**，但不是可用数据源 |
| 可借鉴点 | ① 用 `swisseph` 保底精度；② 规则落本地 SQLite 而非写在 prompt 里；③ 择日（election）模块 `find_election.py` |

## 5 璇玑玉衡 / Loom of Heaven（❌ 未找到）

- 检索：GitHub `璇玑玉衡`、`Loom of Heaven`、`loom-of-heaven`、`xuanji`、`xuanjitu`。
- 结果：全部为无关项目（A 股量化、璇玑图回文诗、AI 网关、珠宝、AI 指令集、动态壁纸）。
- **结论：按此名不存在可下载的占星/术数项目。** 若它是私有项目或另有仓库名，给我准确名称即可接入。

## 6 `dglijin-oss/linren-skill`（❌ 不存在）

- GitHub API `/repos/dglijin-oss/linren-skill` → **404**；组织 `/orgs/dglijin-oss` → **404**。
- **结论：仓库与组织都不存在。** 六壬技能暂用本项目自研的 `unified-divination-model` 技能承载。

## 8 ★ 人类精标成对样本（用户直接提供，✅ 通道已就绪）

| 项 | 值 |
|---|---|
| 投放目录 | `data/samples/paired/PAIR-00XX.json` |
| 模板 | `data/samples/paired-template.schema.json`（JSON Schema 2020-12） |
| 示例 | `data/samples/paired-example.json`（已过校验） |
| 校验/对齐 | `node cli-paired.mjs --check` / `--align` / `--couple PAIR-0001 PAIR-0002` |
| 三大要素 | ① 精确出生坐标（含 **lon/lat**）② 占问时刻与事项 ③ 真实反馈（含应期） |
| 强制约束 | `status` 锁 `hypothesis_under_validation`；`confidenceCap` 锁 `0.6`；**应验必须给应期**；**尚未发生必须为 null** |
| 首期目标 | **30 条**（用户指令） |

**已知首要样本（待用户补齐字段）**：

| 编号 | 状态 | 已有 | 缺 |
|---|---|---|---|
| （样本1） | ⏳ 部分提供 | 四柱 `丁亥 壬子 癸巳 庚申`（**机检自洽 ✅**）；事件：15 岁情感重创、18 岁遇某女命；category 终身格局 | 公历日期、精确到分的时刻、**出生地经纬度**、时差；反馈的应期 |
| （样本2） | ❌ 未提供 | — | 全部字段 |

**★ 样本1 四柱反查结果**：候选公历年份 1947 / 2007 / 2067；四柱全匹配的候选日期 **2007-12-25（申时 16:00–18:00）** ——
与本项目既有 **案例001（2007-12-25 17:30 某市）** 完全一致，**待用户确认是否同一人**（是则直接复用案例001 的精确数据）。

| 项 | 值 |
|---|---|
| 位置 | `data/liuren/{元,亨,利,贞}.md`（原文 232 KB）＋ `data/liuren/cases.jsonl`（结构化 65 例） |
| 出处 | [`look-fate/lookfate-book`](https://github.com/look-fate/lookfate-book) `content/卜/大六壬断案/` —— 即 book.taiyi.me 的书库 |
| **下载路径** | **`api.github.com` contents 接口（base64）** —— 直连 404（VitePress SPA）、jsDelivr 不稳、ghfast 不通 |
| 内容 | **217 套完整课例 / 220 则占断**（文献自述）；每例含 **占时+月将+四课+三传+断语+真实应验** |
| 地位 | 历代公认「**壬学第一案例经典**」（邵彦和毕生实测占验汇编） |
| 本轮解析 | **65 例**（含锚定三传 **41** 例，含断语 65 例）；**覆盖率 65/217，未解析的不算数**（R-L2） |
| 对拍关键 | 原文已给 **(日干支, 月将, 占时)** → 三传可**逐例机检**，**不需要年份**（R-L1） |
| 状态 | ⏳ 引擎侧待接：需把 `src/daliuren.mjs` 第四/五步暴露为「由 (日干支,月将,占时) 直接调用」 |

---

## 接入顺序（按"可用性 × 价值"排）

| 优先 | 数据源 | 用途 | 状态 |
|---|---|---|---|
| 1 | VedAstro AA 15,790 | 应期排序（真实日期 + 出生证明级生时） | ✅ 已跑，八字侧 Top-10 = 2.8× 随机 |
| 2 | Korean Saju 39,494 | ① 三柱对拍排盘正确性；② 职业类别预测 | ✅ 已下载，待接入 |
| 3 | Astro-Databank 原始 wiki | 补非名人/更多事件类别 | ❌ 未爬（AA 子集已覆盖主要需求） |
| 4 | classical-ai-astrology | 架构参考（本地 SQLite 规则集） | ⚠️ 无数据可导 |
| 5 | Starlight Notable DB / 璇玑玉衡 | — | ❌ 未找到 |
