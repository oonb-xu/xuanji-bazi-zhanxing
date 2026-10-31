// ① 向导：出生信息 → 生平事件 → 结果（复用 share-birth 的共享数据）
// ② 实验性排盘：59.58 版年柱/月干/胎元与标准版**并排**（用户选 A），不同时才显示
import fs from 'node:fs';
let changed = [];

/* ══════════ ① 向导 JS ══════════ */
fs.writeFileSync('web/wizard.js', `// 一站式向导 + 实验性排盘并排（用户裁定 A：两套并排，绝不替用户选）
(function () {
  /* ── 59.58 假说：实验版年柱（与 src/cross/experimental-calendar.mjs 同一算法）── */
  var GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var CYCLE_EXP = 3 * (1 / (1 / 11.862 - 1 / 29.457));   // ≈ 59.5770 年
  var EPOCH = 1984;                                       // 甲子
  var WUHU = { 甲:'丙',己:'丙',乙:'戊',庚:'戊',丙:'庚',辛:'庚',丁:'壬',壬:'壬',戊:'甲',癸:'甲' };

  function gz(i) { return GAN[((i % 10) + 10) % 10] + ZHI[((i % 12) + 12) % 12]; }
  function idxOf(g) { for (var i = 0; i < 60; i++) if (gz(i) === g) return i; return -1; }
  function yearStd(y) { return ((y - EPOCH) % 60 + 60) % 60; }
  function yearExp(y) { return Math.floor((y - EPOCH) * (60 / CYCLE_EXP)); }
  function monthGan(yearGan, monthZhi) {
    var s = WUHU[yearGan]; if (!s) return null;
    var off = ((ZHI.indexOf(monthZhi) - ZHI.indexOf('寅')) + 12) % 12;
    return GAN[(GAN.indexOf(s) + off) % 10];
  }
  function taiYuan(mg, mz) { return GAN[(GAN.indexOf(mg) + 1) % 10] + ZHI[(ZHI.indexOf(mz) + 3) % 12]; }

  /**
   * 给定盘上四柱与日历年，返回实验版对比
   * ★ 关键：不用日历年重算年柱（立春前属上一年），只用「索引差」平移盘上真实年柱
   */
  function expCompare(pillars, year) {
    if (!pillars || pillars.length < 4) return null;
    var delta = yearExp(year) - yearStd(year);
    var ai = idxOf(pillars[0]);
    var expYear = ai >= 0 ? gz(ai + delta) : null;
    if (!expYear) return null;
    var mz = pillars[1][1];
    var emg = monthGan(expYear[0], mz) || pillars[1][0];
    var r = {
      year: { std: pillars[0], exp: expYear },
      month: { std: pillars[1], exp: emg + mz },
      tai: { std: taiYuan(pillars[1][0], mz), exp: taiYuan(emg, mz) },
      cycle: CYCLE_EXP,
    };
    r.changed = r.year.std !== r.year.exp || r.month.std !== r.month.exp || r.tai.std !== r.tai.exp;
    return r;
  }
  window.__expCompare = expCompare;

  /* ── 把实验版并排塞进融合盘 HUD ── */
  function renderExpIntoHud() {
    var host = document.querySelector('#fusion-wheel-host');
    if (!host || !host.classList.contains('fw-full')) return;
    if (host.querySelector('.fw-exp')) return;
    var d = window.__fwLastData;
    var pillars = d && d.bazi && d.bazi.pillars;
    if (!pillars) return;
    var y = parseInt(String(d.bazi.year || (d.bazi.solar && d.bazi.solar.year) || '0'), 10);
    if (!y) { var m = String(d.bazi.solarDate || d.at || '').match(/^(\\d{4})/); y = m ? +m[1] : 0; }
    if (!y) return;
    var c = expCompare(pillars, y);
    if (!c || !c.changed) return;
    var box = document.createElement('div');
    box.className = 'fw-hud fw-exp';
    box.innerHTML =
      '<div class="h-k">实验性排盘 · 59.58 年周期（并排，不替你选）</div>' +
      '<div class="h-line">年柱 <s>' + c.year.std + '</s> → <b class="h-x">' + c.year.exp + '</b></div>' +
      '<div class="h-line">月柱 <s>' + c.month.std + '</s> → <b class="h-x">' + c.month.exp + '</b> <i class="h-dim">（月支不变）</i></div>' +
      '<div class="h-line">胎元 <s>' + c.tai.std + '</s> → <b class="h-x">' + c.tai.exp + '</b></div>' +
      '<div class="h-dim" style="margin-top:4px">日柱/时柱/命宫/身宫 不受影响 · 详见关于页</div>';
    host.appendChild(box);
  }

  /* ── 向导 ── */
  var STEP = 1;
  var EVENTS = [];

  function el(t, c, h) { var d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (x) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[x]); }); }

  function readBirth() {
    try { return JSON.parse(localStorage.getItem('xuanji:birth') || '{}'); } catch (e) { return {}; }
  }
  function writeBirth(o) { try { localStorage.setItem('xuanji:birth', JSON.stringify(o)); } catch (e) {} }

  function paint() {
    var box = document.getElementById('wizard');
    if (!box) return;
    var b = readBirth();
    var dots = [1, 2, 3].map(function (n) {
      return '<span class="wz-dot' + (STEP === n ? ' on' : '') + (STEP > n ? ' done' : '') + '">' + n + '</span>';
    }).join('<i class="wz-line"></i>');

    var body = '';
    if (STEP === 1) {
      body =
        '<div class="wz-grid">' +
        field('at', '出生时刻', b.at || '', 'text', '2000-01-01 12:00') +
        field('gender', '性别', b.gender || '男', 'select', '') +
        field('lng', '经度', b.lng != null ? b.lng : '', 'text', '116.407') +
        field('lat', '纬度', b.lat != null ? b.lat : '', 'text', '39.904') +
        '</div>' +
        '<div class="wz-note">不知道时辰？先填大致时间，下一步填事件后可做<b>生时矫正</b>。</div>';
    } else if (STEP === 2) {
      body = '<div class="wz-ev-head"><b>生平事件（可选，但很有用）</b>' +
        '<span>它用于两件事：① 生时矫正 ② 生成可检验的样本</span></div>' +
        '<div id="wz-events">' + EVENTS.map(evRow).join('') + '</div>' +
        '<button type="button" id="wz-add-ev" class="wz-btn ghost">+ 加一条事件</button>' +
        '<div class="wz-note">只填年份就够。<b>请勿填写姓名、单位等可识别信息。</b></div>';
    } else {
      var n = EVENTS.length;
      body =
        '<div class="wz-done">' +
        '<div class="wz-line-1">出生：<b>' + esc(b.at || '未填') + '</b>　' + esc(b.gender || '') +
        '　' + esc(b.lng || '?') + ', ' + esc(b.lat || '?') + '</div>' +
        '<div class="wz-line-1">事件：<b>' + n + '</b> 条' + (n ? '（' + EVENTS.slice(0, 3).map(function (e) { return e.year + esc(e.kind || ''); }).join('、') + (n > 3 ? '…' : '') + '）' : '') + '</div>' +
        '</div>' +
        '<div class="wz-acts">' +
        '<a class="wz-btn primary" data-wz-go="fusion" href="#fusion">排盘 · 融合盘</a>' +
        '<a class="wz-btn" data-wz-go="rectify" href="#rectify">生时矫正</a>' +
        '<a class="wz-btn" data-wz-go="synastry" href="#synastry">合盘</a>' +
        '<button type="button" class="wz-btn" id="wz-sample">生成样本（时间+事件）</button>' +
        '</div>' +
        '<div class="wz-note">三个视图共用你刚填的这份数据，不用重复输入。</div>';
    }

    box.innerHTML =
      '<div class="wz-head"><b>一站式</b><span>填一次，三处通用</span><div class="wz-steps">' + dots + '</div></div>' +
      '<div class="wz-body">' + body + '</div>' +
      '<div class="wz-foot">' +
      (STEP > 1 ? '<button type="button" class="wz-btn ghost" id="wz-prev">← 上一步</button>' : '') +
      (STEP < 3 ? '<button type="button" class="wz-btn primary" id="wz-next">下一步 →</button>' : '') +
      '</div>';

    bind();
  }

  function field(name, label, val, type, ph) {
    if (type === 'select') {
      return '<label class="wz-f"><i>' + label + '</i><select name="' + name + '">' +
        ['男', '女', '未填'].map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
        '</select></label>';
    }
    return '<label class="wz-f"><i>' + label + '</i><input name="' + name + '" type="text" value="' +
      esc(val) + '" placeholder="' + ph + '"></label>';
  }

  function evRow(e, i) {
    var KINDS = ['求学','就业','升迁','创业','婚姻','生育','离婚','疾病','亲丧','迁移','破财','得财','官非','意外','修行','其他'];
    return '<div class="wz-ev" data-i="' + i + '">' +
      '<input class="wz-ev-y" type="number" min="1900" max="2200" placeholder="年份" value="' + (e.year || '') + '">' +
      '<select class="wz-ev-k">' + KINDS.map(function (k) { return '<option' + (k === e.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<input class="wz-ev-n" type="text" placeholder="一句话（可空）" value="' + esc(e.note || '') + '">' +
      '<button type="button" class="wz-x">✕</button></div>';
  }

  function collectSteps() {
    var box = document.getElementById('wizard');
    if (STEP === 1) {
      var o = readBirth();
      ['at', 'gender', 'lng', 'lat'].forEach(function (n) {
        var e = box.querySelector('[name="' + n + '"]');
        if (e) o[n] = e.value;
      });
      writeBirth(o);
      if (window.__birthShared && window.__birthShared.hydrate) window.__birthShared.hydrate();
    } else if (STEP === 2) {
      EVENTS = Array.prototype.slice.call(box.querySelectorAll('.wz-ev')).map(function (r) {
        return {
          year: +r.querySelector('.wz-ev-y').value || 0,
          kind: r.querySelector('.wz-ev-k').value,
          note: r.querySelector('.wz-ev-n').value || '',
        };
      }).filter(function (e) { return e.year > 0; });
      try { localStorage.setItem('xuanji:events', JSON.stringify(EVENTS)); } catch (e) {}
    }
  }

  function bind() {
    var box = document.getElementById('wizard');
    var nx = box.querySelector('#wz-next');
    var pv = box.querySelector('#wz-prev');
    if (nx) nx.onclick = function () { collectSteps(); STEP = Math.min(3, STEP + 1); paint(); };
    if (pv) pv.onclick = function () { collectSteps(); STEP = Math.max(1, STEP - 1); paint(); };
    var add = box.querySelector('#wz-add-ev');
    if (add) add.onclick = function () { collectSteps(); EVENTS.push({ year: '', kind: '其他', note: '' }); paint(); };
    Array.prototype.slice.call(box.querySelectorAll('.wz-x')).forEach(function (btn, i) {
      btn.onclick = function () { collectSteps(); EVENTS.splice(i, 1); paint(); };
    });
    var sm = box.querySelector('#wz-sample');
    if (sm) sm.onclick = function () {
      var b = readBirth();
      var sample = {
        id: 'smp-' + Date.now().toString(36),
        birth: {
          at: b.at || '', tz: 8, lng: +b.lng || 0, lat: +b.lat || 0,
          gender: b.gender || '未填', timePrecision: 'exact', rectified: false,
        },
        events: EVENTS.map(function (e) { return { year: e.year, kind: e.kind, note: e.note, certainty: '确定' }; }),
        consent: { contribute: false, ts: new Date().toISOString(), scope: '仅用于模型校准' },
        meta: { source: '一站式向导', version: '1.0' },
      };
      var blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = sample.id + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    };
  }

  function mount() {
    var pg = document.querySelector('[data-page="fusion"]');
    if (!pg) return;
    if (document.getElementById('wizard')) { paint(); return; }
    var w = el('div', 'card', '');
    w.id = 'wizard';
    var h2 = pg.querySelector('h2');
    if (h2 && h2.nextSibling) pg.insertBefore(w, h2.nextSibling);
    else pg.insertBefore(w, pg.firstChild);
    try { EVENTS = JSON.parse(localStorage.getItem('xuanji:events') || '[]'); } catch (e) { EVENTS = []; }
    paint();
  }

  window.__wizardMount = mount;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 400); });
  else setTimeout(mount, 400);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('[data-go], .nav a, [data-wz-go]')) setTimeout(mount, 350);
  }, true);

  // 每次排盘后尝试把实验版并排塞进 HUD
  var _orig = window.__fwSetData;
  Object.defineProperty(window, '__fwLastData', { value: null, writable: true, configurable: true });
  var tries = 0;
  var iv = setInterval(function () {
    if (++tries > 40) return clearInterval(iv);
    if (window.__fwLastData) renderExpIntoHud();
  }, 500);
})();
`, 'utf8');
console.log('① web/wizard.js 已写入');
changed.push('wizard.js');

