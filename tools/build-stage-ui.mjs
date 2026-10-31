// ① index.html 插入「中西合璧」舞台 + 左侧导航改造
// ② style.css 加赛博科技风样式
import fs from 'node:fs';

let html = fs.readFileSync('web/index.html', 'utf8');

/* ────────── ① 舞台 HTML ────────── */
const STAGE = `
  <!-- ★ 中西合璧圆盘舞台（可拖拽旋转） -->
  <section class="stage-hero" id="stage-hero">
    <canvas></canvas>
    <div class="stage-tip"></div>

    <div class="stage-copy">
      <div class="stage-kicker">玄机 · 中西合璧</div>
      <h1 class="stage-title">天盘 <i>×</i> 星轨</h1>
      <p class="stage-sub">外圈二十四山（中国）　·　内环十二宫（西洋）　·　同一个时刻的两种编码</p>
    </div>

    <div class="stage-ctrl">
      <button type="button" data-stage="spin" class="on">自转</button>
      <button type="button" data-stage="flat">平视</button>
      <button type="button" data-stage="top">俯视</button>
      <button type="button" data-stage="reset">复位</button>
    </div>

    <div class="stage-hint">
      <span>拖动旋转</span><span>滚轮缩放</span><span>悬停看对应</span>
    </div>

    <a class="stage-scroll" href="#main" aria-label="进入">↓</a>
  </section>`;

if (!html.includes('stage-hero')) {
  html = html.replace('<main id="main">', STAGE + '\n\n  <main id="main">');
  console.log('① 舞台已插入');
} else console.log('① 舞台已存在');

/* ────────── ② 引入 stage.js ────────── */
if (!html.includes('/stage.js')) {
  html = html.replace('<script type="module" src="/timecheck.js"></script>',
    '<script type="module" src="/stage.js"></script>\n  <script type="module" src="/timecheck.js"></script>');
  console.log('② stage.js 已引入');
}

/* ────────── ③ tabbar 加一个「盘子」按钮用于回到舞台 ────────── */
if (!html.includes('data-go="stage"')) {
  html = html.replace('<nav class="tabbar">', '<nav class="tabbar">\n    <button type="button" data-go="stage" title="回到圆盘"><i class="ic">◉</i><span>圆盘</span></button>');
  console.log('③ tabbar 已加「圆盘」');
}

fs.writeFileSync('web/index.html', html, 'utf8');

/* ────────── ④ 样式 ────────── */
let css = fs.readFileSync('web/style.css', 'utf8');
if (css.includes('.stage-hero')) { console.log('④ 样式已存在'); process.exit(0); }

