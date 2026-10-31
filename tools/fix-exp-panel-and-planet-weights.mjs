// ① 修：全屏后实验面板消失（enter 的 clearHud 把它删了 + 轮询早停）
// ② 加：点击行星 → 详情面板里直接显示该星的十神五组比例
import fs from 'node:fs';
let changed = [];

/* ══════════ ①a fw-fullscreen：暴露 hook 与 deep ══════════ */
let fw = fs.readFileSync('web/fw-fullscreen.js', 'utf8');

if (!fw.includes('__afterHudBuilt')) {
  // enter() 与 __fwSetDeep 之后都触发 hook
  fw = fw.replace(
    `    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    document.documentElement.style.overflow = 'hidden';
    return true;`,
    `    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    document.documentElement.style.overflow = 'hidden';
    // ★ HUD 建好后通知外部（实验性排盘等外部块必须在每次重建后追加）
    setTimeout(function () { try { window.__afterHudBuilt && window.__afterHudBuilt(); } catch (e) {} }, 120);
    return true;`
  );
  changed.push('enter 加 hook');
}

if (!fw.includes('window.__fwDeep')) {
  fw = fw.replace(
    `  window.__fwSetDeep = function (deep) {
    DEEP = deep || null;`,
    `  window.__fwSetDeep = function (deep) {
    DEEP = deep || null;
    window.__fwDeep = DEEP;   // ★ 暴露给行星点击面板用`
  );
  // __fwSetDeep 里的重渲染后也触发 hook
  fw = fw.replace(
    `      clearHud(host);
      host.insertAdjacentHTML('beforeend', buildHud(lastData));
    }
  };
  window.__fwFullscreen = enter;`,
    `      clearHud(host);
      host.insertAdjacentHTML('beforeend', buildHud(lastData));
      setTimeout(function () { try { window.__afterHudBuilt && window.__afterHudBuilt(); } catch (e) {} }, 80);
    }
  };
  window.__fwFullscreen = enter;`
  );
  changed.push('__fwSetDeep 暴露 + hook');
}
fs.writeFileSync('web/fw-fullscreen.js', fw, 'utf8');

/* ══════════ ①b wizard：注册 hook（撤掉会早停的轮询）══════════ */
let wz = fs.readFileSync('web/wizard.js', 'utf8');
if (wz.includes('var tries = 0;')) {
  wz = wz.replace(
    /  \/\/ 每次排盘后尝试把实验版并排塞进 HUD[\s\S]*?\}, 500\);/,
    `  // ★ 由 fw-fullscreen 的 __afterHudBuilt 驱动（不再用会早停的轮询）
  window.__afterHudBuilt = function () { try { renderExpIntoHud(); } catch (e) {} };
  // 首次挂载时若已在全屏态，补一次
  setTimeout(function () { try { renderExpIntoHud(); } catch (e) {} }, 1200);`
  );
  changed.push('wizard 改 hook');
} else if (!wz.includes('__afterHudBuilt')) {
  wz += `\nwindow.__afterHudBuilt = function () { try { renderExpIntoHud(); } catch (e) {} };\n`;
  changed.push('wizard 追加 hook');
}
fs.writeFileSync('web/wizard.js', wz, 'utf8');

