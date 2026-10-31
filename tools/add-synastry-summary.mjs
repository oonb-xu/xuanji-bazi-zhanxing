// 给 /api/synastry 增加：summary（综合结构契合度百分比）+ explain（M / z / 各分项的白话解释）
import fs from 'node:fs';

let s = fs.readFileSync('server.mjs', 'utf8');
if (s.includes('structuralFitPct')) { console.log('已存在 summary，跳过'); process.exit(0); }

// ① 在 apiSynastry 的 return 里，m 之后插入 summary + explain
const OLD = `    m: { value: R3(M), vetoMultiplier: vetoMult, note: 'R-G17：适婚窗口(20–40)加权 + 否决门槛；基线 v2.7；未经真实结局校准，属结构描述' },`;
const NEW = `    m: { value: R3(M), vetoMultiplier: vetoMult, note: '把三路证据折算成同尺度的"标准分"后加权求和，再过否决门槛。它不是准确率，也不是好坏。' },
    // ★ 综合结构契合度：把 M 映射到 0–100%（逻辑斯蒂映射，纯计算层面的换标度）
    summary: (() => {
      const toPct = (z) => Math.round((100 / (1 + Math.exp(-1.1 * (z ?? 0)))) * 10) / 10;
      const comps = [
        { key: '互补度', what: '两盘五行互相"补"了多少', raw: c.complementarity, z: R3(zC), pct: toPct(zC), weight: W.comp, dir: '越高＝越互补' },
        { key: '星盘结构', what: '两张星盘的相位图相似度（已剔除四轴）', raw: astroScore === null ? null : R3(astroScore), z: R3(zA), pct: astroScore === null ? null : toPct(zA), weight: W.astro, dir: '越高＝结构越像' },
        { key: '适婚窗口', what: '20–40 岁里两人同时走好运的比例（按年龄加权）', raw: wf, z: R3(zD), pct: wf === null ? null : toPct(zD), weight: R3(wD), dir: '越高＝关键期越同步' },
      ];
      return {
        structuralFitPct: toPct(M),
        band: toPct(M) >= 70 ? '偏高' : toPct(M) >= 58 ? '略偏高' : toPct(M) >= 42 ? '接近人群平均' : toPct(M) >= 30 ? '略偏低' : '偏低',
        mValue: R3(M),
        components: comps,
        veto: { level: veto, multiplier: vetoMult, note: dy.window?.note ?? null },
        formula: '先各算 z（＝相对人群平均高出几个标准差），再把 z 经 100/(1+e^(−1.1z)) 换成百分比，然后按权重 0.50 / 0.25 / 0.25 加权（大运权重还会按"是否居中"动态下调），最后乘否决系数。',
        meaning: '这个百分比只回答一件事：**这两张盘的结构，在人群里算不算"搭"**。它衡量结构，不衡量感情。',
        disclaimer: '**纯计算层面的结构指数，不是感情好坏的预测，也不是任何建议。** 它没有用任何真实情侣的结局校准过，也不含"磨合"这类盘里根本没有的东西。',
      };
    })(),
    explain: {
      'z 是什么': 'z 是"标准分"：先看这一项在人群里的平均值和离散程度，再看你们这对高出平均多少个标准差。z=0 是正好平均，z=+2 大概处于前 2~3%，z=−1 则低于约 84% 的人。',
      'M 是什么': 'M 是"综合分"：把互补度、星盘结构、适婚窗口三路的 z 按权重加起来，得到一个数。M 本身没有上下限，0 附近代表"和人群平均差不多"。',
      '为什么还要乘一个系数': '若适婚窗口内两人几乎没有共同吉运，整体会再打一个折（0.5~0.8）。依据是一个经验判断：20–40 岁是事业与资本成型的阶段，也是婚姻的基础期——**这条是假设，未经数据检验**。',
      '占比怎么读': '各分项的百分比是**把 z 换成更直观的 0–100 刻度**，方便横向比较哪一路拉高/拉低了总分。它不是概率。',
    },`;

if (!s.includes(OLD)) { console.error('未匹配到 m: { value 行，未修改'); process.exit(1); }
s = s.replace(OLD, NEW);
fs.writeFileSync('server.mjs', s, 'utf8');
console.log('server.mjs: synastry 已加 summary + explain');
