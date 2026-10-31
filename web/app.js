// 玄机 · 中西命理融合 —— 前端应用（纯原生 JavaScript，零依赖零构建）
//
// 铁律：接口没给的东西一律渲染「不可用：原因」，绝不用默认值/占位值填充。
// 所有渲染器逐字段判空：null / undefined / 空数组 / 缺键 全部走 na()。
//
// 载入方式说明：web/index.html 用的是 <script src="/app.js">（无 type="module"），
// 所以本文件不含 import/export 语句 —— 它既能被经典 script 标签直接执行，
// 本身也仍是合法的 ES module（无模块专用语法）。整文件包在 IIFE 内，不污染全局。
//
// 数据来源（server.mjs）：
//   POST /api/bazi      POST /api/natal    POST /api/fusion
//   POST /api/synastry  POST /api/liuren   GET  /api/health
import { mountStage, setPlanets } from '/stage.js';

(() => {
'use strict';

/* ══════════════════════ 常量 ══════════════════════ */

const API = {
  bazi: '/api/bazi',
  natal: '/api/natal',
  fusion: '/api/fusion',
  synastry: '/api/synastry',
  liuren: '/api/liuren',
  health: '/api/health',
};

const WX_ORDER = ['木', '火', '土', '金', '水'];
const WX_COLOR = { 木: '#3fb68b', 火: '#e0674d', 土: '#b08d57', 金: '#c8cdd6', 水: '#4a90d9' };
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const ASPECT_COLOR = {
  合相: '#c9a227', 六分相: '#4a90d9', 三分相: '#3fb68b',
  四分相: '#d9534f', 对冲: '#e0674d', 梅花相: '#5b6376',
};
const CAND_LABEL = { yinWx: '印', dmWx: '日主/比劫', shiWx: '食伤', caiWx: '财', guanWx: '官杀' };
const SVG_NS = 'http://www.w3.org/2000/svg';
const SEC_STYLE = 'margin:0 0 10px;font-size:14px;color:#c9a227;font-weight:600;letter-spacing:.4px';

/* ══════════════════════ DOM 工具 ══════════════════════ */

/** q() —— 单元素查询（找不到返回 null，调用方必须判空） */
function q(sel, root = document) {
  return (root || document).querySelector(sel);
}

/** qa() —— 多元素查询，返回真数组 */
function qa(sel, root = document) {
  return Array.from((root || document).querySelectorAll(sel));
}

function isObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isNode(v) {
  return typeof Node !== 'undefined' && v instanceof Node;
}
function finite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function blank(v) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

function appendKids(node, kids) {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    if (Array.isArray(kid)) appendKids(node, kid);
    else if (isNode(kid)) node.append(kid);
    else node.append(document.createTextNode(String(kid)));
  }
}

/**
 * el() —— 建元素。
 *   el('div', { class:'card', style:'color:red', dataset:{a:'1'}, onclick:fn }, child, [child...], 'text')
 * props 为 null 时忽略；值 null/undefined 的属性跳过（不写空属性）。
 */
function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props && typeof props === 'object') {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') node.className = String(v);
      else if (k === 'style' && isObj(v)) Object.assign(node.style, v);
      else if (k === 'dataset' && isObj(v)) Object.assign(node.dataset, v);
      else if (k === 'text') node.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, String(v));
    }
  }
  appendKids(node, kids);
  return node;
}

/* ══════════════════════ 离线闸门 ══════════════════════
 * 服务不可用时：全屏遮罩 + 原因 + 重试按钮；锁定期间拦截所有表单提交，
 * 3 秒自动重试健康检查；恢复后移除遮罩并回到 30 秒保活轮询。
 */

const gate = { locked: false, reason: '', mask: null, timer: 0 };
let gateKeepTimer = 0;

function ensureGateStyle() {
  if (q('#gate-style')) return;
  document.head.append(el('style', { id: 'gate-style' }, [
    '#gate-mask.flash .card{animation:gateFlash .5s ease 2}',
    '@keyframes gateFlash{0%{outline:0 solid rgba(217,83,79,0)}50%{outline:3px solid rgba(217,83,79,.9)}100%{outline:0 solid rgba(217,83,79,0)}}',
    '#gate-mask button:hover{background:#2c3447 !important}',
  ].join('\n')));
}

/** buildGateMask() —— 建全屏遮罩（深色半透明 + 居中 .card）并挂到 body */
function buildGateMask() {
  ensureGateStyle();
  const reasonNode = el('div', {
    id: 'gate-reason',
    class: 'note',
    style: 'margin:10px 0;color:#b9c0cc;font-size:13px;word-break:break-all',
  }, gate.reason || '无法连接 /api/health');
  const retry = el('button', {
    type: 'button',
    style: 'margin-top:8px;padding:8px 20px;border-radius:8px;border:1px solid #3a4152;background:#222838;color:#e8eaef;cursor:pointer;font-size:14px',
    onclick: () => { void checkHealth(); },
  }, '重试');
  const mask = el('div', {
    id: 'gate-mask',
    style: 'position:fixed;inset:0;z-index:9999;background:rgba(8,10,14,.78);display:flex;align-items:center;justify-content:center;padding:20px',
  }, el('div', {
    class: 'card',
    style: 'max-width:420px;margin:0;text-align:center;background:#161b26;border:1px solid #2c3344;border-radius:12px;padding:22px 26px;box-shadow:0 12px 40px rgba(0,0,0,.55)',
  },
    el('div', { style: 'font-size:18px;font-weight:600;color:#e8eaef' }, '未连接 API'),
    reasonNode,
    retry,
  ));
  document.body.append(mask);
  gate.mask = mask;
  return mask;
}

/** lock(reason) —— 锁定：确保遮罩存在、写入原因、标记 #health 为 bad、3 秒自动重试 */
function lock(reason) {
  gate.locked = true;
  gate.reason = reason || '无法连接 API 服务';
  const mask = gate.mask && gate.mask.isConnected ? gate.mask : buildGateMask();
  gate.mask = mask;
  const reasonNode = q('#gate-reason', mask);
  if (reasonNode) reasonNode.textContent = gate.reason;
  const box = q('#health');
  if (box) {
    box.classList.add('bad');
    box.classList.remove('ok');
  }
  if (!gate.timer) gate.timer = setInterval(checkHealth, 3000);
}

/** unlock() —— 解锁：移除遮罩、标记 #health 为 ok、结束 3 秒重试并恢复 30 秒保活 */
function unlock() {
  gate.locked = false;
  gate.reason = '';
  if (gate.mask) {
    gate.mask.remove();
    gate.mask = null;
  }
  const box = q('#health');
  if (box) {
    box.classList.add('ok');
    box.classList.remove('bad');
  }
  if (gate.timer) {
    clearInterval(gate.timer);
    gate.timer = 0;
  }
  if (!gateKeepTimer) gateKeepTimer = setInterval(checkHealth, 30000);
}

/* 锁定期间在捕获阶段截断表单提交，任何业务 submit 处理器都不会跑、也不发请求 */
if (typeof document !== 'undefined') {
  document.addEventListener('submit', (e) => {
    if (gate.locked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      gate.mask?.classList.add('flash');
    }
  }, true);
}

