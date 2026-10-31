// API 接入页：把 Key 存在本机 localStorage（不上传），支持服务商预设、清空、连通性探测
(function () {
  var KEY = 'xuanji-api-config';

  var PRESETS = {
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    aliyun: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    custom: { baseUrl: '', model: '' },
  };

  function form() { return document.getElementById('f-apikey'); }
  function out() { return document.getElementById('apikey-out'); }
  function setOut(msg, cls) {
    var o = out();
    if (!o) return;
    o.innerHTML = '<div class="card"><div class="note ' + (cls || '') + '" style="margin:0">' + msg + '</div></div>';
  }
  function fv(name) {
    var f = form();
    if (!f) return '';
    var e = f.querySelector('[name="' + name + '"]');
    return e ? String(e.value || '').trim() : '';
  }
  function setV(name, v) {
    var f = form();
    if (!f) return;
    var e = f.querySelector('[name="' + name + '"]');
    if (e) e.value = v || '';
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) return;
    var c = null;
    try { c = JSON.parse(raw); } catch (e) { return; }
    if (!c) return;
    setV('provider', c.provider || 'deepseek');
    setV('model', c.model || '');
    setV('baseUrl', c.baseUrl || '');
    setV('apiKey', c.apiKey || '');
    if (c.apiKey) {
      var mask = c.apiKey.slice(0, 6) + '••••' + c.apiKey.slice(-4);
      setOut('已从本机读取配置：<b>' + (c.provider || '') + '</b> · 模型 <b>' + (c.model || '(' + '默认' + ')') + '</b> · Key <b>' + mask + '</b>' +
        '<br><span class="mut2">修改后点「保存到本机」覆盖。</span>', 'ok');
    }
  }

  function applyPreset() {
    var p = fv('provider');
    var preset = PRESETS[p];
    if (!preset) return;
    if (!fv('baseUrl')) setV('baseUrl', preset.baseUrl);
    if (!fv('model')) setV('model', preset.model);
  }

  function save() {
    var p = fv('provider');
    var cfg = { provider: p, model: fv('model'), baseUrl: fv('baseUrl'), apiKey: fv('apiKey'), savedAt: new Date().toISOString() };
    if (!cfg.baseUrl && PRESETS[p]) cfg.baseUrl = PRESETS[p].baseUrl;
    if (!cfg.model && PRESETS[p]) cfg.model = PRESETS[p].model;
    if (!cfg.apiKey) { setOut('⚠ 请先填 API Key', 'bad'); return; }
    if (!/^[A-Za-z0-9_\-\.]{16,}$/.test(cfg.apiKey)) {
      setOut('⚠ Key 格式看起来不对（一般 20 位以上、只含字母数字和 - _ .）。已按原样保存，请自行确认。', 'bad');
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
      setOut('✅ 已保存到<b>本机浏览器</b>（localStorage），没有上传。' +
        '<br><span class="mut2">服务商 <b>' + cfg.provider + '</b> · 模型 <b>' + cfg.model + '</b></span>', 'ok');
    } catch (e) {
      setOut('⚠ 保存失败：' + e.message + '（浏览器可能禁用了 localStorage）', 'bad');
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    setV('model', ''); setV('baseUrl', ''); setV('apiKey', '');
    setOut('已清空本机保存的 Key 与配置。', 'ok');
  }

  function test() {
    var base = fv('baseUrl') || (PRESETS[fv('provider')] || {}).baseUrl;
    var key = fv('apiKey');
    if (!base) { setOut('⚠ 请先填 Base URL', 'bad'); return; }
    if (!key) { setOut('⚠ 请先填 API Key', 'bad'); return; }
    setOut('探测中…（浏览器直连可能被 CORS 拦截，拦截≠Key 无效）');
    var url = base.replace(/\/+$/, '') + '/models';
    fetch(url, { headers: { Authorization: 'Bearer ' + key } })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) { setOut('❌ Key 被拒绝（HTTP ' + r.status + '）——请检查 Key 是否有效/是否有余额', 'bad'); return; }
        if (!r.ok) { setOut('⚠ 服务端返回 HTTP ' + r.status + '（不代表 Key 无效，可能是该服务商不开放 /models）', 'bad'); return; }
        return r.json().then(function (j) {
          var n = (j && j.data && j.data.length) ? j.data.length : 0;
          setOut('✅ 连通正常' + (n ? '，可见模型 ' + n + ' 个' : '') + '。Key 有效。', 'ok');
        });
      })
      .catch(function (e) {
        setOut('⚠ 直连失败：' + e.message +
          '<br><span class="mut2">浏览器直连常被 CORS 拦住，这<b>不代表</b> Key 无效。真正的调用应由服务端发起（Key 不会经过网页）。</span>', 'bad');
      });
  }

  function boot() {
    var f = form();
    if (!f) return;
    load();
    var sel = f.querySelector('[name="provider"]');
    if (sel) sel.addEventListener('change', function () { setV('baseUrl', ''); setV('model', ''); applyPreset(); });
    f.addEventListener('submit', function (e) { e.preventDefault(); save(); });
    var c = document.getElementById('apikey-clear');
    if (c) c.addEventListener('click', clear);
    var t = document.getElementById('apikey-test');
    if (t) t.addEventListener('click', test);
    applyPreset();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
