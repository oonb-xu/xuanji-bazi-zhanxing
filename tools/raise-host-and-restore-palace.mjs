// ① 3D 盘加高到 860（腾出垂直空间） ② 恢复宫位/紫微环，两环都放到 3D 圆盘之外
import fs from 'node:fs';

/* ① CSS：加高 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('/* FW-HOST-TALL */')) {
  css += `
/* FW-HOST-TALL —— 给外环层腾出空间（3D 盘按 min(W,H) 自适应，不会被拉扁） */
#fusion-wheel-host{ min-height:860px }
@media (max-width:900px){ #fusion-wheel-host{ min-height:640px } }
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ CSS：#fusion-wheel-host min-height 860');
}

/* ② 恢复宫位环 + 半径改用「3D 圆盘实际外沿」基准 */
const P = 'web/fw-ring-overlay.js';
let t = fs.readFileSync(P, 'utf8');

t = t.replace('var SHOW_PALACE = false;', 'var SHOW_PALACE = true;');

const OLD = `    var base = Math.min(W, H) * 0.34;          /* 与 3D 盘同一基准半径 */
    var rMid = base + 30;                       /* 宫位/紫微环 */
    var rOut = base + 66;                       /* 地支环 */
    var canFit = rOut + 24 < Math.min(W, H) / 2;
    if (!canFit) { rOut = Math.min(W, H) / 2 - 24; rMid = rOut - 34; }`;
const NEW = `    var base = Math.min(W, H) * 0.34;          /* 3D 盘的基准半径 */
    var half = Math.min(W, H) / 2;
    /* 3D 盘透视外沿实测约为基准半径的 1.22~1.25 倍，取 0.42 作为两环的起点，保证在盘外 */
    var edge = Math.min(W, H) * 0.42;
    var w1 = Math.max(26, Math.min(32, half - edge - 66));   /* 环宽 */
    var gap = 4;
    var rGongIn = edge, rGongOut = edge + w1;
    var rZhiIn = rGongOut + gap, rZhiOut = rGongOut + gap + w1;
    if (rZhiOut > half - 8) {                                 /* 兜底压缩 */
      var avail = half - 8 - edge;
      w1 = Math.max(16, (avail - gap) / 2);
      rGongOut = edge + w1; rZhiIn = rGongOut + gap; rZhiOut = rZhiIn + w1;
    }`;
if (!t.includes(OLD)) { console.error('❌ 未匹配半径段'); process.exit(1); }
t = t.replace(OLD, NEW);

/* 地支环段落改用新变量名 */
t = t.replace(/rOut \+ 8/g, 'rZhiOut + 8')
     .replace(/rOut \+ 20/g, 'rZhiOut + 20')
     .replace(/rOut \+ 4/g, 'rZhiOut + 4')
     .replace(/\(rOut \+ rMid\) \/ 2/g, '(rZhiOut + rZhiIn) / 2')
     .replace(/pt\(a0, rOut\)/g, 'pt(a0, rZhiOut)')
     .replace(/A' \+ rOut \+ ',' \+ rOut/g, "A' + rZhiOut + ',' + rZhiOut")
     .replace(/pt\(a1, rOut\)/g, 'pt(a1, rZhiOut)')
     .replace(/rMid \+ 4/g, 'rZhiIn')
     .replace(/pt\(a0, rMid \+ 4\)/g, 'pt(a0, rZhiIn)');

/* 宫位环段落改用新变量名 */
t = t.replace(/pt\(c0, rMid\)/g, 'pt(c0, rGongIn)')
     .replace(/A' \+ rMid \+ ',' \+ rMid/g, "A' + rGongIn + ',' + rGongIn")
     .replace(/pt\(g1, rMid\)/g, 'pt(g1, rGongIn)')
     .replace(/pt\(g1, base \+ 10\)/g, 'pt(g1, rGongOut)')
     .replace(/A' \+ \(base \+ 10\) \+ ',' \+ \(base \+ 10\)/g, "A' + rGongOut + ',' + rGongOut")
     .replace(/pt\(c0, base \+ 10\)/g, 'pt(c0, rGongOut)')
     .replace(/X\(mh, rMid - 9\)/g, 'X(mh, rGongOut - 9)')
     .replace(/Y\(mh, rMid - 9\)/g, 'Y(mh, rGongOut - 9)')
     .replace(/X\(mh, base \+ 22\)/g, 'X(mh, rGongIn + 13)')
     .replace(/Y\(mh, base \+ 22\)/g, 'Y(mh, rGongIn + 13)')
     .replace(/X\(mh, base \+ 34\)/g, 'X(mh, rGongIn + 26)')
     .replace(/Y\(mh, base \+ 34\)/g, 'Y(mh, rGongIn + 26)');

/* ASC/MC 内端不要穿到盘心 */
t = t.replace(/X\(asc, base - 20\)/g, 'X(asc, edge - 14)').replace(/Y\(asc, base - 20\)/g, 'Y(asc, edge - 14)')
     .replace(/X\(mc, base - 20\)/g, 'X(mc, edge - 14)').replace(/Y\(mc, base - 20\)/g, 'Y(mc, edge - 14)');

fs.writeFileSync(P, t, 'utf8');
console.log('✅ 宫位环已恢复（SHOW_PALACE=true），两环都以 edge=min(W,H)*0.42 为起点');
console.log('   还有 rOut/rMid 残留: ' + (/\brOut\b|\brMid\b/.test(t) ? '⚠️ 是' : '无'));
