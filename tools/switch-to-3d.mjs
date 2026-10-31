// 把融合盘换成 3D 版本：替换 host 上的模块、加「穿梭」按钮、更新提示
import fs from 'node:fs';

/* ① index.html：换脚本 + 加按钮 + 改提示 */
let h = fs.readFileSync('web/index.html', 'utf8');

h = h.replace(
  '<script type="module" src="/fusion-wheel.js"></script>',
  '<script type="module" src="/fusion3d.js"></script>'
);

if (!h.includes('data-fw="fly"')) {
  h = h.replace(
    '<button type="button" data-fw="reset">复位</button>',
    '<button type="button" data-fw="fly">穿梭</button>\n          <button type="button" data-fw="reset">复位</button>'
  );
}
h = h.replace(
  '<div class="fw-hint">拖动旋转 · 滚轮缩放 · 悬停看中西对照</div>',
  '<div class="fw-hint">拖动环视 · 上下拖看俯仰 · 滚轮缩放（可缩到球心穿梭）· 悬停看中西对照</div>'
);
h = h.replace(
  '融合盘 <span>四柱（金）· 星盘（青）· 恒等连线</span>',
  '融合盘 3D <span>真实星空 · 七柱（金）· 黄道（青）</span>'
);
fs.writeFileSync('web/index.html', h, 'utf8');
console.log('① index.html 已切换 3D');

/* ② 新模块自动挂载钩子 */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');
if (!s.includes('__fw3dInit')) {
  s += `

/* ══════════ 自动挂载 + 对外钩子 ══════════ */
let _m3 = false, _p3 = null;
function __fw3dInit() {
  const host = document.querySelector('#fusion-wheel-host');
  if (!host || _m3) return;
  mountFusion3D(host, _p3);
  _m3 = true;
}
window.__fwSetData = function (data) {
  _p3 = data;
  if (!_m3) __fw3dInit();
  else setFusion3DData(data);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', __fw3dInit);
else __fw3dInit();
`;
  fs.writeFileSync('web/fusion3d.js', s, 'utf8');
  console.log('② 挂载钩子已加');
}

/* ③ 样式：3D 舞台更高 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.fw-card.3d, /* 3D')) {
  css += `

/* ══════════ 融合盘 3D ══════════ */
.fw-card{ height:600px !important;
  background: radial-gradient(900px 520px at 50% 40%, rgba(0,60,100,.30), transparent 70%),
              linear-gradient(180deg,#020509,#010306) !important;
  border-color: rgba(0,229,255,.20) !important;
  box-shadow: inset 0 0 120px rgba(0,120,160,.10) !important;
}
@media(min-width:900px){ .fw-card{grid-column:1 / -1} }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ 3D 舞台样式已加');
}
