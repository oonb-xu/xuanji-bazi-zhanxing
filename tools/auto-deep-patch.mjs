// 修：/api/deep 只在表单 submit 时拉 ⇒ 正常进入融合页点行星看不到十神比例
// 改为：融合页激活/行星面板需要时，若无 __fwDeep 就按当前表单值自动拉一次
import fs from 'node:fs';
const P = 'web/deep-fetch.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak', t, 'utf8');

if (t.includes('AUTO-DEEP-PATCH')) { console.log('已打过补丁'); process.exit(0); }

const patch = `

/* AUTO-DEEP-PATCH —— 融合页一激活就自动拉深度数据（不必手动提交表单）
   目的：直接点行星即可看到十神比例 */
(function () {
  var inflight = false;

  function currentBody() {
    var form = document.querySelector('#f-fusion');
    if (!form) return null;
    var g = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    var body = {
      at: g('at'), gender: g('gender'),
      lng: parseFloat(g('lng')), lat: parseFloat(g('lat')),
      tz: 8,
    };
    if (!body.at) return null;
    return body;
  }

  function runDeep(force) {
    if (inflight) return;
    if (!force && window.__fwDeep) return;      // 已有数据就不重复请求
    var body = currentBody();
    if (!body) return;
    inflight = true;
    fetch('/api/deep', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          try { window.__renderDeep && window.__renderDeep(j.data); } catch (e) {}
          try { window.__fwSetDeep && window.__fwSetDeep(j.data); } catch (e) {}
          try { window.dispatchEvent(new CustomEvent('xuanji:deep', { detail: j.data })); } catch (e) {}
        }
      })
      .catch(function () {})
      .then(function () { inflight = false; });
  }

  /* ① 切到融合页时自动拉 */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-go="fusion"], a[href="#fusion"]');
    if (b) { setTimeout(runDeep, 900); }
  }, true);

  /* ② 进站即已在融合页，或表单值就绪后 */
  function boot() {
    if ((location.hash || '').indexOf('fusion') >= 0) setTimeout(runDeep, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  /* ③ 兜底：行星面板打开时若仍无数据，补拉一次（供下次点击生效） */
  document.addEventListener('pointerdown', function (e) {
    var host = document.querySelector('#fusion-wheel-host');
    if (host && host.contains(e.target) && !window.__fwDeep) setTimeout(function () { runDeep(true); }, 400);
  }, true);

  window.__fwEnsureDeep = runDeep;
})();
`;

fs.writeFileSync(P, t + patch, 'utf8');
console.log('✅ 已追加 AUTO-DEEP-PATCH，deep-fetch.js', (t + patch).length, '字节');

/* 语法检查 */
