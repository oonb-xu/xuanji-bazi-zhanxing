// 108 条古籍语料 vs 引擎 —— 逐条对拍（直接在当前会话跑，不拆包）
//
// 数据：data/bazi-corpus/paired/pillars-sayings.jsonl
//   pillars: "癸未 甲子 丙戌 己亥"（空格分隔，四柱齐全）
//   saying : 古文，含「强弱」「用神」「喜忌」「岁运」分段
//
// 引擎：compileBazi({ pillars: [...], gender })  ← engine.mjs:263 直接接受四柱，无需日期
//
// 口径登记：古人多为「格法」（官格用印、食神制杀格…），本引擎为「扶抑」。
//   两者用神允许不同，**不是错误** ⇒ 分类为 一致 / 疑似口径差 / 真分歧，而不是简单判错。
import fs from 'node:fs';
import { compileBazi } from '../src/bazi/engine.mjs';

const WX = ['木', '火', '土', '金', '水'];
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 生
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };      // 克

const lines = fs.readFileSync('data/bazi-corpus/paired/pillars-sayings.jsonl', 'utf8')
  .split('\n').filter((s) => s.trim()).map((s) => JSON.parse(s));

/** 从 saying 里抽身强弱判定 —— v2：修三类误抓
 *  A 否定语境：「微论身强身弱」= 无论强弱 ⇒ 不判
 *  B 转折前假设：「本当以弱论，然…尚非至弱者也」⇒ 取转折后
 *  C 分段污染：岁运段里的「身弱」不是原局判定 ⇒ 只取「强弱」段
 */
function extractStrength(s) {
  // ① 只取「强弱」分段（原文用「；」分段，段首标「强弱」「用神」「喜忌」「岁运」）
  const segs = s.split('；').map((x) => x.trim());
  let target = segs.find((x) => /^强弱/.test(x));
  if (!target) {
    // 无分段标记：取全文前 200 字（避免抓到岁运）
    target = s.slice(0, 200);
  }
  // ② 剔除否定/无论语境
  if (/(微|无|不|毋|勿)论\s*身?\s*(强|旺|弱)|不论强弱|无论强弱|不可(以)?强弱论/.test(target)) {
    // 去掉这些子句后继续
    target = target.replace(/[^。；]*(微|无|不|毋|勿)论\s*身?\s*(强|旺|弱)[^。；]*/g, '');
  }
  // ③ 转折处理：古法常「本当以X论。然…」⇒ 以转折后为准
  const lastTurn = Math.max(target.lastIndexOf('然'), target.lastIndexOf('但'), target.lastIndexOf('惟'), target.lastIndexOf('乃'));
  const tail = lastTurn > 0 ? target.slice(lastTurn) : target;

  // ④ 判据优先级：显式「身既旺/身旺」> 「以X论」> 「尚非至弱」这类折中
  let m = tail.match(/身\s*(既)?\s*(旺|强|弱)/);
  if (m) return { v: m[2] === '弱' ? '身弱' : '身旺', ev: m[0], how: '身X(转折后)' };
  m = target.match(/以(旺|强|弱)论/);
  if (m && lastTurn < 0) return { v: m[1] === '弱' ? '身弱' : '身旺', ev: m[0], how: '以X论' };
  // ⑤ 折中式：「尚非至弱」「不为弱」「不失为中」
  if (/尚非至弱|不至(于)?弱|不为弱|非甚弱/.test(target)) return { v: '中和偏弱', ev: '尚非至弱', how: '折中' };
  if (/尚非至旺|不至(于)?旺|不为旺|非甚旺/.test(target)) return { v: '中和偏旺', ev: '尚非至旺', how: '折中' };
  // ⑥ 回首段再试一次以X论（无转折时）
  m = target.match(/以(旺|强|弱)论/);
  if (m) return { v: m[1] === '弱' ? '身弱' : '身旺', ev: m[0], how: '以X论(回退)' };
  m = target.match(/(偏|极|太)\s*(弱|旺|强)/);
  if (m) return { v: m[2] === '弱' ? '身弱' : '身旺', ev: m[0], how: '偏X' };
  return null;
}

