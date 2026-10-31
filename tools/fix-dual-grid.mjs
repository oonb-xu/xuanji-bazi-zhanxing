import fs from 'node:fs';
const P = 'web/style.css';
let c = fs.readFileSync(P, 'utf8');
if (c.includes('/* DUAL-WHEEL-GRID-FIX */')) { console.log('已修'); process.exit(0); }
c += `
/* DUAL-WHEEL-GRID-FIX —— 融合页是两栏 grid，带 id 的新卡片不会命中 .card:not([id]) 规则，必须显式跨栏 */
.page.active[data-page="fusion"] > #dual-wheel-card,
.page.active[data-page="fusion"] > #zhi-cang-legend{
  grid-column: 1 / -1 !important;
}
/* 融合盘卡本身也跨栏（避免被压到单栏） */
.page.active[data-page="fusion"] > #fusion-wheel-host{
  grid-column: 1 / -1 !important;
}
`;
fs.writeFileSync(P, c, 'utf8');
console.log('✅ 已加 DUAL-WHEEL-GRID-FIX（三张卡跨两栏）');
