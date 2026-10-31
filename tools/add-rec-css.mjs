// 定格渲染模式：让 1280x720 的 #frame 以 zoom:1.5 铺满 1920x1080（文字重光栅化，非拉伸）
import fs from 'node:fs';
const P = 'web/video-intro.html';
let t = fs.readFileSync(P, 'utf8');

if (t.includes('__REC_CSS__')) { console.log('— 渲染 CSS 已存在'); process.exit(0); }

const CSS = `
/* __REC_CSS__ 定格渲染：?rec=1 时把 1280x720 的 frame 放大 1.5 倍铺满 1920x1080 */
html.rec-mode, html.rec-mode body { width:100%; height:100%; overflow:hidden; }
html.rec-mode #stage { padding:0; }
html.rec-mode #frame { zoom:1.5; border-radius:0; box-shadow:none; }
html.rec-mode .scene { padding:56px 74px; }
</style>`;

if (!t.includes('</style>')) { console.error('❌ 找不到 </style>'); process.exit(1); }
t = t.replace('</style>', CSS.trim());

/* 在 recMode 里给 <html> 打标记 */
const anchor = "    if (q.get('rec') !== '1') return;";
if (!t.includes(anchor)) { console.error('❌ 找不到 recMode 锚点'); process.exit(1); }
t = t.replace(anchor, anchor + "\n    document.documentElement.classList.add('rec-mode');");

fs.writeFileSync(P, t, 'utf8');
console.log('✅ 已加定格渲染 CSS（zoom:1.5 → 1920x1080 铺满）');
