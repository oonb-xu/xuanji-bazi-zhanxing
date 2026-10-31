# 西方星盘双后端 · kerykeion 接入 · 规则冻结表 v1.0

实施：2026-10-08。落地文件：`py/kerykeion_chart.py`（桥接+兼容层）、`cli-kerykeion.mjs`（后端 CLI）、
`test/verify-kerykeion.mjs`（交叉验证）、`.venv/`（隔离环境）。

---

## 1 接入方式

```bash
# 一次性
python -m venv .venv
.venv/Scripts/python -m pip install kerykeion -i https://pypi.tuna.tsinghua.edu.cn/simple

# 用 kerykeion 出盘并跑本引擎 Part5/6/8
node cli-kerykeion.mjs --at "【已脱敏】" --lng 104.06 --lat 30.67 --tz Asia/Shanghai --name 案例001
node cli-kerykeion.mjs --at … --pillars "丁亥 壬子 癸巳 庚申" --report out.md --json out.json

# 双后端对拍
npm run test:astro
```

版本：**kerykeion 6.0.5**（Python 3.12.14，隔离在 `meta-unified/.venv`）。

### 三个必踩的坑（本机实测）

| 坑 | 现象 | 处置 |
|---|---|---|
| **libephemeris 数据目录** | 默认 `~/.libephemeris`，本机创建被拒 → `PermissionError [WinError 5]`，星体计算直接失败 | 设 `LIBEPHEMERIS_DATA_DIR` 指向工程内 `.ephemeris/`（桥接脚本自动兜底） |
| **Python 子进程不能写系统 `%TEMP%`** | 临时 JSON 落 `%TEMP%` → `PermissionError 13` | 临时产物一律落工程内 `.tmp/` |
| **API 断代** | `from kerykeion import AstrologicalSubject` → `ImportError: removed in v6` | v6 用 `AstrologicalSubjectFactory.from_birth_data(...)`；本桥接另提供 **v4 调用约定的兼容壳** `AstrologicalSubject(...)`，旧写法原样可用 |

补充：v6 默认 `active_points` 含 Chiron/Mean_Lilith 等，而本机 LEB 未收录 Chiron（SE body 15）→
退化为 Keplerian 近似并刷 WARNING。桥接默认**只激活双方都有的点**（10 行星 + 四轴 + 平交点），
需要时用 `active_points` 参数放开。

---

## 2 桥接产出的 schema（与本引擎一致，可直接喂 Part5/6/8）

```json
{ "planets": { "太阳": {"sign":"摩羯","house":7,"deg":3.2,"lon":273.198,"retro":false}, "…": {}, "上升":{}, "天顶":{}, "下降":{}, "天底":{}, "北交点":{}, "南交点":{} },
  "aspects": [ {"a":"火星","b":"冥王星","type":"对冲","orb":1.2} ],
  "angles": {"asc":85.339,"mc":338.45}, "cusps": [12 个宫头],
  "meta": {"utc":"…","julianDay":…,"housesSystem":"Placidus","housesSystemId":"P","zodiacType":"Tropical","ephemerisWarnings":[]},
  "skippedAspectBodies": {"chiron": 3} }
```

相位取自 kerykeion 自己的 `AspectsFactory`（**独立于本引擎的相位实现**，才构成对拍意义）；
端点做**严格白名单**：只有两边都认识的天体才进 `aspects`，其余计入 `skippedAspectBodies`。

---

## 3 交叉验证结果（`npm run test:astro`，RESULT: PASS）

| 案例 | UTC 一致性 | 星体黄经最大 Δ | 上升 Δ | 天顶 Δ | 硬相位覆盖 |
|---|---|---|---|---|---|
| 案例001（【已脱敏】 某市） | ✓ 09:30 | **0.0050°** | 0.0010° | 0.0010° | 7/7 = **100%** |
| 1990上海（含夏令时） | ✓ 05:30 | **0.0010°** | 0.0020° | 0.0030° | 14/14 = **100%** |
| 新月（2024-01-11） | ✓ 11:57 | **0.0030°** | 0.0000° | 0.0040° | 8/8 = **100%** |

