// 收尾优化：
//  ① 实验柱标签去掉「（实验）」后缀（避免七分位重叠），改用「虚线圈位 + 暗色 + 右上说明」
//  ② 说明栏提高对比度
import fs from 'node:fs';

let s = fs.readFileSync('web/fusion-wheel.js', 'utf8');

// 标签恢复纯名称，实验柱用更暗的颜色 + 更小字号区分
s = s.replace(
  "      text(isExtra ? PILLAR_NAMES[i] + '（实验）' : PILLAR_NAMES[i], base, R * 1.52, { color: isExtra ? 'rgba(255,196,87,0.42)' : 'rgba(255,196,87,0.55)', size: isExtra ? 9 : 10 });",
  `      // 实验柱：柱名后跟一个小圆点标记，不写字（避免七分位重叠）
      text(PILLAR_NAMES[i], base, R * 1.53, { color: isExtra ? 'rgba(255,196,87,0.38)' : 'rgba(255,196,87,0.60)', size: 10 });
      if (isExtra) {
        const dot = proj(base, R * 1.63);
        ctx.save();
        ctx.globalAlpha = dot.depth > 0 ? 0.7 : 0.35;
        ctx.fillStyle = 'rgba(255,196,87,0.55)';
        ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }`
);

fs.writeFileSync('web/fusion-wheel.js', s, 'utf8');
console.log('① 实验柱标签已简化');

/* ② 说明栏提高对比度 + 加图例 */
let h = fs.readFileSync('web/index.html', 'utf8');
h = h.replace(
  '<div class="fw-note">胎元 / 命宫 / 身宫 为<b>实验性展示</b>，不参与排盘与身强弱判定</div>',
  '<div class="fw-note"><b>●</b> 四柱（实线·参与排盘与判定）<br><span class="exp">● 胎元/命宫/身宫（虚线·实验展示，不参与判定）</span></div>'
);
fs.writeFileSync('web/index.html', h, 'utf8');
console.log('② 图例已改');

/* ③ 样式 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.fw-note .exp')) {
  css = css.replace(
    `.fw-note{
  position:absolute;right:16px;top:14px;z-index:4;pointer-events:none;
  font-size:10.5px;line-height:1.7;color:rgba(255,196,87,.55);
  text-align:right;max-width:300px;letter-spacing:.04em;
}
.fw-note b{color:rgba(255,213,138,.9)}`,
    `.fw-note{
  position:absolute;right:16px;top:14px;z-index:5;pointer-events:none;
  font-size:11px;line-height:1.85;color:rgba(255,213,138,.92);
  text-align:right;max-width:320px;letter-spacing:.03em;
  background:rgba(6,14,20,.62);padding:6px 10px;border-radius:8px;
  border:1px solid rgba(255,196,87,.16);
}
.fw-note b{color:#ffd58a;font-size:9px;vertical-align:middle;margin-right:5px}
.fw-note .exp{color:rgba(255,196,87,.50);font-size:10px}
.fw-note .exp::first-letter{font-size:9px}`
  );
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ 说明栏样式已加强');
}