function svgEl(tag, attrs, ...kids) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs && typeof attrs === 'object') {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      node.setAttribute(k, String(v));
    }
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined) continue;
    node.append(isNode(kid) ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** na() —— 兜底：字段不可用就只说实话，绝不填假值 */
function na(reason) {
  return el('span', {
    class: 'na',
    style: 'color:#5b6376;font-size:12px;font-weight:400',
  }, `不可用：${reason || '接口未返回该字段'}`);
}

/* ══════════════════════ 文本与小部件 ══════════════════════ */

function clean(s) {
  return String(s).replace(/\*\*/g, '').replace(/`/g, '');
}

function numTxt(v, digits = 3) {
  if (!finite(v)) return null;
  const f = 10 ** digits;
  return String(Math.round(v * f) / f);
}

function yn(v) {
  return v === true ? '是' : v === false ? '否' : null;
}

function asText(v) {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    const s = v.filter((x) => x !== null && x !== undefined).map(clean).join('、');
    return s || null;
  }
  if (isObj(v)) return null;
  return clean(v);
}

/** 表格单元格：Node 原样、数组用「、」连、空值走 na() */
function cell(v, why = '接口未返回该字段') {
  if (isNode(v)) return v;
  if (Array.isArray(v)) {
    const kids = [];
    for (const x of v) {
      if (x === null || x === undefined || x === '') continue;
      if (kids.length) kids.push('、');
      kids.push(isNode(x) ? x : document.createTextNode(clean(x)));
    }
    return kids.length ? el('span', null, kids) : na(why);
  }
  if (isObj(v)) return na(why);
  if (blank(v)) return na(why);
  return document.createTextNode(clean(v));
}

function table(headers, rows, opts = {}) {
  const t = el('table');
  if (Array.isArray(headers) && headers.length) {
    t.append(el('thead', null, el('tr', null, headers.map((h) => el('th', null, h)))));
  }
  const tb = el('tbody');
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    tb.append(el('tr', null, r.map((c) => el('td', null, cell(c, opts.reason)))));
  }
  t.append(tb);
  return el('div', { style: 'overflow-x:auto' }, t);
}

function card(title, ...kids) {
  return el('div', { class: 'card' }, title ? el('h3', { style: SEC_STYLE }, title) : null, ...kids);
}

function secHeading(text) {
  return el('div', {
    style: 'font-size:12px;letter-spacing:.5px;color:#c9a227;font-weight:600;margin:16px 0 8px',
  }, text);
}

function kpi(k, v, unit = '', cls = '') {
  let body;
  if (isNode(v)) body = v;
  else if (blank(v)) body = na('字段缺失');
  else body = document.createTextNode(clean(v));
  return el('div', { class: 'kpi' + (cls ? ' ' + cls : '') },
    el('div', { class: 'k' }, k),
    el('div', { class: 'v' }, body, unit ? el('span', { class: 'u' }, unit) : null));
}

function tag(text, cls = '') {
  return el('span', { class: 'tag' + (cls ? ' ' + cls : '') }, text);
}

function notes(arr, reason = '接口未返回该字段') {
  if (!Array.isArray(arr) || !arr.length) return el('div', { class: 'note' }, na(reason));
  return el('ul', {
    style: 'margin:8px 0 0;padding-left:18px;font-size:12px;color:#8b93a7;line-height:1.7',
  }, arr.map((x) => el('li', null, clean(x))));
}

/**
 * bars() —— 通用横向条（复用 .bars / .bar / .track / .fill / .n）
 * entries: [[label, number|null], ...]
 */
function bars(entries, opts = {}) {
  const wrap = el('div', { class: 'bars' });
  const known = entries.map(([, v]) => (finite(v) ? Math.abs(v) : null)).filter((n) => n !== null);
  if (!known.length) {
    wrap.append(na(opts.reason || '数值缺失'));
    return wrap;
  }
  const max = Math.max(...known, 0.0001);
  entries.forEach(([label, v], i) => {
    const wx = opts.labelWx && WX_ORDER.includes(label) ? label : null;
    const row = el('div', { class: 'bar' },
      el('span', { class: wx ? 'wx-' + wx : '', style: wx ? '' : 'color:#8b93a7' }, label));
    if (!finite(v)) {
      row.append(el('div', { class: 'track' }),
        el('div', { class: 'n', title: '不可用：数值缺失', style: 'font-size:11px' }, '不可用'));
    } else {
      const width = Math.max(0, Math.min(100, (Math.abs(v) / max) * 100));
      const color = opts.color ? opts.color(v, label, i) : (wx ? WX_COLOR[wx] : '#c9a227');
      row.append(el('div', { class: 'track' },
        el('div', { class: 'fill', style: `width:${width.toFixed(1)}%;background:${color}` })));
      row.append(el('div', { class: 'n' }, numTxt(v, 3) ?? '不可用'));
    }
    wrap.append(row);
  });
  return wrap;
}

/** 地支藏干（本气 / 中气 / 余气），顺序即权重 */
const CANG_TABLE = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const CANG_LV = ['本气', '中气', '余气'];
const _GANWX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const _YANG = new Set(['甲', '丙', '戊', '庚', '壬']);

/** 十神（相对日干；带阴阳才能分出食神/伤官、正官/七杀） */
function _tenGod(gan, dmGan) {
  const wa = _GANWX[gan], wd = _GANWX[dmGan];
  if (!wa || !wd) return null;
  const same = _YANG.has(gan) === _YANG.has(dmGan);
  const S = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 生
  const K = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };   // 克
  if (wa === wd) return same ? '比肩' : '劫财';
  if (S[wa] === wd) return same ? '偏印' : '正印';
  if (S[wd] === wa) return same ? '食神' : '伤官';
  if (K[wd] === wa) return same ? '偏财' : '正财';
  return same ? '七杀' : '正官';
}

/** 四柱小部件（renderBazi 与 renderSynastry 共用） */
function pillarsEl(pillars) {
  const wrap = el('div', { class: 'pillars' });
  PILLAR_LABELS.forEach((label, i) => {
    const raw = Array.isArray(pillars) ? pillars[i] : null;
    const s = typeof raw === 'string' ? raw.trim() : '';
    const box = el('div', { class: 'pil' }, el('div', { class: 'p' }, label));
    if (s.length < 2) {
      box.append(el('div', { class: 'gz' }, na(`${label}缺失`)));
    } else {
      const gan = s[0];
      const zhi = s[1];
      const gwx = GAN_WX[gan] ?? null;
      const zwx = ZHI_WX[zhi] ?? null;
      box.append(el('div', { class: 'gz' + (gwx ? ' wx-' + gwx : '') }, s));
      box.append(el('div', { class: 'wx' },
        `${gwx ? gan + gwx : gan + '(五行未知)'} · ${zwx ? zhi + zwx : zhi + '(五行未知)'}`));
      // ★ 地支藏气：本气/中气/余气，各带五行与十神
      const cangList = CANG_TABLE[zhi];
      if (cangList && cangList.length) {
        const dmGan = Array.isArray(pillars) && typeof pillars[2] === 'string' ? pillars[2][0] : null;
        const cangBox = el('div', { class: 'cang' });
        cangBox.append(el('div', { class: 'cang-h' }, '藏气'));
        cangList.forEach((cg, ci) => {
          const cwx = _GANWX[cg] ?? null;
          const tg = dmGan ? _tenGod(cg, dmGan) : null;
          cangBox.append(el('div', { class: 'cang-i' },
            el('span', { class: 'cang-g' + (cwx ? ' wx-' + cwx : '') }, cg),
            el('span', { class: 'cang-wx' }, cwx ?? '?'),
            tg ? el('span', { class: 'cang-tg' }, tg) : null,
            el('span', { class: 'cang-lv' }, CANG_LV[ci] ?? '')));
        });
        box.append(cangBox);
      }
    }
    wrap.append(box);
  });
  return wrap;
}

/* ══════════════════════ 星盘轮 buildWheel ══════════════════════ */

function norm360(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return NaN;
  return ((n % 360) + 360) % 360;
}

function pickLon(o) {
  if (o === null || o === undefined) return null;
  if (finite(o)) return norm360(o);
  if (isObj(o)) {
    for (const k of ['lon', 'lng', 'longitude']) if (finite(o[k])) return norm360(o[k]);
  }
  return null;
}

/** houses 兼容：Array<number> / Array<{lon}> / {cusps:[...]}；其它形态一律视为不可用 */
function normalizeHouses(h) {
  let arr = null;
  if (Array.isArray(h)) arr = h;
  else if (isObj(h) && Array.isArray(h.cusps)) arr = h.cusps;
  if (!Array.isArray(arr) || arr.length < 12) return null;
  const out = arr.slice(0, 12).map((x) => (finite(x) ? norm360(x) : isObj(x) ? pickLon(x) : null));
  return out.every((n) => n !== null) ? out : null;
}

function nextSpan(from, to) {
  let d = norm360(to) - norm360(from);
  if (!(d > 0)) d += 360;
  return d;
}

/**
 * buildWheel() —— 本命星盘轮（SVG）
 * 角度口径：黄经 lon → 0° 白羊在左（9 点方向），沿黄道逆时针递增；
 * 屏幕坐标 y 轴向下，故 y = cy - r·sin(θ)。复用 .ring / .tick / .sign / .pl / .asp。
 */
function buildWheel(spec = {}) {
  const S = 340;
  const cx = S / 2;
  const cy = S / 2;
  const R = { outer: 158, signIn: 140, planet: 124, marker: 134, label: 108, inner: 84 };

  const svg = svgEl('svg', {
    class: 'wheel',
    viewBox: `0 0 ${S} ${S}`,
    role: 'img',
    'aria-label': '本命星盘轮（黄经）',
  });

  const theta = (lon) => ((180 + norm360(lon)) * Math.PI) / 180;
  const P = (lon, r) => {
    const a = theta(lon);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };

  // 基础圈
  svg.append(svgEl('circle', { class: 'ring', cx, cy, r: R.outer, 'stroke-width': 1.5 }));
  svg.append(svgEl('circle', { class: 'ring', cx, cy, r: R.signIn, 'stroke-width': 1 }));
  svg.append(svgEl('circle', { class: 'ring', cx, cy, r: R.inner, 'stroke-width': 1 }));

  // 星座分界 + 5° 刻度
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = P(i * 30, R.signIn);
    const [x2, y2] = P(i * 30, R.outer);
    svg.append(svgEl('line', { class: 'tick', x1, y1, x2, y2, 'stroke-width': 1 }));
  }
  for (let d = 0; d < 360; d += 5) {
    if (d % 30 === 0) continue;
    const [x1, y1] = P(d, R.signIn);
    const [x2, y2] = P(d, R.signIn - 4);
    svg.append(svgEl('line', { class: 'tick', x1, y1, x2, y2, 'stroke-width': 0.6, opacity: 0.5 }));
  }
  // 星座名
  for (let i = 0; i < 12; i++) {
    const [x, y] = P(i * 30 + 15, (R.signIn + R.outer) / 2);
    svg.append(svgEl('text', {
      class: 'sign', x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, SIGNS[i]));
  }

  // 数据：优先服务端给的 wheel 数组
  const wheelRows = Array.isArray(spec.wheel)
    ? spec.wheel.filter(isObj)
    : Array.isArray(spec.planets)
      ? spec.planets.filter((p) => isObj(p) && typeof p.name === 'string')
      : [];
  const valid = wheelRows
    .map((p) => ({ name: typeof p.name === 'string' ? p.name : null, lon: pickLon(p), sign: typeof p.sign === 'string' ? p.sign : null }))
    .filter((p) => p.name && p.lon !== null);

  const retroOf = new Map();
  if (Array.isArray(spec.planets)) {
    for (const p of spec.planets) if (isObj(p) && p.name) retroOf.set(p.name, p.retro === true);
  }
  const lonOf = new Map(valid.map((p) => [p.name, p.lon]));

  // 宫位（有才画，没有不画假线）
  const houses = normalizeHouses(spec.houses ?? spec.cusps);
  if (houses) {
    houses.forEach((h, i) => {
      const [x1, y1] = P(h, R.inner);
      const [x2, y2] = P(h, R.outer);
      svg.append(svgEl('line', {
        class: 'tick', x1, y1, x2, y2, stroke: '#2c3342', 'stroke-width': 0.8, 'stroke-dasharray': '2 3',
      }));
      const mid = norm360(h + nextSpan(h, houses[(i + 1) % houses.length]) / 2);
      const [lx, ly] = P(mid, R.outer - 5);
      svg.append(svgEl('text', {
        class: 'sign', x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 7, opacity: 0.7,
      }, String(i + 1)));
    });
  }

  // 四轴（ASC/DSC/MC/IC）：先画线，行星后画覆盖
  const axes = [];
  const asc = lonOf.has('上升') ? lonOf.get('上升') : pickLon(spec.angles?.asc);
  const mc = lonOf.has('天顶') ? lonOf.get('天顶') : pickLon(spec.angles?.mc);
  if (asc !== null) axes.push({ lon: asc, label: 'ASC', color: '#c9a227', strong: true });
  if (asc !== null) axes.push({ lon: norm360(asc + 180), label: 'DSC', color: '#c9a227', strong: false });
  if (mc !== null) axes.push({ lon: mc, label: 'MC', color: '#4a90d9', strong: true });
  if (mc !== null) axes.push({ lon: norm360(mc + 180), label: 'IC', color: '#4a90d9', strong: false });
  for (const ax of axes) {
    const [x1, y1] = P(ax.lon, R.inner);
    const [x2, y2] = P(ax.lon, R.outer);
    svg.append(svgEl('line', {
      class: 'tick', x1, y1, x2, y2, stroke: ax.color,
      'stroke-width': ax.strong ? 1.6 : 1, opacity: ax.strong ? 0.9 : 0.45,
    }));
    const [lx, ly] = P(ax.lon, R.inner - 11);
    svg.append(svgEl('text', {
      class: 'sign', x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: ax.color, 'font-size': 8, 'font-weight': 700,
    }, ax.label));
  }

  // 行星（四轴已单独画，避免重复；近度合相错层避让）
  const AXIS_NAMES = ['上升', '下降', '天顶', '天底'];
  const planets = valid.filter((p) => !AXIS_NAMES.includes(p.name))
    .slice()
    .sort((a, b) => a.lon - b.lon);
  let prevLon = null;
  let level = 0;
  for (const p of planets) {
    if (prevLon !== null && Math.abs(p.lon - prevLon) < 9) level = 1 - level;
    else level = 0;
    prevLon = p.lon;
    const labelR = level ? R.label - 15 : R.label;
    const [x1, y1] = P(p.lon, R.marker);
    const [x2, y2] = P(p.lon, R.planet);
    const [tx, ty] = P(p.lon, labelR);
    const g = svgEl('g', { class: 'pl' });
    g.append(svgEl('line', { x1, y1, x2, y2, 'stroke-width': 1.2 }));
    g.append(svgEl('text', {
      x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    }, retroOf.get(p.name) === true ? p.name + 'R' : p.name));
    svg.append(g);
  }

  // 凯龙
  const chironLon = pickLon(spec.chiron) ?? (lonOf.has('凯龙') ? lonOf.get('凯龙') : null);
  if (chironLon !== null) {
    const [x1, y1] = P(chironLon, R.marker);
    const [x2, y2] = P(chironLon, R.planet);
    const [tx, ty] = P(chironLon, R.label - 15);
    const g = svgEl('g', { class: 'pl', style: 'fill:#b08d57' });
    g.append(svgEl('line', { x1, y1, x2, y2, stroke: '#b08d57', 'stroke-width': 1.2 }));
    g.append(svgEl('text', {
      x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#b08d57',
    }, '凯'));
    svg.append(g);
  }

  // 相位线（只连图内可见星体；orb 越大越淡）
  const aspects = Array.isArray(spec.aspects) ? spec.aspects.filter(isObj) : [];
  for (const a of aspects) {
    if (!a.a || !a.b) continue;
    const la = lonOf.get(a.a);
    const lb = lonOf.get(a.b);
    if (la === undefined || lb === undefined) continue;
    const orb = finite(Number(a.orb)) ? Math.abs(Number(a.orb)) : 0;
    const opacity = Math.max(0.18, Math.min(0.85, 0.85 - orb * 0.09));
    const [x1, y1] = P(la, R.inner);
    const [x2, y2] = P(lb, R.inner);
    svg.append(svgEl('line', {
      class: 'asp', x1, y1, x2, y2,
      stroke: ASPECT_COLOR[a.type] ?? '#5b6376',
      'stroke-width': orb <= 2 ? 1.5 : 1,
      opacity: opacity.toFixed(2),
    }));
  }

  if (!valid.length) {
    svg.append(svgEl('text', {
      class: 'sign', x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 10,
    }, '不可用：接口未返回星体黄经'));
  }

  return svg;
}

/* ══════════════════════ ① 八字渲染 ══════════════════════ */

function renderBazi(B) {
  const root = el('div', { class: 'bazi' });
  if (!isObj(B)) {
    root.append(card('八字', na('接口未返回八字数据（data 为空）')));
    return root;
  }

  const st = isObj(B.strength) ? B.strength : {};
  const vg = isObj(B.vigor) ? B.vigor : {};
  const yj = isObj(B.yongJi) ? B.yongJi : {};
  const dm = typeof B.dayMaster === 'string' && B.dayMaster ? B.dayMaster : null;
  const dmWx = dm ? GAN_WX[dm] ?? null : null;

  /* 四柱 · 强弱 */
  root.append(card('四柱 · 强弱',
    pillarsEl(B.pillars),
    el('div', { class: 'kpis' },
      kpi('日主', dm ? el('span', { class: dmWx ? 'wx-' + dmWx : '' }, dm) : null),
      kpi('强弱判定', asText(st.verdict)),
      kpi('占比 ratio', numTxt(st.ratio, 3)),
      kpi('气势 vigor', numTxt(vg.value, 3))),
    el('div', { class: 'tags', style: 'margin-top:10px' },
      st.rooted === true ? tag('有根', 'ok') : st.rooted === false ? tag('无根', 'warn') : na('strength.rooted'),
      st.lingGate === true ? tag('月令助身', 'ok') : st.lingGate === false ? tag('月令未助身', 'warn') : na('strength.lingGate')),
    st.note ? el('div', { class: 'note' }, clean(st.note)) : el('div', { class: 'note' }, na('strength.note'))));

  /* 气势 · 四维 */
  root.append(card('气势 · 四维',
    bars([
      ['得令', vg.deLing],
      ['得地', vg.deDi],
      ['得势', vg.deShi],
      ['得生', vg.deSheng],
    ], { reason: 'vigor 四维全部缺失' }),
    el('div', { class: 'note' }, '得令=月令助身 · 得地=地支根（按损伤折减）· 得势=比劫力度 · 得生=印星生扶')));

  /* 用忌 */
  const yongNode = typeof yj.yong === 'string' && yj.yong
    ? el('span', { class: WX_ORDER.includes(yj.yong) ? 'wx-' + yj.yong : '' }, yj.yong)
    : null;
  const jiNode = typeof yj.ji === 'string' && yj.ji
    ? el('span', { class: WX_ORDER.includes(yj.ji) ? 'wx-' + yj.ji : '' }, yj.ji)
    : null;
  root.append(card('用神 / 忌神',
    el('div', { class: 'kpis' },
      kpi('用神', yongNode),
      kpi('忌神', jiNode)),
    yj.why ? el('div', { class: 'note' }, clean(yj.why)) : el('div', { class: 'note' }, na('yongJi.why')),
    isObj(yj.candidates)
      ? table(['候选项', '五行'],
        Object.entries(yj.candidates).map(([k, v]) => [CAND_LABEL[k] ?? k, v]))
      : el('div', { class: 'note' }, na('yongJi.candidates'))));

  /* 十神 · 克泄 */
  const tg = isObj(B.tenGods) ? B.tenGods : null;
  const controls = Array.isArray(B.controls) ? B.controls.filter(isObj) : [];
  root.append(card('十神 · 克泄',
    tg
      ? bars(['比劫', '印', '食伤', '财', '官杀'].map((k) => [k, tg[k]]), { reason: 'tenGods 数值缺失' })
      : el('div', { class: 'note' }, na('tenGods')),
    el('div', { class: 'hr' }),
    controls.length
      ? table(['克泄规则', '层级', '占比', '判定'],
        controls.map((c) => [
          c.name,
          c.level === 'tenGod' ? '十神级' : c.level === 'group' ? '分组级' : c.level,
          numTxt(c.ratio, 3),
          c.verdict,
        ]))
      : el('div', { class: 'note' }, '未命中任何克泄规则（controls 为空数组）')));

  /* 寒暖 · 库 */
  const hn = isObj(B.hanNuan) ? B.hanNuan : null;
  const ku = Array.isArray(B.ku) ? B.ku.filter(isObj) : [];
  root.append(card('寒暖 · 库',
    hn
      ? table(null, [
        ['寒暖总分', numTxt(hn.total, 2)],
        ['性质', hn.nature],
        ['调候需求', asText(hn.need)],
        ['有火', yn(hn.hasFire)],
        ['有水', yn(hn.hasWater)],
        ['月令温度 monthT', numTxt(hn.monthT, 2)],
      ])
      : el('div', { class: 'note' }, na('hanNuan')),
    el('div', { class: 'hr' }),
    ku.length
      ? table(['地支', '库', '角色', '可用'], ku.map((x) => [x.zhi, x.ku, x.role, yn(x.usable)]))
      : el('div', { class: 'note' }, '无库（ku 为空数组）')));

  /* 大运 */
  const dayun = Array.isArray(B.dayun) ? B.dayun.filter(isObj) : [];
  root.append(card('大运',
    dayun.length
      ? table(['大运', '年龄', '供根', '净贡献', '关系'],
        dayun.map((d) => [
          d.ganzhi,
          d.age,
          typeof d.supplyRoot === 'string' ? d.supplyRoot : null,
          numTxt(d.net, 3),
          Array.isArray(d.rels) ? (d.rels.length ? d.rels.map(clean) : '无') : null,
        ]))
      : el('div', { class: 'note' }, '无大运数据（dayun 为空数组）')));

  /* 宫位 + 五行分布 */
  const dist = isObj(B.dist) ? B.dist : null;
  root.append(card('命宫 · 身宫 · 胎元 / 五行分布',
    el('div', { class: 'kpis' },
      kpi('命宫', asText(B.mingGong)),
      kpi('身宫', asText(B.shenGong)),
      kpi('胎元', asText(B.taiYuan))),
    el('div', { class: 'hr' }),
    dist
      ? bars(WX_ORDER.map((w) => [w, dist[w]]), { labelWx: true, reason: 'dist 五行数值缺失' })
      : el('div', { class: 'note' }, na('dist（五行分布）')),
    el('div', { class: 'note' }, '五行分布取 L3_distribution.adjusted（引擎内部标度，非百分比）')));

  return root;
}

/* ══════════════════════ ② 占星渲染 ══════════════════════ */

function renderNatal(N) {
  const root = el('div', { class: 'natal' });
  if (!isObj(N)) {
    root.append(card('占星', na('接口未返回星盘数据（data 为空）')));
    return root;
  }

  const planets = Array.isArray(N.planets) ? N.planets.filter(isObj) : [];
  const aspects = Array.isArray(N.aspects) ? N.aspects.filter(isObj) : [];
  const houses = normalizeHouses(N.houses ?? N.cusps);
  const chiron = isObj(N.chiron) ? N.chiron : (finite(N.chiron) ? { lon: N.chiron } : null);

  /* 星盘轮 */
  root.append(card('星盘轮',
    el('div', { class: 'wheel-wrap' },
      buildWheel({
        wheel: Array.isArray(N.wheel) ? N.wheel : planets,
        planets,
        aspects,
        angles: N.angles,
        houses: N.houses ?? N.cusps,
        chiron: N.chiron,
      })),
    chiron ? null : el('div', { class: 'note' }, '凯龙：', na('接口未返回 chiron')),
    houses ? null : el('div', { class: 'note' }, '宫位：', na('接口未返回 houses（服务端只透传 planets/aspects/angles）')),
    el('div', { class: 'note' }, '角度按黄经 lon 计算：0° 白羊在左、沿黄道逆时针；相位线只连本图内可见星体')));

  /* 四轴 */
  const axisKpis = ['上升', '天顶', '下降', '天底'].map((nm) => {
    const p = planets.find((x) => x.name === nm);
    const v = p && typeof p.sign === 'string' && finite(p.deg) ? `${p.sign}${numTxt(p.deg, 2)}°` : null;
    return kpi(nm, v);
  });
  const ang = isObj(N.angles) ? N.angles : null;
  root.append(card('四轴 · 角度',
    el('div', { class: 'kpis' }, axisKpis),
    ang
      ? table(null, [
        ['ASC（黄经）', numTxt(ang.asc, 2)],
        ['MC（黄经）', numTxt(ang.mc, 2)],
        ['RAMC', numTxt(ang.ramc, 2)],
        ['黄赤交角', numTxt(ang.obliquity, 4)],
        ['GAST（h）', numTxt(ang.gastHours, 5)],
      ])
      : el('div', { class: 'note' }, na('angles'))));

  /* 行星表 */
  root.append(card('行星',
    planets.length
      ? table(['星体', '星座', '度数', '宫位', '逆行', '黄经'],
        planets.map((p) => [
          p.name,
          p.sign,
          finite(p.deg) ? `${numTxt(p.deg, 2)}°` : null,
          p.house,
          yn(p.retro),
          numTxt(p.lon, 3),
        ]))
      : el('div', { class: 'note' }, na('planets（接口未返回行星）'))));

  /* 相位表 */
  root.append(card('相位',
    aspects.length
      ? table(['A', '相位', 'B', '容许度 orb'],
        aspects.map((a) => [a.a, a.type, a.b, finite(a.orb) ? `${numTxt(a.orb, 2)}°` : null]))
      : el('div', { class: 'note' }, na('aspects（接口未返回相位）'))));

  /* 拓扑摘要 */
  const topo = isObj(N.topology) ? N.topology : null;
  root.append(card('相位拓扑',
    topo
      ? el('div', { class: 'kpis' },
        kpi('边数', numTxt(topo.edges, 0)),
        kpi('加权', numTxt(topo.weighted, 3)),
        kpi('大偏移边', numTxt(topo.largeOrb, 0)))
      : el('div', { class: 'note' }, na('topology'))));

  /* 凯龙 */
  root.append(card('凯龙星',
    chiron
      ? table(['星体', '星座', '度数', '宫位', '黄经'], [[
        chiron.name ?? '凯龙',
        chiron.sign ?? null,
        finite(chiron.deg) ? `${numTxt(chiron.deg, 2)}°` : null,
        chiron.house ?? null,
        numTxt(chiron.lon, 3),
      ]])
      : el('div', { class: 'note' }, na('接口未返回 chiron'))));

  return root;
}

/* ══════════════════════ ③ 融合渲染 ══════════════════════ */

function renderFusion(F) {
  const root = el('div', { class: 'fusion' });
  if (!isObj(F)) {
    root.append(card('融合', na('接口未返回融合数据（data 为空）')));
    return root;
  }

  root.append(secHeading('① 八字侧'));
  root.append(F.bazi ? renderBazi(F.bazi) : card('八字侧', na('接口未返回 fusion.bazi')));

  root.append(secHeading('② 占星侧'));
  root.append(F.natal ? renderNatal(F.natal) : card('占星侧', na('接口未返回 fusion.natal')));

  root.append(secHeading('③ 结构对照'));
  const fu = isObj(F.fusion) ? F.fusion : {};
  const five = isObj(fu.baziFiveElements) ? fu.baziFiveElements : null;
  const astro = isObj(fu.astroElements) ? fu.astroElements : null;

  root.append(card('融合 · 结构对照',
    el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:14px' },
      el('div', null,
        el('div', { style: 'font-size:11px;color:#5b6376;margin-bottom:6px' }, '八字五行（L3 标度）'),
        five ? bars(WX_ORDER.map((w) => [w, five[w]]), { labelWx: true, reason: 'baziFiveElements 缺失' })
          : na('fusion.baziFiveElements')),
      el('div', null,
        el('div', { style: 'font-size:11px;color:#5b6376;margin-bottom:6px' }, '星盘四元素（按星座计数）'),
        astro ? bars(['火', '土', '金', '水'].map((w) => [w, astro[w]]), { labelWx: true, reason: 'astroElements 缺失' })
          : na('fusion.astroElements'))),
    el('div', { class: 'hr' }),
    notes(fu.notes, 'fusion.notes')));

  return root;
}

/* ══════════════════════ ④ 合盘渲染 ══════════════════════ */

function renderSynastry(S) {
  const root = el('div', { class: 'synastry' });
  if (!isObj(S)) {
    root.append(card('合盘', na('接口未返回合盘数据（data 为空）')));
    return root;
  }

  const side = (P, label) => {
    if (!isObj(P)) return card(label, na(`接口未返回 ${label} 侧数据`));
    return card(label,
      pillarsEl(P.pillars),
      el('div', { class: 'tags' },
        P.verdict ? tag(`强弱 ${P.verdict}`, 'warn') : na('verdict'),
        P.yong ? tag(`用神 ${P.yong}`, 'ok') : na('yong'),
        P.ji ? tag(`忌神 ${P.ji}`, 'bad') : na('ji')));
  };
  root.append(side(S.a, '甲方'));
  root.append(side(S.b, '乙方'));

  /* 互补度 */
  const c = isObj(S.complementarity) ? S.complementarity : null;
  const parts = c && Array.isArray(c.parts) ? c.parts.filter(isObj) : [];
  root.append(card('互补度',
    c
      ? el('div', { class: 'kpis' },
        kpi('互补度 total', numTxt(c.total, 3)),
        kpi('A→B 供给', numTxt(c.supplyAB, 3)),
        kpi('B→A 供给', numTxt(c.supplyBA, 3)))
      : el('div', { class: 'note' }, na('complementarity')),
    parts.length
      ? table(['结构性来源', '权重 w', '证据'],
        parts.map((p) => [p.k, numTxt(p.w, 3), asText(p.ev)]))
      : el('div', { class: 'note' }, '无结构性来源（parts 为空数组）')));

  /* 星盘结构（可空） */
  root.append(card('星盘结构（astro）',
    S.astro
      ? el('div', { class: 'kpis' },
        kpi('星盘耦合度', numTxt(S.astro.score, 3)),
        kpi('A 相位边', numTxt(S.astro.edgesA, 0)),
        kpi('B 相位边', numTxt(S.astro.edgesB, 0)))
      : el('div', { class: 'note' }, na('astro 为 null（需双方都有出生时间 at 才能计算星盘侧）'))));

  /* 大运加权 · 适婚窗口 */
  const dy = isObj(S.dayun) ? S.dayun : {};
  const veto = typeof dy.veto === 'string' ? dy.veto : null;
  const vetoCls = veto === 'severe' ? 'bad' : veto === 'weak' ? 'warn' : veto === 'normal' ? 'ok' : '';
  root.append(card('大运加权 · 适婚窗口',
    el('div', { class: 'kpis' },
      kpi('加权 common 吉', numTxt(dy.weighted, 3)),
      kpi('窗口内比例', numTxt(dy.windowFraction, 3)),
      kpi('核心窗比例', numTxt(dy.coreFraction, 3)),
      kpi('后期比例', numTxt(dy.lateFraction, 3))),
    el('div', { class: 'tags', style: 'margin-top:10px' },
      veto ? tag(`veto ${veto}`, vetoCls) : na('dayun.veto'),
      dy.buffer ? tag(`buffer ${dy.buffer}`, 'warn') : na('dayun.buffer（无缓冲说明）')),
    dy.note ? el('div', { class: 'note' }, clean(dy.note)) : el('div', { class: 'note' }, na('dayun.note'))));

  /* z 分数 · 权重 */
  const z = isObj(S.z) ? S.z : {};
  const w = isObj(S.weights) ? S.weights : {};
  root.append(card('z 分数 · 权重',
    el('div', { class: 'kpis' },
      kpi('z(comp)', numTxt(z.comp, 3)),
      kpi('z(astro)', numTxt(z.astro, 3)),
      kpi('z(dayun)', numTxt(z.dayun, 3))),
    table(['项', '权重'], [
      ['互补度', numTxt(w.comp, 3)],
      ['星盘', numTxt(w.astro, 3)],
      ['大运（按分位动态下调）', numTxt(w.dayun, 3)],
    ])));

  /* M 值 */
  const m = isObj(S.m) ? S.m : {};
  root.append(card('M 值',
    el('div', { class: 'kpis' },
      kpi('M', numTxt(m.value, 3)),
      kpi('否决乘子', numTxt(m.vetoMultiplier, 2))),
    m.note ? el('div', { class: 'note' }, clean(m.note)) : el('div', { class: 'note' }, na('m.note'))));

  /* 口径与边界 */
  root.append(card('口径与边界', notes(S.caveats, 'caveats')));

  return root;
}

/* ══════════════════════ ⑤ 大六壬渲染 ══════════════════════ */

function renderLiuren(L) {
  const root = el('div', { class: 'liuren' });
  if (!isObj(L)) {
    root.append(card('大六壬', na('接口未返回六壬数据（data 为空）')));
    return root;
  }

  /* 时间 */
  const t = isObj(L.time) ? L.time : {};
  const baziStr = Array.isArray(t.bazi) ? t.bazi.map(clean).join(' ') : asText(t.bazi);
  const kongStr = Array.isArray(t.kong) ? t.kong.map(clean).join('') : asText(t.kong);
  root.append(card('时间',
    table(null, [
      ['来源', t.source],
      ['本地时间', t.local],
      ['ISO', t.iso],
      ['四柱', baziStr],
      ['中气', t.zhongQi],
      ['旬', t.xun],
      ['空亡', kongStr],
    ])));

  /* 月将 / 天地盘 */
  const fr = isObj(L.frame) ? L.frame : {};
  const pan = isObj(L.pan) ? L.pan : null;
  const diPan = pan && isObj(pan.diPan) ? pan.diPan : null;
  const tianPan = pan && isObj(pan.tianPan) ? pan.tianPan : null;

  root.append(card('月将 · 天地盘',
    el('div', { class: 'kpis' },
      kpi('月将', asText(fr.yueJiang)),
      kpi('旋转量', numTxt(pan?.rotation, 0))),
    tianPan
      ? el('div', { class: 'lr-pan', style: 'margin-top:10px' },
        ZHI_ORDER.map((z) => {
          const tv = tianPan[z];
          const wx = typeof tv === 'string' ? ZHI_WX[tv] ?? null : null;
          return el('div', { class: 'lr-cell' },
            el('div', { class: 'k' }, `地盘 ${z}`),
            el('div', { class: 'v' + (wx ? ' wx-' + wx : '') },
              tv ? tv : na(`pan.tianPan.${z}`)));
        }))
      : el('div', { class: 'note' }, na('pan.tianPan')),
    el('div', { class: 'note' },
      diPan ? '每格为「地盘位 → 天盘支」；无天盘数据的格子显示不可用' : na('pan.diPan'))));

  /* 四课 */
  const siKe = Array.isArray(L.siKe) ? L.siKe.filter(isObj) : [];
  root.append(card('四课',
    siKe.length
      ? table(['课', '下（地盘/日干）', '上（天盘）', '五行关系'],
        siKe.map((k, i) => [`第${i + 1}课`, k.bottom, k.top, k.rel]))
      : el('div', { class: 'note' }, na('siKe（接口未返回四课）'))));

  /* 贵人 */
  const gr = isObj(L.guiRen) ? L.guiRen : null;
  root.append(card('贵人',
    gr
      ? table(null, [
        ['日干', gr.riGan],
        ['贵人支', gr.guiRenZhi],
        ['昼夜贵人 pair', Array.isArray(gr.pair) ? gr.pair.join(' / ') : gr.pair],
        ['贵人所落地盘', gr.landPos],
        ['排法', gr.direction],
      ])
      : el('div', { class: 'note' }, na('guiRen'))));

  /* 天将 */
  const tj = isObj(L.tianJiang) ? L.tianJiang : null;
  root.append(card('十二天将',
    tj
      ? el('div', { class: 'lr-pan' },
        ZHI_ORDER.map((z) => el('div', { class: 'lr-cell' },
          el('div', { class: 'k' }, z),
          el('div', { class: 'v', style: 'font-size:14px' },
            tj[z] ? tj[z] : na(`tianJiang.${z}`)))))
      : el('div', { class: 'note' }, na('tianJiang'))));

  /* 三传 */
  const sc = isObj(L.sanChuan) ? L.sanChuan : {};
  const chain = Array.isArray(sc.chain) && sc.chain.length
    ? sc.chain.slice(0, 3)
    : [{ pos: '初传', zhi: sc.chu }, { pos: '中传', zhi: sc.zhong }, { pos: '末传', zhi: sc.mo }];
  const special = Array.isArray(sc.special) ? sc.special : [];
  const conf = typeof sc.confidence === 'string' ? sc.confidence : null;
  const confCls = conf && conf.startsWith('high') ? 'ok' : conf && conf.startsWith('medium') ? 'warn' : conf ? 'bad' : '';
  const lib = isObj(sc.lib) ? sc.lib : null;

  root.append(card('三传',
    el('div', { class: 'sanchuan' },
      chain.map((c, i) => {
        const zhi = isObj(c) && typeof c.zhi === 'string' ? c.zhi : null;
        const wx = zhi ? ZHI_WX[zhi] ?? null : null;
        return el('div', { class: 'sc' },
          el('div', { class: 'k' }, (isObj(c) && c.pos) || ['初传', '中传', '末传'][i]),
          el('div', { class: 'v' + (wx ? ' wx-' + wx : '') }, zhi ? zhi : na('三传缺失')),
          el('div', { class: 'k' }, isObj(c) && c.wuxing ? c.wuxing : na('wuxing')));
      })),
    el('div', { class: 'tags', style: 'margin-top:4px' },
      sc.keTi ? tag(`课体 ${sc.keTi}`) : na('sanChuan.keTi'),
      conf ? tag(`置信 ${conf}`, confCls) : na('sanChuan.confidence'),
      sc.agree === true ? tag('与 lib 一致', 'ok') : sc.agree === false ? tag('与 lib 不一致', 'bad') : na('sanChuan.agree'),
      special.length ? special.map((s) => tag(String(s), 'warn')) : tag('无特殊课体')),
    sc.method ? el('div', { class: 'note' }, clean(sc.method)) : el('div', { class: 'note' }, na('sanChuan.method')),
    el('div', { class: 'note' },
      '库（第三方对拍）：',
      lib
        ? table(null, [
          ['初传', lib.chuChuan],
          ['中传', lib.zhongChuan],
          ['末传', lib.moChuan],
        ])
        : na('sanChuan.lib'))));

  return root;
}

/* ══════════════════════ 表单 → payload ══════════════════════ */

function formVal(form, name) {
  const f = form && form.elements ? form.elements[name] : null;
  return f ? String(f.value ?? '').trim() : '';
}

function formNum(form, name) {
  const raw = formVal(form, name);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function genderOf(form, name, fallbackName) {
  const g = formVal(form, name) || formVal(form, fallbackName);
  return g === '男' || g === '女' ? g : null;
}

function fusionPayload(form) {
  const at = formVal(form, 'at');
  const gender = genderOf(form, 'gender');
  const lng = formNum(form, 'lng');
  const lat = formNum(form, 'lat');
  const bad = [];
  if (!at) bad.push('出生时间');
  if (!gender) bad.push('性别');
  if (lng === null || lng < -180 || lng > 180) bad.push('经度（-180~180）');
  if (lat === null || lat < -90 || lat > 90) bad.push('纬度（-90~90）');
  if (bad.length) throw new Error('缺少或非法输入：' + bad.join('、'));
  return { at, gender, lng, lat };
}

function sidePayload(form, pre) {
  const at = formVal(form, pre + '_at');
  const gender = genderOf(form, pre + '_gender');
  const lng = formNum(form, pre + '_lng');
  const lat = formNum(form, pre + '_lat');
  const bad = [];
  if (!at) bad.push(`${pre}_at 出生时间`);
  if (!gender) bad.push(`${pre}_gender 性别`);
  if (lng === null || lng < -180 || lng > 180) bad.push(`${pre}_lng 经度`);
  if (lat === null || lat < -90 || lat > 90) bad.push(`${pre}_lat 纬度`);
  if (bad.length) throw new Error('缺少或非法输入：' + bad.join('、'));
  return { at, gender, lng, lat };
}

function synastryPayload(form) {
  return { a: sidePayload(form, 'a'), b: sidePayload(form, 'b') };
}

function liurenPayload(form) {
  const at = formVal(form, 'at');
  if (!at) throw new Error('缺少占问时间 at');
  const matter = formVal(form, 'matter');
  return matter ? { at, matter } : { at };
}

/* ══════════════════════ 请求 / 结果区 ══════════════════════ */

function showErr(out, e) {
  try { window.__showErr && window.__showErr((err && err.message) || String(err)); } catch (_) {}
  if (!out) return;
  const msg = e && e.message ? e.message : String(e);
  out.replaceChildren(el('div', { class: 'card err', role: 'alert' }, `请求失败：${msg}`));
}

async function runForm({ form, out, url, payload, render }) {
  // ★ GATE-FAIL-OPEN：健康检查失败只提示，不阻断（本应用计算全在本地，同源服务端）
  if (gate.locked) {
    gate.mask?.classList.add('flash');
    try {
      window.__showErr?.('服务状态异常：' + (gate.reason || 'API 未连接') +
        ' —— 仍会尝试排盘；若失败请看具体报错。', 'warn');
      // 稍后自动重连
      setTimeout(() => { try { void checkHealth(); } catch (_) {} }, 1500);
    } catch (_) {}
    // 不 return：继续执行排盘
  }
  if (!out) return;
  const btn = form ? q('button[type="submit"]', form) : null;
  const btnLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '计算中…';
  }
  out.replaceChildren(el('div', { class: 'card empty' }, '计算中…'));
  try {
    // ★ FETCH-TIMEOUT：25 秒没回来就明确报错，绝不让用户停在"计算中…"
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const to = ctrl ? setTimeout(() => ctrl.abort(), 25000) : 0;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
    } catch (e) {
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))) {
        throw new Error(`请求超时（25 秒无响应）：${url}。请确认服务端在运行：node server.mjs 8788`);
      }
      throw new Error(`网络请求失败（${url}）：${(e && e.message) || e}`);
    } finally {
      if (to) clearTimeout(to);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}：响应不是 JSON`);
    }
    if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
    if (!isObj(json) || !('data' in json)) throw new Error('响应缺少 data 字段');
    out.replaceChildren(render(json.data, json));
    maybeAddSynastrySummary(out, json.data);
    feedStage(json.data?.planets ?? json.data?.natal?.planets ?? json.data);
    try {
      if (typeof window.__fwSetData !== 'function') throw new Error('__fwSetData 未挂载（fusion3d.js 可能加载失败）');
      window.__fwLastData = json.data;
      window.__fwSetData(json.data);
    // 修复：不再自动进全屏（全屏层 position:fixed 会盖住结果界面与导航）。需要全屏请点融合盘上的全屏按钮。
    } catch (e) {
      console.error('fusion wheel feed failed', e);
      window.__report?.('wheelFeed', '圆盘喂数据失败: ' + (e && e.message), e && e.stack);
    }
    if (finite(json.ms)) out.append(el('div', { class: 'note' }, `耗时 ${json.ms} ms`));
  } catch (e) {
    showErr(out, e);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btnLabel;
    }
  }
}

