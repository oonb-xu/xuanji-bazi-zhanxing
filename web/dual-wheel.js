// 「外盘 + 内盘」双环对照图
// 外环 = 十二地支 + 藏干（锚定黄经，静态）
// 内环 = 十二宫 + 紫微宫名（锚定 ASC，动态）
// 两环的旋转量 = 上升点 ASC（画成一条贯穿的接缝线）
(function () {
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var CG = { 子: '癸', 丑: '己癸辛', 寅: '甲丙戊', 卯: '乙', 辰: '戊乙癸', 巳: '丙戊庚', 午: '丁己', 未: '己丁乙', 申: '庚壬戊', 酉: '辛', 戌: '戊辛丁', 亥: '壬甲' };
  var ZW = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
  var DOM = ['自我/身体', '资源/价值', '沟通/近亲', '家庭/根基', '创造/子女', '工作/健康', '关系/合作', '共享/危机', '远行/信念', '事业/名声', '群体/愿景', '隐退/内在'];
  var PAGE = 0, PER_PAGE = 6;
  var LAST = null;
  var PAGE7 = 0;   /* 七柱分页：0=四柱 1=胎元/命宫/身宫 */   /* 上次绘制用的数据（分页重绘用） */   /* 内环分页：一次 6 宫 */

  /* 地支 z 的起始黄经：子=255°，每支 +30°（子月=大雪→小寒） */
  function zhiStart(z) { return (255 + z * 30) % 360; }
  function zhiOfLon(l) { return ZHI[Math.floor((((l - 255) % 360) + 360) % 360 / 30)]; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

  /* 紫微命宫：寅起正月，顺数至生月；再自该宫起子时，逆数至生时 */
  function ziweiMing(pillars) {
    if (!Array.isArray(pillars) || pillars.length < 4) return null;
    var zhiIdx = function (gz) {
      var b = String(gz || '').slice(-1);
      return ZHI.indexOf(b);
    };
    var mz = zhiIdx(pillars[1]);   // 月支
    var hz = zhiIdx(pillars[3]);   // 时支
    if (mz < 0 || hz < 0) return null;
    var monthNum = ((mz - 2) % 12 + 12) % 12 + 1;   // 寅月=1
    var hourNum = hz + 1;                            // 子时=1
    return ((2 + (monthNum - 1) - (hourNum - 1)) % 12 + 12) % 12;  // 寅 index = 2
  }

  function draw(d) {
    var host = document.getElementById('dual-wheel-host');
    if (!host) return;
    if (!d) d = LAST || window.__fwLastData;
    if (d) LAST = d;
    var natal = d && d.natal;
    var angles = natal && natal.angles;
    var cusps = natal && natal.cusps;
    var pillars = d && d.bazi && d.bazi.pillars;
    if (!angles || !Array.isArray(cusps) || cusps.length < 12) {
      host.innerHTML = '<div class="note">双环对照需要星盘的 ASC 与十二宫头（本次数据未返回）</div>';
      return;
    }
    var asc = Number(angles.asc), mc = Number(angles.mc);
    var C = 320, R1 = 292, R2 = 236, R3 = 186, R4 = 140;
    var x = function (lon, r) { var t = (lon - 90) * Math.PI / 180; return C + r * Math.cos(t); };
    var y = function (lon, r) { var t = (lon - 90) * Math.PI / 180; return C + r * Math.sin(t); };
    var pt = function (lon, r) { return x(lon, r) + ',' + y(lon, r); };

    var s = '<svg viewBox="-42 -42 724 724" class="dw-svg" role="img" aria-label="外盘地支与内盘宫位双环对照">';
    /* 底 */
    s += '<circle cx="' + C + '" cy="' + C + '" r="' + R1 + '" fill="rgba(4,10,20,.66)" stroke="rgba(94,241,255,.22)"/>';
    s += '<circle cx="' + C + '" cy="' + C + '" r="' + R2 + '" fill="none" stroke="rgba(94,241,255,.14)"/>';
    s += '<circle cx="' + C + '" cy="' + C + '" r="' + R3 + '" fill="none" stroke="rgba(255,213,138,.18)"/>';

    /* ── 外环：十二地支（静态，锚定黄经）+ 藏干 ── */
    for (var z = 0; z < 12; z++) {
      var a0 = zhiStart(z), a1 = a0 + 30;
      s += '<path d="M' + pt(a0, R1) + ' A' + R1 + ',' + R1 + ' 0 0 1 ' + pt(a1, R1) +
        ' L' + pt(a1, R2) + ' A' + R2 + ',' + R2 + ' 0 0 0 ' + pt(a0, R2) + ' Z" ' +
        'fill="' + (z % 2 ? 'rgba(94,241,255,.05)' : 'rgba(94,241,255,.10)') + '" stroke="rgba(94,241,255,.16)"/>';
      var mid = a0 + 15;
      s += '<text x="' + x(mid, (R1 + R2) / 2 + 14) + '" y="' + (y(mid, (R1 + R2) / 2 + 14) + 7) +
        '" text-anchor="middle" font-size="27" font-weight="700" fill="#ffd58a">' + ZHI[z] + '</text>';
      s += '<text x="' + x(mid, (R1 + R2) / 2 - 12) + '" y="' + (y(mid, (R1 + R2) / 2 - 12) + 4) +
        '" text-anchor="middle" font-size="13" fill="rgba(185,220,245,.9)">' + esc(CG[ZHI[z]]) + '</text>';
    }

    /* ── 内环：十二宫（动态，锚定 ASC）+ 紫微宫名 —— 分页，一次 6 宫 ── */
    var ming = ziweiMing(pillars);
    var all = [];
    for (var h = 0; h < 12; h++) {
      var c0 = Number(cusps[h]), c1 = Number(cusps[(h + 1) % 12]);
      var span = ((c1 - c0) % 360 + 360) % 360;
      if (span <= 0) span = 30;
      all.push({ i: h, c0: c0, span: span });
    }
    all.sort(function (a, b) { return a.c0 - b.c0; });
    var PAGE_MAX = Math.ceil(all.length / PER_PAGE);
    if (PAGE >= PAGE_MAX) PAGE = 0;

    all.slice(PAGE * PER_PAGE, PAGE * PER_PAGE + PER_PAGE).forEach(function (it) {
      var h = it.i, c0 = it.c0, span = it.span, g1 = c0 + span, mh = c0 + span / 2;
      s += '<path d="M' + pt(c0, R3) + ' A' + R3 + ',' + R3 + ' 0 0 1 ' + pt(g1, R3) +
        ' L' + pt(g1, R4) + ' A' + R4 + ',' + R4 + ' 0 0 0 ' + pt(c0, R4) + ' Z" ' +
        'fill="' + (h % 2 ? 'rgba(255,196,87,.06)' : 'rgba(255,196,87,.12)') + '" stroke="rgba(255,196,87,.22)"/>';
      var zi = null;
      if (ming != null) {
        var seq = ((zhiStart(ming) - c0) % 360 + 360) % 360;
        zi = Math.round(seq / 30) % 12;
      }
      /* 第一行：宫号 · 地支 · 紫微宫名 */
      s += '<text x="' + x(mh, R3 - 30) + '" y="' + (y(mh, R3 - 30) + 6) +
        '" text-anchor="middle" font-size="20" font-weight="700" fill="#ffe6a8">' + (h + 1) +
        ' <tspan font-size="15" fill="#9fe8ff">' + zhiOfLon(c0) + '</tspan>' +
        (zi != null ? ' <tspan font-size="15" fill="' + (zi === 0 ? '#ff9a8a' : 'rgba(255,213,138,.95)') + '">' + esc(ZW[zi]) + '</tspan>' : '') +
        '</text>';
      /* 第二行：领域 */
      s += '<text x="' + x(mh, R3 - 54) + '" y="' + (y(mh, R3 - 54) + 4) +
        '" text-anchor="middle" font-size="12.5" fill="rgba(190,222,245,.92)">' + esc(DOM[h]) + '</text>';
    });

    var bar = '<div class="fw-ring-page">'
      + '<button type="button" data-dw-page="prev"' + (PAGE === 0 ? ' disabled' : '') + '>‹ 前六宫</button>'
      + '<span>第 ' + (PAGE + 1) + ' / ' + PAGE_MAX + ' 页 · 内环分页</span>'
      + '<button type="button" data-dw-page="next"' + (PAGE >= PAGE_MAX - 1 ? ' disabled' : '') + '>后六宫 ›</button>'
      + '<i class="sep"></i>'
      + '<button type="button" data-dw-page7="0"' + (PAGE7 === 0 ? ' class="on"' : '') + '>四柱</button>'
      + '<button type="button" data-dw-page7="1"' + (PAGE7 === 1 ? ' class="on"' : '') + '>胎元·命宫·身宫</button>'
      + '</div>';

    /* ── SEVEN-PILLARS：最外环 · 七柱（分两组） ── */
    var pNames = ['年柱', '月柱', '日柱', '时柱'];
    var R0 = R1 + 24;
    if (Array.isArray(pillars) && pillars.length >= 4) {
      var bb = (d && d.bazi) || {};
      var xe = bb.extra || {};
      var ex = {
        taiYuan:  bb.taiYuan  || xe.taiYuan,
        mingGong: bb.mingGong || xe.mingGong,
        shenGong: bb.shenGong || xe.shenGong
      };
      var groupA = pillars.slice(0, 4).map(function (gz, i) { return { label: pNames[i], gz: gz, dashed: false }; });
      var groupB = [['胎元', ex.taiYuan], ['命宫', ex.mingGong], ['身宫', ex.shenGong]]
        .filter(function (x) { return x[1]; })
        .map(function (x) { return { label: x[0], gz: x[1], dashed: true }; });

      var grp = (PAGE7 === 1 && groupB.length) ? groupB : groupA;
      var isB = (grp === groupB);

      s += '<circle cx="' + C + '" cy="' + C + '" r="' + R0 + '" fill="none" stroke="' +
        (isB ? 'rgba(255,196,87,.22)' : 'rgba(160,200,235,.18)') + '" stroke-dasharray="' +
        (isB ? '2 6' : '3 5') + '"/>';

      var n = grp.length;
      grp.forEach(function (it, i) {
        var ang = -90 + (360 / n) * i;          /* 均分绕环 */
        var pxx = C + R0 * Math.cos(ang * Math.PI / 180);
        var pyy = C + R0 * Math.sin(ang * Math.PI / 180);
        s += '<circle cx="' + pxx + '" cy="' + pyy + '" r="' + (isB ? 17 : 19) + '" fill="rgba(6,14,26,.94)" stroke="' +
          (isB ? 'rgba(255,196,87,.45)' : 'rgba(255,196,87,.6)') + '"' + (isB ? ' stroke-dasharray="3 3"' : '') + '/>';
        s += '<text x="' + pxx + '" y="' + (pyy + 5) + '" text-anchor="middle" font-size="' + (isB ? 14 : 16) +
          '" font-weight="700" fill="' + (isB ? '#ffe6a8' : '#ffe6a8') + '">' + esc(it.gz) + '</text>';
        /* 组名放圈外一点，避免压地支环 */
        var lx = C + (R0 + 22) * Math.cos(ang * Math.PI / 180);
        var ly = C + (R0 + 22) * Math.sin(ang * Math.PI / 180);
        s += '<text x="' + lx + '" y="' + (ly + 4) + '" text-anchor="middle" font-size="10.5" fill="' +
          (isB ? 'rgba(255,213,138,.9)' : 'rgba(170,205,232,.85)') + '">' + esc(it.label) + '</text>';
      });
    }

    /* ── 接缝：ASC / MC 两条贯穿线 ── */
    s += '<line x1="' + x(asc, R1 + 10) + '" y1="' + y(asc, R1 + 10) + '" x2="' + x(asc, 26) + '" y2="' + y(asc, 26) +
      '" stroke="#5ef1ff" stroke-width="2.4" stroke-dasharray="7 5" opacity=".95"/>';
    s += '<text x="' + x(asc, R1 + 26) + '" y="' + (y(asc, R1 + 26) + 4) +
      '" text-anchor="middle" font-size="14" font-weight="700" fill="#5ef1ff">ASC 上升 ' + asc.toFixed(1) + '°</text>';
    s += '<line x1="' + x(mc, R1 + 6) + '" y1="' + y(mc, R1 + 6) + '" x2="' + x(mc, 30) + '" y2="' + y(mc, 30) +
      '" stroke="rgba(255,154,138,.75)" stroke-width="1.4" stroke-dasharray="4 6"/>';
    s += '<text x="' + x(mc, R1 + 26) + '" y="' + (y(mc, R1 + 26) + 4) +
      '" text-anchor="middle" font-size="13" fill="#ff9a8a">MC 天顶 ' + mc.toFixed(1) + '°</text>';

    /* ── DRAW-PLANETS：行星按真实黄经画在内环上 ── */
    var planets = (natal && Array.isArray(natal.planets)) ? natal.planets : [];
    var seen = 0;
    planets.forEach(function (p) {
      var lon = p && (p.lon != null ? p.lon : (p.lng != null ? p.lng : p.longitude));
      if (lon == null || !isFinite(lon)) return;
      seen++;
      var nm = p.name || p.planet || '';
      var short = { '太阳': '日', '月亮': '月', '水星': '水', '金星': '金', '火星': '火', '木星': '木', '土星': '土', '天王星': '天', '海王星': '海', '冥王星': '冥' }[nm] || nm.slice(0, 1);
      var col = { '日': '#ffd58a', '月': '#dfe9f5', '水': '#9fe8ff', '金': '#ffb3c8', '火': '#ff9a8a', '木': '#ffc457', '土': '#b48cff', '天': '#7dffb4', '海': '#5ef1ff', '冥': '#c08cff' }[short] || '#8fb8d8';
      var px = x(lon, R4 - 24), py = y(lon, R4 - 24);   /* 往里挪，避开「领域」文字行 */
      s += '<circle cx="' + px + '" cy="' + py + '" r="5.4" fill="' + col + '" opacity=".92"/>';
      s += '<text x="' + px + '" y="' + (py - 9) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + col + '">' + esc(short) + '</text>';
    });

    /* 中心 */
    s += '<circle cx="' + C + '" cy="' + C + '" r="30" fill="rgba(8,16,24,.95)" stroke="rgba(255,196,87,.5)"/>';
    s += '<text x="' + C + '" y="' + (C + 5) + '" text-anchor="middle" font-size="12" fill="#ffe6a8">⊙ 地心</text>';
    s += '</svg>';

    var legend = '<div class="dw-legend">'
      + '<span><b style="color:#5ef1ff">外环</b> 十二地支 + 藏干 · 锚定黄经 · <b>静态</b></span>'
      + '<span><b style="color:#ffd58a">内环</b> 十二宫 + 紫微宫名 · 锚定 ASC · <b>动态</b></span>'
      + '<span><b style="color:#5ef1ff">旋转量 = 上升点</b>（两条线的夹角就是两套坐标系的差）</span>'
      + (ming != null ? '<span>紫微命宫落在 <b style="color:#ff9a8a">' + ZHI[ming] + '宫</b></span>' : '')
      + '</div>';

    host.innerHTML = bar + legend + s;
    if (!host.__pageBound) {
      host.__pageBound = true;
      host.addEventListener('click', function (ev) {
        var b7 = ev.target.closest && ev.target.closest('[data-dw-page7]');
        if (b7) {
          PAGE7 = Number(b7.getAttribute('data-dw-page7')) === 1 ? 1 : 0;
          draw(window.__fwLastData || LAST);
          return;
        }
        var btn = ev.target.closest && ev.target.closest('[data-dw-page]');
        if (!btn) return;
        PAGE += (btn.getAttribute('data-dw-page') === 'next' ? 1 : -1);
        if (PAGE < 0) PAGE = 0;
        draw(window.__fwLastData || LAST);
      });
    }
  }

  /* 拿数据：优先用 __fwLastData，其次自己拉一次 */
  function boot() {
    var host = document.getElementById('dual-wheel-host');
    if (!host) return;
    if (window.__fwLastData) { draw(window.__fwLastData); return; }
    var form = document.getElementById('f-fusion');
    if (!form) return;
    var g = function (n) { var e = form.querySelector('[name="' + n + '"]'); return e ? e.value : ''; };
    var body = { at: g('at'), gender: g('gender'), lng: parseFloat(g('lng')), lat: parseFloat(g('lat')), tz: 8 };
    if (!body.at) return;
    fetch('/api/fusion', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) draw(j.data); })
      .catch(function () {});
  }

  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'f-fusion') setTimeout(function () {
      if (window.__fwLastData) draw(window.__fwLastData); else boot();
    }, 900);
  }, true);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-go="fusion"]')) setTimeout(boot, 1000);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
