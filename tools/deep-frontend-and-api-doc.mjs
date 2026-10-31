// 前端：融合排盘后自动拉取 /api/deep 并渲染深度层
import fs from 'node:fs';

fs.writeFileSync('web/deep-fetch.js', `// 融合排盘后自动拉 /api/deep
(function () {
  function payloadOf(form) {
    var g = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    return {
      at: g('at'), gender: g('gender'),
      lng: parseFloat(g('lng')), lat: parseFloat(g('lat')),
      tz: 8,
    };
  }

  function attach() {
    var form = document.querySelector('#f-fusion');
    if (!form || form.__deepBound) return;
    form.__deepBound = true;

    form.addEventListener('submit', function () {
      var body = payloadOf(form);
      var host = document.querySelector('#deep-host');
      if (host) host.innerHTML = '<div class="holo-card wide"><div class="holo-h">深度层 <span>计算中…</span></div></div>';

      // 延后一点，避开排盘请求高峰
      setTimeout(function () {
        fetch('/api/deep', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify(body),
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.ok && window.__renderDeep) window.__renderDeep(j.data);
            else if (host) host.innerHTML = '<div class="holo-card wide"><div class="holo-h">深度层</div><div class="holo-note">' +
              (j && j.error ? j.error : '接口无返回') + '</div></div>';
          })
          .catch(function (e) {
            if (host) host.innerHTML = '<div class="holo-card wide"><div class="holo-h">深度层</div><div class="holo-note">请求失败：' + e.message + '</div></div>';
          });
      }, 600);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
  // 导航切换后再试一次（页面可能是动态渲染的）
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-go="fusion"]')) setTimeout(attach, 120);
  }, true);
})();
`, 'utf8');
console.log('① deep-fetch.js 已写入');

let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('/deep-fetch.js')) {
  html = html.replace('<script type="module" src="/deep-panel.js"></script>',
    '<script src="/deep-fetch.js"></script>\n  <script type="module" src="/deep-panel.js"></script>');
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('② deep-fetch.js 已引入');
}

/* ══════════ 关于页：API 接入说明 + 主流 API 获取教程 ══════════ */
const API_SECTION = `
      <h2>怎么用 · 需要接 API 吗</h2>
      <div class="card" style="margin-bottom:16px">
        <div class="note" style="font-size:13px;line-height:2">
          <b style="color:#7dffb4">排盘本身不需要 API。</b>八字、星盘、融合盘、四钟时序、动态十神权重、神煞——
          全部在这台机器上用本地引擎算，<b>不联网、不上传</b>。<br>
          <b style="color:#ffd58a">只有「AI 解读」这一层需要 API</b>（把算出来的结构交给大模型组织成一段人话）。
          不接 API，前面的计算和图表全部照常可用，只是没有那段文字解读。
        </div>
      </div>

      <h2>主流 API 怎么拿（四个都行，挑一个）</h2>
      <div class="card" style="margin-bottom:16px">
        <table class="api-tb">
          <thead><tr><th>服务商</th><th>拿 Key 的最短路径</th><th>大致价格</th><th>适合</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">DeepSeek</td>
              <td>platform.deepseek.com → 注册登录 → 左侧「API keys」→ 创建 → 复制（<b>只显示一次</b>）→ 充值 10 元起</td>
              <td class="dg a">最便宜</td>
              <td class="mut2">首选，中文好用、价格低</td>
            </tr>
            <tr>
              <td class="pn">智谱 GLM</td>
              <td>open.bigmodel.cn → 注册 → 「API Keys」→ 新建 → 复制；新用户常有免费额度</td>
              <td class="dg a">低</td>
              <td class="mut2">有免费额度，适合试水</td>
            </tr>
            <tr>
              <td class="pn">阿里通义</td>
              <td>dashscope.aliyun.com → 登录阿里云 → 「API-KEY 管理」→ 创建</td>
              <td class="dg">中</td>
              <td class="mut2">已用阿里云的话方便</td>
            </tr>
            <tr>
              <td class="pn">OpenAI</td>
              <td>platform.openai.com → API keys → Create new secret key</td>
              <td class="dg b">较高</td>
              <td class="mut2">需要海外支付方式</td>
            </tr>
          </tbody>
        </table>
        <div class="note" style="margin-top:12px;font-size:12.5px;line-height:1.9">
          <b>四步通用流程</b>：① 注册并实名（国内平台一般要手机号）② 找到「API Key / 密钥」页面并新建
          ③ <b style="color:#ffb0a0">立刻复制保存</b>——Key 通常只明文显示一次 ④ 充值（多数平台 10 元起，按 token 计费）。
        </div>
      </div>

      <h2>Key 怎么用（安全提醒）</h2>
      <div class="card">
        <div class="note" style="font-size:13px;line-height:2">
          <b style="color:#ff8a8a">不要</b>把 Key 写进这个网页的代码里，也不要提交到 GitHub——
          一旦泄露会被别人跑光余额。<br>
          正确做法：把 Key 放在<b>本地环境变量</b>里，由你本地的服务端读取：
        </div>
        <pre class="api-code"># Windows PowerShell（当前窗口临时生效）
$env:DEEPSEEK_API_KEY = "sk-你的key"

# 永久写进当前用户环境变量（重开终端生效）
setx DEEPSEEK_API_KEY "sk-你的key"

# 然后启动服务端
node server.mjs 8788</pre>
        <div class="note" style="font-size:12.5px;line-height:1.9">
          Key 只存在你自己的电脑上。本站<b>不收集、不上传、不存储</b>任何 API Key——
          这也是首页隐私承诺里写明的那一条。
        </div>
      </div>
`;