/* ══════════ ② fusion3d：点击行星 → 十神比例 ══════════ */
let f3 = fs.readFileSync('web/fusion3d.js', 'utf8');
if (!f3.includes('injectTenGodBars')) {
  f3 += `

/* ══════════ 点击行星 → 详情面板里直接显示十神五组比例 ══════════ */
(function () {
  if (typeof showPlanetPanel !== 'function') return;
  var _spp = showPlanetPanel;
  var G5 = [['比劫', '#ff9a8a'], ['印', '#7dffb4'], ['食伤', '#5ef1ff'], ['财', '#ffc457'], ['官杀', '#b48cff']];

  function injectTenGodBars(host, pl) {
    if (!host || !pl) return;
    var panel = host.querySelector('.planet-panel');
    if (!panel || panel.querySelector('.pp-weights')) return;
    var deep = window.__fwDeep;
    var dp = null;
    if (deep && Array.isArray(deep.planets)) {
      for (var i = 0; i < deep.planets.length; i++) {
        if (deep.planets[i].planet === pl.name) { dp = deep.planets[i]; break; }
      }
    }
    if (!dp || !dp.weights) return;
    var box = document.createElement('div');
    box.className = 'pp-weights';
    var html = '<div class="pp-wk">十神比例 · 动态权重（含相位与宫位修正）</div>';
    var maxG = '', maxV = -1;
    G5.forEach(function (p) {
      var v = (dp.weights[p[0]] || 0) * 100;
      if (v > maxV) { maxV = v; maxG = p[0]; }
    });
    G5.forEach(function (p) {
      var v = (dp.weights[p[0]] || 0) * 100;
      html += '<div class="pp-wr' + (p[0] === maxG ? ' top' : '') + '">' +
        '<i style="color:' + p[1] + '">' + p[0] + '</i>' +
        '<span class="pp-wb"><b style="width:' + v.toFixed(1) + '%;background:' + p[1] + '"></b></span>' +
        '<em>' + v.toFixed(1) + '%</em></div>';
    });
    if (dp.primary && dp.primary.group) {
      html += '<div class="pp-wn">主组 <b style="color:#ffc457">' + dp.primary.group + '</b>' +
        ' · ' + Math.round((dp.primary.w || 0) * 100) + '%　说明：同一颗星，状态不同则配比不同</div>';
    }
    box.innerHTML = html;
    panel.appendChild(box);
  }

  showPlanetPanel = function (host, pl) {
    try { _spp(host, pl); } catch (e) { return; }
    try { injectTenGodBars(host, pl); } catch (e) {}
  };
})();
`;
  fs.writeFileSync('web/fusion3d.js', f3, 'utf8');
  changed.push('行星点击加比例');
}

/* ══════════ ③ 样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.pp-weights')) {
  css += `

/* ══════════ 行星详情面板：十神比例 ══════════ */
.pp-weights{margin-top:11px;padding-top:10px;border-top:1px solid rgba(90,160,220,.22)}
.pp-wk{font-size:10.5px;letter-spacing:.1em;color:rgba(140,190,225,.65);margin-bottom:7px}
.pp-wr{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:11.5px}
.pp-wr i{width:34px;font-style:normal;font-weight:700;flex:0 0 auto}
.pp-wb{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.09);overflow:hidden}
.pp-wb b{display:block;height:100%;border-radius:3px;opacity:.9;transition:width .25s ease}
.pp-wr em{width:44px;text-align:right;font-style:normal;color:rgba(200,222,238,.85);
  font-variant-numeric:tabular-nums;flex:0 0 auto;font-size:11px}
.pp-wr.top i{text-shadow:0 0 8px currentColor}
.pp-wr.top em{color:#ffc457;font-weight:700}
.pp-wn{margin-top:8px;font-size:10.5px;line-height:1.7;color:rgba(150,190,220,.7)}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  changed.push('样式');
}

console.log('改动：', changed.join(' / '));

/* 校验 */
const A = fs.readFileSync('web/fw-fullscreen.js', 'utf8');
const B = fs.readFileSync('web/wizard.js', 'utf8');
const C = fs.readFileSync('web/fusion3d.js', 'utf8');
const D = fs.readFileSync('web/style.css', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['enter 触发 hook', A.includes('__afterHudBuilt')],
  ['暴露 __fwDeep', A.includes('window.__fwDeep')],
  ['wizard 注册 hook', B.includes('window.__afterHudBuilt =')],
  ['轮询已移除', !B.includes('var tries = 0;')],
  ['点击注入比例', C.includes('injectTenGodBars')],
  ['包装 showPlanetPanel', C.includes('showPlanetPanel = function')],
  ['CSS .pp-weights', D.includes('.pp-weights')],
  ['CSS .pp-wb', D.includes('.pp-wb')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