/* ══════════ ② 引入 + 暴露 lastData ══════════ */
let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('/wizard.js')) {
  html = html.replace('<script src="/share-birth.js"></script>',
    '<script src="/share-birth.js"></script>\n  <script src="/wizard.js"></script>');
  fs.writeFileSync('web/index.html', html, 'utf8');
  changed.push('index 引入');
}
let app = fs.readFileSync('web/app.js', 'utf8');
if (!app.includes('__fwLastData')) {
  app = app.replace('window.__fwSetData(json.data);',
    'window.__fwLastData = json.data;\n      window.__fwSetData(json.data);');
  fs.writeFileSync('web/app.js', app, 'utf8');
  changed.push('app 暴露 lastData');
}

/* ══════════ ③ 样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.wz-head')) {
  css += `

/* ══════════ 一站式向导 ══════════ */
#wizard{margin-bottom:16px;border-color:rgba(94,241,255,.28);background:rgba(94,241,255,.03)}
.wz-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.wz-head b{font-size:15px;color:#5ef1ff}
.wz-head span{font-size:11.5px;color:rgba(150,190,220,.65)}
.wz-steps{display:flex;align-items:center;gap:5px;margin-left:auto}
.wz-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11.5px;font-weight:700;color:rgba(140,185,215,.6);background:rgba(8,18,30,.8);
  border:1.5px solid rgba(90,160,220,.25)}
