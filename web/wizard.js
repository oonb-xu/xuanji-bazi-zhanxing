// 一站式向导 + 实验性排盘并排（用户裁定 A：两套并排，绝不替用户选）
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
    // ★ 年份来源依次尝试：API 字段 → 盘上文字 → 表单输入，任一成功即可
    var y = 0, cands = [
      d.bazi.year, d.bazi.solar && d.bazi.solar.year, d.year,
      d.bazi.solarDate, d.bazi.at, d.at,
    ];
    for (var ci = 0; ci < cands.length && !y; ci++) {
      var v = cands[ci];
      if (v == null) continue;
      var mm = String(v).match(/(\d{4})/);
      if (mm) y = +mm[1];
    }
    if (!y) {
      var inp = document.querySelector('#f-fusion [name="at"], #f-fusion input[name="at"]');
      if (inp && inp.value) { var m2 = String(inp.value).match(/(\d{4})/); if (m2) y = +m2[1]; }
    }
    if (!y) {
      try {
        var sb = JSON.parse(localStorage.getItem('xuanji:birth') || '{}');
        var m3 = String(sb.at || '').match(/(\d{4})/); if (m3) y = +m3[1];
      } catch (e) {}
    }
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

  // ★ 由 fw-fullscreen 的 __afterHudBuilt 驱动（不再用会早停的轮询）
  window.__afterHudBuilt = function () { try { renderExpIntoHud(); } catch (e) {} };
  // 首次挂载时若已在全屏态，补一次
  setTimeout(function () { try { renderExpIntoHud(); } catch (e) {} }, 1200);
})();
