// ① 把「关于」页移到第一位并设为默认落地页
// ② 「关于」里写死隐私承诺：只收集匿名出生信息，不收集 api/账号/联系方式
import fs from 'node:fs';

let html = fs.readFileSync('web/index.html', 'utf8');

/* ── ① 重写「关于」页（含醒目隐私承诺） ── */
const NEW_ABOUT = `    <!-- ① 关于（首页：这是什么 + 隐私承诺） -->
    <section class="page" data-page="about">
      <h2 class="page-title">关于 <span class="sub">它算什么 · 你的数据去哪了</span></h2>

      <div class="card prose privacy-card">
        <h3>🔒 隐私承诺（请先读这条）</h3>
        <p><strong>本站只收集：匿名出生信息。</strong>也就是——出生年月日时、出生地（城市/经纬度）、性别。这些是排盘必需的输入。</p>
        <p><strong>本站绝不收集、不请求、不存储：</strong></p>
        <ul class="no-list">
          <li>❌ 任何 API Key / 令牌 / 密码</li>
          <li>❌ 姓名、手机号、邮箱、微信、身份证</li>
          <li>❌ 账号登录信息（本站<strong>没有登录</strong>）</li>
          <li>❌ 浏览记录、设备指纹、第三方统计埋点</li>
        </ul>
        <p>排盘计算<strong>全部在你的浏览器与服务端本地完成</strong>，不会转发给任何第三方。<br>
        只有你在「反馈」页<strong>主动点提交</strong>时，才会把<strong>匿名命例</strong>存入数据库用于模型校准——同样不含姓名与任何联系方式。</p>
        <p class="privacy-note">你可以随时在浏览器里清空数据；我们没有账号体系，也就没有"注销"这件事——因为没有东西可注销。</p>
      </div>

      <div class="card prose">
        <h3>这是什么</h3>
        <p>把三样东西放在一起看：<strong>八字</strong>（出生年月日时排出的四柱）、<strong>星盘</strong>（出生那一刻天上的行星位置）、<strong>六壬</strong>（按占问时刻起的课）。三种方法各有一套说法，这里不打架，而是并排算给你看。</p>

        <h3>一句话</h3>
        <p>你把出生时间地点填进去，它用三种老办法各算一遍，把结果<strong>并排摊给你看</strong>。它不替你下结论——下结论的是你。</p>

        <h3>三种办法分别是什么（用白话说）</h3>
        <ul>
          <li><strong>八字</strong>：把出生年月日时各换成两个字，一共八个字（所以叫"八字"）。每个字下面还藏着"藏气"，是一层更细的看法。</li>
          <li><strong>星盘</strong>：算出你出生那一刻，太阳、月亮和其他几颗星各在天空的什么位置，画成一个圆盘。上面那些连线叫"相位"，表示两颗星之间的角度关系。</li>
          <li><strong>六壬</strong>：这不是算人的，是<strong>算事</strong>的——你心里有件想问的事，把它起念的那个时刻填进去，它按老规矩推演三步给你看（这三步叫"三传"）。</li>
        </ul>

        <h3>★ 最容易出错的地方：出生时间</h3>
        <p>你填的是<strong>手机/钟表上的时间</strong>。但老办法要用的是<strong>"当地太阳真正在头顶的时间"</strong>——这两者在中国能差<strong>一个多小时</strong>（因为全国统一用北京时间，可太阳并不是按北京的时间升落的）。本站会自动帮你换，换完如果时柱变了会红字提醒。</p>
        <p>还有两种情况，差<strong>几分钟</strong>结果就完全不同：</p>
        <ul>
          <li><strong>出生时间卡在两个时辰之间</strong>（比如 16:58 前后）——差 5 分钟，最后两个字就换成别的。</li>
          <li><strong>出生时间卡在两个星座交界</strong>——差 3 分钟，"上升星座"就换一个，所有跟上升有关的说法<strong>全部作废</strong>。</li>
        </ul>
        <p>所以：<strong>出生时间记不准的，请先去"矫正"页</strong>。提供几件有确切年月的人生大事，它就能反推出更可能的时间。</p>

        <h3>哪些可以信，哪些别信</h3>
        <p><strong>可以信的：算得准不准。</strong>八个字、藏气、行星度数、宫位、三传——都按固定规则算出来，换谁算都一样，错了也能复查。</p>
        <p><strong>不能全信的：算得灵不灵。</strong></p>
        <ul>
          <li>合盘那个分数衡量的是<strong>"两张盘的结构像不像、补不补"</strong>，不是"你俩能不能过一辈子"。它<strong>没有用真实情侣的结局校准过</strong>。</li>
          <li>两个人怎么相处、愿不愿意让步、遇事怎么选——<strong>这些东西盘里没有</strong>。</li>
          <li>八字讲"木火土金水"，星盘讲"火土风水"，<strong>是两套完全不同的说法</strong>，所以只并排给你看，不硬凑成一个数。</li>
        </ul>

        <h3>最后</h3>
        <p>它是一台<strong>把老规矩拆开给你看</strong>的机器，不是算命先生。它给的每个数字你都可以不信——但至少你能看见它是<strong>怎么算出来的</strong>。</p>
      </div>
    </section>`;