css += `

/* ══════════ ★ 中西合璧舞台（赛博科技风） ══════════ */
.stage-hero{
  position:relative;width:100%;height:calc(100dvh - 56px);min-height:560px;
  overflow:hidden;
  background:
    radial-gradient(1200px 600px at 50% 12%, rgba(0,120,150,0.16), transparent 65%),
    radial-gradient(800px 400px at 80% 80%, rgba(255,160,40,0.06), transparent 70%),
    linear-gradient(180deg,#050a10 0%,#070d15 55%,#04080c 100%);
  border-bottom:1px solid rgba(0,229,255,0.12);
}
.stage-hero::before{
  /* 顶部扫描线 */
  content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(180deg,rgba(0,229,255,0.028) 0 1px,transparent 1px 3px);
  mix-blend-mode:screen;opacity:.55;
}
.stage-hero canvas{position:absolute;inset:0;display:block;touch-action:none}

.stage-copy{position:absolute;left:0;right:0;top:6.5%;text-align:center;pointer-events:none;z-index:3}
.stage-kicker{
  font-size:11px;letter-spacing:.42em;color:rgba(148,230,255,.72);
  text-transform:uppercase;margin-bottom:10px;
  text-shadow:0 0 18px rgba(0,229,255,.5)
}
.stage-title{
  margin:0;font-size:clamp(30px,5.2vw,62px);font-weight:800;letter-spacing:.06em;
  color:#eaf7ff;
  text-shadow:0 0 28px rgba(0,229,255,.45),0 0 70px rgba(0,120,160,.35),0 2px 0 rgba(0,0,0,.6);
}
.stage-title i{font-style:normal;color:#ffc457;text-shadow:0 0 26px rgba(255,196,87,.75);margin:0 .12em}
.stage-sub{
  margin:12px auto 0;max-width:660px;font-size:12.5px;line-height:1.9;
  color:rgba(160,200,225,.72);letter-spacing:.06em
}

.stage-ctrl{
  position:absolute;left:50%;transform:translateX(-50%);bottom:calc(9% + 26px);
  display:flex;gap:8px;z-index:4;
}
.stage-ctrl button{
  padding:6px 15px;font-size:12px;letter-spacing:.08em;
  color:rgba(170,215,240,.82);background:rgba(8,20,30,.66);
  border:1px solid rgba(0,229,255,.24);border-radius:999px;cursor:pointer;
  backdrop-filter:blur(10px);transition:.18s;
}
.stage-ctrl button:hover{border-color:rgba(0,229,255,.6);color:#cdf3ff;box-shadow:0 0 22px rgba(0,229,255,.22)}
.stage-ctrl button.on{
  color:#04121a;background:linear-gradient(180deg,#5ef1ff,#00c4e6);
  border-color:transparent;box-shadow:0 0 26px rgba(0,229,255,.45);font-weight:600
}

.stage-hint{
  position:absolute;left:50%;transform:translateX(-50%);bottom:calc(9% + 2px);
  display:flex;gap:18px;font-size:11px;color:rgba(130,175,200,.5);letter-spacing:.1em;z-index:4
}
.stage-hint span::before{content:'· ';color:rgba(0,229,255,.6)}

.stage-tip{
  position:absolute;z-index:6;pointer-events:none;opacity:0;transition:opacity .12s;
  padding:7px 12px;font-size:12px;line-height:1.5;white-space:nowrap;
  color:#d8f4ff;background:rgba(6,16,24,.94);
  border:1px solid rgba(0,229,255,.42);border-radius:8px;
  box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 22px rgba(0,229,255,.18);
}

.stage-scroll{
  position:absolute;left:50%;transform:translateX(-50%);bottom:16px;
  width:30px;height:30px;line-height:26px;text-align:center;
  color:rgba(0,229,255,.7);border:1px solid rgba(0,229,255,.3);border-radius:50%;
  text-decoration:none;font-size:14px;z-index:4;
  animation:bob 1.9s ease-in-out infinite;
}
@keyframes bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,6px)}}

/* ── 桌面：底部 tabbar 变左侧竖排导航（更接近参考的布局） ── */
@media(min-width:900px){
  .tabbar{
    position:fixed;left:0;top:56px;bottom:0;width:104px;
    display:flex;flex-direction:column;gap:4px;padding:14px 8px;
    background:linear-gradient(180deg,rgba(7,14,22,.96),rgba(5,9,14,.98));
    border-right:1px solid rgba(0,229,255,.12);
    transform:none !important;z-index:30;
  }
  .tabbar button{
    display:flex;align-items:center;gap:9px;justify-content:flex-start;
    padding:11px 12px;border-radius:10px;font-size:13px;
  }
  .tabbar button span{font-size:13px}
  .tabbar button[aria-current="page"],.tabbar button.active{
    background:linear-gradient(90deg,rgba(0,229,255,.16),rgba(0,229,255,.03));
    box-shadow:inset 2px 0 0 #5ef1ff;
  }
  #app,#main,.stage-hero{padding-left:104px}
  .stage-hero{height:calc(100dvh - 56px)}
}
@media(max-width:899px){
  .stage-hero{height:calc(100dvh - 56px - 56px)}
  .stage-copy{top:4%}
  .stage-hint{display:none}
}
`;
fs.writeFileSync('web/style.css', css, 'utf8');
console.log('④ 样式已写入');
