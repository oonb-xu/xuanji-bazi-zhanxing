# 星盘反推八字 · 案例001
- 输入：2007-12-25 17:30（Asia/Shanghai）104.06E 30.67N｜性别 女｜事件 2 条

## Step 0 时间基座（真太阳时与星盘用时分离 — R-T1）
- 民用时 2007-12-25 17:30 → UTC 2007-12-25T09:30:00.000Z（时区偏移 8h，含历史夏令时）
- 均时差 0.148 分｜经度修正 -63.76 分｜合计 **-63.612 分** → 真太阳时 **2007-12-25 16:26**
- 时辰：民用 酉 → 真太阳 **申**（**会变，时柱受影响**）
- 星盘必须用 `2007-12-25T09:30:00.000Z`（民用时→UTC），**不得**用真太阳时——否则经度修正被算两遍，上升/中天会偏一个星座量级

## Step 1 初始星盘（双独立实现）
- 主后端 **mine**｜kerykeion 已对齐
- 上升 双子25.34°｜天顶 双鱼8.45°
- 一致性：Δ星体 0.005°｜Δ上升 0.001°｜硬相位 7/7

## Step 3 八字（校正前）
- 四柱：丁亥 壬子 癸巳 辛酉
- 五行：木0.25 火1.75 土0.25 金3.1 水5.5｜身旺(0.793)｜用 土 忌 水
- 胎元 癸卯｜命宫 壬寅｜身宫 庚戌

## Step 2 生时校正
- **拒绝执行**：事件不足：仅 2 条，生时校正至少需要 3 条（规格 Step 5 明令：少于 3 条拒绝执行生时校正）
- 需要：请补充至 ≥3 条重大人生事件（年份 + 类别）
- Step 5 分支命中：`IF 用户提供的事件少于3个 → 拒绝执行生时校正，仅输出原始星盘与八字`

## Step 4 结构化输出（JSON）
```json
{
  "case_id": "R-20071225-1730",
  "input_events": [
    {
      "year": 2022,
      "event": "父亲生病",
      "category": "家庭"
    },
    {
      "year": 2024,
      "event": "考入航空系",
      "category": "学业"
    }
  ],
  "time_base": {
    "civil": "2007-12-25 17:30",
    "utc": "2007-12-25T09:30:00.000Z",
    "tst": {
      "eot_minutes": 0.148,
      "lon_correction_minutes": -63.76,
      "apparent_solar": "2007-12-25 16:26",
      "shichen_civil": "酉",
      "shichen_true": "申",
      "shichen_differs": true
    },
    "note": "R-T1：星盘用 utc（civilLocal 换算而来，且经度只用于宫位）；真太阳时仅用于中国侧时柱/占时"
  },
  "rectification": {
    "original_time": "17:30",
    "corrected_time": null,
    "confidence": "未执行",
    "method": "拒绝（事件不足）",
    "reason": "事件不足：仅 2 条，生时校正至少需要 3 条（规格 Step 5 明令：少于 3 条拒绝执行生时校正）"
  },
  "star_chart": {
    "太阳": {
      "sign": "摩羯",
      "house": 7,
      "degree": 3.2,
      "longitude": 273.198,
      "retrograde": false
    },
    "月亮": {
      "sign": "巨蟹",
      "house": 2,
      "degree": 21.47,
      "longitude": 111.468,
      "retrograde": false
    },
    "水星": {
      "sign": "摩羯",
      "house": 7,
      "degree": 7.62,
      "longitude": 277.618,
      "retrograde": false
    },
    "金星": {
      "sign": "天蝎",
      "house": 6,
      "degree": 23.54,
      "longitude": 233.538,
      "retrograde": false
    },
    "火星": {
      "sign": "巨蟹",
      "house": 1,
      "degree": 2.39,
      "longitude": 92.391,
      "retrograde": true
    },
    "木星": {
      "sign": "摩羯",
      "house": 7,
      "degree": 1.5,
      "longitude": 271.501,
      "retrograde": false
    },
    "土星": {
      "sign": "处女",
      "house": 4,
      "degree": 8.54,
      "longitude": 158.537,
      "retrograde": true
    },
    "天王星": {
      "sign": "双鱼",
      "house": 10,
      "degree": 15.18,
      "longitude": 345.18,
      "retrograde": false
    },
    "海王星": {
      "sign": "水瓶",
      "house": 9,
      "degree": 20.07,
      "longitude": 320.066,
      "retrograde": false
    },
    "冥王星": {
      "sign": "射手",
      "house": 7,
      "degree": 28.9,
      "longitude": 268.896,
      "retrograde": false
    },
    "北交点": {
      "sign": "双鱼",
      "house": 9,
      "degree": 0.69,
      "longitude": 330.69,
      "retrograde": true
    },
    "南交点": {
      "sign": "处女",
      "house": 3,
      "degree": 0.69,
      "longitude": 150.69,
      "retrograde": true
    },
    "上升": {
      "sign": "双子",
      "house": 1,
      "degree": 25.34,
      "longitude": 85.339,
      "retrograde": false
    },
    "天顶": {
      "sign": "双鱼",
      "house": 10,
      "degree": 8.45,
      "longitude": 338.449,
      "retrograde": false
    },
    "下降": {
      "sign": "射手",
      "house": 7,
      "degree": 25.34,
      "longitude": 265.339,
      "retrograde": false
    },
    "天底": {
      "sign": "处女",
      "house": 4,
      "degree": 8.45,
      "longitude": 158.449,
      "retrograde": false
    }
  },
  "star_chart_meta": {
    "backend": "mine",
    "houses": "porphyry",
    "utc": "2007-12-25T09:30:00.000Z",
    "asc": 85.34,
    "mc": 338.45,
    "consistency": {
      "perBody": [
        {
          "body": "太阳",
          "mineLon": 273.198,
          "keryLon": 273.198,
          "deltas": 0,
          "signMatch": true
        },
        {
          "body": "月亮",
          "mineLon": 111.468,
          "keryLon": 111.468,
          "deltas": 0,
          "signMatch": true
        },
        {
          "body": "水星",
          "min
... (完整见 --json)
```