/* ══════════════════════ 顶栏健康 GET /api/health ══════════════════════ */

async function checkHealth() {
  const box = q('#health');
  if (box && !box.__forceReconnect) {
    box.__forceReconnect = true;
    box.style.cursor = 'pointer';
    box.title = (box.title || '') + '\n（点击可强制重连）';
    box.addEventListener('click', () => { try { unlock(); } catch (_) {} void checkHealth(); });
  }
  if (!box) return;
  try {
    const res = await fetch(API.health, { cache: 'no-store' });
    const j = await res.json();
    if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
    const svc = typeof j.service === 'string' ? j.service : null;
    const port = finite(j.port) ? String(j.port) : null;
    const routes = Array.isArray(j.routes) ? j.routes : null;
    box.textContent = [
      '在线',
      svc,
      port ? ':' + port : null,
      routes ? `${routes.length} 路由` : null,
    ].filter(Boolean).join(' · ');
    box.title = routes ? routes.join('\n') : '';
    box.classList.add('ok');
    box.classList.remove('bad');
    unlock();
  } catch (e) {
    const msg = e && e.message ? e.message : '无法连接';
    box.textContent = '离线 · ' + msg;
    box.classList.add('bad');
    box.classList.remove('ok');
    lock(msg);
  }
}

/* ══════════════════════ tabbar 切换 button[data-go] ══════════════════════ */

