// 关于页间距与标题一致性（视觉收拢，不动结构）
import fs from 'node:fs';
let css = fs.readFileSync('web/style.css', 'utf8');

if (!css.includes('关于页 · 收敛间距')) {
  css += `

/* ══════════ 关于页 · 收敛间距与标题一致性 ══════════ */
/* ① 卡片统一紧凑，去掉过大间隔 */
.page[data-page="about"] .card{margin:0 0 12px}
.page[data-page="about"] .card:last-child{margin-bottom:0}

/* ② 落在卡片外的区块标题：统一成小号青色、上下留合理距离 */
.page[data-page="about"] > h2{
  margin:20px 0 8px;font-size:15px;font-weight:700;letter-spacing:.08em;
  color:#5ef1ff;line-height:1.5;
}
.page[data-page="about"] > h2:first-of-type{margin-top:0}

/* ③ 卡片内的标题：首次不留上边距，避免顶部空一块 */
.page[data-page="about"] .card > h2:first-child,
.page[data-page="about"] .card > .note:first-child{margin-top:0}

/* ④ 卡片内的 .note 段落间距收紧 */
.page[data-page="about"] .card > .note + .note{margin-top:10px}
.page[data-page="about"] .note p{margin:6px 0}
.page[data-page="about"] .note ul{margin:6px 0 6px 18px}

/* ⑤ 标题与卡片之间不留大缝 */
.page[data-page="about"] > h2 + .card{margin-top:0}

/* ⑥ 卡片内表格不要太挤 */
.page[data-page="about"] .holo-tb{margin:8px 0 0}

/* ⑦ 页标题统一 */
.page[data-page="about"] > .page-title{margin:0 0 14px}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ 关于页间距样式已加');
} else console.log('已有样式');

/* 量一下底部累计 margin 是否会叠加过大 */
const h = fs.readFileSync('web/index.html', 'utf8');
console.log('\n卡片数（关于页）:', (h.slice(h.indexOf('data-page="about"'), h.indexOf('data-page="fusion"')).match(/<div class="card/g) || []).length);