.wz-dot.on{color:#04170c;background:#5ef1ff;border-color:#5ef1ff}
.wz-dot.done{color:#7dffb4;border-color:rgba(125,255,180,.55)}
.wz-line{width:20px;height:1px;background:rgba(90,160,220,.3)}
.wz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.wz-f{display:flex;flex-direction:column;gap:4px}
.wz-f i{font-style:normal;font-size:11px;color:rgba(150,190,220,.7);letter-spacing:.06em}
.wz-f input,.wz-f select{padding:8px 10px;border-radius:8px;border:1px solid rgba(90,160,220,.28);
  background:rgba(4,10,18,.7);color:#eaf7ff;font-size:13px;font-family:inherit}
.wz-f input:focus,.wz-f select:focus{outline:none;border-color:rgba(94,241,255,.6)}
.wz-note{margin-top:11px;font-size:11.5px;line-height:1.75;color:rgba(150,190,220,.72)}
.wz-foot{display:flex;gap:9px;margin-top:14px;justify-content:flex-end}
.wz-btn{padding:8px 16px;border-radius:8px;border:1px solid rgba(90,160,220,.3);
  background:rgba(8,18,30,.7);color:#cfe9ff;font-size:12.5px;cursor:pointer;font-family:inherit;
  text-decoration:none;display:inline-flex;align-items:center;gap:5px}
.wz-btn:hover{border-color:rgba(94,241,255,.55);color:#5ef1ff}
.wz-btn.primary{background:rgba(94,241,255,.15);border-color:rgba(94,241,255,.5);color:#5ef1ff;font-weight:600}
.wz-btn.ghost{background:transparent}
.wz-ev{display:grid;grid-template-columns:90px 110px 1fr 30px;gap:7px;margin-bottom:7px;align-items:center}
.wz-ev input,.wz-ev select{padding:7px 9px;border-radius:7px;border:1px solid rgba(90,160,220,.24);
  background:rgba(4,10,18,.7);color:#eaf7ff;font-size:12.5px;font-family:inherit;min-width:0}
.wz-ev-y{text-align:center}
.wz-x{border:1px solid rgba(255,154,138,.3);background:rgba(255,154,138,.08);color:#ff9a8a;
  border-radius:7px;cursor:pointer;font-size:11px;padding:6px 0}
.wz-ev-head{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}
.wz-ev-head b{font-size:13px;color:#eaf7ff}
.wz-ev-head span{font-size:11.5px;color:rgba(150,190,220,.7)}
.wz-done{font-size:13px;line-height:2;color:#dfeaf5}
.wz-line-1 b{color:#ffc457}
.wz-acts{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}

/* ══════════ 实验性排盘并排 ══════════ */
.fw-exp{left:26px;bottom:auto;top:50%;transform:translateY(-50%);
  background:rgba(14,8,26,.78);border:1px solid rgba(180,140,255,.4);
  border-radius:11px;padding:12px 15px;max-width:280px}
.fw-ex s{color:rgba(150,185,210,.6)}
.fw-exp .h-x{color:#b48cff;font-weight:800}
.fw-exp s{color:rgba(150,185,210,.55);text-decoration:line-through;text-decoration-color:rgba(255,255,255,.2)}
@media(max-width:760px){.fw-exp{display:none}}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  changed.push('样式');
}

console.log('改动：', changed.join(' / '));

/* 校验 */
const w = fs.readFileSync('web/wizard.js', 'utf8');
const i2 = fs.readFileSync('web/index.html', 'utf8');
const a2 = fs.readFileSync('web/app.js', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['wizard.js 有向导', w.includes('function paint()')],
  ['三步', w.includes('STEP === 1') && w.includes('STEP === 2') && w.includes('STEP === 3')],
  ['事件表', w.includes('EVENTS')],
  ['生成样本', w.includes('wz-sample')],
  ['实验版对比', w.includes('expCompare')],
  ['实验版并排渲染', w.includes('renderExpIntoHud')],
  ['已引入', i2.includes('/wizard.js')],
  ['app 暴露 lastData', a2.includes('__fwLastData')],
  ['CSS 有 .wz-head', fs.readFileSync('web/style.css', 'utf8').includes('.wz-head')],
  ['CSS 有 .fw-exp', fs.readFileSync('web/style.css', 'utf8').includes('.fw-exp')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