function initTabs() {
  const buttons = qa('button[data-go]');
  const pages = qa('.page');
  if (!buttons.length || !pages.length) return;
  const show = (page, scroll = true) => {
    for (const p of pages) p.classList.toggle('active', p.dataset.page === page);
    for (const b of buttons) b.classList.toggle('active', b.dataset.go === page);
    if (scroll) window.scrollTo({ top: 0 });
  };
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const go = b.dataset.go;
      if (go) show(go);
    });
  }
  const first = buttons.find((b) => b.classList.contains('active'))?.dataset.go
    || pages[0]?.dataset.page;
  if (first) show(first, false);
}

function initForms() {
  const fFusion = q('#f-fusion');
  if (fFusion) {
    fFusion.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let payload;
      try {
        payload = fusionPayload(fFusion);
      } catch (e) {
        showErr(q('#fusion-out'), e);
        return;
      }
      runForm({ form: fFusion, out: q('#fusion-out'), url: API.fusion, payload, render: renderFusion });
    });
  }

  const fSyn = q('#f-synastry');
  if (fSyn) {
    fSyn.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let payload;
      try {
        payload = synastryPayload(fSyn);
      } catch (e) {
        showErr(q('#synastry-out'), e);
        return;
      }
      runForm({ form: fSyn, out: q('#synastry-out'), url: API.synastry, payload, render: renderSynastry });
    });
  }

  const fLr = q('#f-liuren');
  if (fLr) {
    fLr.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let payload;
      try {
        payload = liurenPayload(fLr);
      } catch (e) {
        showErr(q('#liuren-out'), e);
        return;
      }
      runForm({ form: fLr, out: q('#liuren-out'), url: API.liuren, payload, render: renderLiuren });
    });
  }
}

