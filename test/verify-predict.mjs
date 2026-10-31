// 四柱 → 引擎预测（predictions.jsonl）回归钉
//
// 验证五件事：
//   1) 108 行、id 与语料同序、纯组合入口、零日期（无 at/date 键、无日期/时刻字面量）；
//   2) schema 枚举：verdict 六值、yong/ji 五行、ratio/rooted/basis/source；
//   3) 逐条用 compileBazi({ pillars }) 复算一致（预测不是手写或按原文回填）；
//   4) 六种 verdict 全覆盖 + 难例钉（身旺/身弱/中和偏旺/中和偏弱/从强格/从弱格）；
//   5) 口径差已登记：compare 与 saying 提取器/groundtruth.jsonl 一致，四类都有样本。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PREDICTIONS_PATH, VERDICT_ENUM, BASIS, COMPARE_ENUM,
  predictRecord, buildPredictionsText,
} from '../src/bazi/pillars-predict.mjs';
import { readCorpus, extractRecord, GROUNDTRUTH_PATH } from '../src/bazi/extract-saying.mjs';
import { compileBazi } from '../src/bazi/engine.mjs';
import { WU_XING_LIST } from '../src/bazi/wuxing.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}：期望 ${JSON.stringify(b)} 实得 ${JSON.stringify(a)}`);

const WX_SET = new Set(WU_XING_LIST);
const VERDICT_SET = new Set(VERDICT_ENUM);
const SW_CMP_ENUM = new Set(['一致', '分歧', '不可比']);
const YONG_CMP_SET = new Set(COMPARE_ENUM);

/** 递归收集键路径（用于「schema 无 at/date 键」的断言） */
function keyPaths(value, path = '') {
  const out = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...keyPaths(v, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      out.push(p);
      out.push(...keyPaths(v, p));
    }
  }
  return out;
}
const forbiddenKey = (p) => p === 'at' || p === 'date' || p.endsWith('.at') || p.endsWith('.date');

const corpus = readCorpus();
const text1 = buildPredictionsText(corpus);
const text2 = buildPredictionsText(corpus);
const lines = text1.trim().split('\n');
const records = lines.map((l) => JSON.parse(l));
const byId = new Map(records.map((r) => [r.id, r]));
const source = readFileSync(fileURLToPath(new URL('../src/bazi/pillars-predict.mjs', import.meta.url)), 'utf8');

