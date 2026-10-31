#!/usr/bin/env node
// 《大六壬断案》(邵彦和) 课例解析与入库
//   node cli-liuren-cases.mjs --parse       # 解析四集 → data/liuren/cases.jsonl + 统计
//   node cli-liuren-cases.mjs --check       # 用本引擎由 (日干支,月将,占时) 重算三传并与原文对拍
//
// 数据来源：look-fate/lookfate-book（五术书籍库）content/卜/大六壬断案/{元,亨,利,贞}集.md
//   经 GitHub contents API 下载（jsDelivr 不稳、raw.githubusercontent 本机不通）
// 每例结构（原文）：
//   应贡元丁卯生四十二岁占前程，戊申年六月丁丑日午将未时。   ← 命主生年+年龄+事由 + 年/月/日干支+月将+占时
//   [天地盘 / 四课 / 三传]
//   邵先生曰：……                                          ← 断语
//   后贡元官至礼部，贵寿两全。                                ← ★真实应验
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'data', 'liuren');
const OUT = join(DIR, 'cases.jsonl');
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(`--${k}`);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** 表头：…占事由，XX年X月X日X将X时。
 *  ★ 注意：**月将只写一个地支**（如「午将」），不是干支 —— 首版写成「干+支」导致 0 命中 */
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const HEAD = new RegExp(`占([^，。]{1,12})[，,]\\s*([${GAN}][${ZHI}])年([^月]{1,3})月([${GAN}][${ZHI}])日([${ZHI}])将([${ZHI}])时`);
/** 三传行：原文格式固定为「六亲 干支 天将」，如「官 丙子 蛇」。
 *  ★ 首版只匹配「六亲+干支」，会从四课盘面里误抓（样例第二项抓成「子巳」）→ 必须锚定天将后缀 */
const TIAN_JIANG = '贵蛇朱合勾青空虎常玄阴后';
const SANCHUAN = new RegExp(`([官财父兄子])\\s*([${GAN}][${ZHI}])\\s*([${TIAN_JIANG}])`, 'g');

function parseCollection(name, text) {
  const lines = text.split('\n');
  const cases = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEAD);
    if (!m) continue;
    const [, matter, yearGz, month, dayGz, yueJiang, zhanShi] = m;
    // 往后找三传（本行或后续 12 行内出现 ≥3 个「六亲+干支」）
    const block = lines.slice(i, i + 14).join('\n');
    const sc = [...block.matchAll(SANCHUAN)].map((x) => `${x[1]}${x[2]}`).slice(0, 3);
    // 断语与应验：从「邵先生曰」到下一例之前
    const rest = lines.slice(i + 1).join('\n');
    const duanIdx = rest.indexOf('邵先生曰');
    const nextIdx = rest.search(HEAD);
    const duanBlock = duanIdx >= 0 ? rest.slice(duanIdx, nextIdx > duanIdx ? nextIdx : duanIdx + 3000) : '';
    const duan = duanBlock.replace(/邵先生曰[:：]?/, '').slice(0, 2000);
    // ★ 结局抽字段（用户要求）：应验叙述通常在断语块**末尾**，含「后果/竟/遂/卒/终/年…岁/死/官至/生子」等标记
    const OUTCOME_MARK = /后|果|竟|遂|卒|终|官至|生子|升|迁|死|亡|寿|中[第举]|得[官子]|病愈|破财|成家/;
    const sents = duan.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
    const tail = sents.slice(-2).join('');
    const outcome = tail && OUTCOME_MARK.test(tail) ? tail.slice(0, 300) : null;
    cases.push({
      book: '大六壬断案', collection: name, line: i + 1,
      matter, yearGz: yearGz || null, month, dayGz, yueJiang, zhanShi,
      sanChuan: sc.length === 3 ? sc : null,
      sanChuanZhi: sc.length === 3 ? sc.map((x) => x.slice(-1)) : null,
      hasDuan: duanBlock.length > 0,
      duan,
      outcome,                                   // ★ 结局字段（启发式抽取，未人工校）
      outcomeConfidence: outcome ? 'heuristic' : 'missing',
    });
  }
  return cases;
}

if (!existsSync(DIR)) { console.error(`缺目录 ${DIR}`); process.exit(2); }
const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && f.includes('断案'));
if (!files.length) { console.error('缺 断案 md 文件（4 集）'); process.exit(2); }

const all = [];
for (const f of files) {
  const name = f.replace(/大六壬断案|\(|\)|\.md/g, '');
  all.push(...parseCollection(name, readFileSync(join(DIR, f), 'utf8')));
}

