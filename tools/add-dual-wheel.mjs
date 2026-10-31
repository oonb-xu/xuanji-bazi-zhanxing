// 在融合页插入双环对照容器 + 引入 dual-wheel.js
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak16', h, 'utf8');

/* ① 容器：放在 #zhi-cang-legend 卡之前 */
if (!h.includes('id="dual-wheel-host"')) {
  const anchor = '<div class="card" id="zhi-cang-legend"';
  const ai = h.indexOf(anchor);
  if (ai < 0) { console.error('❌ 找不到 zhi-cang-legend 锚点'); process.exit(1); }
  const cardStart = h.lastIndexOf('<div', ai);
  const CARD = `      <div class="card" id="dual-wheel-card" style="margin-top:14px">
        <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;color:#5ef1ff">外盘 ＋ 内盘 · 两套坐标系的接缝</h3>
        <p class="note" style="margin:0 0 10px">
          <b>外环</b>是黄道（十二地支 + 藏干），锚定天球，<b>永恒不动</b>；
          <b>内环</b>是宫位（带紫微十二宫名），锚定你这张盘的<b>上升点</b>，<b>因人而转</b>。
          两环之间的旋转量，就是 ASC。
        </p>
        <div id="dual-wheel-host"><div class="note">排盘后自动绘制…</div></div>
      </div>

`;
  h = h.slice(0, cardStart) + CARD + h.slice(cardStart);
  console.log('✅ 已插入双环容器 #dual-wheel-host');
} else console.log('— 容器已存在');

/* ② 引入脚本 */
if (!h.includes('/dual-wheel.js')) {
  const b = h.lastIndexOf('</body>');
  h = h.slice(0, b) + '  <script src="/dual-wheel.js"></script>\n' + h.slice(b);
  console.log('✅ 已引入 dual-wheel.js');
}

/* ③ CSS */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* DUAL-WHEEL */')) {
  css += `
/* DUAL-WHEEL —— 外盘/内盘 双环对照 */
#dual-wheel-host{ margin-top:6px }
.dw-svg{ width:100%; max-width:660px; height:auto; display:block; margin:0 auto }
.dw-legend{
  display:flex; flex-wrap:wrap; gap:8px 18px;
  font-size:11.5px; line-height:1.8; color:rgba(175,205,230,.82);
  margin:0 0 8px; padding:8px 12px;
  border:1px solid rgba(94,160,220,.16); border-radius:10px;
  background:rgba(12,24,38,.4);
}
.dw-legend b{ color:#e8f4ff }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ style.css 追加 DUAL-WHEEL');
}

fs.writeFileSync(P, h, 'utf8');

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g], ['p', /<p\b/g, /<\/p>/g], ['h3', /<h3\b/g, /<\/h3>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
console.log(bad ? '❌ 标签不平衡' : '✅ 标签平衡');
console.log('index.html', h.length, '字节');
if (bad) process.exit(1);
