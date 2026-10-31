#!/usr/bin/env node
// meta-unified/scripts/smoke.mjs —— 零依赖端到端冒烟（只用 node 内置 fetch / child_process）
//
// 用法：node meta-unified/scripts/smoke.mjs
// 行为：
//   1. 先探测 http://127.0.0.1:8788/api/health；已在跑就直连复用
//   2. 没在跑则 spawn(process.execPath, ['server.mjs'], { cwd, stdio: 'inherit' })
//      （stdio:'inherit' 避开受限模式下 pipe-stdio 的 EPERM）
//   3. 轮询 health 至 200，超时 5s
//   4. 逐个 POST 6 个请求：bazi(at) / bazi(pillars) / natal / fusion / synastry / liuren
//   5. 断言 HTTP 200、JSON ok === true、关键字段存在；逐条 PASS/FAIL + 一行汇总
//   6. 全过 process.exit(0)，任一失败 process.exit(1)
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = (process.env.SMOKE_BASE || 'http://127.0.0.1:8788').replace(/\/+$/, '');
const PORT = new URL(BASE).port || '8788';
const HEALTH_WAIT_MS = 5000;
const REQ_TIMEOUT_MS = 20000;

const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let child = null;

/* ───────── HTTP ───────── */

async function request(method, pathname, payload, timeoutMs = REQ_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + pathname, {
      method,
      headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function healthOk() {
  try {
    const r = await request('GET', '/api/health', undefined, 1200);
    return r.status === 200 && r.json?.ok === true;
  } catch {
    return false;
  }
}

/* ───────── 拉起或复用 server ───────── */

async function ensureServer() {
  if (await healthOk()) return { child: null, mode: 'reused' };

  const proc = spawn(process.execPath, ['server.mjs', PORT], { cwd: ROOT, stdio: 'inherit' });
  let exited = false;
  proc.on('exit', () => { exited = true; });

  const t0 = Date.now();
  while (Date.now() - t0 < HEALTH_WAIT_MS) {
    if (exited) throw new Error(`server.mjs 提前退出（code=${proc.exitCode}），无法启动 ${BASE}`);
    if (await healthOk()) return { child: proc, mode: 'spawned' };
    await sleep(150);
  }
  try { proc.kill(); } catch { /* 已在退出 */ }
  throw new Error(`health 轮询超时（${HEALTH_WAIT_MS}ms，${BASE}/api/health）`);
}

/* ───────── 断言与输出 ───────── */

const msg = (e) => String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 220);

async function check(name, fn) {
  try {
    const evidence = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${evidence ? `  (${evidence})` : ''}`);
  } catch (e) {
    results.push({ name, ok: false, reason: msg(e) });
    console.log(`FAIL  ${name}  <- ${msg(e)}`);
  }
}

/** 统一校验：HTTP 200 / JSON / ok === true / data 为对象 */
async function postOk(pathname, payload) {
  const r = await request('POST', pathname, payload);
  if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.text.slice(0, 140)}`);
  if (!r.json || typeof r.json !== 'object') throw new Error('响应不是 JSON');
  if (r.json.ok === true) {
    if (!r.json.data || typeof r.json.data !== 'object') throw new Error('响应缺少 data 对象');
    return r.json;
  }
  throw new Error(`ok !== true: ${r.text.slice(0, 140)}`);
}

const isObj = (x) => Boolean(x) && typeof x === 'object' && !Array.isArray(x);
const isArr = (x) => Array.isArray(x);

/* ───────── 主流程 ───────── */

try {
  const s = await ensureServer();
  child = s.child;
  console.log(`server: ${s.mode === 'reused' ? '复用已运行实例' : '已由本脚本拉起'} @ ${BASE}`);

  // ① health
  await check('GET  /api/health', async () => {
    const r = await request('GET', '/api/health');
    if (r.status !== 200) throw new Error(`HTTP ${r.status} ${r.text.slice(0, 140)}`);
    const j = r.json;
    if (!j || j.ok !== true) throw new Error(`ok !== true: ${r.text.slice(0, 140)}`);
    if (!isArr(j.routes)) throw new Error('缺少 routes 数组');
    const need = ['/api/bazi', '/api/natal', '/api/fusion', '/api/synastry', '/api/liuren'];
    const miss = need.filter((x) => !j.routes.includes(x));
    if (miss.length) throw new Error(`routes 缺少 ${miss.join(',')}`);
    return `routes=${j.routes.length}`;
  });

  // ② bazi：at 入参（男）
  await check('POST /api/bazi (at, 男)', async () => {
    const j = await postOk('/api/bazi', { at: '1990-06-15T10:30', gender: '男' });
    const d = j.data;
    if (!isArr(d.pillars) || d.pillars.length !== 4) throw new Error('缺少 data.pillars（4 柱）');
    return d.pillars.join(' ');
  });

  // ③ bazi：pillars 入参（女）
  await check('POST /api/bazi (pillars, 女)', async () => {
    const j = await postOk('/api/bazi', { pillars: ['戊子', '戊午', '乙巳', '甲申'], gender: '女' });
    const d = j.data;
    if (!isArr(d.pillars) || d.pillars.length !== 4) throw new Error('缺少 data.pillars（4 柱）');
    return d.pillars.join(' ');
  });

  // ④ natal
  await check('POST /api/natal', async () => {
    const j = await postOk('/api/natal', { at: '1990-06-15T10:30', lng: 116.4, lat: 39.9, tz: 8 });
    const d = j.data;
    if (!isArr(d.planets) || d.planets.length === 0) throw new Error('缺少 data.planets');
    return `planets=${d.planets.length}`;
  });

  // ⑤ fusion
  await check('POST /api/fusion', async () => {
    const j = await postOk('/api/fusion', { at: '1990-06-15T10:30', lng: 116.4, lat: 39.9, tz: 8, gender: '女' });
    const d = j.data;
    if (!isObj(d.bazi)) throw new Error('缺少 data.bazi');
    if (!isObj(d.natal)) throw new Error('缺少 data.natal');
    return `bazi.pillars=${d.bazi.pillars?.length}, natal.planets=${d.natal.planets?.length}`;
  });

  // ⑥ synastry
  await check('POST /api/synastry', async () => {
    const j = await postOk('/api/synastry', {
      a: { at: '1990-06-15T10:30', lng: 116.4, lat: 39.9, tz: 8, gender: '男' },
      b: { at: '1992-11-03T08:15', lng: 121.47, lat: 31.23, tz: 8, gender: '女' },
    });
    const d = j.data;
    if (!isObj(d.complementarity)) throw new Error('缺少 data.complementarity');
    return `total=${d.complementarity.total}`;
  });

  // ⑦ liuren
  await check('POST /api/liuren', async () => {
    const j = await postOk('/api/liuren', { at: '2024-06-15T10:30', matter: '冒烟测试' });
    const d = j.data;
    if (!isObj(d.pan)) throw new Error('缺少 data.pan');
    return `rotation=${d.pan.rotation ?? 'n/a'}`;
  });
} catch (e) {
  if (results.length === 0) {
    results.push({ name: 'server', ok: false, reason: msg(e) });
    console.log(`FAIL  server  <- ${msg(e)}`);
  }
} finally {
  if (child && child.exitCode === null) {
    try { child.kill(); } catch { /* 已退出 */ }
    await sleep(150);
  }
}

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
if (failed === 0 && results.length > 0) {
  console.log(`全部通过 · ALL PASS  (${passed}/${results.length})`);
  process.exit(0);
} else {
  console.log(`存在失败 · FAIL  (${passed}/${results.length})`);
  process.exit(1);
}