if (flag('parse') || argv.length === 0) {
  const withSc = all.filter((c) => c.sanChuan).length;
  const withDuan = all.filter((c) => c.hasDuan).length;
  const matters = {};
  for (const c of all) matters[c.matter] = (matters[c.matter] ?? 0) + 1;
  P('# 《大六壬断案》(邵彦和) 课例解析');
  P('');
  P(`来源：\`look-fate/lookfate-book\` content/卜/大六壬断案（4 集）｜经 GitHub contents API 下载`);
  P('');
  P('| 指标 | 值 |');
  P('|---|---|');
  P(`| 解析出课例 | **${all.length}** |`);
  P(`| 含完整三传 | **${withSc}**（${(withSc / all.length * 100).toFixed(1)}%） |`);
  P(`| 含断语（邵先生曰） | **${withDuan}**（${(withDuan / all.length * 100).toFixed(1)}%） |`);
  P(`| 各集 | ${files.map((f) => f.replace(/大六壬断案|\(|\)|\.md/g, '') + ':' + all.filter((c) => c.collection === f.replace(/大六壬断案|\(|\)|\.md/g, '')).length).join('、')} |`);
  P('');
  P(`> ⚠️ **覆盖率**：文献自述 **217 套课例 / 220 则占断**，本轮只解析出 **${all.length}** 例 ——`);
  P(`> 说明当前表头正则只覆盖了「占X，干支年X月干支日X将X时」这一种写法；`);
  P(`> 另有一批表头写法不同（如「邵二十一公占孙前程，同此数。邵公系…」无完整占时、或占时写在别处）。`);
  P('> **未解析的不算数**：不得据此声称"文献已全部结构化"。');
  P('');
  P('## 占问事由分布（前 15）');
  P('');
  P('| 事由 | 例数 |');
  P('|---|---|');
  for (const [k, v] of Object.entries(matters).sort((a, b) => b[1] - a[1]).slice(0, 15)) P(`| 占${k} | ${v} |`);
  P('');
  P('## 样例（前 3 例结构化结果）');
  P('');
  P('```json');
  P(JSON.stringify(all.slice(0, 3).map(({ duan, ...x }) => ({ ...x, duan: duan.slice(0, 60) + '…' })), null, 1));
  P('```');
  mkdirSync(DIR, { recursive: true });
  writeFileSync(OUT, '', 'utf8');
  for (const c of all) appendFileSync(OUT, JSON.stringify(c) + '\n', 'utf8');
  console.error(`[课例已写入] ${OUT}（${all.length} 例）`);
}

if (flag('check')) {
  const { compileFromGanZhi } = await import('./src/daliuren.mjs');
  const withSc = all.filter((c) => c.sanChuanZhi);
  const rows = [];
  for (const c of withSc) {
    let got = null, err = null;
    try {
      const r = compileFromGanZhi({ dayGz: c.dayGz, yueJiang: c.yueJiang, zhanShi: c.zhanShi });
      got = [r.sanChuan.chu, r.sanChuan.zhong, r.sanChuan.mo];
    } catch (e) { err = e.message; }
    const match = got && got.join('') === c.sanChuanZhi.join('');
    const partial = got ? got.filter((z, i) => z === c.sanChuanZhi[i]).length : 0;
    rows.push({ ...c, got, err, match, partial, method: null });
  }
  const okN = rows.filter((r) => r.match).length;
  const errN = rows.filter((r) => r.err).length;
  const partialN = rows.filter((r) => !r.match && r.partial > 0).length;
  P('# 三传对拍：本引擎 vs 邵彦和原文（《大六壬断案》）');
  P('');
  P('用 (日干支, 月将, 占时) 直算三传（`compileFromGanZhi`，**不改算法，只组合既有四步**）——');
  P('这三项原文都给了，**不需要年份**（R-L1）。');
  P('');
  P('| 指标 | 值 |');
  P('|---|---|');
  P(`| 可对拍课例 | **${rows.length}** |`);
  P(`| **三传全同** | **${okN}（${(okN / rows.length * 100).toFixed(1)}%）** |`);
  P(`| 部分相同（1–2 位） | ${partialN} |`);
  P(`| 引擎报错 | ${errN} |`);
  P('');
  P('## 逐例明细（前 30）');
  P('');
  P('| # | 事由 | 日干支 | 月将 | 占时 | 原文三传 | 引擎三传 | 判定 |');
  P('|---|---|---|---|---|---|---|---|');
  for (const [i, r] of rows.slice(0, 30).entries()) {
    P(`| ${i + 1} | 占${r.matter} | ${r.dayGz} | ${r.yueJiang} | ${r.zhanShi} | ${r.sanChuanZhi.join('')} | ${r.got ? r.got.join('') : '—'} | ${r.match ? '✓' : r.err ? '✗ 报错' : `△ ${r.partial}/3`} |`);
  }
  P('');
  P('## 不一致样例（前 8）');
  P('');
  for (const r of rows.filter((x) => !x.match).slice(0, 8)) {
    P(`- **${r.dayGz}日${r.yueJiang}将${r.zhanShi}时**（占${r.matter}）：原文 ${r.sanChuanZhi.join('')} vs 引擎 ${r.got ? r.got.join('') : r.err}`);
    P(`  - 原文三传：${r.sanChuan.join(' / ')}`);
  }
  P('');
  P(`## 结局字段`);
  P('');
  P(`- 抽出结局：**${all.filter((c) => c.outcome).length}/${all.length}**（启发式，标记：后/果/竟/遂/卒/终/官至/生子/死/寿…）`);
  P(`- ⚠️ **未经人工校对** —— 只能当"线索字段"，不得用于自动评估断语命中率；`);
  P(`  要评估命中率必须人工过一遍这 ${all.filter((c) => c.outcome).length} 条结局（下一步，成本约 30 分钟人工）。`);
}

const rp = argv[argv.indexOf('--report') + 1];
if (argv.includes('--report') && rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
