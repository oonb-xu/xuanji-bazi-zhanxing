// 非侵入：给双环图所有文字加「可点击 + 详情面板」
// 详情来源 = 查表数据 glossary-data.json（175 条） + 内置天文/干支小词典
(function () {
  var GLOSS = null, GLOSS_BY = {};
  var ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  var ZHI_INFO = {
    子:{plain:'冬月，水，正北，寒冷之极将过',note:'节气：大雪→小寒（黄经 255°–285°）'},
    丑:{plain:'隆冬，湿土，冷极在此',note:'节气：小寒→立春（285°–315°）· 物候最冷'},
    寅:{plain:'初春，木，东北，回暖起点',note:'节气：立春→惊蛰（315°–345°）· 年柱换柱点'},
    卯:{plain:'仲春，木，正东',note:'节气：惊蛰→清明（345°–15°）'},
    辰:{plain:'季春，湿土，水库',note:'节气：清明→立夏（15°–45°）'},
    巳:{plain:'初夏，火，东南',note:'节气：立夏→芒种（45°–75°）· 名义夏而实际仍偏春'},
    午:{plain:'仲夏，火，正南',note:'节气：芒种→小暑（75°–105°）'},
    未:{plain:'季夏，燥土，木库',note:'节气：小暑→立秋（105°–135°）· 物候最热在此'},
    申:{plain:'初秋，金，西南',note:'节气：立秋→白露（135°–165°）'},
    酉:{plain:'仲秋，金，正西',note:'节气：白露→寒露（165°–195°）'},
    戌:{plain:'季秋，燥土，火库',note:'节气：寒露→立冬（195°–225°）'},
    亥:{plain:'初冬，水，西北',note:'节气：立冬→大雪（225°–255°）'}
  };
  var CG_INFO = {
    '癸':'阴水 · 雨露','己癸辛':'己(本) 癸(中) 辛(余) · 湿土藏水与金','甲丙戊':'甲(本) 丙(中) 戊(余) · 木藏火与土',
    '乙':'阴木 · 花草','戊乙癸':'戊(本) 乙(中) 癸(余) · 湿土藏木与水','丙戊庚':'丙(本) 戊(中) 庚(余) · 火藏土与金',
    '丁己':'丁(本) 己(余) · 火藏土','己丁乙':'己(本) 丁(中) 乙(余) · 燥土藏火与木','庚壬戊':'庚(本) 壬(中) 戊(余) · 金藏水与土',
    '辛':'阴金 · 珠玉','戊辛丁':'戊(本) 辛(中) 丁(余) · 燥土藏金与火','壬甲':'壬(本) 甲(余) · 水藏木'
  };
  var PALACE = ['自我/身体','资源/价值','沟通/近亲','家庭/根基','创造/子女','工作/健康','关系/合作','共享/危机','远行/信念','事业/名声','群体/愿景','隐退/内在'];
  var ZW_INFO = { 命宫:'自我核心，命之所在', 兄弟:'手足与同辈', 夫妻:'伴侣与一对一关系', 子女:'创造与晚辈', 财帛:'金钱与价值感', 疾厄:'健康与身体', 迁移:'对外与环境', 仆役:'朋友与下属', 官禄:'事业与志向', 田宅:'家宅与不动产', 福德:'精神与享受', 父母:'长辈与权威' };
  var PL_INFO = { 日:'太阳 · 自我与意志', 月:'月亮 · 情绪与安全感', 水:'水星 · 思维与表达', 金:'金星 · 情感与美感', 火:'火星 · 行动与冲突', 木:'木星 · 扩张与信念', 土:'土星 · 限制与结构', 天:'天王星 · 突变与自由', 海:'海王星 · 消融与想象', 冥:'冥王星 · 深渊与重生', 北:'罗睺 · 北交点，放大与执着', 南:'计都 · 南交点，放下与业力' };

  function loadGloss(cb) {
    if (GLOSS) return cb();
    fetch('/glossary-data.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        GLOSS = j;
        (j.entries || []).forEach(function (e) { if (e.term && !GLOSS_BY[e.term]) GLOSS_BY[e.term] = e; });
        cb();
      })
      .catch(function () { GLOSS = { entries: [] }; cb(); });
  }

  function classify(t) {
    if (/^[子丑寅卯辰巳午未申酉戌亥]$/.test(t)) return { k: 'zhi', v: t, label: '地支 ' + t };
    if (/^(ASC|MC)\b/.test(t)) return { k: 'angle', v: t.slice(0, 3), label: t };
    if (/^[日月水金火木土天海冥北南]$/.test(t)) return { k: 'planet', v: t, label: '行星/交点 ' + t };
    if (ZW_INFO[t]) return { k: 'zw', v: t, label: '紫微 ' + t };
    if (/^\d{1,2}$/.test(t)) return { k: 'house', v: t, label: '第 ' + t + ' 宫' };
    var cg = CG_INFO[t] || (t.length <= 3 && /^[甲乙丙丁戊己庚辛壬癸]+$/.test(t) ? t : null);
    if (cg && t.length >= 1 && /^[甲乙丙丁戊己庚辛壬癸]+$/.test(t)) return { k: 'canggan', v: t, label: '藏干 ' + t };
    if (PALACE.indexOf(t) >= 0) return { k: 'palace', v: t, label: '宫位领域 ' + t };
    if (GLOSS_BY[t]) return { k: 'gloss', v: t, label: t };
    return null;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

  function detailHTML(info) {
    var rows = [];
    var e = GLOSS_BY[info.v];
    if (info.k === 'zhi') { var z = ZHI_INFO[info.v]; rows.push(['含义', z.plain], ['天文', z.note]); }
    if (info.k === 'canggan') rows.push(['藏干', CG_INFO[info.v] || '（本气/中气/余气）']);
    if (info.k === 'planet') rows.push(['说明', PL_INFO[info.v] || '']);
    if (info.k === 'zw') rows.push(['宫义', ZW_INFO[info.v] || '']);
    if (info.k === 'house') rows.push(['领域', PALACE[Number(info.v) - 1] || '']);
    if (info.k === 'angle') rows.push(['说明', info.v === 'ASC' ? '上升点：内外环的旋转基准，宫 1 的起点' : '天顶：黄道与当地子午线的交点']);
    if (e) {
      rows.push(['体系', e.system || '']);
      if (e.plain) rows.push(['白话', e.plain]);
      if (e.note) rows.push(['备注', e.note]);
    }
    if (!rows.length) return '<div class="note">这个词暂时没有收录解释。</div>';
    var tr = rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<tr><td class="pn" style="width:70px">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
    }).join('');
    return '<table class="holo-tb"><tbody>' + tr + '</tbody></table>';
  }

  function show(info) {
    var box = document.getElementById('dw-detail');
    if (!box) return;
    box.innerHTML = '<div class="dw-dt-h">' + esc(info.label) + '</div>' + detailHTML(info);
    box.classList.add('on');
  }

  var BOUND = false;
  function bind() {
    var host = document.getElementById('dual-wheel-host');
    var svg = host && host.querySelector('svg');
    if (!svg || BOUND) return;
    BOUND = true;
    [].forEach.call(svg.querySelectorAll('text'), function (t) {
      var info = classify((t.textContent || '').trim());
      if (!info) return;
      t.classList.add('dw-click');
      t.setAttribute('data-dw', info.k + '|' + info.v);
      t.style.cursor = 'pointer';
    });
    svg.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || t.tagName !== 'text') return;
      var a = t.getAttribute('data-dw');
      if (!a) return;
      var p = a.split('|');
      var info = { k: p[0], v: p.slice(1).join('|'), label: (t.textContent || '').trim() };
      if (info.k === 'zhi') info.label = '地支 ' + info.v;
      if (info.k === 'planet') info.label = '行星/交点 ' + info.v;
      if (info.k === 'house') info.label = '第 ' + info.v + ' 宫';
      if (info.k === 'zw') info.label = '紫微 ' + info.v;
      if (info.k === 'canggan') info.label = '藏干 ' + info.v;
      loadGloss(function () { show(info); });
    });
  }

  function boot() {
    loadGloss(function () {});
    bind();
    var host = document.getElementById('dual-wheel-host');
    if (host && !host.__dwObs) {
      host.__dwObs = new MutationObserver(function () { BOUND = false; bind(); });
      host.__dwObs.observe(host, { childList: true, subtree: true });
    }
  }
  /* 供融合盘外环层复用同一详情面板 */
  document.addEventListener('dw-show', function (e) {
    if (!e || !e.detail) return;
    loadGloss(function () { show(e.detail); });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