/* ══════════════════════ 启动 ══════════════════════ */

function nowLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function boot() {
  initTabs();
  const lrNow = q('#lr-now');
  if (lrNow && !lrNow.value) lrNow.value = nowLocal();
  initForms();
  checkHealth(); // 成功后由 unlock() 自建 30 秒保活；失败则由 lock() 接管 3 秒重试
  window.addEventListener('beforeunload', () => {
    if (gate.timer) clearInterval(gate.timer);
    if (gateKeepTimer) clearInterval(gateKeepTimer);
  }, { once: true });
}

/* ══════════════════════ ⑥ 生时矫正 ══════════════════════
 * 自成闭合段：只新增本页表单/渲染逻辑，不触碰 initForms / boot / API 常量。
 * 载荷字段对齐 server.mjs POST /api/rectify（经度键是 lon，不是 lng）。
 * 铁律不变：接口没给的一律 na()，错误按 reason / need / hint 原样显示。
 */

const RX_CATEGORIES = ['婚姻', '生育', '重疾', '丧亲', '事业', '迁移', '学业', '财务'];

function rectifyEventRow() {
  const category = el('select', { name: 'category', 'aria-label': '事件类别' },
    el('option', { value: '' }, '类别…'),
    RX_CATEGORIES.map((c) => el('option', { value: c }, c)));
  return el('div', { class: 'rx-ev' },
    el('input', {
      type: 'number', name: 'year', class: 'rx-year', placeholder: '年份',
      min: '1900', max: '2100', step: '1', 'aria-label': '事件年份',
    }),
    el('input', {
      type: 'month', name: 'month', class: 'rx-month',
      'aria-label': '事件月份（可选）', title: '可选：填到月，矫正精度更高',
      oninput: function () {
        var hint = document.querySelector('#rx-month-hint');
        var rows = document.querySelectorAll('#rx-events .rx-ev');
        var total = 0, withMonth = 0;
        rows.forEach(function (r) {
          var y = r.querySelector('input.rx-year');
          if (!y || !y.value) return;
          total++;
          var m = r.querySelector('input.rx-month');
          if (m && m.value) withMonth++;
        });
        if (hint) {
          if (total && withMonth < total) {
            hint.textContent = '⚠ ' + (total - withMonth) + ' 条未填月份：时间误差按 ±6 个月计，矫正结果区间会更宽。填月份可以收窄。';
            hint.style.color = '#ffc457';
          } else {
            hint.textContent = '✔ 已全部填到月份，时间误差按 ±1 个月计。';
            hint.style.color = '#7dffb4';
          }
        }
      },
    }),
    category,
    el('input', {
      type: 'text', name: 'note', class: 'rx-note',
      placeholder: '事件简述（可空）', 'aria-label': '事件简述',
    }),
    el('button', {
      type: 'button', class: 'rx-del', title: '删除这一行', 'aria-label': '删除这一行',
      onclick: (ev) => { ev.currentTarget.closest('.rx-ev')?.remove(); },
    }, '×'));
}

