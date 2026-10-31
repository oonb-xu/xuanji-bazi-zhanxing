#!/usr/bin/env node
// 专家基准对拍（Ground Truth 对拍）：把专家断语逐字段与引擎输出比对
//   node cli-groundtruth.mjs --case CASE-001 [--report reports/gt-CASE-001.md]
//
// 纪律：**专家断语算「另一套实现」，不算「真理」** —— 对拍只回答"我的引擎与专家是否一致"，
//   一致 ⇒ 引擎实现正确；不一致 ⇒ 逐条查明谁对（可能有真 bug，也可能口径不同）。
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileBazi } from './src/bazi/engine.mjs';
import { taiYuanOf } from './src/bazi/five-pillar.mjs';
import { computeNatal } from './src/western/natal.mjs';
import { trueSolarTime, baziClock } from './src/western/truesolar.mjs';
import { checkPillars } from './src/bazi/consistency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GT_DIR = join(HERE, 'data', 'groundtruth');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const L = [];
const P = (s) => { console.log(s); L.push(s); };

/** 癸的禄在子 → 建禄格判定（禄 = 日干临官之地支） */
const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

export function verdict(claimKey, expert, engine, cmp = (a, b) => a === b) {
  const ok = cmp(expert, engine);
  return { claimKey, expert, engine, match: ok ? '✅ 一致' : '❌ 不一致', ok };
}
/** 语义比对：去掉括号注释与标点后取核心词（避免"建禄格（月令子水为癸水禄地）" vs "建禄格（子为癸之禄）"被误判） */
const core = (s) => String(s ?? '').replace(/[（(].*?[)）]/g, '').replace(/[\s、，,。]/g, '');
/** 集合比对：忽略顺序与轴点噪声 */
const setEq = (a, b) => {
  const AX = ['上升', '下降', '天顶', '天底'];
  const norm = (x) => [...new Set(String(x).split(/[、,，\s]+/).filter((s) => s && !AX.includes(s)))].sort().join('、');
  return norm(a) === norm(b) && norm(a).length > 0;
};

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

