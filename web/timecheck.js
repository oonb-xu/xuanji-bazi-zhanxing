// 玄机 · 时间风险自检（POST /api/timecheck）
//
// 由 <script type="module" src="/timecheck.js"> 载入（零依赖，无 import/export，
// 因此同时保持 node --check 可解析）。职责只有两件：
//   1) 在 #f-fusion 末尾注入「我已自行换算过真太阳时」开关；勾选后，发往
//      /api/bazi|fusion|synastry 的 JSON 请求体附加 timeMode:"trueSolar"。
//   2) 融合 / 合盘提交时并行请求 /api/timecheck，把风险横幅渲染到 <main> 上方、
//      把详情卡 insertBefore 到对应结果容器前。
//
// 铁律：接口没给的字段一律 na()，不用默认值/占位值填充。
//       app.js 的 payload 构造与既有 id/name 一律不动。

/* ══════════════════════ 精简工具：q() / el() / na() ══════════════════════ */

const q = (sel, root = document) => (root || document).querySelector(sel);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const has = (v) => v !== null && v !== undefined && v !== '';
const plain = (s) => String(s).replace(/\*\*/g, '').replace(/`/g, '');

/** el() —— 建元素：el('div', {class:'card', style:'...'}, child, 'text') */
function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props && typeof props === 'object') {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class' || k === 'className') node.className = String(v);
      else if (k === 'text') node.textContent = String(v);
      else node.setAttribute(k, String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    if (kid instanceof Node) node.append(kid);
    else node.append(document.createTextNode(String(kid)));
  }
  return node;
}

/** na() —— 字段不可用就说事实 + 原因，绝不编造 */
function na(reason) {
  return el('span', {
    class: 'na',
    style: 'color:#8b93a7;font-size:12px;font-weight:400',
  }, `不可用：${reason || '接口未返回该字段'}`);
}

/** kpi() —— 复用 style.css 的 .kpis/.kpi 小卡片 */
function kpi(label, value) {
  let body;
  if (value instanceof Node) body = value;
  else if (has(value)) body = String(value);
  else body = na('字段缺失');
  return el('div', { class: 'kpi' },
    el('div', { class: 'k' }, label),
    el('div', { class: 'v' }, body));
}

/* ══════════════════════ ① fetch 拦截：勾选后附加 timeMode ══════════════════════ */

// app.js 的 runForm 用的是裸 fetch（运行时解析到 window.fetch），所以包装
// window.fetch 即可生效，不需要改 app.js 的 payload 构造函数。
const native = window.fetch.bind(window);

window.fetch = (u, o) => {
  try {
    const path = new URL(u, location).pathname;
    if (o && typeof o.body === 'string'
      && /\/api\/(bazi|fusion|synastry)$/.test(path)
      && q('#t-trueSolar')?.checked) {
      const body = JSON.parse(o.body);
      if (isObj(body)) {
        body.timeMode = 'trueSolar';
        o = { ...o, body: JSON.stringify(body) };
      }
    }
  } catch {
    /* 非 JSON / 非法 URL：原样放行，绝不打断主流程 */
  }
  return native(u, o);
};

/* ══════════════════════ ② 注入 UI ══════════════════════ */

function injectUI() {
  const form = q('#f-fusion');
  if (form && !q('#t-trueSolar')) {
    const cb = el('input', { type: 'checkbox', id: 't-trueSolar', style: 'accent-color:#c9a227' });
    form.append(el('label', {
      style: 'display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:#c8cdd6',
    }, cb, ' 我已自行换算过真太阳时'));
  }

  const main = q('main');
  if (main && !q('#tc-banner')) {
    const banner = el('div', { id: 'tc-banner' });
    banner.hidden = true;
    main.parentNode.insertBefore(banner, main);
  }
}

/* ══════════════════════ ③ 渲染：横幅 + 详情卡 ══════════════════════ */

const LEVEL_STYLE = {
  high: 'margin:10px 12px 0;padding:11px 14px;border-radius:10px;background:#3a1518;border:1px solid #d9534f;color:#ffd9d4;font-size:13px;line-height:1.65',
  medium: 'margin:10px 12px 0;padding:11px 14px;border-radius:10px;background:#3a3315;border:1px solid #c9a227;color:#ffe9a8;font-size:13px;line-height:1.65',
  low: 'margin:10px 12px 0;padding:11px 14px;border-radius:10px;background:#14301f;border:1px solid #3fb68b;color:#c9f5df;font-size:13px;line-height:1.65',
  unknown: 'margin:10px 12px 0;padding:10px 14px;border-radius:10px;background:#12151d;border:1px solid #3a4152;color:#c8cdd6;font-size:13px;line-height:1.65',
};

const LEVEL_TEXT = { high: '高', medium: '中', low: '低' };

const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];
const CHANGED_KEYS = ['年', '月', '日', '时'];

function renderBanner(data) {
  const banner = q('#tc-banner');
  if (!banner) return;

  const level = data && isObj(data.risk) ? data.risk.level : null;
  banner.replaceChildren();

  if (!LEVEL_STYLE[level]) {
    banner.setAttribute('style', LEVEL_STYLE.unknown);
    banner.append(el('div', null, '时间风险自检：', na('risk.level 缺失或取值异常')));
    banner.hidden = false;
    return;
  }

  banner.setAttribute('style', LEVEL_STYLE[level]);
  banner.append(el('div', { style: 'font-weight:600' },
    `时间风险：${LEVEL_TEXT[level]}（${level}）`));

  const items = Array.isArray(data.risk.items) ? data.risk.items.filter(isObj) : [];
  if (items.length) {
    banner.append(el('ul', { style: 'margin:6px 0 0;padding-left:18px' },
      items.map((it) => el('li', null, has(it.why) ? plain(it.why) : na('risk.items[].why')))));
  } else {
    banner.append(el('div', { style: 'margin-top:4px;opacity:.85' }, '接口未返回具体风险项'));
  }

  banner.append(el('div', { style: 'margin-top:6px;opacity:.92' },
    has(data.advice) ? plain(data.advice) : el('span', null, '建议：', na('advice'))));
  banner.hidden = false;
}

function hideBanner() {
  const banner = q('#tc-banner');
  if (!banner) return;
  banner.hidden = true;
  banner.replaceChildren();
}

/** 四柱对比表：changed[]（年/月/日/时）命中的柱 inline 高亮 */
function pillarTable(civilP, trueP, changed) {
  const hit = (i) => changed.includes(CHANGED_KEYS[i]);
  const cell = (label, arr) => el('tr', null,
    el('td', null, label),
    arr.map((v, i) => el('td', {
      style: hit(i) ? 'background:#4a1f24;color:#ffd9d4;font-weight:600' : null,
      title: hit(i) ? '该柱因民用时→真太阳时换算而改变' : null,
    }, has(v) ? String(v) : na(`pillars.${label}.${i}`))));

  return el('div', { style: 'overflow-x:auto' },
    el('table', { style: 'margin-top:2px' },
      el('thead', null, el('tr', null,
        el('th', null, '口径'),
        PILLAR_LABELS.map((label, i) => el('th', {
          style: hit(i) ? 'color:#ffb3ab' : null,
        }, label)))),
      el('tbody', null,
        cell('民用时', civilP),
        cell('真太阳时', trueP))));
}

function clearDetail(out) {
  const parent = out.parentNode;
  if (!parent) return;
  for (const node of Array.from(parent.children)) {
    if (node.classList && node.classList.contains('tc-detail')) node.remove();
  }
}

/** 详情卡：data 为 null 时只显示不可用 + 原因（failReason） */
function renderDetail(out, data, failReason) {
  const parent = out.parentNode;
  if (!parent) return;
  clearDetail(out);

  const box = el('div', { class: 'card tc-detail' });
  box.append(el('h3', {
    style: 'margin:0 0 10px;font-size:14px;color:#c9a227;font-weight:600;letter-spacing:.4px',
  }, '时间风险自检 · 真太阳时 / 时柱 / 上升'));

  if (!isObj(data)) {
    box.append(el('div', { class: 'note' }, na(failReason || '接口未返回时间自检数据（data 为空）')));
    parent.insertBefore(box, out);
    return;
  }

  /* 民用时 → 真太阳时 + 偏移 */
  const civilIn = has(data.civilInput) ? String(data.civilInput) : null;
  const trueIn = has(data.trueSolarInput) ? String(data.trueSolarInput) : null;
  const off = isNum(data.offsetMinutes) ? String(data.offsetMinutes) : null;

  box.append(el('div', { class: 'kpis' },
    kpi('民用时', civilIn === null ? na('civilInput') : civilIn),
    kpi('真太阳时', trueIn === null ? na('trueSolarInput') : trueIn),
    kpi('偏移', off === null
      ? na('offsetMinutes')
      : el('span', null, off, el('span', { class: 'u' }, '分钟')))));

  /* 四柱前后对比 */
  const P = isObj(data.pillars) ? data.pillars : null;
  const civilP = P && Array.isArray(P.civil) ? P.civil : null;
  const trueP = P && Array.isArray(P.trueSolar) ? P.trueSolar : null;
  const changed = P && Array.isArray(P.changed) ? P.changed.map(String) : [];

  box.append(el('div', {
    style: 'margin:14px 0 6px;font-size:12px;letter-spacing:.5px;color:#c9a227;font-weight:600',
  }, '四柱对比（民用时 → 真太阳时）'));

  if (civilP && trueP && civilP.length === 4 && trueP.length === 4) {
    box.append(pillarTable(civilP, trueP, changed));
  } else {
    box.append(el('div', { class: 'note' },
      '四柱对比：', na('pillars.civil / pillars.trueSolar（各需 4 柱）')));
  }

  /* 上升 */
  box.append(el('div', {
    style: 'margin:14px 0 6px;font-size:12px;letter-spacing:.5px;color:#c9a227;font-weight:600',
  }, '上升（Asc）'));

  const asc = isObj(data.asc) ? data.asc : null;
  if (!asc) {
    box.append(el('div', { class: 'note' }, na('asc')));
  } else {
    const sign = has(asc.sign) ? String(asc.sign) : null;
    const deg = isNum(asc.deg) ? `${asc.deg}°` : null;
    const stable = asc.stable === true
      ? '稳定（±3 分钟不换座）'
      : asc.stable === false
        ? '不稳定（±3 分钟内换座）'
        : null;
    const edge = isNum(asc.edgeDistance) ? `${asc.edgeDistance}°` : null;

    box.append(el('div', { class: 'kpis' },
      kpi('星座', sign === null ? na('asc.sign') : sign),
      kpi('度数', deg === null ? na('asc.deg') : deg),
      kpi('稳定性', stable === null ? na('asc.stable') : stable),
      kpi('距边界', edge === null ? na('asc.edgeDistance') : edge)));
  }

  if (out.id === 'synastry-out') {
    box.append(el('div', { class: 'note' }, '合盘页仅自动检测甲方（a_at / a_gender / a_lng / a_lat）。'));
  }

  parent.insertBefore(box, out);
}

function renderTimeCheck(data, out) {
  renderBanner(data);
  renderDetail(out, data, null);
}

/* ══════════════════════ ④ 请求 /api/timecheck ══════════════════════ */

const FIELD_MAP = {
  'f-fusion': { at: 'at', gender: 'gender', lng: 'lng', lat: 'lat' },
  'f-synastry': { at: 'a_at', gender: 'a_gender', lng: 'a_lng', lat: 'a_lat' },
};

const OUT_MAP = { 'f-fusion': '#fusion-out', 'f-synastry': '#synastry-out' };

function readFields(form) {
  const map = FIELD_MAP[form.id] || FIELD_MAP['f-fusion'];
  const get = (name) => {
    const input = form.elements.namedItem(name);
    return input && 'value' in input ? String(input.value).trim() : '';
  };

  const payload = {};
  const missing = [];

  const at = get(map.at);
  if (at) payload.at = at; else missing.push(`${map.at}（出生时间）`);

  const gender = get(map.gender);
  if (gender) payload.gender = gender; else missing.push(`${map.gender}（性别）`);

  const lngRaw = get(map.lng);
  const latRaw = get(map.lat);
  const lng = lngRaw === '' ? NaN : Number(lngRaw);
  const lat = latRaw === '' ? NaN : Number(latRaw);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) missing.push(`${map.lng}（经度 −180…180）`);
  else payload.lng = lng;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) missing.push(`${map.lat}（纬度 −90…90）`);
  else payload.lat = lat;

  return { payload, missing };
}

async function runTimeCheck(form) {
  if (!form) return;
  const out = q(OUT_MAP[form.id] || '');
  if (!out) return;

  const { payload, missing } = readFields(form);
  if (missing.length) {
    hideBanner();
    renderDetail(out, null, `表单缺少有效字段：${missing.join('、')}（未发起 /api/timecheck）`);
    return;
  }

  try {
    const res = await native('/api/timecheck', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}：响应不是 JSON`);
    }
    if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
    if (!isObj(json) || !isObj(json.data)) throw new Error('响应缺少 data 字段');
    renderTimeCheck(json.data, out);
  } catch (e) {
    hideBanner();
    renderDetail(out, null, `时间自检请求失败：${e && e.message ? e.message : e}`);
  }
}

/* ══════════════════════ ⑤ 挂接：capture 阶段 submit，并行跑 ══════════════════════ */

function bindForms() {
  for (const [formSel, outSel] of [
    ['#f-fusion', '#fusion-out'],
    ['#f-synastry', '#synastry-out'],
  ]) {
    const form = q(formSel);
    const out = q(outSel);
    if (!form || !out) continue;
    form.addEventListener('submit', () => {
      // capture 阶段监听，但**不** preventDefault、**不** stopPropagation：
      // app.js 的主流程照常执行；延后一个宏任务发起并行请求，两路请求同时在途。
      setTimeout(() => { runTimeCheck(form); }, 0);
    }, true);
  }
}

/* ══════════════════════ 启动 ══════════════════════ */

function boot() {
  injectUI();
  bindForms();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
