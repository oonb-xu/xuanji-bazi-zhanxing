// 把行星的十神力量写进融合盘界面（HUD），并移除原来那张独立表（避免割裂）
import fs from 'node:fs';
let changed = [];

/* ══════════ ① deep 数据回灌给融合盘 HUD ══════════ */
let df = fs.readFileSync('web/deep-fetch.js', 'utf8');
if (!df.includes('__fwSetDeep')) {
  df = df.replace(
    "if (j && j.ok && window.__renderDeep) window.__renderDeep(j.data);",
    "if (j && j.ok) {\n            window.__renderDeep && window.__renderDeep(j.data);\n            // ★ 同一份深度数据同时喂给全屏融合盘，让十神权重直接长在盘上\n            try { window.__fwSetDeep && window.__fwSetDeep(j.data); } catch (e) {}\n          }"
  );
  fs.writeFileSync('web/deep-fetch.js', df, 'utf8');
  changed.push('deep-fetch 回灌');
}

/* ══════════ ② HUD：每颗行星下面加 5 组权重条 ══════════ */
let fw = fs.readFileSync('web/fw-fullscreen.js', 'utf8');

if (!fw.includes('DEEP')) {
  // 2a 模块级变量
  fw = fw.replace(
    'var host = null, lastData = null;',
    'var host = null, lastData = null, DEEP = null;   // DEEP = /api/deep 的响应（含动态十神权重）'
  );

  // 2b 行星块：有 DEEP 就画权重条
  const OLD = `  /** 行星块：七政/四余标签 + 复主星 → 十神 */
  function planetsHtml(d) {
    var ps = (d.planets || []).filter(function (p) { return p && p.primary; });`;
  const NEW = `  var G5 = ['比劫', '印', '食伤', '财', '官杀'];
  var G_COLOR = { 比劫: '#ff9a8a', 印: '#7dffb4', 食伤: '#5ef1ff', 财: '#ffc457', 官杀: '#b48cff' };

  /** 5 组权重迷你条（长在每颗行星下面） */
  function weightsMini(w) {
    if (!w) return '';
    var h = '<span class="h-wb">';
    G5.forEach(function (g) {
      var v = (w[g] || 0) * 100;
      if (v < 0.5) return;
      h += '<i title="' + g + ' ' + v.toFixed(1) + '%" style="width:' + v.toFixed(1) + '%;background:' + G_COLOR[g] + '"></i>';
    });
    return h + '</span>';
  }

  /** 从 DEEP 里按行星名取权重 */
  function deepOf(name) {
    if (!DEEP || !Array.isArray(DEEP.planets)) return null;
    for (var i = 0; i < DEEP.planets.length; i++) if (DEEP.planets[i].planet === name) return DEEP.planets[i];
    return null;
  }

  /** 行星块：七政/四余标签 + 十神主组 + 5 组权重条 */
  function planetsHtml(d) {
    var ps = (d.planets || []).filter(function (p) { return p && p.primary; });`;
  if (fw.includes(OLD)) { fw = fw.replace(OLD, NEW); changed.push('HUD 权重条函数'); }
}