/** 从 saying 里抽用神五行（先找显式五行，再把「用印/用官…」映射到五行） */
function extractYong(s, dmWx) {
  const seg = s.slice(Math.max(0, s.search(/用神|取用|喜用/)));
  const head = seg.slice(0, 80);
  // ① 十神名 → 五行（相对日主）
  const TG = [
    [/用\s*印|印为用|取印/, '印'], [/用\s*官|官为用|取官|用杀|杀为用/, '官杀'],
    [/用\s*财|财为用|取财/, '财'], [/用\s*食伤|食伤为用|用食|用伤|食神为用/, '食伤'],
    [/用\s*比劫|比劫为用/, '比劫'],
  ];
  for (const [re, g] of TG) if (re.test(head)) {
    const wx = g === '印' ? Object.keys(SHENG).find((w) => SHENG[w] === dmWx)
      : g === '官杀' ? Object.keys(KE).find((w) => KE[w] === dmWx)
        : g === '财' ? KE[dmWx]
          : g === '食伤' ? SHENG[dmWx]
            : dmWx;
    return { wx, ev: (head.match(re) || [])[0] + '→' + g + '→' + wx, how: '十神映射' };
  }
  // ② 显式五行
  for (const w of WX) {
    if (new RegExp(`用\\s*${w}|取\\s*${w}|喜\\s*${w}`).test(head)) return { wx: w, ev: '显式' + w, how: '显式五行' };
  }
  return null;
}

const rows = [];
for (const r of lines) {
  const p = r.pillars.trim().split(/\s+/);
  if (p.length !== 4) { rows.push({ id: r.id, err: '四柱不足' }); continue; }
  let eng;
  try { eng = compileBazi({ pillars: p, gender: r.gender === 'female' ? '女' : '男' }); }
  catch (e) { rows.push({ id: r.id, err: '引擎报错:' + e.message }); continue; }
  const dmWx = eng.L5_yongJi.candidates.dmWx;
  const srcS = extractStrength(r.saying);
  const srcY = extractYong(r.saying, dmWx);
  rows.push({
    id: r.id, pillars: r.pillars, dmWx,
    engStrength: eng.L3_verdict.verdict, engRatio: eng.L3_verdict.ratio,
    engYong: eng.L5_yongJi.yong, engJi: eng.L5_yongJi.ji,
    srcStrength: srcS, srcYong: srcY,
  });
}

// ── 统计 ──
const ok = rows.filter((r) => !r.err);
const withS = ok.filter((r) => r.srcStrength);
const withY = ok.filter((r) => r.srcYong);
const sMatch = withS.filter((r) => r.srcStrength.v === r.engStrength);
const cls = (v) => (/旺/.test(v) ? '旺' : /弱/.test(v) ? '弱' : '其他');
const sLoose = withS.filter((r) => cls(r.srcStrength.v) === cls(r.engStrength));
const yMatch = withY.filter((r) => r.srcYong.wx === r.engYong);

const pct = (n, d) => d ? (n / d * 100).toFixed(1) + '%' : 'n/a';
console.log('=== 108 条对拍总览 ===');
console.log('可解析四柱', ok.length, '/', lines.length, '｜引擎报错', rows.filter((r) => r.err).length);
console.log('');
console.log('[身强弱] 源文明说', withS.length, '条');
console.log('  严格一致(四档全等)', sMatch.length, '=', pct(sMatch.length, withS.length));
console.log('  宽容一致(旺~旺/弱~弱)', sLoose.length, '=', pct(sLoose.length, withS.length));
const sConf = {};
for (const r of withS) { const k = r.srcStrength.v + '→' + r.engStrength; sConf[k] = (sConf[k] || 0) + 1; }
console.log('  混淆:', JSON.stringify(sConf));
console.log('');
console.log('[用神] 源文可抽', withY.length, '条 → 一致', yMatch.length, '=', pct(yMatch.length, withY.length));
const yConf = {};
for (const r of withY) { const k = r.srcYong.wx + '→' + r.engYong; yConf[k] = (yConf[k] || 0) + 1; }
console.log('  混淆:', JSON.stringify(yConf));
console.log('');
console.log('=== 不一致样本（前 8 条，供人工判口径）===');
for (const r of withY.filter((x) => x.srcYong.wx !== x.engYong).slice(0, 8)) {
  console.log(`  ${r.id} ${r.pillars} 日主${r.dmWx} | 源用神=${r.srcYong.wx}(${r.srcYong.ev}) 引擎=${r.engYong} | 源强弱=${r.srcStrength?.v ?? '?'} 引擎=${r.engStrength}`);
}
fs.writeFileSync('data/bazi-corpus/paired/battle-result.json', JSON.stringify(rows, null, 1), 'utf8');
console.log('\n明细已落盘 data/bazi-corpus/paired/battle-result.json');
