// 把「时序」（大运/行运/次运 + 年份对齐）融入 融合盘 与 合盘 的结果里
(function () {
  function fv(form, n) { var e = form.querySelector('[name="' + n + '"]'); return e ? e.value : ''; }
  function num(v) { var x = parseFloat(v); return Number.isFinite(x) ? x : null; }

  function personOf(form, p) {
    var g = function (n) { return fv(form, p ? p + '_' + n : n); };
    return { at: g('at'), gender: g('gender'), lng: num(g('lng')), lat: num(g('lat')), tz: 8, label: p === 'b' ? '乙方' : (p === 'a' ? '甲方' : '本命') };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function uniqYears(arr) {
    var out = [];
    (arr || []).forEach(function (t) {
      var y = t && (t.year || t.at || t.from);
      if (y && out.indexOf(y) < 0) out.push(y);
    });
    return out;
  }

  function renderTl(D, who) {
    if (!D || !Array.isArray(D.rows)) return '';
    var rows = D.rows;
    var r0 = D.range || {};
    var tr = D.transitions || {};
    var al = D.alignment || {};

    /* 每 5 年抽样 + 首尾 */
    var picked = rows.filter(function (r, i) { return i === 0 || i === rows.length - 1 || (r.year % 5 === 0); });

    var tb = '<table class="holo-tb" style="margin-top:8px"><thead><tr><th>年</th><th>龄</th><th>流年</th><th>大运</th><th>次运月亮</th><th>木星宫</th><th>土星宫</th></tr></thead><tbody>';
    picked.forEach(function (r) {
      var b = r.bazi || {}, a = r.astro || {};
      var pr = a.progression || {};
      var mo = pr['月亮'] ? (pr['月亮'].sign + ' ' + pr['月亮'].deg + '°') : '—';
      var ju = (a.transit && a.transit['木星'] && a.transit['木星'].house) || '—';
      var sa = (a.transit && a.transit['土星'] && a.transit['土星'].house) || '—';
      tb += '<tr><td class="pn">' + r.year + '</td><td class="mut">' + r.age + '</td><td>' + esc(b.liunian || '—') + '</td>'
        + '<td class="mut">' + esc(b.dayun || '—') + '</td><td class="mut">' + esc(mo) + '</td>'
        + '<td class="mut">' + ju + '</td><td class="mut">' + sa + '</td></tr>';
    });
    tb += '</tbody></table>';

    var dy = uniqYears(tr.dayunChange);
    var ju2 = uniqYears(tr.transitJupiterHouse);
    var sa2 = uniqYears(tr.transitSaturnHouse);
    var pm = uniqYears(tr.progMoonSign);
    var ps = uniqYears(tr.progSunSign);

    var lines = [];
    if (dy.length) lines.push('<li><b>大运换运</b>：' + dy.slice(0, 10).join('、') + '</li>');
    if (ju2.length) lines.push('<li><b>木星换宫</b>：' + ju2.slice(0, 10).join('、') + '</li>');
    if (sa2.length) lines.push('<li><b>土星换宫</b>：' + sa2.slice(0, 10).join('、') + '</li>');
    if (pm.length) lines.push('<li><b>次运月亮换座</b>：' + pm.slice(0, 10).join('、') + '</li>');
    if (ps.length) lines.push('<li><b>次运太阳换座</b>：' + ps.slice(0, 10).join('、') + '</li>');

    return '<div class="card"><h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#5ef1ff">时序 · ' + esc(who) +
      ' <span class="mut2" style="font-weight:400;font-size:11.5px">' + (r0.from || '') + '–' + (r0.to || '') + '（' + (r0.count || rows.length) + ' 个年份）</span></h3>'
      + (lines.length ? '<ul style="margin:6px 0 0 18px;line-height:1.95;font-size:12.5px">' + lines.join('') + '</ul>' : '')
      + (al.cannotAlign ? '<div class="note" style="margin-top:8px;font-size:11.5px;color:#ff9a8a">不可对齐：' + esc(al.cannotAlign) + '</div>' : '')
      + tb
      + '<div class="note" style="margin-top:8px;font-size:11.5px">' + esc(D.clockNote || '') + '</div></div>';
  }

  function fetchTl(p) {
    return fetch('/api/timeline', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ at: p.at, gender: p.gender, lng: p.lng, lat: p.lat, tz: 8 }),
    }).then(function (r) { return r.json(); });
  }

  function ensureSlot(hostId, id) {
    var host = document.getElementById(hostId);
    if (!host) return null;
    var el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; host.appendChild(el); }
    return el;
  }

  /* ── 融合盘：本命时序 ── */
  function onFusion(e) {
    var form = document.getElementById('f-fusion');
    if (!form) return;
    var p = personOf(form, null);
    if (!p.at) return;
    var slot = ensureSlot('fusion-out', 'fuse-timeline');
    if (!slot) return;
    slot.innerHTML = '<div class="card"><div class="note">时序计算中…</div></div>';
    fetchTl(p).then(function (j) {
      if (!j || !j.ok) { slot.innerHTML = '<div class="card"><div class="note" style="color:#ff9a8a">时序失败：' + esc((j && j.error) || '接口无返回') + '</div></div>'; return; }
      slot.innerHTML = renderTl(j.data, '本命');
    }).catch(function (err) {
      slot.innerHTML = '<div class="card"><div class="note" style="color:#ff9a8a">时序请求失败：' + esc(err.message) + '</div></div>';
    });
  }

  /* ── 合盘：双方时序 + 年份对齐 ── */
  function onSynastry() {
    var form = document.getElementById('f-synastry');
    if (!form) return;
    var A = personOf(form, 'a'), B = personOf(form, 'b');
    if (!A.at || !B.at) return;
    var slot = ensureSlot('synastry-out', 'syn-timeline');
    if (!slot) return;
    slot.innerHTML = '<div class="card"><div class="note">双方时序计算中…</div></div>';
    Promise.all([fetchTl(A), fetchTl(B)]).then(function (res) {
      var ja = res[0], jb = res[1];
      var html = '';
      if (ja && ja.ok) html += renderTl(ja.data, '甲方');
      else html += '<div class="card"><div class="note" style="color:#ff9a8a">甲方时序失败：' + esc((ja && ja.error) || '') + '</div></div>';
      if (jb && jb.ok) html += renderTl(jb.data, '乙方');
      else html += '<div class="card"><div class="note" style="color:#ff9a8a">乙方时序失败：' + esc((jb && jb.error) || '') + '</div></div>';
      /* 对齐结论 */
      var al = (ja && ja.ok && ja.data.alignment) || null;
      if (al) {
        html += '<div class="card"><h3 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#ffd58a">时间轴对齐 <span class="mut2" style="font-weight:400;font-size:11.5px">两边能不能按年份比较</span></h3>'
          + '<div class="note" style="font-size:12px">'
          + (al.canAlign ? '<b style="color:#7dffb4">能对齐</b>：' + esc(al.canAlign) + '<br>' : '')
          + (al.cannotAlign ? '<b style="color:#ff9a8a">不能对齐</b>：' + esc(al.cannotAlign) : '')
          + '</div></div>';
      }
      slot.innerHTML = html;
    }).catch(function (err) {
      slot.innerHTML = '<div class="card"><div class="note" style="color:#ff9a8a">时序请求失败：' + esc(err.message) + '</div></div>';
    });
  }

  /* 用捕获阶段挂在 submit 之后（app.js 的渲染是异步的，稍等再补） */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.id) return;
    if (f.id === 'f-fusion') setTimeout(onFusion, 1200);
    if (f.id === 'f-synastry') setTimeout(onSynastry, 1400);
  }, true);
})();
