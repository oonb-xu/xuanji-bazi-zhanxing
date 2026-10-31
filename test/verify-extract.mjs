// 《千里命稿》评断篇 saying → ground-truth 提取器回归钉
//
// 验证四件事：
//   1) 108 行、schema 枚举、raw 原文逐字保留；
//   2) 纯规则确定性：同输入两次产物字节一致，且 groundtruth.jsonl 与提取器输出一致；
//   3) 关键难例：从格否定、多命例切范围、引文/假设句、反语喜忌、格法换算；
//   4) 口径差已登记：compare 字段区分 一致 / 口径差 / 真分歧 / 不可比。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CORPUS_PATH, GROUNDTRUTH_PATH, WX_ORDER, STRONG_WEAK_ENUM,
  readCorpus, buildGroundtruthText, extractRecord,
} from '../src/bazi/extract-saying.mjs';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}：期望 ${JSON.stringify(b)} 实得 ${JSON.stringify(a)}`);

const corpus = readCorpus();
const text1 = buildGroundtruthText(corpus);
const text2 = buildGroundtruthText(corpus);
const lines = text1.trim().split('\n');
const records = lines.map((l) => JSON.parse(l));
const byId = new Map(records.map((r) => [r.id, r]));
const source = readFileSync(fileURLToPath(new URL('../src/bazi/extract-saying.mjs', import.meta.url)), 'utf8');

console.log('[A] 文件、行数、确定性');
{
  eq(corpus.length, 108, '语料 108 行');
  ok(text1 === text2, '同输入两次产物字节一致');
  const disk = readFileSync(GROUNDTRUTH_PATH, 'utf8');
  ok(disk === text1, 'groundtruth.jsonl 与提取器输出字节一致（改动提取器后须重跑 node src/bazi/extract-saying.mjs）');
  eq(lines.length, 108, 'groundtruth 恰 108 行');
  ok(text1.endsWith('\n'), '文件以 LF 结尾');
  ok(!text1.includes('\r'), '行尾统一 LF（无 CR）');
  ok(!text1.startsWith('\uFEFF'), '无 BOM');
  ok(lines.every((l) => l.trim() === l && l.length > 0), '无空行/行尾空白');
  ok(!/Math\.random|Date\.now|new Date\(/.test(source), '提取器无随机/时间依赖');
  ok(!/\bfetch\s*\(|https?:\/\//.test(source), '提取器无网络调用');
  ok(!/compileBazi\(\s*\{\s*at\s*:/.test(source), '不得用日期入口（语料只有四柱）');
  ok(/compileBazi\(\s*\{\s*pillars/.test(source), '必须走 compileBazi({ pillars }) 纯组合入口');
  console.log(`  108 行；两次产物 ${text1.length} bytes 一致 ✓`);
}

console.log('[B] Schema 与枚举');
{
  const required = ['id', 'strongWeak', 'yongWx', 'xiSet', 'jiSet', 'method', 'raw'];
  const swEnum = new Set([...STRONG_WEAK_ENUM, null]);
  const yongEnum = new Set([...WX_ORDER, null]);
  const wxSet = new Set(WX_ORDER);
  const canonical = (arr) => arr.every((w, i) => i === 0 || WX_ORDER.indexOf(arr[i - 1]) < WX_ORDER.indexOf(w));
  for (const r of records) {
    ok(required.every((k) => Object.prototype.hasOwnProperty.call(r, k)), `${r.id} 缺字段：${required.filter((k) => !(k in r)).join(',')}`);
    ok(typeof r.id === 'string' && r.id.startsWith('QLMG-PJ-'), `${r.id} id 前缀`);
    ok(swEnum.has(r.strongWeak), `${r.id} strongWeak 枚举：${r.strongWeak}`);
    ok(yongEnum.has(r.yongWx), `${r.id} yongWx 枚举：${r.yongWx}`);
    for (const [k, v] of [['xiSet', r.xiSet], ['jiSet', r.jiSet]]) {
      ok(v === null || (Array.isArray(v) && v.every((w) => wxSet.has(w))), `${r.id} ${k} 必须是 null 或五行数组`);
      if (Array.isArray(v)) {
        ok(new Set(v).size === v.length, `${r.id} ${k} 不得重复`);
        ok(canonical(v), `${r.id} ${k} 必须按 木火土金水 排序：${v.join('')}`);
      }
    }
    ok(typeof r.method === 'string' && r.method.length > 0, `${r.id} method 非空`);
    ok(typeof r.raw === 'string' && r.raw.length > 0, `${r.id} raw 非空`);
    ok(/strongWeak=/.test(r.method) && /yongWx=/.test(r.method) && /xiSet=/.test(r.method) && /jiSet=/.test(r.method), `${r.id} method 必须逐项登记四个字段`);
    ok(r.compare && typeof r.compare === 'object', `${r.id} compare 缺失`);
    ok(['一致', '分歧', '不可比'].includes(r.compare.strongWeak), `${r.id} compare.strongWeak 枚举`);
    ok(['一致', '口径差', '真分歧', '不可比'].includes(r.compare.yongWx), `${r.id} compare.yongWx 枚举`);
    ok(typeof r.compare.reason === 'string' && r.compare.reason.length > 0, `${r.id} compare.reason 非空`);
    eq(r.compare.strongWeak === '不可比', r.strongWeak === null, `${r.id} strongWeak=null ⇔ compare=不可比`);
    eq(r.compare.yongWx === '不可比', r.yongWx === null, `${r.id} yongWx=null ⇔ compare=不可比`);
    eq(r.raw, corpus.find((c) => c.id === r.id).saying, `${r.id} raw 必须是 saying 原文（逐字）`);
  }
  eq(new Set(records.map((r) => r.id)).size, 108, 'id 唯一');
  eq(records.map((r) => r.id), corpus.map((c) => c.id), 'id 顺序与语料一致');
  console.log('  字段/枚举/集合排序/raw 原文 全部通过 ✓');
}

console.log('[C] 关键难例（避免从格否定、多命例、引文/假设句、反语误判）');
{
  const pin = (id, sw, yong, xi, ji) => {
    const r = byId.get(id);
    eq([r.strongWeak, r.yongWx, r.xiSet, r.jiSet], [sw, yong, xi, ji], id);
  };
  pin('QLMG-PJ-001', '弱', '木', ['木', '火'], ['金']);
  pin('QLMG-PJ-003', '弱', '金', [], ['火']);
  pin('QLMG-PJ-004', '强', '水', ['木', '水'], ['火', '土']);
  pin('QLMG-PJ-005', '中和', '水', null, ['木']);
  pin('QLMG-PJ-013', '从格', '木', null, null);
  pin('QLMG-PJ-025', '弱', null, null, null);
  pin('QLMG-PJ-030', '弱', '土', null, null);
  pin('QLMG-PJ-037', '强', null, ['木', '火'], null);
  pin('QLMG-PJ-041', '弱', '水', null, null);
  pin('QLMG-PJ-042', '强', null, null, null);
  pin('QLMG-PJ-044', '从格', '火', null, null);
  pin('QLMG-PJ-047', null, null, null, null);
  pin('QLMG-PJ-051', '中和', null, [], []);
  pin('QLMG-PJ-052', '强', null, null, null);
  pin('QLMG-PJ-054', null, '木', null, null);
  pin('QLMG-PJ-056', '弱', null, ['木', '火'], ['水']);
  pin('QLMG-PJ-057', '从格', '木', null, ['金']);
  pin('QLMG-PJ-058', '强', null, null, ['火']);
  pin('QLMG-PJ-062', '中和', null, ['木', '火'], null);
  pin('QLMG-PJ-067', '弱', null, null, null);
  pin('QLMG-PJ-075', '强', null, null, null);
  pin('QLMG-PJ-076', '弱', null, null, null);
  pin('QLMG-PJ-082', '强', '土', ['木', '土'], null);
  pin('QLMG-PJ-084', '中和', '水', ['木', '火'], ['金']);
  pin('QLMG-PJ-087', '强', '金', null, ['木', '火']);
  pin('QLMG-PJ-088', '强', '金', null, ['火']);
  pin('QLMG-PJ-102', '强', '土', ['水'], null);
  pin('QLMG-PJ-105', '从格', '土', null, null);
  pin('QLMG-PJ-108', '强', '火', null, ['水']);
  console.log(`  ${29} 个难例钉全部通过 ✓`);
}

console.log('[D] 规则覆盖与口径差登记');
{
  const count = (k) => records.filter((r) => r[k] !== null).length;
  ok(count('strongWeak') >= 60, `strongWeak 非 null 覆盖 ${count('strongWeak')}/108（应 ≥60）`);
  ok(count('yongWx') >= 40, `yongWx 非 null 覆盖 ${count('yongWx')}/108（应 ≥40）`);
  ok(count('xiSet') >= 18, `xiSet 非 null 覆盖 ${count('xiSet')}/108（应 ≥18）`);
  ok(count('jiSet') >= 18, `jiSet 非 null 覆盖 ${count('jiSet')}/108（应 ≥18）`);
  const cmp = (v) => records.filter((r) => r.compare.yongWx === v).length;
  ok(cmp('一致') >= 1, '口径差分类：至少 1 条「一致」');
  ok(cmp('口径差') >= 1, '口径差分类：至少 1 条「口径差」（古人格法 vs 引擎扶抑）');
  ok(cmp('真分歧') >= 1, '口径差分类：至少 1 条「真分歧」');
  ok(cmp('不可比') >= 1, '口径差分类：至少 1 条「不可比」');
  ok(!records.some((r) => r.compare.yongWx === '口径差' && r.yongWx === null), '口径差行必须原文有值');
  // 明确登记的规则边界
  ok(!byId.get('QLMG-PJ-030').method.includes('日干旺'), '030 的「喜忌篇云。日干旺甚无依」是引文，不得判强');
  ok(!byId.get('QLMG-PJ-041').method.includes('从格'), '041 的从杀格被原文否定，不得判从格');
  ok(!byId.get('QLMG-PJ-042').method.includes('从格'), '042 的曲直格被「佥谓/谬」否定，不得判从格');
  ok(!byId.get('QLMG-PJ-047').method.includes('从财'), '047 从财格属于次男命例，不得算到女婴本行');
  ok(!byId.get('QLMG-PJ-052').jiSet, '052「宜其凶悍无比」的「无比」不是比劫，不得判忌火');
  ok(!byId.get('QLMG-PJ-088').jiSet?.includes('土'), '088「恶燥」不得回头抓「戊为阳土」判忌土');
  ok(!byId.get('QLMG-PJ-017').xiSet, '017「辰运亦有喜无尤」不是五行喜，不得抓下一句己土');
  ok(!byId.get('QLMG-PJ-071').xiSet, '071「固所宜焉」不是五行喜，不得抓下一句壬水');
  ok(byId.get('QLMG-PJ-076').yongWx === null, '076 的「用亥中甲木」属于另一女命，本行不得取用神');
  ok(byId.get('QLMG-PJ-075').strongWeak === '强', '075「身主强健」属本行；「财多身弱」属另一命');
  ok(byId.get('QLMG-PJ-084').strongWeak === '中和', '084「乃得中和」属本行；「身强财旺」属婿命');
  ok(byId.get('QLMG-PJ-062').strongWeak === '中和', '062「不以弱论」属本行；「身弱逢财」属另一辛卯造');
  console.log(`  覆盖：强弱 ${count('strongWeak')}｜用神 ${count('yongWx')}｜喜 ${count('xiSet')}｜忌 ${count('jiSet')}｜一致 ${cmp('一致')}｜口径差 ${cmp('口径差')}｜真分歧 ${cmp('真分歧')}｜不可比 ${cmp('不可比')} ✓`);
}

console.log('[E] 单条记录可重放');
{
  const row = corpus.find((r) => r.id === 'QLMG-PJ-001');
  const a = extractRecord(row);
  const b = extractRecord(row);
  eq(a, b, 'extractRecord 同输入两次深相等');
  ok(a.raw.includes('故丙干以弱论'), '001 raw 保留原文');
  console.log('  extractRecord 逐条重放一致 ✓');
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
