// 全屏融合盘 HUD：七柱（透干高亮）+ 12宫地支藏干（透干高亮）+ 紫微宫名 + 七政四余
// 设计要点：
//   · **不移动 DOM** —— 只给 .fw-card 加 .fw-full 类，靠 ResizeObserver 让 fit() 重算
//   · 宇宙幕布是 CSS 的 ::before/::after，总不透明度很低，不喧宾夺主
(function () {
  var host = null, lastData = null, DEEP = null;   // DEEP = /api/deep 的响应（含动态十神权重）

  /* ── 藏干表与五行（自带，避免依赖 fusion3d 内部变量）── */
  var CANG = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
    辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
  };
  var GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  /* 星座 → 月将地支（七政四余十二次） */
  var SIGN2ZHI = { 白羊: '戌', 金牛: '酉', 双子: '申', 巨蟹: '未', 狮子: '午', 处女: '巳',
    天秤: '辰', 天蝎: '卯', 射手: '寅', 摩羯: '丑', 水瓶: '子', 双鱼: '亥' };
  /* 紫微十二宫（逆序排在命宫之后） */
  var ZW_ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
  /* 七政 + 四余 */
  var QIZHENG = { 太阳: '日', 月亮: '月', 木星: '木', 火星: '火', 土星: '土', 金星: '金', 水星: '水' };
  var SIYU = { 北交点: '罗睺', 南交点: '计都' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]); }); }
  function gz(x) {
    if (x == null) return null;
    if (typeof x === 'string') return x.length >= 2 ? x : null;
    if (typeof x === 'object') return x.ganzhi || (x.gan && x.zhi ? x.gan + x.zhi : null);
    return null;
  }

  /** 取一盘的七柱 + 天干集合（用于判透干） */
  function extract(d) {
    var b = (d && d.bazi) || {};
    var four = b.pillars || (d && d.pillars) || [];
    if (!Array.isArray(four)) four = [];
    var extra = [gz(b.taiYuan), gz(b.mingGong), gz(b.shenGong)];
    var pillars = four.slice(0, 4).concat(extra.filter(Boolean));
    var gans = {};
    pillars.forEach(function (p) { if (p && p.length >= 2) gans[p[0]] = true; });
    // 四柱天干（透干判定只认四柱，不认派生柱）
    var fourGans = {};
    four.slice(0, 4).forEach(function (p) { if (p && p.length >= 2) fourGans[p[0]] = true; });
    return {
      pillars: pillars, four: four.slice(0, 4), extra: extra,
      gans: gans, fourGans: fourGans,
      dm: b.dayMaster || '', verdict: (b.strength && b.strength.verdict) || '',
      mingGong: gz(b.mingGong),
    };
  }

  /** 七柱块：胎命身用虚线边框；有藏干透出的柱高亮 */
  function pillarsHtml(x) {
    var names = ['年', '月', '日', '时', '胎元', '命宫', '身宫'];
    var h = '<div class="h-k">七柱 · 日主</div><div class="h-pillars">';
    x.pillars.forEach(function (p, i) {
      if (!p || p.length < 2) return;
      var zhi = p[1], cang = CANG[zhi] || [];
      // 该柱地支的藏干，有几个透到四柱天干
      var tou = cang.filter(function (g) { return x.fourGans[g]; });
      var isDerived = i >= 4;
      h += '<span class="h-pc' + (isDerived ? ' deriv' : '') + (tou.length ? ' tou' : '') + '" title="' +
        names[i] + ' ' + p + '｜藏干 ' + cang.join('') + (tou.length ? '｜透出 ' + tou.join('') : '｜纯藏') + '">' +
        '<i>' + names[i] + '</i>' + esc(p) + (tou.length ? '<em>透</em>' : '') + '</span>';
    });
    h += '</div>';
    if (x.dm) h += '<div class="h-line">日主 <b style="color:#ffc457">' + esc(x.dm) + '</b>' + (x.verdict ? ' · ' + esc(x.verdict) : '') + '</div>';
    return h;
  }

  /** 12 宫块：地支 + 藏干（透干高亮）+ 紫微宫名 */
  function housesHtml(x) {
    var startZhi = x.mingGong ? x.mingGong[1] : null;
    var i0 = startZhi ? ZHI.indexOf(startZhi) : -1;
    var h = '<div class="h-k">十二宫 · 地支 · 藏干</div><div class="h-houses">';
    for (var k = 0; k < 12; k++) {
      var zhi = ZHI[k];
      var cang = CANG[zhi] || [];
      // 紫微宫名：命宫起，逆序（子→亥）
      var zwName = '';
      if (i0 >= 0) {
        var off = ((i0 - k) % 12 + 12) % 12;   // 从命宫支逆数
        zwName = ZW_ORDER[off] || '';
      }
      var cangHtml = cang.map(function (g) {
        var isTou = !!x.fourGans[g];
        return '<em class="' + (isTou ? 'tou' : '') + '">' + g + '<sub>' + GAN_WX[g] + '</sub></em>';
      }).join('');
      var anyTou = cang.some(function (g) { return x.fourGans[g]; });
      h += '<span class="h-hc' + (anyTou ? ' tou' : '') + '" title="' + zhi + '｜' + (zwName || '—') + '｜藏干 ' + cang.join('') + '">' +
        '<i>' + zhi + '</i>' + (zwName ? '<s>' + zwName + '</s>' : '') + '<b>' + cangHtml + '</b></span>';
    }
    h += '</div>';
    return h;
  }

  var G5 = ['比劫', '印', '食伤', '财', '官杀'];
  var G_COLOR = { 比劫: '#ff9a8a', 印: '#7dffb4', 食伤: '#5ef1ff', 财: '#ffc457', 官杀: '#b48cff' };

  /** 5 组权重迷你条（长在每颗行星下面） */
  function weightsMini(w) {
    if (!w) return '';
    var h = '<span class="h-wb">';
    G5.forEach(function (g) {
      var v = (w[g] || 0) * 100;
      if (v < 0.5) return;
      h += '<i title="' + g + ' ' + v.toFixed(1) + '%" style="width:' + v.toFixed(1) + '%;background:' + G_COLOR[g] + '"></i>';
    });
    return h + '</span>';
  }

  /** 从 DEEP 里按行星名取权重 */
  function deepOf(name) {
    if (!DEEP || !Array.isArray(DEEP.planets)) return null;
    for (var i = 0; i < DEEP.planets.length; i++) if (DEEP.planets[i].planet === name) return DEEP.planets[i];
    return null;
  }

  /** 行星块：七政/四余标签 + 十神主组 + 5 组权重条 */
  function planetsHtml(d) {
    var ps = (d.planets || []).filter(function (p) { return p && p.primary; });
    var nat = (d.natal && d.natal.planets) || d.planets || [];
    if (!Array.isArray(nat)) nat = Object.keys(nat).map(function (k) { return Object.assign({ name: k }, nat[k]); });
    var h = '<div class="h-k">七政四余 · 行星 · 十神</div>';
    // ★ 有 /api/deep 数据时，十神力量直接长在盘上（不再是独立表）
    var deepList = (DEEP && Array.isArray(DEEP.planets)) ? DEEP.planets : null;
    if (deepList && deepList.length) {
      deepList.slice(0, 10).forEach(function (p) {
        var tag = QIZHENG[p.planet] || SIYU[p.planet] || '';
        var pr = p.primary || {};
        h += '<div class="h-pWithBar">' +
          '<div class="h-line"><b>' + esc(p.planet) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (p.house ? ' ' + p.house + '宫' : '') + '</span>' +
          ' <span class="h-tg" style="border-color:' + (G_COLOR[pr.group] || '#ffc457') + '">' +
          esc(pr.group || '—') + ' ' + Math.round((pr.w || 0) * 100) + '%</span></div>' +
          weightsMini(p.weights) + '</div>';
      });
    } else if (ps.length) {
      ps.slice(0, 9).forEach(function (p) {
        var tag = QIZHENG[p.planet] || SIYU[p.planet] || '';
        h += '<div class="h-line"><b>' + esc(p.planet) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (p.house ? ' ' + p.house + '宫' : '') + '</span> ' +
          '<span class="h-tg">' + esc(p.primary.group) + ' ' + Math.round((p.primary.w || 0) * 100) + '%</span></div>';
      });
    } else {
      nat.slice(0, 9).forEach(function (p) {
        var tag = QIZHENG[p.name] || SIYU[p.name] || '';
        var zhi = SIGN2ZHI[p.sign] || '';
        h += '<div class="h-line"><b>' + esc(p.name) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (zhi ? '·' + zhi : '') + (p.house ? ' ' + p.house + '宫' : '') + '</span></div>';
      });
    }
    return h;
  }

  function buildHud(d) {
    var x = extract(d);
    var parts = [];
    parts.push('<div class="fw-hud tl">' + pillarsHtml(x) + '</div>');
    parts.push('<div class="fw-hud tr">' + planetsHtml(d) + '</div>');
    parts.push('<div class="fw-hud bl">' + housesHtml(x) + '</div>');
    return parts.join('');
  }

  function ensureHost() {
    if (host) return host;
    host = document.querySelector('#fusion-wheel-host');
    if (!host) return null;
    if (!host.__fullInit) {
      host.__fullInit = true;
      var btn = document.createElement('button');
      btn.className = 'fw-close';
      btn.textContent = '✕';
      btn.title = '退出全屏（ESC）';
      btn.addEventListener('click', exit);
      host.appendChild(btn);
    }
    return host;
  }

  function clearHud(h) {
    Array.prototype.slice.call(h.querySelectorAll('.fw-hud')).forEach(function (n) { n.remove(); });
  }

  function enter(data) {
    var h = ensureHost();
    if (!h) return false;
    if (data) lastData = data;
    h.classList.add('fw-full');
    clearHud(h);
    if (lastData) h.insertAdjacentHTML('beforeend', buildHud(lastData));
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    document.documentElement.style.overflow = 'hidden';
    // ★ HUD 建好后通知外部（实验性排盘等外部块必须在每次重建后追加）
    setTimeout(function () { try { window.__afterHudBuilt && window.__afterHudBuilt(); } catch (e) {} }, 120);
    return true;
  }

  function exit() {
    var h = ensureHost();
    if (!h) return;
    h.classList.remove('fw-full');
    clearHud(h);
    document.documentElement.style.overflow = '';
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && host && host.classList.contains('fw-full')) exit();
  });

  window.__fwSetDeep = function (deep) {
    DEEP = deep || null;
    window.__fwDeep = DEEP;   // ★ 暴露给行星点击面板用
    if (host && host.classList.contains('fw-full') && lastData) {
      clearHud(host);
      host.insertAdjacentHTML('beforeend', buildHud(lastData));
      setTimeout(function () { try { window.__afterHudBuilt && window.__afterHudBuilt(); } catch (e) {} }, 80);
    }
  };
  window.__fwFullscreen = enter;
  window.__fwFullscreenExit = exit;
  window.__fwFullscreenUpdate = function (data) {
    lastData = data;
    if (host && host.classList.contains('fw-full')) {
      clearHud(host);
      host.insertAdjacentHTML('beforeend', buildHud(data));
    }
  };
})();
