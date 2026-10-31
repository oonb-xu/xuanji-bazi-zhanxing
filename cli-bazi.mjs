#!/usr/bin/env node
// 八字 + 占星交叉修正 + 摩擦引擎 + 自发掘 CLI
//   node cli-bazi.mjs --at "1990-05-20 14:30" --gender 男 [--astro astro.json] [--matter "…"] [--json out.json]
//   node cli-bazi.mjs --pillars "庚午 辛巳 乙酉 癸未" [--astro astro.json]
//   node cli-bazi.mjs --mapping-list [--status verified|pending|contradicted]
//   node cli-bazi.mjs --at … --astro … --no-write     # 自发掘不落映射库
import { readFileSync, writeFileSync } from 'node:fs';
import { compileBazi } from './src/bazi/engine.mjs';
import { renderBazi } from './src/bazi/render.mjs';
import { calibrate, renderCalibration } from './src/cross/calibration.mjs';
import { friction, renderFriction } from './src/cross/friction.mjs';
import { timeline, renderTimeline } from './src/cross/timing.mjs';
import { discover, renderDiscovery } from './src/cross/discovery.mjs';
import { runDbDiscovery, renderDbDiscovery } from './src/cross/db-discovery.mjs';
import { loadKb, renderKb, listProposals, decideProposal, contradictionReview, runCount } from './src/cross/kb-db.mjs';
import { dignityTable } from './src/western/dignity.mjs';
import { ensureBasis, listLibrary, renderLibrary } from './src/cross/mapping-library.mjs';
import { computeNatal } from './src/western/natal.mjs';
import { renderNatal } from './src/western/natal.mjs';

/** 仅凭干支输入时，星盘无法定位时间：显式报错而不是猜 */
function baziTimeHint(ir) {
  if (ir.meta.local) return ir.meta.local;
  throw new Error('用 --lat/--lon 现场生成星盘时必须提供 --at（干支输入没有时间信息，星盘无法计算）');
}

// ---- argv 解析（必须在任何子命令之前） ----
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);

/* ── 知识库子命令（不跑排盘） ── */
const kbFlag = (k) => argv.includes(`--${k}`);
if (kbFlag('kb-list') || kbFlag('kb') || kbFlag('kb-proposals') || kbFlag('kb-review') || kbFlag('kb-accept') || kbFlag('kb-reject') || kbFlag('dignity')) {  const sub = kbFlag('kb-accept') ? 'accept' : kbFlag('kb-reject') ? 'reject'
    : kbFlag('kb-review') ? 'review' : kbFlag('kb-proposals') ? 'proposals' : kbFlag('dignity') ? 'dignity' : 'list';
  if (sub === 'dignity') {
    console.log('# 必然尊贵表（庙/旺/陷/落）');
    console.log('| 行星 | 庙 | 旺 | 陷 | 落 | 争议 |');
    console.log('|---|---|---|---|---|---|');
    for (const r of dignityTable()) console.log(`| ${r.planet} | ${r.庙} | ${r.旺} | ${r.陷} | ${r.落} | ${r.争议} |`);
    console.log('\n庙=守护星座；旺=擢升；陷=庙之对宫；落=旺之对宫。现代三王星的旺/落有异说，见 docs/06 裁定 R-W6。');
    process.exit(0);
  }
  if (sub === 'proposals') {
    const ps = listProposals();
    console.log(`# 数据库更新建议 · ${ps.length} 条`);
    for (const p of ps) console.log(`- [${p.status}] ${p.id}\n    ${p.target} ← ${p.entry}\n    理由：${p.reason}`);
    process.exit(0);
  }
  if (sub === 'review') {
    const r = contradictionReview({ runIndex: runCount() });
    console.log(`# 矛盾复盘（第 ${r.runIndex} 轮）· 扫描 ${r.scanned} 条，标记「${r.mark}」${r.flagged} 条`);
    for (const f of r.flags) console.log(`- ${f.claim}（支持 ${f.sup}/反例 ${f.con}/命盘 ${f.charts}）：${f.reasons.join('；')}`);
    process.exit(0);
  }
  const id = arg('kb-accept') ?? arg('kb-reject');
  if (id) { decideProposal(id, sub === 'accept' ? 'accepted' : 'rejected', arg('note', '')); console.log(`${sub === 'accept' ? '已采纳' : '已驳回'}：${id}`); process.exit(0); }
  console.log(renderKb(loadKb()));
  process.exit(0);
}

if (flag('mapping-list')) {
  ensureBasis();
  const items = listLibrary({ status: arg('status') });
  console.log(`# 跨系统映射库 · ${items.length} 条${arg('status') ? `（status=${arg('status')}）` : ''}`);
  console.log(renderLibrary(items));
  process.exit(0);
}

const pillarsRaw = arg('pillars');
const input = { at: arg('at'), matter: arg('matter'), gender: arg('gender') ?? '男' };
if (pillarsRaw) input.pillars = pillarsRaw.split(/[\s,]+/).filter(Boolean);
if (!input.at && !input.pillars) { console.error('需要 --at "YYYY-MM-DD HH:mm" 或 --pillars "年 月 日 时"（或用 --mapping-list 查看映射库）'); process.exit(2); }

const r = compileBazi(input);
const astroPath = arg('astro');
// 星盘来源优先级：--astro 文件 > --lat/--lon 现场生成 > 无（Part5/6 优雅降级）
let astro = astroPath ? JSON.parse(readFileSync(astroPath, 'utf8')) : null;
let natal = null;
if (!astro && (arg('lat') !== null || flag('natal'))) {
  natal = computeNatal({
    at: input.at ?? baziTimeHint(r),
    lat: arg('lat') !== null ? Number(arg('lat')) : undefined,
    lon: arg('lon') !== null ? Number(arg('lon')) : undefined,
    tz: arg('tz') !== null ? Number(arg('tz')) : undefined,
    houseSystem: arg('house-system', 'porphyry'),
    orb: arg('orb') !== null ? Number(arg('orb')) : undefined,
  });
  astro = { planets: natal.planets, aspects: natal.aspects };
  console.error(`[星盘已现场生成] 上升 ${natal.planets['上升'].sign}${natal.planets['上升'].deg}°｜${natal.meta.houseSystem}｜UTC ${natal.meta.utc}`);
}
const cal = calibrate(r, astro);
const fr = friction(r, astro);
const tl = timeline(r, astro, { fromYear: Number(arg('from-year')) || undefined });
const disc = discover({ bazi: r, astroInput: astro, friction: fr, write: !flag('no-write') });
const chartId = `${r.pillars.join('')}-${astro?.planets?.['太阳']?.sign ?? 'x'}`;
const part8 = flag('no-kb') ? { skipped: true, reason: '--no-kb' } : runDbDiscovery({ bazi: r, astroInput: astro, frictionResult: fr, chartId, write: !flag('no-write') });

const report = [
  renderBazi(r),
  natal ? '\n' + renderNatal(natal) : '',
  renderCalibration(cal, r), renderFriction(fr, r), renderTimeline(tl), renderDiscovery(disc), renderDbDiscovery(part8),
].join('\n');
console.log(report);

const out = arg('json');
if (out) { writeFileSync(out, JSON.stringify({ bazi: r, natal, calibration: cal, friction: fr, timeline: tl, discovery: disc, part8 }, null, 2), 'utf8'); console.error(`[IR 已写入] ${out}`); }
const md = arg('report');
if (md) { writeFileSync(md, report, 'utf8'); console.error(`[报告已写入] ${md}`); }
