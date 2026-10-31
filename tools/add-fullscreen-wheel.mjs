// 【任务⑥】全屏融合盘 + 真实宇宙幕布（不喧宾夺主）
// 设计要点：
//   · **不移动 DOM** —— 移动会让 fusion3d 的 cv/_hostEl 引用错位。
//     改用给 .fw-card 加 .fw-full 类，让卡片自身 fixed 全屏；ResizeObserver 会自动触发 fit()
//   · 宇宙幕布用 CSS 多层径向渐变 + 极淡星点，**总不透明度很低**，压在所有内容之下
//   · HUD 面板为卡片的绝对定位子元素，全部 pointer-events 可控
import fs from 'node:fs';

/* ══════════ ① CSS ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.fw-card.fw-full')) {
  css += `

/* ══════════ 全屏融合盘 ══════════ */
.fw-card.fw-full{
  position:fixed; inset:0; width:100vw; height:100vh; margin:0;
  border-radius:0; border:none; z-index:900;
  background:#03060b;
  overflow:hidden;
}
/* ★ 真实宇宙幕布：多层极淡星云 + 细密星点，压在最底层，不抢主体 */
.fw-card.fw-full::before{
  content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(1200px 700px at 18% 12%, rgba(56,92,180,.16), transparent 62%),
    radial-gradient(1000px 620px at 82% 78%, rgba(150,70,150,.10), transparent 66%),
    radial-gradient(900px 540px at 55% 42%, rgba(30,120,150,.09), transparent 70%),
    radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,.55), transparent),
    radial-gradient(1px 1px at 28% 64%, rgba(255,255,255,.42), transparent),
    radial-gradient(1px 1px at 41% 18%, rgba(255,255,255,.50), transparent),
    radial-gradient(1px 1px at 57% 73%, rgba(255,255,255,.38), transparent),
    radial-gradient(1px 1px at 68% 31%, rgba(255,255,255,.46), transparent),
    radial-gradient(1px 1px at 79% 58%, rgba(255,255,255,.40), transparent),
    radial-gradient(1px 1px at 88% 24%, rgba(255,255,255,.52), transparent),
    radial-gradient(1px 1px at 93% 81%, rgba(255,255,255,.34), transparent),
    radial-gradient(1.4px 1.4px at 7% 84%, rgba(200,225,255,.45), transparent),
    radial-gradient(1.4px 1.4px at 33% 41%, rgba(200,225,255,.38), transparent),
    radial-gradient(1.4px 1.4px at 64% 88%, rgba(200,225,255,.42), transparent),
    linear-gradient(180deg,#050a12 0%,#03060b 55%,#020408 100%);
  opacity:.95;
}
/* 幕布之上再压一层暗角，让中心更亮 */
.fw-card.fw-full::after{
  content:''; position:absolute; inset:0; z-index:1; pointer-events:none;
  background:radial-gradient(closest-side at 50% 52%, transparent 40%, rgba(0,0,0,.55) 100%);
}
.fw-card.fw-full canvas{ z-index:2 }
.fw-card.fw-full canvas.gl{ z-index:3 }

/* HUD 面板 */
.fw-hud{ position:absolute; z-index:6; pointer-events:none; color:#dfeaf5;
  font:12px/1.7 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif; }
