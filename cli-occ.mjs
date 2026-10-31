#!/usr/bin/env node
// 韩式职业预测 + **胎元当「第五柱」会不会提高正确率**（用户命题的直接检验）
//   node cli-occ.mjs --run [--split 0.5]
//
// 设计要点（避免自欺）：
//   · 目标 = 职业大类（由韩文标签关键词归一）；**取第一个职业**，多职业问题已记录在案
//   · 特征 = 三柱（年月日 干/支）+ 日主 + **胎元（干/支）**（=第五柱）
//   · 模型 = 朴素贝叶斯（分类特征），**训练/测试按行奇偶切分**，测试集只看不调
//   · 基线 = 多数类 + 均匀随机；**并且给出每个特征的互信息**，直接回答"胎元到底带不带信息"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIAN_GAN, DI_ZHI } from './src/constants.mjs';
import { splitPillar } from './src/bazi/engine.mjs';
import { taiYuanOf } from './src/bazi/five-pillar.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, 'data', 'korean', 'persons.csv');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/* ── 职业归一：韩文关键词 → 大类 ── */
export const OCC_RULES = [
  ['演艺', ['배우', '가수', '영화', '텔레비전', '연극', '성우', '코미디언', '모델', '래퍼', '아이돌', '방송인', '아나운서', '연예인', '뮤지컬', '개그맨', 'mc']],
  ['政治', ['정치인', '국회의원', '대통령', '장관', '시장', '도지사', '의원', '정당', '외교']],
  ['体育', ['선수', '감독', '코치', '골프', '복싱', '씨름', '태권도', '유도', '역도', '체조', '수영', '육상']],
  ['文艺学术', ['작가', '시인', '화가', '교수', '학자', '작곡가', '지휘자', '음악가', '평론', '번역', '연구']],
  ['商业', ['사업가', '기업인', '회장', '경영', '최고경영자', '은행', '투자']],
  ['专业技术', ['변호사', '의사', '판사', '검사', '회계사', '약사', '간호', '교사', '기자', '공무원', '군인']],
  ['游戏围棋', ['프로게이머', '바둑', '게임']],
];
export function normalizeOcc(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (!s.trim()) return null;
  for (const [cat, kws] of OCC_RULES) for (const k of kws) if (s.includes(k.toLowerCase())) return cat;
  return '其他';
}

