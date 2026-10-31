// 八字 · 四柱 → 引擎预测（u2-pillars-predict）
//
// 只做三件事：
//   1) 由四柱复算：compileBazi({ pillars }) 纯组合入口（meta.source === 'ganzhi'）。
//      **零日期** —— 语料只有四柱，绝不构造出生时间；产物里也没有 at/date 键。
//   2) 提取引擎判定：L3_verdict.verdict 与 L5_yongJi.{yong,ji}
//      （另存 ratio/rooted 作证据，均由引擎产出，不按原文回填）。
//   3) 登记口径差：原文是民国子平「格法/官格用印」，本引擎是「扶抑」。
//      逐条 compare 机械分类（一致 / 口径差 / 真分歧 / 不可比），不改写任一侧取值；
//      参考侧只用于分类，不参与预测。
//
// 产物：data/bazi-corpus/paired/predictions.jsonl（108 行，id 与语料同序，LF 结尾）

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBazi } from './engine.mjs';
import { extractRecord, readCorpus } from './extract-saying.mjs';
import { WU_XING_LIST } from './wuxing.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

export const PREDICTIONS_PATH = join(ROOT, 'data', 'bazi-corpus', 'paired', 'predictions.jsonl');
export const VERDICT_ENUM = ['身旺', '身弱', '中和偏旺', '中和偏弱', '从强格', '从弱格'];
export const BASIS = '扶抑';
export const COMPARE_ENUM = ['一致', '口径差', '真分歧', '不可比'];

const WX_SET = new Set(WU_XING_LIST);

/** 四柱字符串 → 4 个干支；不足/超出即抛错（不补、不猜） */
export function splitPillars(text) {
  const pillars = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (pillars.length !== 4) throw new Error(`需要 4 柱，实得 ${pillars.length}：${text}`);
  return pillars;
}

/**
 * 单条预测。
 * - verdict/yong/ji/ratio/rooted 只取自 compileBazi({ pillars })；
 * - compare 取自 saying 提取器的机械对拍（参考侧不参与预测，只用于登记口径差）。
 * @param {object} row 语料行（id / pillars / saying ...）
 * @param {object} [reference] 参考侧提取结果（缺省按 saying 现算）
 */
export function predictRecord(row, reference = extractRecord(row)) {
  const pillars = splitPillars(row.pillars);
  const engine = compileBazi({ pillars });
  if (engine.meta.source !== 'ganzhi') {
    throw new Error(`${row.id}: 非纯组合入口（meta.source=${engine.meta.source}）`);
  }
  const { verdict, ratio, rooted } = engine.L3_verdict;
  const { yong, ji } = engine.L5_yongJi;
  if (!VERDICT_ENUM.includes(verdict)) throw new Error(`${row.id}: verdict 越界 ${verdict}`);
  if (!WX_SET.has(yong) || !WX_SET.has(ji)) throw new Error(`${row.id}: yong/ji 非五行 ${yong}/${ji}`);
  return {
    id: row.id,
    pillars: pillars.join(' '),
    verdict,
    yong,
    ji,
    ratio,
    rooted,
    basis: BASIS,
    source: engine.meta.source,
    compare: reference.compare,
  };
}

export function predictAll(rows = readCorpus()) {
  return rows.map((row) => predictRecord(row));
}

export function buildPredictionsText(rows = readCorpus()) {
  return predictAll(rows).map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function main() {
  const text = buildPredictionsText();
  writeFileSync(PREDICTIONS_PATH, text, 'utf8');
  const records = text.trim().split('\n').map((line) => JSON.parse(line));
  console.log(`已写入 ${records.length} 行 → ${PREDICTIONS_PATH}`);
  console.log(`verdict 分布：${VERDICT_ENUM.map((v) => `${v} ${records.filter((r) => r.verdict === v).length}`).join('｜')}`);
  console.log(`口径差登记：${COMPARE_ENUM.map((c) => `${c} ${records.filter((r) => r.compare.yongWx === c).length}`).join('｜')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