.fw-hud.tl{ top:22px; left:26px; max-width:300px }
.fw-hud.tr{ top:22px; right:26px; max-width:300px; text-align:right }
.fw-hud.bl{ bottom:22px; left:26px; max-width:420px }
.fw-hud .h-k{ font-size:10.5px; letter-spacing:.14em; color:rgba(140,190,225,.55); margin-bottom:5px }
.fw-hud .h-v{ font-size:15px; color:#eaf7ff; font-weight:700; letter-spacing:.02em }
.fw-hud .h-line{ margin:3px 0; color:rgba(195,220,240,.9) }
.fw-hud .h-dim{ color:rgba(140,180,210,.62); font-size:11px }
.fw-hud .h-tg{ display:inline-block; padding:0 7px; margin:2px 3px 2px 0; border-radius:999px;
  font-size:10.5px; background:rgba(255,196,87,.13); border:1px solid rgba(255,196,87,.34); color:#ffc457 }
.fw-hud .h-axis{ margin:4px 0 }
.fw-hud .h-bar{ display:inline-block; width:74px; height:4px; border-radius:2px;
  background:rgba(255,255,255,.1); vertical-align:middle; overflow:hidden }
.fw-hud .h-bar i{ display:block; height:100% }
.fw-hud .h-bar.psy i{ background:linear-gradient(90deg,#5ef1ff,#7dffb4) }
.fw-hud .h-bar.mat i{ background:linear-gradient(90deg,#ffc457,#ff9a5a) }

/* 关闭按钮 */
.fw-close{ position:absolute; z-index:8; top:20px; right:20px; width:34px; height:34px;
  border-radius:50%; border:1px solid rgba(120,180,220,.3); background:rgba(6,14,24,.8);
  color:#9fd8f5; font-size:17px; line-height:1; cursor:pointer; pointer-events:auto;
  display:none; align-items:center; justify-content:center; }
.fw-card.fw-full .fw-close{ display:flex }
.fw-close:hover{ background:rgba(94,241,255,.16); border-color:rgba(94,241,255,.5); color:#5ef1ff }

/* 全屏时隐藏卡片标题与提示，避免干扰 */
.fw-card.fw-full .fw-title, .fw-card.fw-full .fw-tip{ display:none }
.fw-card.fw-full .fw-hud.tr{ right:74px }   /* 让开关闭按钮 */

@media(max-width:760px){
  .fw-hud.tl{ top:16px; left:14px; max-width:200px; font-size:11px }
  .fw-hud.tr{ display:none }
  .fw-hud.bl{ bottom:14px; left:14px; right:14px; max-width:none; font-size:11px }
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('① 全屏与 HUD 样式已加');
} else console.log('① 样式已有');

/* ══════════ ② JS ══════════ */
fs.writeFileSync('web/fw-fullscreen.js', `// 全屏融合盘：排盘后自动进入，ESC 或点按钮退出
// 数据融合进 HUD 面板；不移动 DOM（只切 CSS 类）
(function () {
  var host = null;
  var lastData = null;

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]); }); }

  function tgChips(list) {
    if (!list || !list.length) return '<span class="h-dim">—</span>';
    return list.slice(0, 6).map(function (x) { return '<span class="h-tg">' + esc(x) + '</span>'; }).join('');
  }

  function buildHud(d) {
    var parts = [];
    var b = d.bazi || d || {};
    var pillars = b.pillars || [];
    var dm = b.dayMaster || (d.bazi && d.bazi.dayMaster) || '';
    var verdict = (b.strength && b.strength.verdict) || '';

    /* 左上：四柱 + 日主 */
    var h1 = '<div class="h-k">四柱 · 日主</div>';
    h1 += '<div class="h-v">' + (pillars.length ? pillars.map(esc).join(' ') : '—') + '</div>';
    if (dm) h1 += '<div class="h-line">日主 <b style="color:#ffc457">' + esc(dm) + '</b>' + (verdict ? ' · ' + esc(verdict) : '') + '</div>';
    if (b.taiYuan || b.mingGong || b.shenGong) {
      h1 += '<div class="h-dim" style="margin-top:3px">胎元 ' + esc(b.taiYuan || '—') + ' · 命宫 ' + esc(b.mingGong || '—') + ' · 身宫 ' + esc(b.shenGong || '—') + '</div>';
    }
    parts.push('<div class="fw-hud tl">' + h1 + '</div>');

    /* 右上：行星十神（若来自 /api/deep 有动态权重则用它） */
    var ps = (d.planets || []).filter(function (p) { return p && p.primary; });
    var h2 = '<div class="h-k">行星 · 十神主组</div>';
    if (ps.length) {
      ps.slice(0, 8).forEach(function (p) {
        h2 += '<div class="h-line"><b>' + esc(p.planet) + '</b> '
          + '<span class="h-dim">' + esc(p.sign || '') + (p.house ? ' 第' + p.house + '宫' : '') + '</span> '
          + '<span class="h-tg">' + esc(p.primary.group) + ' ' + Math.round((p.primary.w || 0) * 100) + '%</span></div>';
      });
    } else {
      var nat = (d.natal && d.natal.planets) || d.planets || [];
      if (!Array.isArray(nat)) nat = Object.values(nat);
      nat.slice(0, 8).forEach(function (p) {
        h2 += '<div class="h-line">' + esc(p.name || '') + ' <span class="h-dim">' + esc(p.sign || '') + '</span></div>';
      });
    }
    parts.push('<div class="fw-hud tr">' + h2 + '</div>');

    /* 左下：双轴 + 神煞 + 四化 */
    var h3 = '';
    if (d.axes || d.quadrant) {
      var ax = d.axes || {};
      var q = d.quadrant || {};
      h3 += '<div class="h-k">双轴（心理 / 物质）</div>';
      if (ax.psych) h3 += '<div class="h-axis">心理 <span class="h-bar psy"><i style="width:' + Math.min(100, Math.round((ax.psych.value || 1) / 1.6 * 100)) + '%"></i></span> ' + esc(ax.psych.level) + '</div>';
      if (ax.material) h3 += '<div class="h-axis">物质 <span class="h-bar mat"><i style="width:' + Math.min(100, Math.round((ax.material.value || 1) / 1.4 * 100)) + '%"></i></span> ' + esc(ax.material.level) + '</div>';
      if (q.reading) h3 += '<div class="h-line" style="margin-top:4px">' + esc(q.reading) + '</div>';
    }
    var ss = d.shensha || [];
    if (ss.length) {
      h3 += '<div class="h-k" style="margin-top:9px">神煞 · 心理印证</div>';
      ss.slice(0, 4).forEach(function (r) {
        h3 += '<div class="h-line">' + esc(r.name) + ' <span class="h-dim">' + esc(r.axis || '') + ' · 收敛 ' + Math.round((r.converge || 0) * 100) + '%</span></div>';
      });
    }
    if (h3) parts.push('<div class="fw-hud bl">' + h3 + '</div>');

    return parts.join('');
  }

  function ensureHost() {
    if (host) return host;
    host = document.querySelector('#fusion-wheel-host');
    if (!host) return null;
    if (!host.__fullInit) {
      host.__fullInit = true;
      var btn = el('button', 'fw-close', '✕');
      btn.title = '退出全屏（ESC）';
      btn.addEventListener('click', exit);
      host.appendChild(btn);
    }
    return host;
  }

  function enter(data) {
    var h = ensureHost();
    if (!h) return false;
    if (data) lastData = data;
    h.classList.add('fw-full');
    // 先清掉旧 HUD，再按数据重建
    [].slice.call(h.querySelectorAll('.fw-hud')).forEach(function (n) { n.remove(); });
    if (lastData) h.insertAdjacentHTML('beforeend', buildHud(lastData));
    // 触发一次 resize，让 fusion3d 的 fit() 重算尺寸
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    document.documentElement.style.overflow = 'hidden';
    return true;
  }

  function exit() {
    var h = ensureHost();
    if (!h) return;
    h.classList.remove('fw-full');
    [].slice.call(h.querySelectorAll('.fw-hud')).forEach(function (n) { n.remove(); });
    document.documentElement.style.overflow = '';
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && host && host.classList.contains('fw-full')) exit();
  });

  window.__fwFullscreen = enter;
  window.__fwFullscreenExit = exit;
  window.__fwFullscreenUpdate = function (data) {
    lastData = data;
    if (host && host.classList.contains('fw-full')) {
      [].slice.call(host.querySelectorAll('.fw-hud')).forEach(function (n) { n.remove(); });
      host.insertAdjacentHTML('beforeend', buildHud(data));
    }
  };
})();
`, 'utf8');
console.log('② web/fw-fullscreen.js 已写入');

/* ══════════ ③ 引入 ══════════ */
let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('/fw-fullscreen.js')) {
  html = html.replace('<script type="module" src="/fusion3d.js"></script>',
    '<script type="module" src="/fusion3d.js"></script>\n  <script src="/fw-fullscreen.js"></script>');
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('③ 已引入 fw-fullscreen.js');
}

/* ══════════ ④ 排盘后自动全屏 ══════════ */
let app = fs.readFileSync('web/app.js', 'utf8');
if (!app.includes('__fwFullscreen')) {
  app = app.replace(
    "      window.__fwSetData(json.data);",
    `      window.__fwSetData(json.data);
      // ★ 排盘成功后自动进入全屏融合盘
      try { setTimeout(function () { window.__fwFullscreen && window.__fwFullscreen(json.data); }, 380); } catch (e) {}`
  );
  fs.writeFileSync('web/app.js', app, 'utf8');
  console.log('④ app.js 已接自动全屏');
} else console.log('④ 已接');

/* 校验 */
const c2 = fs.readFileSync('web/style.css', 'utf8');
const a2 = fs.readFileSync('web/app.js', 'utf8');
const h2 = fs.readFileSync('web/index.html', 'utf8');
console.log('\n校验：');
for (const [k, v] of [
  ['CSS 有 .fw-full', c2.includes('.fw-card.fw-full')],
  ['CSS 有宇宙幕布 ::before', c2.includes('::before{\n  content:\'\'; position:absolute; inset:0; z-index:0') || c2.includes('.fw-card.fw-full::before')],
  ['CSS 有 HUD 样式', c2.includes('.fw-hud')],
  ['JS 有 enter/exit', fs.readFileSync('web/fw-fullscreen.js', 'utf8').includes('window.__fwFullscreen = enter')],
  ['JS 有 ESC 退出', fs.readFileSync('web/fw-fullscreen.js', 'utf8').includes("e.key === 'Escape'")],
  ['index 已引入', h2.includes('/fw-fullscreen.js')],
  ['app.js 自动全屏', a2.includes('__fwFullscreen')],
]) console.log(' ', v ? '✅' : '❌', k);
