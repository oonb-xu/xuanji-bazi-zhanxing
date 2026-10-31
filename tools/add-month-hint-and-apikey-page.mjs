// ① 矫正表单加「月份误差提示」元素 + .rx-month 样式
// ② 新增「API 接入」页（导航项 + 表单 + 本地保存）
import fs from 'node:fs';

/* ══════ ① index.html：月份提示 ══════ */
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak12', h, 'utf8');

if (!h.includes('id="rx-month-hint"')) {
  const anchor = '<div id="rx-events" class="rx-events"></div>';
  if (!h.includes(anchor)) { console.error('❌ 找不到 #rx-events'); process.exit(1); }
  const hint = anchor + `
        <div id="rx-month-hint" class="mut2" style="font-size:11.5px;margin-top:8px;line-height:1.7;color:#ffc457">
          月份是<b>可选</b>的：不填则时间误差按 <b>±6 个月</b> 计，矫正结果区间会更宽；填到月份可收窄到 <b>±1 个月</b>。
        </div>`;
  h = h.replace(anchor, hint);
  console.log('✅ 已加月份误差提示');
} else console.log('— 提示已存在');

/* ══════ ② 导航加「API」项 ══════ */
if (!h.includes('data-go="apikey"')) {
  const navAnchor = '<button data-go="contribute"><span>✎</span>反馈</button>';
  if (!h.includes(navAnchor)) { console.error('❌ 找不到反馈按钮'); process.exit(1); }
  h = h.replace(navAnchor, '<button data-go="apikey"><span>🔑</span>API</button>\n    ' + navAnchor);
  console.log('✅ 导航已加「API」项');
} else console.log('— API 导航已存在');

/* ══════ ③ 新增 API 页 section（放在 rectify section 之前） ══════ */
const API_SECTION = `
    <section class="page" data-page="apikey">
      <h2 class="page-title">API 接入 <span class="sub">填一次，边界情形就能交给模型复核</span></h2>

      <form class="card form" id="f-apikey">
        <div class="grid2">
          <label>服务商
            <select name="provider">
              <option value="deepseek">DeepSeek（深度求索）</option>
              <option value="openai">OpenAI</option>
              <option value="moonshot">Moonshot（月之暗面）</option>
              <option value="zhipu">智谱 GLM</option>
              <option value="aliyun">阿里云百炼</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <label>模型名 <input type="text" name="model" placeholder="deepseek-chat"></label>
          <label>Base URL（可留空，按服务商自动填）
            <input type="text" name="baseUrl" placeholder="https://api.deepseek.com/v1">
          </label>
          <label>API Key <input type="password" name="apiKey" placeholder="sk-…" autocomplete="off"></label>
        </div>

        <div class="note" style="margin-top:10px">
          <b style="color:#7dffb4">Key 只存在你这台机器的浏览器里</b>（localStorage），
          <b>不会上传</b>到本站服务端，也不会写进任何样本文件。点「清空」即刻删除。
          <br>充值付给你选的那家公司，不是本项目开发者——本站没有收款通道。
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
          <button type="submit">保存到本机</button>
          <button type="button" id="apikey-clear" class="rx-add">清空</button>
          <button type="button" id="apikey-test" class="rx-add">测连通性</button>
        </div>
      </form>

      <div id="apikey-out"></div>
    </section>
`;

if (!h.includes('data-page="apikey"')) {
  const before = h.indexOf('<section class="page" data-page="rectify">');
  if (before < 0) { console.error('❌ 找不到 rectify section 作为插入锚点'); process.exit(1); }
  h = h.slice(0, before) + API_SECTION.trimStart() + '\n\n    ' + h.slice(before);
  console.log('✅ 已新增 API 页 section');
} else console.log('— API section 已存在');

/* ══════ ④ 引入 apikey.js ══════ */
if (!h.includes('/apikey.js')) {
  const bodyEnd = h.lastIndexOf('</body>');
  h = h.slice(0, bodyEnd) + '  <script src="/apikey.js"></script>\n' + h.slice(bodyEnd);
  console.log('✅ 已引入 apikey.js');
}

fs.writeFileSync(P, h, 'utf8');
console.log('index.html 大小', h.length);

/* ══════ ⑤ CSS ══════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* RX-MONTH + APIKEY */')) {
  css += `
/* RX-MONTH + APIKEY */
#rx-events .rx-ev input.rx-month{
  max-width:150px; flex:0 0 auto;
}
#f-apikey .grid2{ gap:10px }
#f-apikey input,#f-apikey select{ width:100% }
#apikey-out .ok{ color:#7dffb4 }
#apikey-out .bad{ color:#ff9a8a }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ style.css 已追加 RX-MONTH + APIKEY');
}

/* ══════ ⑥ 校验 ══════ */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['form', /<form\b/g, /<\/form>/g], ['button', /<button\b/g, /<\/button>/g],
  ['label', /<label\b/g, /<\/label>/g], ['select', /<select\b/g, /<\/select>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['b', /<b\b/g, /<\/b>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(8)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}
for (const [n, ok] of [
  ['月份提示已加', h.includes('id="rx-month-hint"')],
  ['API 导航已加', h.includes('data-go="apikey"')],
  ['API section 已加', h.includes('id="f-apikey"')],
  ['apikey.js 已引用', h.includes('/apikey.js')],
  ['导航共 9 项', c(h, /data-go="/g) === 8 && h.includes('data-go="apikey"')],
]) { if (!ok) bad++; console.log(`  ${ok ? '✅' : '❌'} ${n}`); }

if (bad) { console.error('\n❌ 校验未过'); process.exit(1); }
console.log('\n✅ 全部通过');