if (!fw.includes('weightsMini(')) {
  console.log('⚠️ 未插入 weightsMini，跳过后续替换');
} else {
  // 2c 有 DEEP 的渲染分支：优先用 DEEP 的数据
  const OLD2 = `    if (ps.length) {
      ps.slice(0, 9).forEach(function (p) {
        var tag = QIZHENG[p.planet] || SIYU[p.planet] || '';
        h += '<div class="h-line"><b>' + esc(p.planet) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (p.house ? ' ' + p.house + '宫' : '') + '</span> ' +
          '<span class="h-tg">' + esc(p.primary.group) + ' ' + Math.round((p.primary.w || 0) * 100) + '%</span></div>';
      });
    } else {`;
  const NEW2 = `    // ★ 有 /api/deep 数据时，十神力量直接长在盘上（不再是独立表）
    var deepList = (DEEP && Array.isArray(DEEP.planets)) ? DEEP.planets : null;
    if (deepList && deepList.length) {
      deepList.slice(0, 10).forEach(function (p) {
        var tag = QIZHENG[p.planet] || SIYU[p.planet] || '';
        var pr = p.primary || {};
        h += '<div class="h-pWithBar">' +
          '<div class="h-line"><b>' + esc(p.planet) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (p.house ? ' ' + p.house + '宫' : '') + '</span>' +
          ' <span class="h-tg" style="border-color:' + (G_COLOR[pr.group] || '#ffc457') + '">' +
          esc(pr.group || '—') + ' ' + Math.round((pr.w || 0) * 100) + '%</span></div>' +
          weightsMini(p.weights) + '</div>';
      });
    } else if (ps.length) {
      ps.slice(0, 9).forEach(function (p) {
        var tag = QIZHENG[p.planet] || SIYU[p.planet] || '';
        h += '<div class="h-line"><b>' + esc(p.planet) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (p.house ? ' ' + p.house + '宫' : '') + '</span> ' +
          '<span class="h-tg">' + esc(p.primary.group) + ' ' + Math.round((p.primary.w || 0) * 100) + '%</span></div>';
      });
    } else {`;
  if (fw.includes(OLD2)) {
    fw = fw.replace(OLD2, NEW2);
    changed.push('HUD 十神权重条');
  } else {
    console.log('⚠️ 行星块未匹配，跳过');
  }

  // 2d 暴露 __fwSetDeep
  if (!fw.includes('window.__fwSetDeep')) {
    fw = fw.replace(
      'window.__fwFullscreen = enter;',
      `window.__fwSetDeep = function (deep) {
    DEEP = deep || null;
    if (host && host.classList.contains('fw-full') && lastData) {
      clearHud(host);
      host.insertAdjacentHTML('beforeend', buildHud(lastData));
    }
  };
  window.__fwFullscreen = enter;`
    );
    changed.push('__fwSetDeep');
  }
}
fs.writeFileSync('web/fw-fullscreen.js', fw, 'utf8');

/* ══════════ ③ 隐藏原独立表（避免割裂）══════════ */
let dp = fs.readFileSync('web/deep-panel.js', 'utf8');
if (!dp.includes('动态十神权重已并入')) {
  dp = dp.replace(
    "  /* ① 动态十神权重 */\n  h += '<div class=\"holo-card wide\"><div class=\"holo-h\">动态十神权重 <span>同一颗星，状态不同则配比不同</span></div>';",
    `  /* ① 动态十神权重 —— 已并入全屏融合盘（盘上每颗行星下方直接显示 5 组权重条） */
  /*
  h += '<div class="holo-card wide"><div class="holo-h">动态十神权重 <span>同一颗星，状态不同则配比不同</span></div>';`
  );
  // 同时给这块加一句指引
  dp = dp.replace(
    "  /* ② 合相双效应 */",
    `  h += '<div class="holo-card wide"><div class="holo-h">动态十神权重 <span>已并入全屏融合盘</span></div>' +
    '<div class="holo-note">排盘后自动进入的全屏融合盘里，<b>每颗行星下方直接显示 5 组十神权重条</b>——' +
    '不再单独列一张表和盘割裂。点行星可看详情，ESC 退出全屏。</div></div>';

  /* ② 合相双效应 */`
  );
  fs.writeFileSync('web/deep-panel.js', dp, 'utf8');
  changed.push('独立表改为指引');
}

/* ══════════ ④ 样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.h-wb')) {
  css += `

/* ══════════ HUD：行星十神权重条 ══════════ */
.h-pWithBar{margin-bottom:5px}
.h-wb{display:flex;width:118px;height:3px;border-radius:2px;overflow:hidden;margin-top:3px;
  background:rgba(255,255,255,.08)}
.h-wb i{display:block;height:100%;opacity:.92}
.fw-hud.tr .h-wb{margin-left:auto}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  changed.push('样式');
}

console.log('改动：', changed.length ? changed.join(' / ') : '无');

/* 校验 */
const f2 = fs.readFileSync('web/fw-fullscreen.js', 'utf8');
const d2 = fs.readFileSync('web/deep-fetch.js', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['deep 回灌 HUD', d2.includes('__fwSetDeep')],
  ['HUD 有 DEEP 变量', f2.includes('DEEP = null')],
  ['HUD 有权重迷你条', f2.includes('function weightsMini')],
  ['HUD 优先用 deep 数据', f2.includes('deepList')],
  ['暴露 __fwSetDeep', f2.includes('window.__fwSetDeep')],
  ['CSS 有 .h-wb', fs.readFileSync('web/style.css', 'utf8').includes('.h-wb')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