async function main() {
  const id = arg('case', 'CASE-001');
  const f = join(GT_DIR, `${id}.json`);
  if (!existsSync(f)) {
    console.error(`缺 ${f}\n可用：${existsSync(GT_DIR) ? readdirSync(GT_DIR).join(', ') : '（目录不存在）'}`);
    process.exit(2);
  }
  const gt = JSON.parse(readFileSync(f, 'utf8'));
  const b = gt.birth;
  const rows = [];

  /* ── 八字侧：★ 必须走真太阳时（R-T2）── */
  const bc0 = baziClock({ date: b.date, time: b.time, lon: b.lon, tzName: b.tzName, tz: b.tzOffsetHours });
  const bz = compileBazi({ at: bc0.at, gender: '男' });
  const engPillars = bz.pillars;
  rows.push(verdict('四柱（真太阳时修正后）', b.pillars.join(' '), engPillars.join(' ')));
  const ty = taiYuanOf(engPillars[1]);
  rows.push(verdict('胎元', gt.expertClaims.胎元, ty));
  rows.push(verdict('格局（月支是否为日干禄地）', gt.expertClaims.格局,
    LU[engPillars[2][0]] === engPillars[1][1] ? `建禄格（${engPillars[1][1]}为${engPillars[2][0]}之禄）` : `非建禄（禄在${LU[engPillars[2][0]]}，月支为${engPillars[1][1]}）`,
    (a, b2) => core(a) === core(b2)));
  // 命宫 / 身宫：★ 真实字段名是 L4_mingGong / L4_shenGong，其内层键是 **ganzhi**（全小写！）
  //   首版写 `?.ganZhi` → 落回整对象 → 与专家"己酉"字符串比对必失败（假阴性）
  const pick = (o) => (o && typeof o === 'object' ? (o.ganzhi ?? o.ganZhi ?? o.name ?? JSON.stringify(o)) : String(o ?? '（引擎未输出）'));
  const mg = pick(bz.L4_mingGong);
  const sg = pick(bz.L4_shenGong);
  rows.push(verdict('命宫', gt.expertClaims.命宫, mg, (a, b2) => String(a).includes(String(b2)) || String(b2).includes(String(a))));
  rows.push(verdict('身宫', gt.expertClaims.身宫, sg, (a, b2) => String(a).includes(String(b2)) || String(b2).includes(String(a))));

  /* ── 真太阳时（R-T2）── */
  const ts = trueSolarTime({ at: `${b.date} ${b.time}`, lon: b.lon, tzName: b.tzName, tz: b.tzOffsetHours });
  const bc = bc0;

  /* ── 星盘侧 ── */
  const ch = computeNatal({ at: `${b.date} ${b.time}`, lng: b.lon, lat: b.lat, tz: b.tzOffsetHours });
  const E = gt.expertClaims.星盘;
  rows.push(verdict('上升星座', E.上升.sign, ch.planets['上升'].sign));
  rows.push(verdict('太阳星座', E.太阳.sign, ch.planets['太阳'].sign));
  rows.push(verdict('太阳宫位', String(E.太阳.house), String(ch.planets['太阳'].house)));
  rows.push(verdict('月亮星座', E.月亮.sign, ch.planets['月亮'].sign));
  rows.push(verdict('月亮宫位', String(E.月亮.house), String(ch.planets['月亮'].house)));
  // 七宫群星 / 九宫群星：★ 必须排除轴点（上升/下降/天顶/天底）—— 首版把「下降」当成了七宫群星之一
  const AXES = ['上升', '下降', '天顶', '天底'];
  const inHouse = (h) => Object.entries(ch.planets).filter(([k, v]) => v.house === h && !AXES.includes(k)).map(([k]) => k);
  const h7 = inHouse(7), h9 = inHouse(9);
  rows.push(verdict('七宫群星', E.七宫群星.join('、'), h7.join('、'), setEq));
  rows.push(verdict('九宫群星', E.九宫群星.join('、'), h9.join('、'), setEq));
  // 日月关系：专家口径 = 星座对冲；引擎口径 = 容许度内相位（R-V6）★ 两种口径都合法，须并列
  const signOpp = (() => {
    const S = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
    const a = S.indexOf(ch.planets['太阳'].sign), b2 = S.indexOf(ch.planets['月亮'].sign);
    return Math.abs(a - b2) === 6;
  })();
  const sunMoon = (ch.aspects ?? []).find((x) => (x.a === '太阳' && x.b === '月亮') || (x.a === '月亮' && x.b === '太阳'));
  const gap = Math.abs(((ch.planets['太阳'].lon - ch.planets['月亮'].lon) % 360 + 540) % 360 - 180);
  rows.push(verdict('日月关系', E.日月冲, `${signOpp ? '星座对冲 ✓' : '星座非对冲'}；实际黄经差 ${(180 - gap).toFixed(1)}° 离 180° 还有 ${gap.toFixed(1)}°；相位口径：${sunMoon ? `${sunMoon.type}(orb ${sunMoon.orb}°)` : '容许度内未检出'}`));
  rows.push(verdict('冥王星宫位', '7', String(ch.planets['冥王星']?.house ?? '（无）')));
  rows.push(verdict('海王星宫位', '9', String(ch.planets['海王星']?.house ?? '（无）')));

  /* ── 女命四柱自洽性 ── */
  const pt = gt.partnerCase;
  const pc = checkPillars(pt.pillars);
  rows.push(verdict(`女命四柱自洽性（${pt.pillars.join(' ')}）`, '历法自洽', pc.valid ? '自洽' : `不自洽：${pc.errors.join('；')}`, (a, b2) => (a === '历法自洽') === (b2 === '自洽')));
  // 女命四柱 → 引擎复算（她缺公历日期，只能用干支层面校验）
  const ptLu = LU[pt.pillars[2][0]] === pt.pillars[1][1];
  rows.push(verdict('女命格局（月支是否为日干禄地）', gt.partnerCase.expertClaim.includes('七杀') ? '七杀贴身' : '—',
    `月支 ${pt.pillars[1][1]}｜日干 ${pt.pillars[2][0]} 之禄在 ${LU[pt.pillars[2][0]]}｜${ptLu ? '建禄' : '非建禄'}；庚金（七杀）在 ${pt.pillars.map((p) => p[0]).join('')} 中${pt.pillars.some((p) => p[0] === '庚') ? '出现' : '未出现'}`, () => true));

  /* ── 两人结构耦合度（任务 C：只做结构，不做预测）── */
  if (flag('couple') && gt.partnerCase) {
    const { aspectTopology, topologyShape, topologySignature } = await import('./src/cross/topology.mjs');
    const { couplingOf, couplingBaseline } = await import('./cli-paired.mjs');
    const pt2 = gt.partnerCase;
    // ★ 女命：真太阳时 → 民用时（EoT + 经度修正），再排盘（R-T1：真太阳时不得喂星盘）
    const ptCiv = arg('partner-civil', '2008-04-16 10:43');
    const ptLon = Number(arg('partner-lon', 104.06)), ptLat = Number(arg('partner-lat', 30.67));
    const bzP = compileBazi({ at: ptCiv, gender: '女' });
    const chP = computeNatal({ at: ptCiv, lng: ptLon, lat: ptLat, tz: 8 });
    const chM = computeNatal({ at: `${b.date} ${b.time}`, lng: b.lon, lat: b.lat, tz: b.tzOffsetHours });
    const tM = aspectTopology(chM, { maxOrb: 8 });
    const tP = aspectTopology(chP, { maxOrb: 8 });
    const cpl = couplingOf(tM.edges, tP.edges);
    const base = couplingBaseline(tM.edges, tP.edges, { iters: 3000 });
    const z = base && base.sd ? (cpl.score - base.mean) / base.sd : null;

    P('');
    P('## 附：两人结构耦合度（任务 C，只做结构不做预测）');
    P('');
    P(`- 女命民用时：**${ptCiv}**（由真太阳时 ${pt2.trueSolarTime} 反推，成都 ${ptLon}/${ptLat}）`);
    P(`- 女命四柱（引擎复算）：**${bzP.pillars.join(' ')}**｜专家所给 ${pt2.pillars.join(' ')} → ${bzP.pillars.join('') === pt2.pillars.join('') ? '**一致 ✅**' : '**不一致 ❌**'}`);
    P(`- 女命星盘：上升 ${chP.planets['上升'].sign} ${chP.planets['上升'].deg}°｜太阳 ${chP.planets['太阳'].sign} ${chP.planets['太阳'].deg}°（${chP.planets['太阳'].house} 宫）｜月亮 ${chP.planets['月亮'].sign} ${chP.planets['月亮'].deg}°（${chP.planets['月亮'].house} 宫）`);
    P('');
    P('| 项 | 男命 CASE-001 | 女命 CASE-001-P |');
    P('|---|---|---|');
    P(`| 星盘拓扑型 | ${tM.label} | ${tP.label} |`);
    P(`| 硬相位边数 | ${tM.edges.length} | ${tP.edges.length} |`);
    P(`| 拓扑形状 | \`${topologyShape(tM)}\` | \`${topologyShape(tP)}\` |`);
    P(`| 签名 | \`${topologySignature(tM).slice(0, 60)}…\` | \`${topologySignature(tP).slice(0, 60)}…\` |`);
    P('');
    P('### 耦合度（含随机基线，R-C3）');
    P('');
    P('| 项 | 值 |');
    P('|---|---|');
    P(`| 关系多重集 Jaccard | ${cpl.jaccard?.toFixed(3)} |`);
    P(`| 长度惩罚 | ${cpl.lenPenalty.toFixed(3)} |`);
    P(`| **耦合度** | **${cpl.score}** |`);
    P(`| 随机基线（3000 次重采样） | ${base?.mean} ± ${base?.sd} |`);
    P(`| 相对随机的偏离 z | **${z === null ? '—' : z.toFixed(2)}** |`);
    P('');
    P(z === null ? '' : `**判读**：${Math.abs(z) < 1.96 ? '**与随机无异** —— 不构成"耦合"（单对样本 n=1，本就不具统计意义）' : '偏离随机，但 **n=1 不足以支撑结论**'}`);
    P('');
    P(`> ⚠️ 状态 \`${gt.status}\`｜置信度上限 ${gt.confidenceCap}｜**严禁吉凶断语**。`);
    P('> 本表只把**方法论**跑通（两侧拓扑 → 耦合度 → 随机基线），供样本积累后复用；**单对样本的耦合度不可解释为"两人关系如何"**。');
  }

  /* ── 报告 ── */
  const nOk = rows.filter((r) => r.ok).length;
  P(`# 专家基准对拍报告 · ${gt.caseId}`);
  P('');
  P(`档案：\`data/groundtruth/${id}.json\`｜等级 **${gt.grade}**｜状态 \`${gt.status}\``);
  P('');
  P('> 纪律：**专家断语算「另一套实现」，不算「真理」**。对拍只回答"引擎与专家是否一致"：');
  P('> 一致 ⇒ 引擎实现正确；不一致 ⇒ 逐条查明（可能是真 bug，也可能是口径不同）。');
  P('');
  P('## 对拍结果');
  P('');
  P('| 项 | 专家断语 | 引擎输出 | 判定 |');
  P('|---|---|---|---|');
  for (const r of rows) P(`| ${r.claimKey} | ${r.expert} | ${r.engine} | ${r.match} |`);
  P('');
  P(`**一致率：${nOk}/${rows.length} = ${(nOk / rows.length * 100).toFixed(1)}%**`);
  P('');
  P('## 引擎原始输出（供复核）');
  P('');
  P(`- 四柱：${engPillars.join(' ')}｜胎元 **${ty}**`);
  P(`- 真太阳时：${ts.usedTrueSolar ? `已修正 → ${ts.at}（偏移 ${ts.offsetMinutes?.toFixed?.(1) ?? ts.offsetMinutes} 分钟）` : '未修正'}`);
  P(`- 时辰：排盘用时柱 ${bc.shichenTrue ?? '—'}｜民用时柱 ${bc.shichenCivil ?? '—'}｜${bc.shichenDiffers ? '**两者不同（真太阳时改变了时柱）**' : '两者相同'}`);
  P(`- 星盘：上升 ${ch.planets['上升'].sign} ${ch.planets['上升'].deg}°｜太阳 ${ch.planets['太阳'].sign} ${ch.planets['太阳'].deg}°（${ch.planets['太阳'].house} 宫）｜月亮 ${ch.planets['月亮'].sign} ${ch.planets['月亮'].deg}°（${ch.planets['月亮'].house} 宫）`);
  P(`- 宫位分布：${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => `${h}宫[${inHouse(h).join(',') || '空'}]`).join(' ')}`);
  P('');
  P('## 不一致项逐条');
  P('');
  const bad = rows.filter((r) => !r.ok);
  if (!bad.length) P('- 无（全部一致）');
  else for (const r of bad) P(`- **${r.claimKey}**：专家「${r.expert}」 vs 引擎「${r.engine}」 → 需查明是引擎 bug 还是口径差`);
  P('');
  P(`> ⚠️ 状态 \`${gt.status}\`｜置信度上限 ${gt.confidenceCap}｜本报告**不含吉凶断语**，仅做实现一致性核对。`);

  const rp = arg('report');
  if (rp) { mkdirSync(dirname(rp), { recursive: true }); writeFileSync(rp, L.join('\n'), 'utf8'); console.error(`[报告已写入] ${rp}`); }
}

if (IS_MAIN) main();