/* 改样式：表格与代码块 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.api-tb')) {
  css += `

/* ══════════ 关于页 · API 教程 ══════════ */
.api-tb{width:100%;border-collapse:collapse;font-size:12.5px}
.api-tb th{text-align:left;font-weight:600;color:rgba(150,205,235,.62);font-size:11px;letter-spacing:.1em;
  padding:7px 9px;border-bottom:1px solid rgba(90,160,220,.2)}
.api-tb td{padding:9px;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top;line-height:1.75}
.api-tb td.pn{color:#eaf7ff;font-weight:700;white-space:nowrap}
.api-tb td.dg{font-weight:700;white-space:nowrap}
.api-tb td.dg.a{color:#7dffb4}
.api-tb td.dg.b{color:#ffb0a0}
.api-tb td.mut2{color:rgba(170,205,228,.75);font-size:12px}
.api-code{
  margin:10px 0 0;padding:13px 15px;border-radius:9px;overflow-x:auto;
  background:rgba(2,6,12,.85);border:1px solid rgba(90,160,220,.22);
  font-family:Consolas,"Cascadia Mono",monospace;font-size:11.5px;line-height:1.85;
  color:#9fe8ff;white-space:pre;
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ API 教程样式已加');
}

/* 插入到关于页（隐私卡之后） */
html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('怎么用 · 需要接 API 吗')) {
  // 找到关于页里的隐私卡结束后的位置
  const anchor = html.indexOf('data-page="about"');
  if (anchor < 0) { console.error('❌ 未找到关于页'); process.exit(1); }
  // 在该 section 的第一个 </div> 闭合后插（隐私卡之后）
  const afterPrivacy = html.indexOf('</div>', html.indexOf('privacy', anchor));
  // 更稳：插在关于页 h2「隐私」之后的第一个 </div> 之后
  const h2privacy = html.indexOf('隐私', anchor);
  const insertAt = html.indexOf('</div>', h2privacy);
  if (insertAt < 0) { console.error('❌ 未定位插入点'); process.exit(1); }
  html = html.slice(0, insertAt + 6) + '\n' + API_SECTION + html.slice(insertAt + 6);
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('④ API 教程已插入关于页');
} else console.log('④ 已在');
