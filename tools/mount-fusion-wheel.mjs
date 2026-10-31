// 把融合圆盘挂到「融合」页：在结果最上方插入一块融合视图，并用 API 数据喂养
import fs from 'node:fs';

let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('fusion-wheel.js')) {
  html = html.replace('<script type="module" src="/timeline-ui.js"></script>',
    '<script type="module" src="/fusion-wheel.js"></script>\n  <script type="module" src="/timeline-ui.js"></script>');
  console.log('① 脚本已引入');
}

// 融合页顶部加容器
if (!html.includes('id="fusion-wheel-host"')) {
  html = html.replace(
    /(<section class="page" data-page="fusion">\s*<h2 class="page-title">[^<]*<span[^>]*>[^<]*<\/span><\/h2>)/,
    `$1
      <section class="fw-card" id="fusion-wheel-host">
        <canvas></canvas>
        <div class="fw-tip"></div>
        <div class="fw-title">融合盘 <span>四柱（金）· 星盘（青）· 恒等连线</span></div>
        <div class="fw-ctrl">
          <button type="button" data-fw="spin" class="on">自转</button>
          <button type="button" data-fw="pillars" class="on">四柱</button>
          <button type="button" data-fw="planets" class="on">行星</button>
          <button type="button" data-fw="aspects" class="on">相位</button>
          <button type="button" data-fw="houses" class="on">宫位</button>
          <button type="button" data-fw="link" class="on">恒等线</button>
          <button type="button" data-fw="flat">平视</button>
          <button type="button" data-fw="top">俯视</button>
          <button type="button" data-fw="reset">复位</button>
        </div>
        <div class="fw-hint">拖动旋转 · 滚轮缩放 · 悬停看中西对照</div>
      </section>`
  );
  console.log('② 融合盘容器已插入');
}
fs.writeFileSync('web/index.html', html, 'utf8');

/* ③ 样式 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.fw-card')) {
  css += `

/* ══════════ 融合盘（八字 × 星盘 同一盘面） ══════════ */
.fw-card{
  position:relative;width:100%;height:520px;margin:0 0 16px;border-radius:14px;overflow:hidden;
  border:1px solid rgba(0,229,255,.16);
  background:
    radial-gradient(700px 380px at 50% 24%, rgba(0,140,175,.14), transparent 68%),
    radial-gradient(520px 300px at 80% 82%, rgba(255,170,60,.06), transparent 72%),
    linear-gradient(180deg,#050b11,#04080d);
}
@media(min-width:900px){ .fw-card{grid-column:1 / -1} }
.fw-card canvas{position:absolute;inset:0;display:block;touch-action:none}
.fw-tip{
  position:absolute;z-index:6;pointer-events:none;opacity:0;transition:opacity .12s;
  padding:7px 11px;font-size:12px;line-height:1.55;max-width:340px;
  color:#d8f4ff;background:rgba(6,16,24,.95);
  border:1px solid rgba(0,229,255,.42);border-radius:8px;
  box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 20px rgba(0,229,255,.18);
}
.fw-title{
  position:absolute;left:18px;top:14px;font-size:13px;color:var(--gold);letter-spacing:.1em;z-index:4;
  text-shadow:0 0 14px rgba(255,196,87,.4);pointer-events:none;
}
.fw-title span{color:rgba(160,205,230,.6);font-size:11px;margin-left:8px;letter-spacing:.05em}
.fw-ctrl{
  position:absolute;left:50%;transform:translateX(-50%);bottom:30px;display:flex;gap:6px;flex-wrap:wrap;
  justify-content:center;z-index:4;padding:0 12px;
}
.fw-ctrl button{
  padding:5px 12px;font-size:11.5px;letter-spacing:.06em;color:rgba(170,215,240,.75);
  background:rgba(8,20,30,.72);border:1px solid rgba(0,229,255,.22);border-radius:999px;cursor:pointer;
  backdrop-filter:blur(8px);transition:.16s;
}
.fw-ctrl button:hover{border-color:rgba(0,229,255,.55);color:#cdf3ff}
.fw-ctrl button.on{color:#04121a;background:linear-gradient(180deg,#5ef1ff,#00c4e6);border-color:transparent;font-weight:600}
.fw-hint{
  position:absolute;left:50%;transform:translateX(-50%);bottom:10px;z-index:4;
  font-size:10.5px;color:rgba(130,175,200,.45);letter-spacing:.1em;white-space:nowrap;
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ 样式已加');
}