/** rectifyPayload() —— 收集出生参数与 #rx-events 各事件行；事件 <3 条前端直接拒绝 */
function rectifyPayload(form) {
  const date = formVal(form, 'date');
  const time = formVal(form, 'time');
  const lon = formNum(form, 'lon');
  const lat = formNum(form, 'lat');
  const windowMin = formNum(form, 'windowMin');
  const stepMin = formNum(form, 'stepMin');
  const orb = formNum(form, 'orb');
  const bad = [];
  if (!date) bad.push('出生日期 date');
  if (!time) bad.push('候选出生时间 time');
  if (lon === null || lon < -180 || lon > 180) bad.push('经度 lon（-180~180）');
  if (lat === null || lat < -90 || lat > 90) bad.push('纬度 lat（-90~90）');
  if (windowMin === null || windowMin < 1) bad.push('搜索窗口 windowMin（≥1）');
  if (stepMin === null || stepMin < 1) bad.push('步长 stepMin（≥1）');
  if (orb === null || orb < 0) bad.push('容许度 orb（≥0）');
  if (bad.length) throw new Error('缺少或非法输入：' + bad.join('、'));

  const events = [];
  qa('#rx-events .rx-ev').forEach((row, i) => {
    const raw = String(q('[name="year"]', row)?.value ?? '').trim();
    if (!raw) return; // 完全空白的行不计入事件
    const year = Number(raw);
    if (!Number.isInteger(year)) throw new Error(`第 ${i + 1} 行事件年份非法：${raw}`);
    const category = String(q('[name="category"]', row)?.value ?? '').trim();
    const note = String(q('[name="note"]', row)?.value ?? '').trim();
    events.push({ year, category: category || null, note: note || null });
  });
  if (events.length < 3) {
    throw new Error(`生时矫正至少需要 3 条带年份的人生事件（当前 ${events.length} 条）`);
  }
  return { date, time, lon, lat, windowMin, stepMin, orb, events };
}