- 星体黄经：kerykeion（Swiss Ephemeris 血统 / libephemeris）vs 本引擎（astronomy-engine）——**量级 0.001–0.005°**。
- 四轴：本引擎的上升/天顶球面公式与 kerykeion **完全对齐**（0.000–0.004°）。
- 宫位：**四轴相同，宫内不同**——kerykeion 默认 Placidus，本引擎默认 porphyry，这是**设计差异不是错误**；
  本引擎在 `porphyry/equal/whole` 下 1 宫头 / 10 宫头都与 kerykeion 逐位吻合。

---

## 4 被 kerykeion 逼出的两个本引擎缺陷（已修）

| 编号 | 缺陷 | 症状 | 修正 |
|---|---|---|---|
| **R-W7** | `computeNatal` 只认 `o.lon`，传 `o.lng`（kerykeion 的命名习惯）时**静默回退到默认北京经度** 116.4074 | 案例001 上升差 11.28°、天顶差 13.31°——查出后算出"等效经度 116.38"，正是默认值 | 同时接受 `lon` / `lng` / `longitude`；`lat` 也接受 `latitude` |
| **R-W8** | `toUTC` 用**固定数值偏移**，忽略**历史夏令时**。中国 1986–1991 实行过夏令时（+9） | 1990-05-20 14:30 被当成 UTC 06:30，实际应为 **05:30**；月亮差 0.59°、四轴差 8–13° | 新增 `tzName` 参数：用 `Intl.DateTimeFormat(longOffset)` 按**历史真实规则**求偏移（含 DST），并回代一次以跨 DST 边界更准 |

> 这类"静默回退默认值"是最危险的缺陷形态：**不报错、不告警，只是结果悄悄错**。
> 若没有 kerykeion 这个独立实现对拍，这两处都不会被发现。

## 5 相位参与天体的扩展（R-W9）

原实现只把 `上升 + 北交点` 纳入相位。对拍显示 kerykeion 把**四轴（上升/天顶/下降/天底）与南北交点**全部纳入，
于是出现"覆盖率虚低"。裁定 **R-W9**：本引擎同样把 **四轴 + 南北交点** 纳入相位点
（四轴与其对跖点由定义确定宫位：上升=1、天顶=10、下降=7、天底=4）。
扩展后覆盖率从 57%/50% 升到 **100%**。

---

## 6 实现裁定

| 编号 | 未定义处 | 裁定 |
|---|---|---|
| R-W7 | 经度参数名 | 同时接受 `lon`/`lng`/`longitude`；禁止静默回退（传了不认识的名字也要能生效） |
| R-W8 | 历史时区 | 给了 `tzName` 就用 IANA 历史规则（含 DST）；只给数字 `tz` 时保持旧的固定偏移行为（向后兼容） |
| R-W9 | 相位参与点 | 10 行星 + 四轴 + 南北交点；四轴宫位由定义给定 |
| R-W10 | kerykeion 与 astronomy-engine 的分歧仲裁 | 星体黄经以**两者一致**为准（实测 ≤0.005°）；分歧 >0.05° 一律视为缺陷并排查，不"取平均" |
| R-W11 | 宫位制差异 | 不追求两后端一致；只要求**四轴一致 + 各制自身不变量成立**。跨后端比较宫位前必须先对齐宫位制 |

---

## 7 已知未决

1. **宫位制未对齐**：kerykeion 默认 Placidus，本引擎无 Placidus（只有 porphyry/equal/whole）。
   若要逐宫对齐，需要给本引擎补 Placidus（迭代算法，高纬会退化）。
2. **交点口径**：本引擎用**平交点**（Meyer 多项式），kerykeion 同时给平/真交点；两者最大差 ±1.5°。
3. **本引擎不计算的天体**：Chiron、Lilith、小行星、恒星等一律不涉及（桥接会列入 `skippedAspectBodies`）。
4. **kerykeion 未启用恒星黄道**（Tropical 默认）；桥接支持 `sidereal` 参数但未纳入对拍。
5. **`.venv` 体积**：本机隔离环境约 200MB，已加入 `.gitignore`；`npm test` 在无 venv 时会**自动跳过**该套件。
