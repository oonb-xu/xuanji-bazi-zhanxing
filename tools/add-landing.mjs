// 加入全屏引导页（landing）：覆盖式首屏，点「进入」→ 切到关于页
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak9', h, 'utf8');

if (h.includes('id="landing"')) { console.log('已有 landing，先移除旧块'); process.exit(1); }

/* ── ① CSS（追加到 style.css，全部以 #landing 前缀限定，不影响其它页） ── */
const CSS = `
/* ══════════ 全屏引导页 #landing ══════════ */
#landing{
  position:fixed; inset:0; z-index:9999;
  display:flex; align-items:center; justify-content:center;
  background:#03070d;
  overflow:hidden;
  animation:ld-in .7s ease both;
}
#landing::before{ /* 深空底 */
  content:""; position:absolute; inset:0;
  background:
    radial-gradient(1100px 700px at 22% 12%, rgba(30,90,160,.34), transparent 62%),
    radial-gradient(900px 620px at 82% 84%, rgba(120,58,150,.28), transparent 64%),
    radial-gradient(700px 500px at 50% 50%, rgba(12,32,54,.55), transparent 70%),
    linear-gradient(180deg,#04080f 0%,#02050a 100%);
}
#landing::after{ /* 星点 */
  content:""; position:absolute; inset:0; opacity:.55;
  background-image:
    radial-gradient(1.4px 1.4px at 12% 22%, rgba(255,255,255,.9), transparent 100%),
    radial-gradient(1.2px 1.2px at 78% 14%, rgba(200,235,255,.8), transparent 100%),
    radial-gradient(1.6px 1.6px at 34% 78%, rgba(255,240,200,.85), transparent 100%),
    radial-gradient(1.1px 1.1px at 66% 62%, rgba(255,255,255,.7), transparent 100%),
    radial-gradient(1.3px 1.3px at 88% 44%, rgba(180,220,255,.75), transparent 100%),
    radial-gradient(1px 1px at 46% 34%, rgba(255,255,255,.6), transparent 100%),
    radial-gradient(1.5px 1.5px at 8% 62%, rgba(255,255,255,.7), transparent 100%),
    radial-gradient(1px 1px at 58% 88%, rgba(255,255,255,.55), transparent 100%);
  animation:ld-twinkle 6s ease-in-out infinite alternate;
}
@keyframes ld-twinkle{ from{opacity:.35} to{opacity:.7} }
@keyframes ld-in{ from{opacity:0} to{opacity:1} }
#landing.ld-out{ animation:ld-out .45s ease forwards }
@keyframes ld-out{ to{ opacity:0; transform:scale(1.04) } }

#landing .ld-inner{
  position:relative; z-index:2;
  width:min(760px, 92vw);
  text-align:center;
  padding:8px 4px;
  animation:ld-rise .85s cubic-bezier(.2,.8,.2,1) .1s both;
}
@keyframes ld-rise{ from{opacity:0; transform:translateY(22px)} to{opacity:1; transform:none} }

#landing .ld-kicker{
  margin:0 0 18px; font-size:12px; letter-spacing:.42em; text-transform:uppercase;
  color:rgba(150,200,235,.72); font-weight:600;
}
#landing .ld-title{
  margin:0; font-size:clamp(56px,11vw,108px); line-height:1;
  letter-spacing:.18em; font-weight:800;
  background:linear-gradient(180deg,#fff 0%,#cfe9ff 42%,#7fb6e0 78%,#4a7fa8 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
  text-shadow:0 0 60px rgba(94,241,255,.28);
}
#landing .ld-sub{
  margin:16px 0 0; font-size:clamp(14px,1.7vw,17px);
  letter-spacing:.24em; color:rgba(190,225,250,.9); font-weight:600;
}
#landing .ld-lead{
  margin:26px auto 0; max-width:640px;
  font-size:14.5px; line-height:2.05; color:rgba(200,220,240,.78);
}
#landing .ld-lead b{ color:#ffd58a; font-weight:700 }

#landing .ld-points{
  list-style:none; margin:34px 0 0; padding:0;
  display:grid; grid-template-columns:repeat(4,1fr); gap:10px;
}
#landing .ld-points li{
  display:flex; flex-direction:column; align-items:center; gap:7px;
  padding:16px 8px; border-radius:14px;
  background:linear-gradient(180deg,rgba(20,38,58,.72),rgba(10,20,32,.6));
  border:1px solid rgba(94,160,220,.16);
  transition:transform .25s ease, border-color .25s ease, box-shadow .25s ease;
}
#landing .ld-points li:hover{
  transform:translateY(-3px); border-color:rgba(94,241,255,.4);
  box-shadow:0 10px 30px -12px rgba(94,200,255,.45);
}
#landing .ld-points i{
  font-style:normal; font-size:18px; line-height:1;
  color:#5ef1ff; text-shadow:0 0 16px rgba(94,241,255,.6);
}
#landing .ld-points b{ font-size:12.5px; color:#e8f4ff; font-weight:700; letter-spacing:.04em }
#landing .ld-points span{ font-size:11px; color:rgba(175,205,230,.72); line-height:1.5 }

#landing .ld-enter{
  margin:36px 0 0; padding:15px 44px;
  font-size:16px; font-weight:800; letter-spacing:.26em;
  color:#04121c; cursor:pointer;
  border:0; border-radius:999px;
  background:linear-gradient(135deg,#8af7ff 0%,#5ef1ff 45%,#48c8e8 100%);
  box-shadow:0 0 0 1px rgba(120,240,255,.5), 0 14px 40px -12px rgba(94,241,255,.75);
  transition:transform .2s ease, box-shadow .25s ease, filter .2s ease;
  animation:ld-pulse 2.8s ease-in-out infinite;
}
#landing .ld-enter span{ display:inline-block; margin-left:10px; transition:transform .25s ease }
#landing .ld-enter:hover{ transform:translateY(-2px); filter:brightness(1.06); box-shadow:0 0 0 1px rgba(140,250,255,.7), 0 20px 54px -10px rgba(94,241,255,.9) }
#landing .ld-enter:hover span{ transform:translateX(5px) }
#landing .ld-enter:active{ transform:scale(.975) }
@keyframes ld-pulse{
  0%,100%{ box-shadow:0 0 0 1px rgba(120,240,255,.5), 0 14px 40px -12px rgba(94,241,255,.7) }
  50%{ box-shadow:0 0 0 1px rgba(160,250,255,.75), 0 18px 54px -8px rgba(94,241,255,.95) }
}

#landing .ld-foot{
  margin:20px 0 0; font-size:11.5px; letter-spacing:.08em;
  color:rgba(150,185,215,.55);
}
#landing .ld-skip{
  position:absolute; top:22px; right:26px; z-index:3;
  padding:8px 16px; font-size:12px; letter-spacing:.14em;
  color:rgba(170,200,225,.7); cursor:pointer;
  background:rgba(12,24,38,.55); border:1px solid rgba(94,160,220,.22); border-radius:999px;
  transition:color .2s ease, border-color .2s ease;
}
#landing .ld-skip:hover{ color:#dff2ff; border-color:rgba(94,241,255,.45) }

@media (max-width:760px){
  #landing .ld-points{ grid-template-columns:repeat(2,1fr) }
  #landing .ld-title{ letter-spacing:.1em }
}
`;

