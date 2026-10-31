// 明确标注：胎元/命宫/身宫 = 实验性展示，不参与排盘与身强弱判定
import fs from 'node:fs';

/* ① 圆盘：实验柱用虚线 + 更暗，并加图例 */
let s = fs.readFileSync('web/fusion-wheel.js', 'utf8');

// 实验柱的刻度线改虚线（视觉区分）
s = s.replace(
  "      radialLine(base, R * 1.18, R * 1.30, isExtra ? 'rgba(255,196,87,0.28)' : 'rgba(255,196,87,0.45)', 1);",
  `      if (isExtra) {
        // ★ 实验柱：虚线 + 更暗，与四柱明确区分
        const a0 = ((base + state.rot) * Math.PI) / 180, tt = tiltRad();
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, Math.cos(tt));
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * R * 1.18, Math.sin(a0) * R * 1.18);
        ctx.lineTo(Math.cos(a0) * R * 1.30, Math.sin(a0) * R * 1.30);
        ctx.strokeStyle = 'rgba(255,196,87,0.26)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]); ctx.stroke(); ctx.restore();
      } else {
        radialLine(base, R * 1.18, R * 1.30, 'rgba(255,196,87,0.45)', 1);
      }`
);

// 实验柱的柱名加「实验」后缀
s = s.replace(
  "      text(PILLAR_NAMES[i], base, R * 1.52, { color: isExtra ? 'rgba(255,196,87,0.40)' : 'rgba(255,196,87,0.55)', size: 10 });",
  "      text(isExtra ? PILLAR_NAMES[i] + '（实验）' : PILLAR_NAMES[i], base, R * 1.52, { color: isExtra ? 'rgba(255,196,87,0.42)' : 'rgba(255,196,87,0.55)', size: isExtra ? 9 : 10 });"
);

// tooltip 标注
s = s.replace(
  "    const tag = h.i >= 4 ? '（补充柱）' : '';",
  "    const tag = h.i >= 4 ? '（实验柱 · 不参与排盘与身强弱判定）' : '（四柱 · 参与排盘与判定）';"
);

fs.writeFileSync('web/fusion-wheel.js', s, 'utf8');
console.log('① 圆盘已标注实验柱');

/* ② 页面上加说明条 */
let h = fs.readFileSync('web/index.html', 'utf8');
if (!h.includes('fw-note')) {
  h = h.replace(
    '<div class="fw-hint">拖动旋转 · 滚轮缩放 · 悬停看中西对照</div>',
    '<div class="fw-hint">拖动旋转 · 滚轮缩放 · 悬停看中西对照</div>\n        <div class="fw-note">胎元 / 命宫 / 身宫 为<b>实验性展示</b>，不参与排盘与身强弱判定</div>'
  );
  fs.writeFileSync('web/index.html', h, 'utf8');
  console.log('② 说明条已加');
}

/* ③ 样式 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.fw-note')) {
  css += `

/* ══════════ 融合盘：实验柱说明 ══════════ */
.fw-note{
  position:absolute;right:16px;top:14px;z-index:4;pointer-events:none;
  font-size:10.5px;line-height:1.7;color:rgba(255,196,87,.55);
  text-align:right;max-width:300px;letter-spacing:.04em;
}
.fw-note b{color:rgba(255,213,138,.9)}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ 样式已加');
}
