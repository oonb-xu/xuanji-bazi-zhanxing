// ① 双环补「七柱」最外环（融合盘核心）  ② 接入 dw-interact.js  ③ 加详情容器与样式
import fs from 'node:fs';

/* ── ① dual-wheel.js 加七柱最外环 ── */
const W = 'web/dual-wheel.js';
let w = fs.readFileSync(W, 'utf8');
if (w.includes('SEVEN-PILLARS')) console.log('— 七柱已加');
else {
  const OLD = `    /* ── 接缝：ASC / MC 两条贯穿线（外环与内环的旋转量就是它） ── */`;
  const NEW = `    /* ── 接缝：ASC / MC 两条贯穿线 ── */`;
  if (!w.includes(OLD)) { console.error('❌ 未匹配接缝段'); process.exit(1); }
  w = w.replace(OLD, NEW);

  const ANCHOR = `    /* ── 接缝：ASC / MC 两条贯穿线 ── */`;
  const RING = `    /* ── SEVEN-PILLARS：最外环 · 七柱（融合盘的核心，可点击） ── */
    var pNames = ['年柱', '月柱', '日柱', '时柱', '胎元', '命宫', '身宫'];
    if (Array.isArray(pillars) && pillars.length >= 4) {
      var R0 = R1 + 34;
      s += '<circle cx="' + C + '" cy="' + C + '" r="' + R0 + '" fill="none" stroke="rgba(160,200,235,.16)" stroke-dasharray="3 5"/>';
      pillars.slice(0, 4).forEach(function (gz, i) {
        var ang = -90 + i * 90;                       /* 上 右 下 左 */
        var px = C + R0 * Math.cos(ang * Math.PI / 180), py = C + R0 * Math.sin(ang * Math.PI / 180);
        s += '<circle cx="' + px + '" cy="' + py + '" r="19" fill="rgba(6,14,26,.92)" stroke="rgba(255,196,87,.5)"/>';
        s += '<text x="' + px + '" y="' + (py + 5) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#ffe6a8" style="cursor:pointer">' + esc(gz) + '</text>';
        s += '<text x="' + px + '" y="' + (py + 32) + '" text-anchor="middle" font-size="10" fill="rgba(170,205,232,.8)">' + pNames[i] + '</text>';
      });
      /* 胎元/命宫/身宫：右下角竖排（虚线，实验性） */
      var extra = [['胎元', d.bazi.extra && d.bazi.extra.taiYuan], ['命宫', d.bazi.extra && d.bazi.extra.mingGong], ['身宫', d.bazi.extra && d.bazi.extra.shenGong]];
      var ok = extra.filter(function (e2) { return e2[1]; });
      ok.forEach(function (e2, i) {
        var yy = C - R1 + 70 + i * 26;
        s += '<text x="' + (C + R1 - 6) + '" y="' + yy + '" text-anchor="end" font-size="12" fill="rgba(180,215,240,.86)" style="cursor:pointer">' +
          esc(e2[0]) + ' <tspan font-weight="700" fill="#9fe8ff">' + esc(e2[1]) + '</tspan></text>';
      });
    }

    /* ── 接缝：ASC / MC 两条贯穿线 ── */`;
  w = w.replace(ANCHOR, RING);
  fs.writeFileSync(W, w, 'utf8');
  console.log('✅ dual-wheel.js 已加七柱外环');
}

/* ── ② HTML：详情容器 + 引入 dw-interact.js ── */
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak19', h, 'utf8');

if (!h.includes('id="dw-detail"')) {
  const anchor = 'id="dual-wheel-host"';
  const ai = h.indexOf(anchor);
  if (ai < 0) { console.error('❌ 找不到 dual-wheel-host'); process.exit(1); }
  const close = h.indexOf('</div>', ai) + 6;
  h = h.slice(0, close) + '\n        <div id="dw-detail" class="dw-detail"><div class="note">点图上的任意词语（地支 / 藏干 / 宫位 / 紫微宫名 / 行星 / ASC）看详情。</div></div>' + h.slice(close);
  console.log('✅ 已插入 #dw-detail 详情容器');
}
if (!h.includes('/dw-interact.js')) {
  const b = h.lastIndexOf('</body>');
  h = h.slice(0, b) + '  <script src="/dw-interact.js"></script>\n' + h.slice(b);
  console.log('✅ 已引入 dw-interact.js');
}
fs.writeFileSync(P, h, 'utf8');

/* ── ③ CSS ── */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* DW-INTERACT */')) {
  css += `
/* DW-INTERACT —— 可点击词语 + 详情面板 */
.dw-svg text.dw-click{ transition:fill .15s, filter .15s }
.dw-svg text.dw-click:hover{ filter:drop-shadow(0 0 6px currentColor); opacity:1 }
.dw-detail{
  margin-top:12px; padding:12px 14px; border-radius:12px;
  border:1px solid rgba(94,160,220,.18); background:rgba(10,20,32,.55);
  min-height:64px;
}
.dw-detail.on{ border-color:rgba(94,241,255,.42); background:rgba(10,26,40,.72) }
.dw-dt-h{
  font-size:13.5px; font-weight:700; color:#9fe8ff;
  letter-spacing:.04em; margin-bottom:8px;
}
.dw-detail .holo-tb{ margin-top:2px }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ style.css 追加 DW-INTERACT');
}

/* 校验 */
const c = (s2, re) => (s2.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g], ['script', /<script\b/g, /<\/script>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
console.log(bad ? '❌ 标签不平衡' : '✅ 标签平衡');
console.log('index.html', h.length, '字节');
if (bad) process.exit(1);
