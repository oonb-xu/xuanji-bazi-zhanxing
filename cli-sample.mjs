#!/usr/bin/env node
// 双盘样本采集 CLI —— 每次训练/采集写入本地库（data/samples.jsonl，只追加）
//   node cli-sample.mjs --add data/samples/案例001.json
//   node cli-sample.mjs --list | --stats | --show <id> | --template
//   node cli-sample.mjs --verify <id>|--all      # 重算双盘一致性（验证事件追加进库）
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { collectSample, loadSamples, sampleStats, renderSample, renderSampleRules, validateSample, SAMPLES_DB, SAMPLES_DIR, TEMPLATE } from './src/cross/sample.mjs';
import { BACKENDS, PRIMARY_BACKEND, hasKerykeion } from './src/western/backends.mjs';
import { EVENT_CATEGORIES, RULE_SPECS } from './src/cross/event-rules.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);

if (flag('template')) { console.log(TEMPLATE); console.log(`\n复制它改成你的样本，然后：node cli-sample.mjs --add <你的文件>`); process.exit(0); }

if (flag('add')) {
  const f = arg('add');
  if (!existsSync(f)) { console.error(`找不到样本文件：${f}`); process.exit(2); }
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  const v = validateSample(raw);
  if (!v.ok) { console.error(`样本校验失败：\n- ${v.errors.join('\n- ')}`); process.exit(2); }
  if (v.warnings.length) console.error(`[告警] ${v.warnings.join('；')}`);
  const rec = collectSample(raw, { houseSystem: arg('house-system', 'porphyry'), write: !flag('no-write'), noRules: flag('no-rules') });
  console.log(renderSample(rec));
  if (rec.consistencyOk === false) { console.error('\n[!] 双盘一致性未通过，请检查（详见 consistency.perBody）'); process.exit(4); }
  console.error(`[已写入] ${flag('no-write') ? '(dry-run 未写)' : `${SAMPLES_DB} + ${join(SAMPLES_DIR, rec.id + '.json')}`}`);
  process.exit(0);
}

if (flag('rules')) {
  console.log(renderSampleRules());
  console.log(`\n事件类别枚举（R-S6）：${EVENT_CATEGORIES.join(' / ')}`);
  console.log(`规则规格：${RULE_SPECS.map((r) => `${r.id}(${r.family}族)`).join('、')}`);
  process.exit(0);
}

if (flag('categories')) { console.log(EVENT_CATEGORIES.join('\n')); process.exit(0); }

if (flag('list')) {
  const all = loadSamples();
  console.log(`# 双盘样本库 · ${all.length} 条｜主后端 ${PRIMARY_BACKEND}｜kerykeion ${hasKerykeion() ? '可用' : '不可用'}`);
  console.log('| id | 名称 | 性别 | 出生 | 八字 | 一致性 | 事件 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const s of all) {
    const c = s.consistency;
    console.log(`| ${s.id} | ${s.name} | ${s.gender} | ${s.intake.birth_date.date} ${s.intake.birth_date.time} | ${s.bazi.pillars.join(' ')} | ${s.consistencyOk === null ? '—' : s.consistencyOk ? `✓ Δ${c.maxBodyDelta}°` : '✗'} | ${s.events?.length ?? 0} |`);
  }
  process.exit(0);
}

if (flag('show')) {
  const id = arg('show');
  const s = loadSamples().find((x) => x.id === id || x.id.endsWith(id));
  if (!s) { console.error(`未找到样本：${id}`); process.exit(2); }
  console.log(renderSample(s));
  process.exit(0);
}

if (flag('stats')) {
  const st = sampleStats();
  console.log(JSON.stringify(st, null, 2));
  const all = loadSamples();
  if (all.length) {
    console.log('\n| 指标 | 值 |');
    console.log('|---|---|');
    console.log(`| 样本数 | ${st.total} |`);
    console.log(`| 双盘齐备 | ${st.withKerykeion} |`);
    console.log(`| 一致性通过 / 未通过 | ${st.consistencyPass} / ${st.consistencyFail} |`);
    console.log(`| 生活事件数 | ${st.events} |`);
    console.log(`| 事件落在「引动刑冲」流年的比例 | ${(st.eventActivationRate * 100).toFixed(1)}% |`);
    console.log(`| 事件类别分布 | ${Object.entries(st.byCategory).map(([k, v]) => `${k}:${v}`).join('、')} |`);
    console.log(`| 后端 | ${st.backends.join('/')}（主 ${st.primary}） |`);
  }
  process.exit(0);
}

if (flag('verify')) {
  const want = arg('verify');
  const all = loadSamples();
  const targets = flag('all') || !want ? all : all.filter((s) => s.id === want || s.id.endsWith(want));
  if (!targets.length) { console.error('无可验证样本'); process.exit(2); }
  mkdirSync(SAMPLES_DIR, { recursive: true });
  let bad = 0;
  for (const s of targets) {
    const rec = collectSample(s.intake, { houseSystem: s.charts?.mine?.meta?.houseSystem ?? 'porphyry', write: false });
    const pass = rec.consistencyOk;
    if (pass === false) bad++;
    appendFileSync(SAMPLES_DB, JSON.stringify({ kind: 'verification', id: s.id, ts: new Date().toISOString(), consistencyOk: pass, maxBodyDelta: rec.consistency?.maxBodyDelta ?? null, angles: rec.consistency?.angles ?? null, aspectRate: rec.consistency?.aspect?.rate ?? null }) + '\n', 'utf8');
    console.log(`${pass === true ? '✓' : pass === false ? '✗' : '—'} ${s.id} Δ星体${rec.consistency?.maxBodyDelta ?? '—'}° Δ上升${rec.consistency?.angles?.asc ?? '—'}° 相位${rec.consistency ? (rec.consistency.aspect.rate * 100).toFixed(0) + '%' : '—'}`);
  }
  console.log(`\n重验 ${targets.length} 条，未通过 ${bad} 条（验证事件已追加进库）`);
  process.exit(bad ? 4 : 0);
}

console.log(`双盘样本采集 · 后端 ${BACKENDS.join('/')}（主 ${PRIMARY_BACKEND}）｜kerykeion ${hasKerykeion() ? '可用' : '不可用'}
用法：
  node cli-sample.mjs --template                  # 打印样板模板路径
  node cli-sample.mjs --add <sample.json>         # 采集并写入本地库
  node cli-sample.mjs --list | --stats | --show <id>
  node cli-sample.mjs --verify <id>|--all         # 重算双盘一致性
库：${SAMPLES_DB}`);
