// 合盘：记录「你们之间发生过的事」，与两人出生时间一起作为训练样本上交
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
