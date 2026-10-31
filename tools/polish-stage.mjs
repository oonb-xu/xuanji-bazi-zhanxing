// 修两处：
//  ① 行星标签重叠（"海王星星"）→ 贪心去重：与已画标签太近就跳过，或沿半径外推
//  ② 左侧导航顶部空隙
import fs from 'node:fs';

let js = fs.readFileSync('web/stage.js', 'utf8');

// ── ① 标签去重：改 draw() 里的行星 label 段 ──
const OLD = `    if (hot || front) {
      label(p.name, p.lon, R * 0.94, { color: hot ? '#ffffff' : 'rgba(148,230,255,0.8)', size: hot ? 13 : 11 });
    }`;

const NEW = `    if (hot || front) {
      // 去重：与已放置的标签屏幕距离太近就沿半径外推，仍冲突则丢弃
      const cand = project(p.lon, R * 0.94);
      let placed = false;
      for (const tryR of [0.94, 1.02, 1.10]) {
        const q = project(p.lon, R * tryR);
        const clash = placedLabels.some((L) => Math.hypot(L.x - q.x, L.y - q.y) < 26);
        if (!clash) {
          placedLabels.push(q);
          label(p.name, p.lon, R * tryR, { color: hot ? '#ffffff' : 'rgba(148,230,255,0.8)', size: hot ? 13 : 11 });
          placed = true;
          break;
        }
      }
      if (!placed && hot) {
        // 高亮项无论如何都要显示
        label(p.name, p.lon, R * 1.10, { color: '#ffffff', size: 13 });
      }
    }`;

if (js.includes(OLD)) {
  js = js.replace(OLD, NEW);
  // 在行星循环开始前声明 placedLabels
  js = js.replace('  for (const p of PLANETS) {', '  const placedLabels = [];\n  for (const p of PLANETS) {');
  console.log('① 行星标签去重已加');
} else console.log('① ⚠️ 未匹配到行星 label 段');

// ── ③ 地支标签也不要压到标题：把外圈标签往下收一点（画布中心略下移） ──
js = js.replace('cy = H / 2 + 10;', 'cy = H / 2 + 26;');

fs.writeFileSync('web/stage.js', js, 'utf8');

// ── ② 左侧导航空隙：让 tabbar 顶到底 ──
let css = fs.readFileSync('web/style.css', 'utf8');
css = css.replace(
  '.tabbar{\n    position:fixed;left:0;top:56px;bottom:0;width:104px;',
  '.tabbar{\n    position:fixed;left:0;top:0;bottom:0;width:104px;padding-top:66px;'
);
css += `

/* 侧栏首项与站名对齐；避免顶部空块 */
@media(min-width:900px){
  .tabbar{background:linear-gradient(180deg,#060d16 0%,#050a11 40%,#04080c 100%)}
  .tabbar button[data-go="stage"]{margin-bottom:10px;border-bottom:1px solid rgba(0,229,255,.10);border-radius:10px 10px 0 0}
  .topbar{padding-left:120px}
}
`;
fs.writeFileSync('web/style.css', css, 'utf8');
console.log('② 侧栏样式已修');