const SP = 'web/style.css';
let css = fs.readFileSync(SP, 'utf8');
if (!css.includes('全屏引导页 #landing')) { css += CSS; fs.writeFileSync(SP, css, 'utf8'); console.log('✅ style.css 追加引导页样式，共', css.length, '字节'); }
else console.log('样式已存在');

/* ── ② HTML（放在 <div id="app"> 之前，作为 body 的直接子元素，不影响 #app 结构） ── */
const HTML = `
  <!-- ══════════ 全屏引导页 ══════════ -->
  <div id="landing" role="dialog" aria-modal="true" aria-label="玄机 · 进入引导">
    <div class="ld-inner">
      <p class="ld-kicker">中西命理 · 融合模型</p>
      <h1 class="ld-title">玄 机</h1>
      <p class="ld-sub">把四套体系翻译到同一张盘上</p>
      <p class="ld-lead">
        八字的<b>十神</b>、星盘的<b>宫位</b>、紫微的<b>庙旺</b>、七政四余的<b>宿度</b>——
        它们说着不同的语言，却指向同一个出生时刻。
        本系统不做并排罗列，而是先找到底层对应，再融成一张盘。
      </p>
      <ul class="ld-points">
        <li><i>◎</i><b>四系统融合</b><span>十神说力量<br>宫位说领域</span></li>
        <li><i>◈</i><b>可机检</b><span>每条对应<br>都标置信度</span></li>
        <li><i>◐</i><b>不下吉凶</b><span>只呈现结构<br>结论留给你</span></li>
        <li><i>⬡</i><b>本地计算</b><span>只收匿名<br>出生信息</span></li>
      </ul>
      <button id="ld-enter" class="ld-enter" type="button">进 入<span>→</span></button>
      <p class="ld-foot">进入后先到「关于」页 · 按 Esc 可直接跳过</p>
    </div>
    <button id="ld-skip" class="ld-skip" type="button">跳过</button>
  </div>

`;