// 删掉旧的 about 页
const oldStart = html.indexOf('    <!-- ④ 关于 -->');
const oldEnd = html.indexOf('  </main>', oldStart);
if (oldStart > 0 && oldEnd > 0) {
  html = html.slice(0, oldStart) + html.slice(oldEnd);
  console.log('① 旧「关于」页已删除');
}

// 把新 about 插到 <main> 之后（第一位）
html = html.replace('<main id="main">', '<main id="main">\n' + NEW_ABOUT + '\n');
console.log('② 新「关于」已放到第一位');

fs.writeFileSync('web/index.html', html, 'utf8');

/* ── ③ 默认落地页改成 about ── */
let js = fs.readFileSync('web/app.js', 'utf8');
const pats = [
  [/data-page="fusion"\]\)\.classList\.add\('active'\)/, 'about 默认（未匹配 pattern A）'],
];
// 通用做法：找出设置 active 页的地方
if (!js.includes('DEFAULT_PAGE')) {
  js = js.replace(
    /(\/\*[^\n]*\n)?(\s*)(\/\/[^\n]*默认[^\n]*\n)?/,
    (m) => m,
  );
}
// 直接在文件末尾加一段：把 about 设为默认
js += `

/* ══════════ 默认落地页：关于（含隐私承诺） ══════════ */
(function defaultToAbout() {
  function go() {
    const pages = document.querySelectorAll('.page');
    if (!pages.length) return;
    pages.forEach((p) => p.classList.toggle('active', p.dataset.page === 'about'));
    document.querySelectorAll('.tabbar button').forEach((b) => {
      const on = b.dataset.go === 'about';
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(go, 0));
  else setTimeout(go, 0);
})();
`;
fs.writeFileSync('web/app.js', js, 'utf8');
console.log('③ 默认落地页已改为 about');

/* ── ④ 隐私卡片样式 ── */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.privacy-card')) {
  css += `

/* ══════════ 隐私承诺卡片 ══════════ */
.privacy-card{
  border:1px solid rgba(94,241,255,.32);
  background:linear-gradient(180deg,rgba(10,30,42,.92),rgba(8,18,28,.92));
  box-shadow:0 0 40px rgba(0,229,255,.10),inset 0 1px 0 rgba(94,241,255,.12);
}
.privacy-card h3{color:#5ef1ff !important;font-size:15px !important}
.privacy-card strong{color:#dff6ff}
.privacy-card .no-list{list-style:none;padding-left:2px}
.privacy-card .no-list li{color:#ff9d9d;font-size:13px;line-height:1.95}
.privacy-card .privacy-note{
  margin-top:10px;padding-top:10px;border-top:1px dashed rgba(94,241,255,.22);
  color:rgba(160,215,240,.75);font-size:12px
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('④ 隐私卡片样式已加');
}