/** renderRectify() —— R 是 json.data；env 是外壳（本页暂不需要，保留签名） */
function renderRectify(R, env) {
  const root = el('div', { class: 'rectify' });
  if (!isObj(R)) {
    root.append(card('生时矫正', na('接口未返回 data')));
    return root;
  }

  /* 失败分支：后端 {ok:false, reason, need, hint} —— 逐字段判空，原样显示 */
  if (R.ok === false) {
    const lines = [];
    const line = (label, v) => {
      if (blank(v)) return;
      lines.push(el('p', { class: 'rx-err-line' }, el('strong', null, label + '：'), clean(v)));
    };
    line('原因', R.reason);
    line('需要补充', R.need);
    line('提示', R.hint);
    const box = el('div', { class: 'card err', role: 'alert' },
      el('div', { style: 'font-weight:600;margin-bottom:6px' }, '生时矫正未执行'));
    if (lines.length) box.append(...lines);
    else box.append(el('p', { class: 'rx-err-line' }, na('reason / need / hint')));
    root.append(box);
    return root;
  }

  /* KPI：校正时刻 / 置信度 / 是否收敛 / 方法 / 搜索窗口 */
  const corr = el('span', null,
    blank(R.original) ? na('original') : clean(R.original),
    ' → ',
    blank(R.corrected) ? na('corrected') : clean(R.corrected));
  const conv = R.converged === true
    ? tag('已收敛', 'ok')
    : R.converged === false ? tag('未收敛', 'bad') : na('converged');
  root.append(el('div', { class: 'kpis' },
    kpi('校正时刻', corr),
    kpi('置信度', blank(R.confidence) ? null : clean(R.confidence)),
    kpi('是否收敛', conv),
    kpi('方法', blank(R.method) ? null : clean(R.method), '', 'rx-kpi-text'),
    kpi('搜索窗口', blank(R.window) ? null : clean(R.window), '', 'rx-kpi-text')));

  /* 最佳候选：得分 + 三部分 + 事件触点表（directed/planet、aspect、natal、event、w） */
  if (!isObj(R.best)) {
    root.append(card('最佳候选', na('接口未返回 best')));
  } else {
    const best = R.best;
    const parts = isObj(best.parts) ? best.parts : {};
    const when = [
      blank(best.time) ? null : `时刻 ${clean(best.time)}`,
      blank(best.localTime) ? null : `当地 ${clean(best.localTime)}`,
    ].filter(Boolean).join(' · ');
    const contacts = Array.isArray(best.contacts) ? best.contacts : [];
    const rows = contacts.map((c) => {
      const x = isObj(c) ? c : {};
      const planet = blank(x.directed)
        ? (blank(x.planet) ? null : clean(x.planet))
        : clean(x.directed);
      return [
        planet,
        blank(x.aspect) ? null : clean(x.aspect),
        blank(x.natal) ? null : clean(x.natal),
        blank(x.event) ? null : clean(x.event),
        finite(x.w) ? numTxt(x.w, 2) : null,
      ];
    });
    root.append(card('最佳候选' + (when ? ' · ' + when : ''),
      el('div', { class: 'kpis' },
        kpi('得分', finite(best.score) ? numTxt(best.score, 2) : null),
        kpi('行运 transit', finite(parts.transit) ? numTxt(parts.transit, 2) : null),
        kpi('太阳弧 arc', finite(parts.arc) ? numTxt(parts.arc, 2) : null),
        kpi('八字流年 bazi', finite(parts.bazi) ? numTxt(parts.bazi, 2) : null)),
      secHeading('事件触点 contacts'),
      rows.length
        ? table(['行星', '相位', '本命点', '事件年份', 'w'], rows, { reason: 'contact 字段缺失' })
        : el('div', { class: 'note' }, na('best.contacts'))));
  }

  /* 候选前 5 */
  const top = Array.isArray(R.top) ? R.top : [];
  const topRows = top.slice(0, 5).map((t) => {
    const x = isObj(t) ? t : {};
    return [
      blank(x.time) ? null : clean(x.time),
      finite(x.score) ? numTxt(x.score, 2) : null,
    ];
  });
  root.append(card('候选前 5',
    topRows.length
      ? table(['时刻', '得分'], topRows, { reason: 'top 字段缺失' })
      : el('div', { class: 'note' }, na('top'))));

  /* 95% 峰值平台 */
  if (!isObj(R.plateau)) {
    root.append(card('95% 峰值平台', na('接口未返回 plateau')));
  } else {
    const pl = R.plateau;
    root.append(card('95% 峰值平台',
      el('div', { class: 'kpis' },
        kpi('点数 count', finite(pl.count) ? numTxt(pl.count, 0) : null),
        kpi('宽度', finite(pl.widthMin) ? numTxt(pl.widthMin, 0) : null, '分钟'),
        kpi('起', blank(pl.from) ? null : clean(pl.from)),
        kpi('止', blank(pl.to) ? null : clean(pl.to)))));
  }

  /* caveat 原文 */
  root.append(card('注意',
    blank(R.caveat)
      ? el('div', { class: 'note' }, na('caveat'))
      : el('div', { class: 'note' }, clean(R.caveat))));

  /* 一键带入融合页：复用 initTabs 已绑定的点击处理器 */
  const rxForm = q('#f-rectify');
  const canUse = !blank(R.corrected) && /^\d{2}:\d{2}/.test(String(R.corrected));
  root.append(el('button', {
    type: 'button',
    class: 'rx-use',
    disabled: !canUse,
    title: canUse ? '把校正时刻带入融合页的出生时间' : '缺少 corrected 时刻，无法带入',
    onclick: () => {
      const date = formVal(rxForm, 'date');
      const hm = String(R.corrected ?? '').slice(0, 5);
      if (!date || !/^\d{2}:\d{2}$/.test(hm)) return;
      const input = q('#f-fusion [name="at"]');
      if (!input) {
        showErr(q('#rectify-out'), new Error('找不到融合页的出生时间输入框'));
        return;
      }
      input.value = `${date}T${hm}`;
      const tab = q('button[data-go="fusion"]');
      if (tab) tab.click();
      else showErr(q('#rectify-out'), new Error('找不到融合页签'));
    },
  }, '用这个时刻去排盘'));

  return root;
}

/** initRectify() —— 绑定矫正表单；脚本在 body 末尾，DOM 已就绪，直接绑 */
function initRectify() {
  const form = q('#f-rectify');
  const out = q('#rectify-out');
  if (!form || !out) return;
  const box = q('#rx-events');
  const add = q('#rx-add-event');
  if (box) {
    if (!qa('.rx-ev', box).length) {
      for (let i = 0; i < 3; i++) box.append(rectifyEventRow());
    }
    if (add) add.addEventListener('click', () => box.append(rectifyEventRow()));
  }
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    let payload;
    try {
      payload = rectifyPayload(form);
    } catch (e) {
      showErr(out, e);
      return;
    }
    runForm({ form, out, url: '/api/rectify', payload, render: renderRectify });
  });
}

if (typeof document !== 'undefined') initRectify();

/* 控制台验收钩子：不改变页面行为，只把渲染器暴露出来便于自动化检查 */
try {
  window.__xuanji = { buildWheel, renderBazi, renderNatal, renderFusion, renderSynastry, renderLiuren };
} catch {
  /* 非浏览器环境忽略 */
}

/* ══════════════════════ ⑦ 数据反馈 ══════════════════════
 * 自成闭合段：只新增本页收集逻辑，不触碰 initForms / boot / API 常量。
 * 载荷对齐 server.mjs POST /api/contribute（实现在 src/app/collect-endpoints.mjs）。
 * 故意不在前端做「矫正事件 <3」预拦截：让后端 qualityAssess 判级并回 advisories（**照收**，不是拒收），
 * 这正是本页的核心体验（看得见自己缺什么）；前端只负责原样展示。
 * 统计走 GET /api/contrib-stats —— 该接口没有 data 外壳，直接读 total / decisive /
 * categories / decisiveCategories。
 */

/** ctRows() —— 读一个事件容器里的各行；整行空白丢弃，年份转 Number（非法则留 null 交后端判定） */
function ctRows(container) {
  const rows = qa('.ct-ev', container || document);
  const out = [];
  for (const row of rows) {
    const rawYear = String(q('[name="year"]', row)?.value ?? '').trim();
    const category = String(q('[name="category"]', row)?.value ?? '').trim();
    const note = String(q('[name="note"]', row)?.value ?? '').trim();
    if (!rawYear && !category && !note) continue; // 整行空白：不计入事件
    const year = rawYear ? Number(rawYear) : null;
    out.push({
      year: Number.isFinite(year) ? year : null,
      month: (r.querySelector('input.rx-month') || {}).value || null,
      category: category || null,
      note: note || null,
    });
  }
  return out;
}

/** contributePayload() —— 收集四柱/性别/出生地/时制/矫正标记 + 两类事件；不预拦截条数 */
function contributePayload(form) {
  const pillars = [0, 1, 2, 3].map((i) => formVal(form, 'pillar' + i));
  const gender = genderOf(form, 'gender');
  const birthPlace = formVal(form, 'birthPlace');
  const timeMode = formVal(form, 'timeMode') || 'civil';
  const box = form && form.elements ? form.elements['rectified'] : null;
  const rectified = !!(box && box.checked === true);
  return {
    pillars,
    gender,
    birthPlace: birthPlace || null,
    timeMode,
    rectified,
    rectifyEvents: ctRows(q('#ct-rectify-events')),
    outcomeEvents: ctRows(q('#ct-outcome-events')),
  };
}

/** renderContribute() —— R 是 json.data；env 是外壳（本页不用，保留签名） */
function renderContribute(R, env) {
  const root = el('div', { class: 'contribute' });
  if (!isObj(R)) {
    root.append(card('数据反馈', na('接口未返回 data')));
    return root;
  }
  const g = isObj(R.gate) ? R.gate : {};

  /* 未通过（accepted !== true，含后端没给 accepted 的情况）：红色卡片，逐条列，全部判空则 na() */
  if (R.accepted !== true) {
    const blockers = (Array.isArray(g.blockers) ? g.blockers : []).filter((x) => !blank(x));
    const fixes = (Array.isArray(R.whatToFix) ? R.whatToFix : []).filter((x) => !blank(x));
    const box = el('div', { class: 'card err ct-gate-bad', role: 'alert' },
      el('div', { class: 'ct-verdict ' + (R.tier === 'X' ? 'bad' : 'ok') }, R.tier === 'X' ? '无法使用 · 四柱不合法' : ('已入库 · 等级 ' + (R.tier ?? '?') + ' · ' + (R.label ?? ''))));

    if (blockers.length) {
      box.append(el('div', { class: 'ct-blockers' },
        el('div', { class: 'ct-h' }, '误差告知（这些会让结果不够准，但数据已收下）'),
        el('ul', null, blockers.map((b) => el('li', null, clean(b))))));
    }
    if (fixes.length) {
      box.append(el('div', { class: 'ct-blockers ct-fixes' },
        el('div', { class: 'ct-h' }, '建议补什么（补上后可升级）'),
        el('ul', null, fixes.map((b) => el('li', null, clean(b))))));
    }
    if (!blank(R.reason)) {
      box.append(el('p', { class: 'ct-line' }, el('strong', null, '原因：'), clean(R.reason)));
    }
    if (!blockers.length && !fixes.length && blank(R.reason)) {
      box.append(el('p', { class: 'ct-line' }, na('gate.blockers / whatToFix / reason')));
    }
    if (finite(g.score)) box.append(el('div', { class: 'note' }, `门槛得分 ${numTxt(g.score, 0)} / 100`));
    root.append(box);
    loadContribStats(); // 渲染后刷新一次统计
    return root;
  }

  /* 已入库：绿色卡片 + id / gate.score / 去重后的 warnings / note */
  const okBox = el('div', { class: 'card ct-gate-ok', role: 'status' },
    el('div', { class: 'ct-verdict ok' }, '已入库'));
  const warns = Array.isArray(g.warnings)
    ? [...new Set(g.warnings.filter((x) => !blank(x)).map((x) => clean(x)))]
    : [];
  okBox.append(el('div', { class: 'kpis' },
    kpi('编号 id', blank(R.id) ? null : clean(R.id), '', 'ct-kpi-text'),
    kpi('门槛得分', finite(g.score) ? numTxt(g.score, 0) : null, '分')));
  okBox.append(secHeading('提示 warnings'));
  okBox.append(warns.length
    ? el('div', { class: 'tags ct-warns' }, warns.map((w) => tag(w, 'warn')))
    : el('div', { class: 'note' }, '无附加提示（gate.warnings 为空）'));
  okBox.append(el('div', { class: 'note ct-note' },
    blank(R.note) ? na('note') : clean(R.note)));
  root.append(okBox);
  loadContribStats(); // 渲染后刷新一次统计
  return root;
}