const anchor = '<div id="app"';
const ai = h.indexOf(anchor);
if (ai < 0) { console.error('❌ 找不到 #app'); process.exit(1); }
h = h.slice(0, ai) + HTML + h.slice(ai);

/* ── ③ JS（在 </body> 前注入，独立文件更干净 → 写 landing.js 并引用） ── */
const JS = `// 全屏引导页：进入 → 切到关于页；同一标签页只挡一次
(function () {
  var L = document.getElementById('landing');
  if (!L) return;
  var entry = document.getElementById('ld-enter');
  var skip = document.getElementById('ld-skip');

  try {
    if (sessionStorage.getItem('xuanji-landing-done') === '1') { L.parentNode.removeChild(L); return; }
  } catch (e) {}

  function enter() {
    try { sessionStorage.setItem('xuanji-landing-done', '1'); } catch (e) {}
    L.classList.add('ld-out');
    setTimeout(function () { if (L.parentNode) L.parentNode.removeChild(L); }, 460);
    // 用导航按钮切页（hash 直跳不会激活页面，已知问题）
    var b = document.querySelector('.tabbar button[data-go="about"]');
    if (b) { try { b.click(); } catch (e) {} }
    else { location.hash = '#about'; }
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  if (entry) entry.addEventListener('click', enter);
  if (skip) skip.addEventListener('click', enter);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') enter(); });
})();
`;
fs.writeFileSync('web/landing.js', JS, 'utf8');
console.log('✅ web/landing.js 已写入');

/* 在 </body> 前引入脚本 */
const bodyEnd = h.lastIndexOf('</body>');
if (bodyEnd < 0) { console.error('❌ 找不到 </body>'); process.exit(1); }
h = h.slice(0, bodyEnd) + '  <script src="/landing.js"></script>\n' + h.slice(bodyEnd);

fs.writeFileSync(P, h, 'utf8');
console.log('✅ index.html 已写入引导页，共', h.length, '字节');

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h1', /<h1\b/g, /<\/h1>/g], ['p', /<p\b/g, /<\/p>/g], ['ul', /<ul\b/g, /<\/ul>/g],
  ['li', /<li\b/g, /<\/li>/g], ['button', /<button\b/g, /<\/button>/g], ['span', /<span\b/g, /<\/span>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}
const app = h.indexOf('<div id="app"');
const at = h.indexOf('>', app) + 1;
const r2 = /<div\b|<\/div>/g; r2.lastIndex = at;
let dd = 1, mm, appEnd = -1;
while ((mm = r2.exec(h))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { appEnd = mm.index; break; } }
const okAll = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => { const p = h.indexOf('data-page="' + k + '"'); return p > app && p < appEnd; });
console.log('  #app 包含其余页面 ' + (okAll ? '✅' : '❌'));
if (!okAll) bad++;
console.log('  landing 在 #app 之前 ' + (h.indexOf('id="landing"') < app ? '✅' : '❌'));
if (h.indexOf('id="landing"') >= app) bad++;
console.log('  landing.js 已引用 ' + (h.includes('src="/landing.js"') ? '✅' : '❌'));
if (!h.includes('src="/landing.js"')) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
console.log('\n✅ 全部通过');