console.log('[A] 文件、行数、确定性、零日期');
{
  eq(corpus.length, 108, '语料 108 行');
  ok(text1 === text2, '同输入两次产物字节一致');
  const disk = readFileSync(PREDICTIONS_PATH, 'utf8');
  ok(disk === text1, 'predictions.jsonl 与生成器输出字节一致（改动生成器后须重跑 node src/bazi/pillars-predict.mjs）');
  eq(lines.length, 108, 'predictions 恰 108 行');
  ok(text1.endsWith('\n'), '文件以 LF 结尾');
  ok(!text1.includes('\r'), '行尾统一 LF（无 CR）');
  ok(!text1.startsWith('\uFEFF'), '无 BOM');
  ok(lines.every((l) => l.trim() === l && l.length > 0), '无空行/行尾空白');
  ok(!/\b\d{4}-\d{1,2}-\d{1,2}\b/.test(text1), '产物无日期字面量（零日期伪造）');
  ok(!/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(text1), '产物无时刻字面量（零日期伪造）');
  const badKeys = records.flatMap((r, i) => keyPaths(r, `#${i}`).filter(forbiddenKey));
  eq(badKeys, [], 'schema 不得含 at/date 键');
  ok(!/Math\.random|Date\.now|new Date\(/.test(source), '生成器无随机/时间依赖');
  ok(!/compileBazi\(\s*\{\s*at\s*:/.test(source), '不得用日期入口');
  ok(/compileBazi\(\s*\{\s*pillars\s*\}/.test(source), '必须走 compileBazi({ pillars }) 纯组合入口');
  console.log(`  108 行；两次产物 ${text1.length} bytes 一致 ✓`);
}

console.log('[B] Schema 与枚举');
{
  const required = ['id', 'pillars', 'verdict', 'yong', 'ji', 'ratio', 'rooted', 'basis', 'source', 'compare'];
  for (const r of records) {
    ok(required.every((k) => Object.prototype.hasOwnProperty.call(r, k)), `${r.id} 缺字段：${required.filter((k) => !(k in r)).join(',')}`);
    ok(typeof r.id === 'string' && r.id.startsWith('QLMG-PJ-'), `${r.id} id 前缀`);
    ok(VERDICT_SET.has(r.verdict), `${r.id} verdict 枚举：${r.verdict}`);
    ok(WX_SET.has(r.yong), `${r.id} yong 非五行：${r.yong}`);
    ok(WX_SET.has(r.ji), `${r.id} ji 非五行：${r.ji}`);
    ok(typeof r.ratio === 'number' && r.ratio >= 0 && r.ratio <= 1, `${r.id} ratio 越界：${r.ratio}`);
    ok(typeof r.rooted === 'boolean', `${r.id} rooted 必须是布尔：${r.rooted}`);
    eq(r.basis, BASIS, `${r.id} 口径必须是扶抑`);
    eq(r.source, 'ganzhi', `${r.id} 必须来自纯组合入口`);
    ok(r.compare && typeof r.compare === 'object', `${r.id} compare 缺失`);
    ok(SW_CMP_ENUM.has(r.compare.strongWeak), `${r.id} compare.strongWeak 枚举：${r.compare.strongWeak}`);
    ok(YONG_CMP_SET.has(r.compare.yongWx), `${r.id} compare.yongWx 枚举：${r.compare.yongWx}`);
    ok(typeof r.compare.reason === 'string' && r.compare.reason.length > 0, `${r.id} compare.reason 非空`);
  }
  eq(new Set(records.map((r) => r.id)).size, 108, 'id 唯一');
  console.log('  字段/枚举/口径标记 全部通过 ✓');
}

console.log('[C] id 与语料按序一一对应；逐条复算一致');
{
  eq(records.map((r) => r.id), corpus.map((c) => c.id), 'id 顺序与语料一致');
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const row = corpus[i];
    eq(r.pillars, row.pillars.trim().split(/\s+/).join(' '), `${r.id} 四柱回显`);
    const e = compileBazi({ pillars: r.pillars.split(' ') });
    eq(e.meta.source, 'ganzhi', `${r.id} 复算 meta.source`);
    eq([e.L3_verdict.verdict, e.L5_yongJi.yong, e.L5_yongJi.ji], [r.verdict, r.yong, r.ji], `${r.id} 复算 verdict/yong/ji`);
    eq([e.L3_verdict.ratio, e.L3_verdict.rooted], [r.ratio, r.rooted], `${r.id} 复算 ratio/rooted`);
    ok(!('at' in e.input.raw) && !('date' in e.input.raw), `${r.id} 复算输入只有四柱，不含日期`);
    ok(Object.keys(e.input.raw).every((k) => k === 'pillars' || k === 'gender' || k === 'matter'), `${r.id} 复算输入字段仅允许 pillars/gender/matter`);
  }
  console.log('  108 条逐条复算一致 ✓');
}

console.log('[D] 分布与难例钉');
{
  const dist = Object.fromEntries(VERDICT_ENUM.map((v) => [v, records.filter((r) => r.verdict === v).length]));
  eq(dist, { 身旺: 30, 身弱: 41, 中和偏旺: 24, 中和偏弱: 9, 从强格: 1, 从弱格: 3 }, 'verdict 分布（R-B14 月令门后：12 条 身弱→中和偏旺）');
  for (const v of VERDICT_ENUM) ok(records.some((r) => r.verdict === v), `verdict 覆盖 ${v}`);
  const pin = (id, verdict, yong, ji) => {
    const r = byId.get(id);
    if (!ok(r, `${id} 存在`)) return;
    eq([r.verdict, r.yong, r.ji], [verdict, yong, ji], `${id} 引擎判定`);
  };
  pin('QLMG-PJ-001', '身弱', '火', '水');
  pin('QLMG-PJ-005', '中和偏旺', '木', '水');
  pin('QLMG-PJ-013', '身旺', '金', '木');
  pin('QLMG-PJ-035', '从强格', '水', '木');
  pin('QLMG-PJ-044', '从弱格', '木', '水');
  pin('QLMG-PJ-062', '中和偏弱', '金', '木');
  pin('QLMG-PJ-072', '从弱格', '木', '水');
  pin('QLMG-PJ-078', '从弱格', '金', '木');
  pin('QLMG-PJ-108', '身弱', '水', '木');
  console.log('  六种 verdict 全覆盖 + 9 个难例钉通过 ✓');
}

console.log('[E] 口径差登记（格法 vs 扶抑）');
{
  const refs = corpus.map((row) => extractRecord(row));
  const gt = readFileSync(GROUNDTRUTH_PATH, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  eq(gt.length, 108, 'groundtruth 108 行');
  const gtById = new Map(gt.map((r) => [r.id, r]));
  for (let i = 0; i < records.length; i++) {
    const id = records[i].id;
    eq(records[i].compare, refs[i].compare, `${id} compare 与 saying 提取器一致`);
    eq(records[i].compare, gtById.get(id)?.compare, `${id} compare 与 groundtruth.jsonl 一致`);
    eq(records[i].compare.strongWeak === '不可比', refs[i].strongWeak === null, `${id} strongWeak=null ⇔ 不可比`);
    eq(records[i].compare.yongWx === '不可比', refs[i].yongWx === null, `${id} yongWx=null ⇔ 不可比`);
  }
  const cmpCount = (v) => records.filter((r) => r.compare.yongWx === v).length;
  eq(COMPARE_ENUM.map(cmpCount), [4, 36, 4, 64], '口径差四类计数（一致/口径差/真分歧/不可比）');
  ok(records.some((r) => r.compare.strongWeak === '一致'), '强弱对拍至少有 1 条一致');
  ok(records.some((r) => r.compare.strongWeak === '分歧'), '强弱对拍至少有 1 条分歧（格法 vs 扶抑）');
  ok(records.some((r) => r.compare.strongWeak === '不可比'), '强弱对拍至少有 1 条不可比');
  // 预测必须独立于原文：原文有值时引擎仍可给出不同用神（记口径差/真分歧，不是错误）
  const differed = records.filter((r, i) => refs[i].yongWx !== null && r.yong !== refs[i].yongWx).length;
  ok(differed >= 35, `引擎用神与原文不同 ${differed} 行（口径差/真分歧，不是错误）`);
  ok(records.every((r) => r.basis === BASIS), '口径已登记：引擎用扶抑');
  console.log(`  覆盖：一致 ${cmpCount('一致')}｜口径差 ${cmpCount('口径差')}｜真分歧 ${cmpCount('真分歧')}｜不可比 ${cmpCount('不可比')}；用神不同 ${differed}/44 ✓`);
}

console.log('[F] 单条记录可重放');
{
  const row = corpus[0];
  const a = predictRecord(row);
  const b = predictRecord(row);
  eq(a, b, 'predictRecord 同输入两次深相等');
  eq(a.id, row.id, 'predictRecord id');
  ok(a.raw === undefined && a.saying === undefined, 'prediction 不夹带原文');
  ok(!('at' in a) && !('date' in a), 'prediction 无 at/date');
  console.log('  predictRecord 逐条重放一致 ✓');
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
