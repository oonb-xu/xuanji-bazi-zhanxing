import fs from 'node:fs';

/* ══════ ① web/rectify-embed.js —— 生时矫正作为弹层，从融合/合盘打开 ══════ */
fs.writeFileSync('web/rectify-embed.js', `// 生时矫正改为「弹层」：从融合页 / 合盘页的入口打开，不再作为独立导航项
(function () {
  var SEL = '[data-page="rectify"]';
  function sec() { return document.querySelector(SEL); }

  function open() {
    var s = sec();
    if (!s) return;
    s.classList.add('rx-open');
    document.documentElement.style.overflow = 'hidden';
    if (!s.querySelector('.rx-close')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rx-close';
      b.setAttribute('aria-label', '关闭生时矫正');
      b.textContent = '×';
      b.addEventListener('click', close);
      s.appendChild(b);
    }
    try { s.scrollTop = 0; } catch (e) {}
    var f = s.querySelector('input,select,button');
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  function close() {
    var s = sec();
    if (!s) return;
    s.classList.remove('rx-open');
    document.documentElement.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-rx-open]')) { e.preventDefault(); open(); return; }
    if (t.closest('[data-rx-close]')) { e.preventDefault(); close(); return; }
    // 切到别的页面时自动关掉
    if (t.closest('.tabbar [data-go], .tabbar a')) close();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  window.__rxOpen = open;
  window.__rxClose = close;
})();
`, 'utf8');
console.log('✅ web/rectify-embed.js');

/* ══════ ② web/synastry-events.js —— 合盘事例采集 + 上交训练样本 ══════ */
fs.writeFileSync('web/synastry-events.js', `// 合盘：记录「你们之间发生过的事」，与两人出生时间一起作为训练样本上交
(function () {
  var TYPES = ['吵架', '分离', '复合', '异地', '升职', '生孩子', '结婚', '同居',
    '分手', '搬家', '重病', '丧亲', '买房', '失业', '其他'];

  function host() { return document.getElementById('syn-events'); }
  function outEl() { return document.getElementById('syn-sample-out'); }

  function row() {
    var d = document.createElement('div');
    d.className = 'rx-ev';

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', '事例类别');
    var o0 = document.createElement('option');
    o0.value = ''; o0.textContent = '类别…';
    sel.appendChild(o0);
    TYPES.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t; o.textContent = t;
      sel.appendChild(o);
    });

    var mon = document.createElement('input');
    mon.type = 'month';
    mon.setAttribute('aria-label', '大概哪个月');

    var note = document.createElement('input');
    note.type = 'text';
    note.placeholder = '补充一句（可选）';
    note.maxLength = 200;

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'rx-del';
    del.textContent = '×';
    del.setAttribute('aria-label', '删除这一行');
    del.addEventListener('click', function () { d.remove(); });

    d.append(sel, mon, note, del);
    return d;
  }

  function addRow() {
    var h = host();
    if (!h) return;
    h.appendChild(row());
  }

  function val(form, n) {
    var e = form.querySelector('[name="' + n + '"]');
    return e ? e.value : '';
  }

  function collect() {
    var form = document.getElementById('f-synastry');
    if (!form) throw new Error('找不到合盘表单');
    var h = host();
    var events = [];
    if (h) {
      h.querySelectorAll('.rx-ev').forEach(function (r) {
        var sel = r.querySelector('select');
        var mon = r.querySelector('input[type="month"]');
        var note = r.querySelector('input[type="text"]');
        if (!sel || !sel.value) return;
        events.push({ type: sel.value, date: mon ? mon.value : '', note: note ? note.value : '' });
      });
    }
    return {
      a: { at: val(form, 'a_at'), gender: val(form, 'a_gender'), lng: parseFloat(val(form, 'a_lng')), lat: parseFloat(val(form, 'a_lat')) },
      b: { at: val(form, 'b_at'), gender: val(form, 'b_gender'), lng: parseFloat(val(form, 'b_lng')), lat: parseFloat(val(form, 'b_lat')) },
      events: events,
      consent: true,
    };
  }

  function submit() {
    var o = outEl();
    try {
      var body = collect();
      if (!body.events.length) { if (o) o.textContent = '⚠ 至少填 1 条事例（选类别即可）'; return; }
      if (o) { o.textContent = '提交中…'; o.style.color = ''; }
      fetch('/api/synastry-sample', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) {
            if (o) { o.textContent = '✅ 已保存 ' + j.data.events + ' 条事例 · 累计 ' + j.data.total + ' 份样本'; o.style.color = '#7dffb4'; }
          } else if (o) {
            o.textContent = '⚠ ' + ((j && j.error) || '接口无返回');
            o.style.color = '#ff9a8a';
          }
        })
        .catch(function (e) {
          if (o) { o.textContent = '⚠ 请求失败：' + e.message; o.style.color = '#ff9a8a'; }
        });
    } catch (e) {
      if (o) { o.textContent = '⚠ ' + e.message; o.style.color = '#ff9a8a'; }
    }
  }

  function boot() {
    var add = document.getElementById('syn-add-ev');
    var sub = document.getElementById('syn-submit');
    if (add) add.addEventListener('click', addRow);
    if (sub) sub.addEventListener('click', submit);
    var h = host();
    if (h && !h.children.length) { addRow(); addRow(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
`, 'utf8');
console.log('✅ web/synastry-events.js');