/** loadContribStats() —— GET /api/contrib-stats（无 data 外壳）→ #ct-stats */
async function loadContribStats() {
  const box = q('#ct-stats');
  if (!box) return;
  box.replaceChildren(el('div', { class: 'card empty' }, '统计读取中…'));
  try {
    const res = await fetch('/api/contrib-stats', { cache: 'no-store' });
    let j = null;
    try {
      j = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}：响应不是 JSON`);
    }
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    if (!isObj(j)) throw new Error('响应不是对象');

    const total = finite(j.total) ? j.total : null;
    const cats = isObj(j.categories) ? j.categories : {};
    const decisive = isObj(j.decisive) ? j.decisive : {};
    const decisiveCats = Array.isArray(j.decisiveCategories)
      ? j.decisiveCategories.filter((c) => typeof c === 'string' && c)
      : [];

    const kids = [
      el('div', { class: 'ct-stats-total' }, total === null ? na('total') : `已收 ${total} 条`),
    ];

    const rows = Object.keys(cats)
      .filter((k) => k && k !== 'undefined' && finite(cats[k]))
      .map((k) => [k, cats[k], decisiveCats.includes(k) ? tag('决定性', 'ok') : '—']);
    if (rows.length) {
      kids.push(table(['类别', '事件数', '类型'], rows, { reason: 'categories 字段缺失' }));
    } else {
      kids.push(el('div', { class: 'note' }, '暂无类别计数（采集库还没有可统计的结局事件）'));
    }

    const decNames = Object.keys(decisive).filter((k) => k && k !== 'undefined' && finite(decisive[k]));
    if (decNames.length) {
      kids.push(el('div', { class: 'note' },
        '决定性事件：' + decNames.map((k) => `${k} ${decisive[k]}`).join(' · ')));
    }
    if (decisiveCats.length) {
      kids.push(el('div', { class: 'tags ct-cats' }, decisiveCats.map((c) => tag(c))));
    }

    box.replaceChildren(card('采集库统计', ...kids));
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    box.replaceChildren(card('采集库统计', el('div', { class: 'note' }, na(msg))));
  }
}

/** initContribute() —— 绑定反馈表单；脚本在 body 末尾，DOM 已就绪，直接绑并读一次统计 */
function initContribute() {
  const form = q('#f-contribute');
  const out = q('#contribute-out');
  if (form && out) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      let payload;
      try {
        payload = contributePayload(form);
      } catch (e) {
        showErr(out, e);
        return;
      }
      runForm({ form, out, url: '/api/contribute', payload, render: renderContribute });
    });
  }
  loadContribStats(); // 页面加载即刷新一次
}

if (typeof document !== 'undefined') initContribute();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

})();

/* ══════════ 城市 → 经纬度 自动填充（CITY_BINDING） ══════════ */
import { findCity } from '/cities.js';
function bindCitySelects() {
  const pairs = [['#city-fusion', 'input[name="lng"]', 'input[name="lat"]'],
                 ['#city-a', 'input[name="a_lng"]', 'input[name="a_lat"]'],
                 ['#city-b', 'input[name="b_lng"]', 'input[name="b_lat"]']];
  for (const [sel, lngSel, latSel] of pairs) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.addEventListener('change', () => {
      const c = findCity(el.value);
      if (!c) return;
      const [, lng, lat] = c;
      const li = document.querySelector(lngSel), la = document.querySelector(latSel);
      if (li) li.value = lng;
      if (la) la.value = lat;
    });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindCitySelects);
else bindCitySelects();


/* ══════════ 采集结果：分级徽章 + 误差告知（TIER_BADGE） ══════════ */
function renderTierBadge(R) {
  if (!R || !R.tier) return null;
  const tier = R.tier;
  const map = {
    A: { cls: 'ok', text: 'A 级 · 可直接参与校准' },
    B: { cls: 'warn', text: 'B 级 · 以 0.6 权重参与校准' },
    C: { cls: 'warn', text: 'C 级 · 仅结构参考，不参与校准' },
    X: { cls: 'bad', text: 'X 级 · 数据无法使用' },
  };
  const m = map[tier] ?? map.C;
  const box = el('div', { class: 'ct-tier' });
  box.append(el('div', { class: 'tags' },
    el('span', { class: 'tag ' + m.cls }, m.text),
    el('span', { class: 'tag' }, '质量分 ' + (R.qualityScore ?? '-')),
    el('span', { class: 'tag' }, '校准权重 ' + (R.calibrationWeight ?? '-'))));
  if (R.impact) box.append(el('p', { class: 'ct-line' }, clean(R.impact)));
  if (Array.isArray(R.advisories) && R.advisories.length) {
    box.append(el('div', { class: 'ct-blockers' },
      el('div', { class: 'ct-h' }, '误差告知（数据已收下，但这些会影响准确度）'),
      el('ul', null, R.advisories.map((a) => el('li', null, clean(a))))));
  }
  return box;
}


/* ══════════ 合盘：综合结构契合度总览（renderStructuralSummary） ══════════ */
// 自带元素构造器：不依赖外层 el（曾因作用域遮蔽报 "el is not defined"）
function _mk(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) {
    if (k === null || k === undefined || k === false) continue;
    n.append(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return n;
}
const _clean = (s) => String(s ?? '').replace(/\*\*/g, '');

function renderStructuralSummary(sum) {
  if (!sum || typeof sum.structuralFitPct !== 'number') return null;
  const pct = sum.structuralFitPct;
  const tone = pct >= 70 ? 'good' : pct >= 42 ? 'warn' : 'bad';
  const box = _mk('div', { class: 'card ss-card' });

  box.append(_mk('h3', { class: 'ss-title' }, '综合结构契合度'));
  box.append(_mk('div', { class: 'ss-hero' },
    _mk('div', { class: 'ss-pct ' + tone }, String(pct) + '%'),
    _mk('div', { class: 'ss-side' },
      _mk('div', { class: 'ss-band' }, sum.band ?? ''),
      _mk('div', { class: 'ss-m' }, '综合分 M = ' + (sum.mValue ?? '-')))));
  box.append(_mk('p', { class: 'ss-disc' }, _clean(sum.disclaimer ?? '')));

  // 三路分项（横向条）
  if (Array.isArray(sum.components)) {
    const list = _mk('div', { class: 'ss-comps' });
    for (const c of sum.components) {
      const bar = _mk('div', { class: 'bar' },
        _mk('div', { class: 'ss-k' }, c.key),
        _mk('div', { class: 'track' }, _mk('div', { class: 'fill', style: 'width:' + Math.max(0, Math.min(100, c.pct ?? 0)) + '%' })),
        _mk('div', { class: 'n' }, (c.pct === null ? '—' : c.pct + '%')));
      list.append(bar);
      list.append(_mk('div', { class: 'ss-note' },
        (c.what ?? '') + '　' + (c.dir ?? '') + '　z=' + (c.z ?? '-') + '　权重 ' + (c.weight ?? '-')));
    }
    box.append(list);
  }

  // 否决说明
  if (sum.veto && sum.veto.multiplier !== 1) {
    box.append(_mk('div', { class: 'note' },
      '否决生效：' + (sum.veto.note ?? '') + '（总分再乘 ' + sum.veto.multiplier + '）'));
  }

  // 公式
  if (sum.formula) box.append(_mk('div', { class: 'note' }, '算法：' + _clean(sum.formula)));

  // 术语解释（折叠）
  const det = _mk('details', { class: 'ss-explain' });
  det.append(_mk('summary', null, 'M、z 和百分比分别是什么意思？（点开看）'));
  if (sum.meaning) det.append(_mk('p', { class: 'ss-mean' }, _clean(sum.meaning)));
  box.append(det);
  return box;
}

/** 把 explain 对象渲染成折叠区（由 renderSynastry 尾部调用） */
function renderExplain(explain) {
  if (!explain || !Object.keys(explain).length) return null;
  const det = _mk('details', { class: 'ss-explain card' });
  det.append(_mk('summary', null, '这些数字怎么读？（点开看）'));
  for (const [k, v] of Object.entries(explain)) {
    det.append(_mk('div', { class: 'ss-ex-item' },
      _mk('strong', null, k + '　'), _clean(v)));
  }
  return det;
}




/* ══════════ 合盘总览挂载（自足；不依赖 render 的返回值约定） ══════════ */
function maybeAddSynastrySummary(host, data) {
  if (!host || !data || !data.summary) return;
  try {
    const sumBox = renderStructuralSummary(data.summary);
    if (sumBox) host.insertBefore(sumBox, host.firstChild);
    const expBox = renderExplain(data.explain);
    if (expBox) host.append(expBox);
  } catch (e) {
    // 总览失败不能影响主结果：只在控制台留痕
    console.warn('summary render failed:', e && e.message);
  }
}

/* ══════════ 中西合璧圆盘：挂载 + 行星注入 ══════════ */
let stageMounted = false;
function initStage() {
  const el = document.querySelector('#stage-hero');
  if (!el || stageMounted) return;
  mountStage(el);
  stageMounted = true;
}
function feedStage(natalData) {
  // natalData: apiNatal 的 planets（数组，含 name/lon）或 computeNatal 的对象
  if (!natalData) return;
  const list = Array.isArray(natalData)
    ? natalData
    : Object.entries(natalData).map(([name, v]) => ({ name, ...v }));
  try { setPlanets(list); } catch (e) { console.warn('stage feed failed', e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStage);
else initStage();

/* ══════════ 导航：圆盘 / 页面 ══════════ */
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-go]');
  if (!b) return;
  const go = b.dataset.go;
  if (go === 'stage') {
    const hero = document.querySelector('#stage-hero');
    if (hero) { hero.scrollIntoView({ behavior: 'smooth' }); }
  }
});


/* ══════════ 默认落地页：关于（含隐私承诺） ══════════ */
(function defaultToAbout() {
  function go() {
    const pages = document.querySelectorAll('.page');
    if (!pages.length) return;
    pages.forEach((p) => p.classList.toggle('active', p.dataset.page === 'about'));
    document.querySelectorAll('.tabbar button').forEach((b) => {
      const on = b.dataset.go === 'about';
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(go, 0));
  else setTimeout(go, 0);
})();


/* 直达某页：/?p=fusion 或 #fusion */
(function __directPage() {
  try {
    var m = (location.search.match(/[?&]p=([\w-]+)/) || [])[1] || (location.hash || '').replace('#', '');
    if (m && window.__gotoPage) window.__gotoPage(m);
  } catch (e) {}
})();
