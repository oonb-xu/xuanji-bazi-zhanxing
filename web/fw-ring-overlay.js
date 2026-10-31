// 融合盘「外环层」v2：不碰 3D 渲染，在 #fusion-wheel-host 之上叠一层平面 SVG 环
// 地支环 12 支全显示（支 + 藏干）· 宫位环分页显示（一次 6 宫，一行：宫号·地支·紫微名）· ASC/MC · 全部可点击
(function () {
  var ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var CG = { 子:'癸', 丑:'己癸辛', 寅:'甲丙戊', 卯:'乙', 辰:'戊乙癸', 巳:'丙戊庚', 午:'丁己', 未:'己丁乙', 申:'庚壬戊', 酉:'辛', 戌:'戊辛丁', 亥:'壬甲' };
  var ZW = ['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];

  var PAGE = 0;
  var PER_PAGE = 6;

  function zhiStart(z) { return (255 + z * 30) % 360; }
  function zhiOfLon(l) { return ZHI[Math.floor((((l - 255) % 360) + 360) % 360 / 30)]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[c]; }); }

  function ziweiMing(pillars) {
    if (!Array.isArray(pillars) || pillars.length < 4) return null;
    var idx = function (gz) { return ZHI.indexOf(String(gz || '').slice(-1)); };
    var mz = idx(pillars[1]), hz = idx(pillars[3]);
    if (mz < 0 || hz < 0) return null;
    var monthNum = ((mz - 2) % 12 + 12) % 12 + 1, hourNum = hz + 1;
    return ((2 + (monthNum - 1) - (hourNum - 1)) % 12 + 12) % 12;
  }

  function draw() {
    var host = document.getElementById('fusion-wheel-host');
    if (!host) return;
    var d = window.__fwLastData;
    var natal = d && d.natal, angles = natal && natal.angles, cusps = natal && natal.cusps;
    var pillars = d && d.bazi && d.bazi.pillars;
    if (!angles || !Array.isArray(cusps) || cusps.length < 12) return;

    var box = host.getBoundingClientRect();
    var W = Math.max(320, Math.round(box.width)), H = Math.max(320, Math.round(box.height));
    var cx = W / 2, cy = H / 2, half = Math.min(W, H) / 2;

    var edge = Math.min(W, H) * 0.37;
    var zhiIn = edge + 4, zhiOut = zhiIn + 26;
    var palIn = zhiOut + 4, palOut = palIn + 34;
    if (palOut > half - 8) {
      var k = (half - 8 - edge) / (26 + 4 + 34 + 4);
      zhiOut = zhiIn + 26 * k;
      palIn = zhiOut + 4; palOut = palIn + 34 * k;
    }

    var asc = Number(angles.asc), mc = Number(angles.mc);
    var X = function (lon, r) { var t = (lon - 90) * Math.PI / 180; return cx + r * Math.cos(t); };
    var Y = function (lon, r) { var t = (lon - 90) * Math.PI / 180; return cy + r * Math.sin(t); };
    var pt = function (lon, r) { return X(lon, r) + ',' + Y(lon, r); };
    var ming = ziweiMing(pillars);

    var s = '<svg class="fw-ring-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';

    /* ── 地支环（12 支，两行） ── */
    for (var z = 0; z < 12; z++) {
      var a0 = zhiStart(z), a1 = a0 + 30, m = a0 + 15;
      s += '<path d="M' + pt(a0, zhiOut) + ' A' + zhiOut + ',' + zhiOut + ' 0 0 1 ' + pt(a1, zhiOut) +
        ' L' + pt(a1, zhiIn) + ' A' + zhiIn + ',' + zhiIn + ' 0 0 0 ' + pt(a0, zhiIn) + ' Z" fill="' +
        (z % 2 ? 'rgba(94,241,255,.05)' : 'rgba(94,241,255,.10)') + '" stroke="rgba(94,241,255,.18)"/>';
      s += '<text x="' + X(m, (zhiOut + zhiIn) / 2 + 6) + '" y="' + (Y(m, (zhiOut + zhiIn) / 2 + 6) + 5) +
        '" text-anchor="middle" font-size="14" font-weight="700" fill="#ffd58a" data-dw="zhi|' + ZHI[z] + '" style="cursor:pointer">' + ZHI[z] + '</text>';
      s += '<text x="' + X(m, (zhiOut + zhiIn) / 2 - 8) + '" y="' + (Y(m, (zhiOut + zhiIn) / 2 - 8) + 3) +
        '" text-anchor="middle" font-size="9" fill="rgba(180,215,240,.82)" data-dw="canggan|' + CG[ZHI[z]] + '" style="cursor:pointer">' + esc(CG[ZHI[z]]) + '</text>';
    }

    /* ── 宫位环（分页，一次 6 宫，一行） ── */
    var all = [];
    for (var h = 0; h < 12; h++) {
      var c0 = Number(cusps[h]), c1 = Number(cusps[(h + 1) % 12]);
      var span = ((c1 - c0) % 360 + 360) % 360; if (span <= 0) span = 30;
      all.push({ i: h, c0: c0, span: span });
    }
    all.sort(function (a, b) { return a.c0 - b.c0; });
    var pageMax = Math.ceil(all.length / PER_PAGE);
    if (PAGE >= pageMax) PAGE = 0;
    var midR = (palOut + palIn) / 2;

    all.slice(PAGE * PER_PAGE, PAGE * PER_PAGE + PER_PAGE).forEach(function (it) {
      var h = it.i, c0 = it.c0, span = it.span, g1 = c0 + span, mh = c0 + span / 2;
      var zhi = zhiOfLon(c0), zi = null;
      if (ming != null) {
        var seq = ((zhiStart(ming) - c0) % 360 + 360) % 360;
        zi = Math.round(seq / 30) % 12;
      }
      s += '<path d="M' + pt(c0, palOut) + ' A' + palOut + ',' + palOut + ' 0 0 1 ' + pt(g1, palOut) +
        ' L' + pt(g1, palIn) + ' A' + palIn + ',' + palIn + ' 0 0 0 ' + pt(c0, palIn) + ' Z" fill="' +
        (h % 2 ? 'rgba(255,196,87,.06)' : 'rgba(255,196,87,.11)') + '" stroke="rgba(255,196,87,.22)"/>';
      s += '<text x="' + X(mh, midR) + '" y="' + (Y(mh, midR) + 4) + '" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffe6a8" data-dw="house|' + (h + 1) + '" style="cursor:pointer">' +
        (h + 1) + ' <tspan fill="#9fe8ff">' + zhi + '</tspan>' +
        (zi != null ? ' <tspan fill="' + (zi === 0 ? '#ff9a8a' : 'rgba(255,213,138,.9)') + '">' + esc(ZW[zi]) + '</tspan>' : '') +
        '</text>';
    });

    /* ── ASC / MC ── */
    s += '<line x1="' + X(asc, zhiOut + 6) + '" y1="' + Y(asc, zhiOut + 6) + '" x2="' + X(asc, edge - 16) + '" y2="' + Y(asc, edge - 16) +
      '" stroke="#5ef1ff" stroke-width="2" stroke-dasharray="6 5" opacity=".9" pointer-events="none"/>';
    s += '<text x="' + X(asc, zhiOut + 18) + '" y="' + (Y(asc, zhiOut + 18) + 4) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#5ef1ff" data-dw="angle|ASC" style="cursor:pointer">ASC ' + asc.toFixed(1) + '°</text>';
    s += '<line x1="' + X(mc, zhiOut + 4) + '" y1="' + Y(mc, zhiOut + 4) + '" x2="' + X(mc, edge - 16) + '" y2="' + Y(mc, edge - 16) +
      '" stroke="rgba(255,154,138,.6)" stroke-width="1.2" stroke-dasharray="4 6" pointer-events="none"/>';
    s += '<text x="' + X(mc, zhiOut + 18) + '" y="' + (Y(mc, zhiOut + 18) + 4) + '" text-anchor="middle" font-size="10" fill="#ff9a8a" data-dw="angle|MC" style="cursor:pointer">MC ' + mc.toFixed(0) + '°</text>';
    s += '</svg>';

    var bar = '<div class="fw-ring-page">'
      + '<button type="button" data-ring-page="prev"' + (PAGE === 0 ? ' disabled' : '') + '>‹ 前六宫</button>'
      + '<span>第 ' + (PAGE + 1) + ' / ' + pageMax + ' 页 · 宫位环分页</span>'
      + '<button type="button" data-ring-page="next"' + (PAGE >= pageMax - 1 ? ' disabled' : '') + '>后六宫 ›</button>'
      + '</div>';

    var layer = host.querySelector('.fw-ring-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'fw-ring-layer';
      host.appendChild(layer);
    }
    layer.innerHTML = bar + s;
    if (!layer.__bound) {
      layer.__bound = true;
      layer.addEventListener('click', function (ev) {
        var btn = ev.target.closest && ev.target.closest('[data-ring-page]');
        if (btn) {
          PAGE += (btn.getAttribute('data-ring-page') === 'next' ? 1 : -1);
          if (PAGE < 0) PAGE = 0;
          draw();
          return;
        }
        var t = ev.target;
        if (!t || t.tagName !== 'text') return;
        var a = t.getAttribute('data-dw');
        if (!a) return;
        var p = a.split('|');
        var info = { k: p[0], v: p.slice(1).join('|'), label: (t.textContent || '').trim() };
        if (info.k === 'house') {
          var mm = /^\d+/.exec(info.label);
          if (mm) info.label = mm[0];
          info.label = '第 ' + info.label + ' 宫';
        } else {
          var LBL = { zhi: '地支 ', canggan: '藏干 ', zw: '紫微 ', angle: '' };
          info.label = (LBL[info.k] || '') + info.label;
        }
        document.dispatchEvent(new CustomEvent('dw-show', { detail: info }));
      });
    }
  }

  function boot() {
    if (window.__fwLastData) draw();
  }
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'f-fusion') setTimeout(draw, 1500);
  }, true);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-go="fusion"]')) setTimeout(draw, 1600);
  }, true);
  window.addEventListener('resize', function () { setTimeout(draw, 250); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