if (!existsSync(CSV)) { console.error(`缺 ${CSV}`); process.exit(2); }
const rows = require('csv-parse/sync').parse(readFileSync(CSV, 'utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true, bom: true });

/* ── 特征构造 ── */
const WX_OF_GAN = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const WX_OF_ZHI = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
export function buildFeatures(r) {
  const P3 = ['year', 'month', 'day'].map((k) => `${r[`${k}_stem`]}${r[`${k}_branch`]}`);
  if (P3.some((x) => x.length !== 2 || x.includes('undefined') || x.includes('null'))) return null;
  const [Y, M, D] = P3;
  const ty = taiYuanOf(M);
  const f = {
    y_stem: Y[0], y_branch: Y[1], m_stem: M[0], m_branch: M[1], d_stem: D[0], d_branch: D[1],
    y_wx: WX_OF_GAN[Y[0]] + WX_OF_ZHI[Y[1]], m_wx: WX_OF_GAN[M[0]] + WX_OF_ZHI[M[1]], d_wx: WX_OF_GAN[D[0]] + WX_OF_ZHI[D[1]],
    dayMaster: D[0], dayMasterWx: WX_OF_GAN[D[0]],
    yearPolarity: '甲丙戊庚壬'.includes(Y[0]) ? '阳' : '阴',
  };
  const f5 = { taiYuan: ty, taiYuanStem: ty[0], taiYuanBranch: ty[1], taiYuanWx: WX_OF_GAN[ty[0]] + WX_OF_ZHI[ty[1]] };
  return { f, f5, pillars: P3, taiYuan: ty };
}

const data = [];
for (const r of rows) {
  const cat = normalizeOcc(r.occupations_raw);
  if (!cat) continue;
  const b = buildFeatures(r);
  if (!b) continue;
  data.push({ cat, ...b, id: r.wikidata_qid || r.name_ko });
}

/* ── 朴素贝叶斯（拉普拉斯平滑） ── */
function trainNB(train, featureKeys) {
  const catN = {}, featN = {};
  for (const d of train) {
    catN[d.cat] = (catN[d.cat] ?? 0) + 1;
    for (const k of featureKeys) {
      const v = d.f[k] ?? d.f5[k];
      if (v === undefined) continue;
      ((featN[k] ??= {})[v] ??= {});
      featN[k][v][d.cat] = (featN[k][v][d.cat] ?? 0) + 1;
    }
  }
  const vocab = {};
  for (const k of featureKeys) vocab[k] = new Set(train.map((d) => d.f[k] ?? d.f5[k]).filter((x) => x !== undefined)).size;
  return { catN, featN, vocab, total: train.length, cats: Object.keys(catN) };
}
function predictNB(model, d, featureKeys) {
  let best = null, bestLog = -Infinity;
  for (const c of model.cats) {
    let log = Math.log(model.catN[c] / model.total);
    for (const k of featureKeys) {
      const v = d.f[k] ?? d.f5[k];
      if (v === undefined) continue;
      const num = (model.featN[k]?.[v]?.[c] ?? 0) + 1;
      const den = model.catN[c] + (model.vocab[k] ?? 1);
      log += Math.log(num / den);
    }
    if (log > bestLog) { bestLog = log; best = c; }
  }
  return best;
}

/* ── 互信息（每个特征与职业的关联强度） ── */
export function mutualInfo(data, key) {
  const n = data.length, joint = {}, px = {}, py = {};
  for (const d of data) {
    const v = d.f[key] ?? d.f5[key];
    if (v === undefined) continue;
    ((joint[v] ??= {})[d.cat] ??= 0);
    joint[v][d.cat]++;
    px[v] = (px[v] ?? 0) + 1; py[d.cat] = (py[d.cat] ?? 0) + 1;
  }
  let mi = 0;
  for (const [v, m] of Object.entries(joint)) for (const [c, cnt] of Object.entries(m)) {
    const pxy = cnt / n, pxx = px[v] / n, pyy = py[c] / n;
    mi += pxy * Math.log2(pxy / (pxx * pyy));
  }
  return mi;
}

const F3 = ['y_stem', 'y_branch', 'm_stem', 'm_branch', 'd_stem', 'd_branch', 'y_wx', 'm_wx', 'd_wx', 'dayMaster', 'dayMasterWx', 'yearPolarity'];
const F5 = [...F3, 'taiYuan', 'taiYuanStem', 'taiYuanBranch', 'taiYuanWx'];

const train = data.filter((_, i) => i % 2 === 0), test = data.filter((_, i) => i % 2 === 1);
const catN = {}; for (const d of train) catN[d.cat] = (catN[d.cat] ?? 0) + 1;
const majority = Object.entries(catN).sort((a, b) => b[1] - a[1])[0][0];
const majAcc = test.filter((d) => d.cat === majority).length / test.length;
const uniqCats = [...new Set(data.map((d) => d.cat))].length;

P('# 韩式职业预测 · 胎元当「第五柱」的对照实验');
P('');
P(`数据：${rows.length} 条 → 有职业且三柱完整 **${data.length}** 条｜职业大类 **${uniqCats}** 类`);
P(`切分：训练 ${train.length} / 测试 ${test.length}（按行奇偶，**测试集只看不调**）`);
P('');
P('## 基线（必须先摆出来）');
P('');
P('| 基线 | 准确率 |');
P('|---|---|');
P(`| 多数类（${majority}，占训练集 ${(catN[majority] / train.length * 100).toFixed(1)}%） | **${(majAcc * 100).toFixed(2)}%** |`);
P(`| 均匀随机（${uniqCats} 类） | ${(100 / uniqCats).toFixed(2)}% |`);
P('');
P('## 主实验：加不加胎元');
P('');
const m3 = trainNB(train, F3), m5 = trainNB(train, F5);
const acc3 = test.filter((d) => predictNB(m3, d, F3) === d.cat).length / test.length;
const acc5 = test.filter((d) => predictNB(m5, d, F5) === d.cat).length / test.length;
P('| 特征集 | 测试准确率 | 相对多数类 | 相对随机 |');
P('|---|---|---|---|');
P(`| 三柱（年/月/日 共 ${F3.length} 特征） | **${(acc3 * 100).toFixed(2)}%** | ${((acc3 - majAcc) * 100).toFixed(2)}pt | +${((acc3 - 1 / uniqCats) * 100).toFixed(2)}pt |`);
P(`| **三柱 + 胎元（第五柱，+4 特征）** | **${(acc5 * 100).toFixed(2)}%** | ${((acc5 - majAcc) * 100).toFixed(2)}pt | +${((acc5 - 1 / uniqCats) * 100).toFixed(2)}pt |`);
P(`| **胎元带来的增量** | **${((acc5 - acc3) * 100).toFixed(2)}pt** | | |`);
P('');
P('## 特征互信息（谁真带信息，bits）');
P('');
P('| 特征 | 互信息 | 归属 |');
P('|---|---|---|');
const miAll = [...F3, ...F5.slice(F3.length)].map((k) => ({ k, mi: mutualInfo(data, k), grp: F3.includes(k) ? '四柱' : '**胎元(第五柱)**' })).sort((a, b) => b.mi - a.mi);
for (const x of miAll) P(`| ${x.k} | ${x.mi.toFixed(6)} | ${x.grp} |`);
P('');
const miPillars = miAll.filter((x) => x.grp === '四柱').map((x) => x.mi);
const miTy = miAll.filter((x) => x.grp.includes('胎元')).map((x) => x.mi);
P(`- 四柱特征互信息：中位 ${median(miPillars).toFixed(6)}｜最大 ${Math.max(...miPillars).toFixed(6)}`);
P(`- **胎元特征互信息：中位 ${median(miTy).toFixed(6)}｜最大 ${Math.max(...miTy).toFixed(6)}**`);
P(`- **判定：${median(miTy) > median(miPillars) ? '胎元信息量高于四柱中位（有信号）' : '胎元信息量不高于四柱中位（无额外信号）'}**`);
P('');
P('## 判读纪律');
P('1. 职业是**多标签**（11,062 人多职业），此处只取第一个 → 目标本身含噪；');
P('2. 未控制**国别/年代/性别**；韩国公众人物的职业分布本身极度偏斜；');
P('3. **互信息是单特征关联**，不代表可预测；朴素贝叶斯假设特征独立，而干支特征强相关；');
P('4. 结论只能说明"在该数据该口径下胎元是否带来增量"，**不能外推到命理有效性**。');

function median(a) { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; }

const rp = arg('report');
if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