/* ══════ ③ CSS：矫正弹层 + 触发条 ══════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* RX-EMBED */')) {
  css += `
/* RX-EMBED —— 生时矫正作为弹层（不再单列导航项） */
.rx-trigger{
  display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  margin:10px 0 12px; padding:10px 14px;
  border:1px dashed rgba(94,160,220,.28); border-radius:12px;
  background:rgba(12,24,38,.42);
}
.rx-open-btn{
  width:auto !important; margin:0 !important;
  padding:8px 16px !important; border-radius:999px !important;
  font-size:12.5px !important; font-weight:700 !important; letter-spacing:.06em;
  color:#04121c !important; cursor:pointer;
  background:linear-gradient(135deg,#8af7ff,#5ef1ff 60%,#48c8e8) !important;
  border:0 !important;
  box-shadow:0 8px 22px -10px rgba(94,241,255,.8);
  transition:transform .18s ease, filter .18s ease;
}
.rx-open-btn:hover{ transform:translateY(-1px); filter:brightness(1.06) }
.rx-open-btn:active{ transform:scale(.97) }

/* 矫正页 → 弹层 */
.page[data-page="rectify"].rx-open{
  display:block !important;
  position:fixed !important; inset:0 !important; z-index:9500 !important;
  overflow:auto !important;
  padding:54px 20px 40px !important;
  margin:0 !important;
  background:rgba(3,7,13,.94);
  -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
  animation:rx-fade .2s ease both;
}
@keyframes rx-fade{ from{opacity:0} to{opacity:1} }
.page[data-page="rectify"].rx-open > *{
  max-width:1000px; margin-left:auto; margin-right:auto;
}
.page[data-page="rectify"] .rx-close{
  position:fixed; top:18px; right:22px; z-index:2;
  width:auto !important; margin:0 !important;
  padding:8px 16px !important; font-size:16px !important; line-height:1;
  color:#cfe9ff !important; cursor:pointer;
  background:rgba(14,26,40,.9) !important;
  border:1px solid rgba(94,160,220,.35) !important; border-radius:999px !important;
}
.page[data-page="rectify"] .rx-close:hover{ border-color:rgba(94,241,255,.6) !important; color:#fff !important }
/* 事例行内输入宽度 */
#syn-events .rx-ev input[type="month"]{ max-width:140px }
#syn-events .rx-ev input[type="text"]{ flex:1 1 160px; min-width:120px }
#syn-events-card .note{ line-height:1.9 }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ style.css 追加 RX-EMBED，共', css.length, '字节');
} else console.log('CSS 已存在');
