#!/usr/bin/env node
// 文内年号锚点 → 干支年份校准 → 回写 cases.jsonl（Part 11 步骤 1/2 的落地）
//   node cli-anchors.mjs --verify     # 验算锚点（年号纪年 → 公历 → 干支 是否自洽）
//   node cli-anchors.mjs --writeback  # 把 candidateYears / anchor / calibratedYear / evidenceLevel 回写 cases.jsonl
//
// ★ 判据纪律（R-A2/R-A4）：锚点是**直接证据**；由锚点推出的相邻年（如 己酉=1129 ⇒ 戊申=1128）
//   是**推断**，必须与直接锚点分开标注，不得混为一谈。
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ganzhiOf } from './cli-calib.mjs';
import { compileFromGanZhi } from './src/daliuren.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIUREN = join(HERE, 'data', 'liuren');
const CASES = join(LIUREN, 'cases.jsonl');
const CALIB = join(LIUREN, 'calibrated-years.json');
const ANCHOR_FILE = join(LIUREN, 'era-anchors.json');
const argv = process.argv.slice(2);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** 北宋—南宋年号元年（公历）—— 用于把「年号+年数」换算为公历 */
export const ERA_START = {
  崇宁: 1102, 大观: 1107, 政和: 1111, 重和: 1118, 宣和: 1119,
  靖康: 1126, 建炎: 1127, 绍兴: 1131, 隆兴: 1163, 乾道: 1165,
  淳熙: 1174, 绍熙: 1190, 庆元: 1195, 嘉泰: 1201, 开禧: 1205,
  嘉定: 1208, 宝庆: 1225, 绍定: 1228, 端平: 1234, 嘉熙: 1237,
};
const HAN_NUM = { 元: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const NUM = ['元', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三', '二十四', '二十五'];

/**
 * ★ 锚点抽取的唯一合法判据：**年干支必须紧贴「年」字**（中间不得出现「月」「日」）
 *   —— 首版允许间隔 10 字符，把「宣和三年十二月二十七日**丁巳**」里的**日干支**误当年干支，
 *   验算时才发现（宣和三年 = 1121 = 辛丑 ≠ 丁巳）。**机检验算抓出了我自己的抽取错误。**
 *   后缀还须以「岁 / 岁在 / 年 / 月 / ，」等收束，避免吃到人名用字。
 */
export function scanAnchors(files) {
  const out = [];
  for (const [name, text] of files) {
    for (const era of Object.keys(ERA_START)) {
      for (const n of NUM) {
        const head = `${era}${n}年`;
        let idx = text.indexOf(head);
        while (idx >= 0) {
          const rest = text.slice(idx + head.length, idx + head.length + 10);
          // 句式 A：年干支紧贴「年」字（如「绍兴十五年乙丑四月」）——「宣和三年十二月…日丁巳」因中间有月日而被正确排除
          // 句式 B：「年，岁在干支」（如「靖康元年，岁在丙午」）
          let gz = null;
          const a = rest.replace(/^\s+/, '');
          if (GAN.includes(a[0]) && ZHI.includes(a[1])) gz = a.slice(0, 2);
          else { const b = rest.match(/^[，,、]?\s*岁在\s*(.)(.)/); if (b && GAN.includes(b[1]) && ZHI.includes(b[2])) gz = b[1] + b[2]; }
          if (gz) out.push({ era, n: NUM.indexOf(n) + 1, ganzhi: gz, src: name, quote: text.slice(idx, idx + head.length + 16).replace(/\s+/g, '') });
          idx = text.indexOf(head, idx + head.length);
        }
      }
    }
  }
  // 去重（同年号同年数同干支只留一条）
  const seen = new Set(), uniq = [];
  for (const a of out) { const k = `${a.era}${a.n}|${a.ganzhi}`; if (seen.has(k)) continue; seen.add(k); uniq.push(a); }
  return uniq;
}

/** 从原文扫出的「年号+干支」同现锚点（本轮实扫所得，带出处） */
export const RAW_ANCHORS = [];

/** 验算：年号纪年 → 公历 → 干支 是否与原文一致（机检，不靠人工） */
export function verifyAnchors(raws = RAW_ANCHORS) {
  return raws.map((a) => {
    const start = ERA_START[a.era];
    if (!start) return { ...a, ok: false, reason: `未知年号「${a.era}」` };
    const year = start + a.n - 1;
    const gz = ganzhiOf(year, 6, 1).year;
    return { ...a, year, computed: gz, ok: gz === a.ganzhi, reason: gz === a.ganzhi ? null : `换算得 ${year} 年干支为 ${gz}，原文作 ${a.ganzhi}` };
  });
}

/** 锚点表：干支 → { year, 依据, 类型 }；另含**推断**的相邻年（单独标注） */
export function buildAnchorTable(verified) {
  const table = {};
  for (const v of verified.filter((x) => x.ok)) {
    table[v.ganzhi] = { year: v.year, basis: `direct:${v.era}${v.n === 1 ? '元' : v.n}年`, type: 'direct', src: v.src, quote: v.quote };
  }
  // 推断：与直接锚点**相邻**的干支年（同一本书同一时期 ⇒ 前一年/后一年）
  for (const v of verified.filter((x) => x.ok)) {
    const gi = '甲乙丙丁戊己庚辛壬癸', zi = '子丑寅卯辰巳午未申酉戌亥';
    const g = v.ganzhi[0], z = v.ganzhi[1];
    const prev = gi[(gi.indexOf(g) + 9) % 10] + zi[(zi.indexOf(z) + 11) % 12];
    const next = gi[(gi.indexOf(g) + 1) % 10] + zi[(zi.indexOf(z) + 1) % 12];
    if (!table[prev]) table[prev] = { year: v.year - 1, basis: `inferred:紧随 ${v.ganzhi}(${v.year})`, type: 'inferred', src: v.src };
    if (!table[next]) table[next] = { year: v.year + 1, basis: `inferred:紧接 ${v.ganzhi}(${v.year})`, type: 'inferred', src: v.src };
  }
  return table;
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  // 实扫原文取锚点（不靠手抄）
  const dir = LIUREN;
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [f.replace(/大六壬断案|\(|\)|\.md/g, ''), readFileSync(join(dir, f), 'utf8')])
    : [];
  const scanned = files.length ? scanAnchors(files) : RAW_ANCHORS;
  const verified = verifyAnchors(scanned.length ? scanned : RAW_ANCHORS);
  const table = buildAnchorTable(verified);

  if (argv.includes('--verify') || argv.length === 0) {
    const okN = verified.filter((v) => v.ok).length;
    P('# 文内年号锚点验算（Part 11）');
    P('');
    P(`机检口径：**年号纪年 → 公历（年号元年 + n − 1）→ 该年立春后年干支**，与原文所记干支比对。`);
    P('');
    P('| 年号 | 原文干支 | 换算公历 | 实算干支 | 自洽 | 出处 |');
    P('|---|---|---|---|---|---|');
    for (const v of verified) P(`| ${v.era}${v.n === 1 ? '元' : v.n}年 | ${v.ganzhi} | ${v.year ?? '—'} | ${v.computed ?? '—'} | ${v.ok ? '✅' : '❌'} | ${v.src} |`);
    P('');
    P(`**${okN}/${verified.length} 个锚点自洽**${okN === verified.length ? ' —— 文献的年号—干支—公历三者完全一致，其绝对年代可信' : ' —— 存在不自洽项，须逐条查证'}`);
    P('');
    P('## 由此确定的干支年份');
    P('');
    P('| 干支 | 公历 | 类型 | 依据 |');
    P('|---|---|---|---|');
    for (const [gz, a] of Object.entries(table).sort((x, y) => x[1].year - y[1].year)) {
      P(`| ${gz} | **${a.year}** | ${a.type === 'direct' ? '**直接锚点**' : '推断（相邻年）'} | ${a.basis} |`);
    }
    P('');
    P('> ⚠️ **直接锚点** = 原文同时写出年号与干支（可直接采信）；');
    P('> **推断** = 由直接锚点推相邻年（同一部书、同一时期），**强度较低**，需人工确认。');
    mkdirSync(LIUREN, { recursive: true });
    writeFileSync(ANCHOR_FILE, JSON.stringify({ verified, table }, null, 1), 'utf8');
    console.error(`[锚点表已写入] ${ANCHOR_FILE}`);
  }

  if (argv.includes('--writeback')) {
    if (!existsSync(CASES) || !existsSync(CALIB)) { console.error('缺 cases.jsonl 或 calibrated-years.json'); process.exit(2); }
    const cases = readFileSync(CASES, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const calib = JSON.parse(readFileSync(CALIB, 'utf8'));
    const byLine = new Map(calib.results.map((r) => [`${r.case.collection}:${r.case.line}`, r]));
    let anchored = 0, inferred = 0, none = 0;
    for (const c of cases) {
      const r = byLine.get(`${c.collection}:${c.line}`);
      c.candidateYears = r ? r.candidates.map((x) => x.date) : null;
      const a = c.yearGz ? table[c.yearGz] : null;
      if (a) {
        c.anchor = { ganzhi: c.yearGz, year: a.year, type: a.type, basis: a.basis, src: a.src, quote: a.quote ?? null };
        c.calibratedYear = a.year;
        c.yearConfidence = a.type === 'direct' ? 'anchored' : 'inferred-adjacent';
        if (a.type === 'direct') anchored++; else inferred++;
      } else {
        c.anchor = null; c.calibratedYear = null; c.yearConfidence = 'unresolved';
        none++;
      }
      // 三级证据强度（docs/22 §6）—— ★ A 级要求**三传对拍一致**，不是"有原文三传"
      let scMatch = null;
      if (c.sanChuanZhi && c.sanChuanZhi.length === 3) {
        try {
          const r = compileFromGanZhi({ dayGz: c.dayGz, yueJiang: c.yueJiang, zhanShi: c.zhanShi });
          scMatch = [r.sanChuan.chu, r.sanChuan.zhong, r.sanChuan.mo].join('') === c.sanChuanZhi.join('');
        } catch { scMatch = false; }
      }
      c.sanChuanMatch = scMatch;
      c.evidenceLevel = (scMatch === true && c.yearConfidence === 'anchored') ? 'A'
        : (c.candidateYears && c.candidateYears.length) ? 'B' : 'C';
    }
    writeFileSync(CASES, cases.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');
    const lv = {};
    for (const c of cases) lv[c.evidenceLevel] = (lv[c.evidenceLevel] ?? 0) + 1;
    P('');
    P('## 回写结果（cases.jsonl）');
    P('');
    P('新增字段：`candidateYears`（天文候选）/ `anchor`（年号锚点）/ `calibratedYear` / `yearConfidence` / `evidenceLevel`');
    P('');
    P('| 项 | 值 |');
    P('|---|---|');
    P(`| 直接锚点定年 | **${anchored}** 例 |`);
    P(`| 推断（相邻年）定年 | ${inferred} 例 |`);
    P(`| 未定年 | ${none} 例 |`);
    P(`| **A 级**（三传一致 + 直接锚点） | **${lv.A ?? 0}** |`);
    P(`| **B 级**（有天文候选） | **${lv.B ?? 0}** |`);
    P(`| C 级 | ${lv.C ?? 0} |`);
    console.error(`[已回写] ${CASES}`);
  }

  const rp = argv[argv.indexOf('--report') + 1];
  if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
