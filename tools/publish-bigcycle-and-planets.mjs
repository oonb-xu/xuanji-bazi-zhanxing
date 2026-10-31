// ① 把大周期实测结果写进关于页（59.58 板块下新增一节）
// ② 双环图补行星点
import fs from 'node:fs';

/* ── ① 关于页新增「大周期精确模型」 ── */
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak18', h, 'utf8');

if (h.includes('id="d5958-bigcycle"')) { console.log('— 大周期节已存在'); }
else {
  const CARD = `
      <div class="card" id="d5958-bigcycle" style="margin-top:14px">
        <h3 style="margin:0 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">
          大周期精确模型 · 用真实星历量出来，而不是线性外推
        </h3>
        <div class="note" style="margin:0 0 10px">
          上一节说的是<b>一阶线性项</b>（久期漂移）。但真实天体轨道误差是<b>长周期</b>的——
          只要周期够长，<b>几百年窗口内完全可以精确建模</b>，不必外推到几千年。
          本节用 <code>astronomy-engine</code> 扫出 <b>1702–2298 年（596 年）全部 31 次木土会合</b>，实测其周期结构。
        </div>
        <table class="holo-tb">
          <thead><tr><th style="width:30%">量</th><th>实测值</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td class="pn">单次会合间隔</td><td>平均 <b>19.8653</b> 年，σ = 0.5052，极差 <b>1.3776</b>（19.13–20.51）</td><td class="mut">理论 19.85899；<b>单次抖得厉害</b></td></tr>
            <tr><td class="pn">3 次会合跨度<br><span class="mut2" style="font-size:11px">（对应「60 年」）</span></td><td>平均 <b>59.58991</b> 年，极差仅 <b>0.119 年（43 天）</b></td><td class="mut">理论 59.576971；<b>三次一组几乎是常数</b></td></tr>
            <tr><td class="pn">与 60 的差</td><td><b>−0.454 ~ −0.366 年</b>（−166 ~ −134 天）</td><td class="mut">稳定在 −5 个月左右</td></tr>
            <tr><td class="pn">会合点黄经推进</td><td>单次 <b>−116.66°</b>；三元组净 <b>+10°</b></td><td class="mut">每 60 年沿黄道挪约 10°</td></tr>
            <tr><td class="pn">绕行一周</td><td>≈ 36 个三元组 ≈ <b>2145 年</b></td><td class="mut">会合点转满 360° 的大周期</td></tr>
            <tr><td class="pn">间隔自相关</td><td>峰值在滞后 <b>3 个会合</b>，<b>r = 0.992</b></td><td class="mut">强周期结构，周期 ≈ 60 年</td></tr>
          </tbody>
        </table>
        <div class="note" style="margin:12px 0 0">
          <b style="color:#7dffb4">这就是「大周期精确运算」的结构</b>：
          误差不是单调漂移，而是
          <b>「≈60 年为节拍的振荡」</b>（r = 0.992）叠加
          <b>「≈2145 年的慢绕行」</b>。
          所以在<b>几百年窗口</b>内，可以用实测的周期表精确修正——不需要线性外推到几千年。
        </div>
        <div class="note" style="margin:10px 0 0;color:#ffc457">
          <b>但要诚实说明两件事</b>：<br>
          ① 单次会合间隔抖动达 ±0.7 年，<b>拿单次会合当"60 年刻度"是不可靠的</b>；必须<b>三次一组</b>才稳定。
          <br>② 上述 59.5899 比理论 59.5770 略大 0.013 年，差异来自<b>行星摄动与所选窗口</b>——
          换窗口数值会微变，说明<b>它是窗口统计量，不是宇宙常数</b>。
        </div>
        <div class="note" style="margin:10px 0 0;font-size:11.5px">
          复现：<code>node tools/bigcycle-v2.mjs</code>（输出 reports/jupiter-saturn-bigcycle.json）
        </div>
      </div>
`;
  /* 插到 59.58 卡片之后 */
  const i = h.indexOf('id="sec-59-58"');
  const s = h.lastIndexOf('<div class="card"', i);
  const re = /<div\b|<\/div>/g; re.lastIndex = s;
  let d = 0, m, e = -1;
  while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { e = m.index + 6; break; } }
  h = h.slice(0, e) + '\n\n      ' + CARD.trim() + h.slice(e);
  fs.writeFileSync(P, h, 'utf8');
  console.log('✅ 已插入「大周期精确模型」卡');
}

/* ── ② 双环图补行星 ── */
const W = 'web/dual-wheel.js';
let w = fs.readFileSync(W, 'utf8');
if (w.includes('DRAW-PLANETS')) console.log('— 行星已加');
else {
  const OLD = `    /* 中心 */`;
  const NEW = `    /* ── DRAW-PLANETS：行星按真实黄经画在内环上 ── */
    var planets = (natal && Array.isArray(natal.planets)) ? natal.planets : [];
    var seen = 0;
    planets.forEach(function (p) {
      var lon = p && (p.lon != null ? p.lon : (p.lng != null ? p.lng : p.longitude));
      if (lon == null || !isFinite(lon)) return;
      seen++;
      var nm = p.name || p.planet || '';
      var short = { '太阳': '日', '月亮': '月', '水星': '水', '金星': '金', '火星': '火', '木星': '木', '土星': '土', '天王星': '天', '海王星': '海', '冥王星': '冥' }[nm] || nm.slice(0, 1);
      var col = { '日': '#ffd58a', '月': '#dfe9f5', '水': '#9fe8ff', '金': '#ffb3c8', '火': '#ff9a8a', '木': '#ffc457', '土': '#b48cff', '天': '#7dffb4', '海': '#5ef1ff', '冥': '#c08cff' }[short] || '#8fb8d8';
      var px = x(lon, R4 - 8), py = y(lon, R4 - 8);
      s += '<circle cx="' + px + '" cy="' + py + '" r="5.4" fill="' + col + '" opacity=".92"/>';
      s += '<text x="' + px + '" y="' + (py - 9) + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + col + '">' + esc(short) + '</text>';
    });

    /* 中心 */`;
  if (!w.includes(OLD)) { console.error('❌ dual-wheel 未匹配中心段'); process.exit(1); }
  w = w.replace(OLD, NEW);
  fs.writeFileSync(W, w, 'utf8');
  console.log('✅ dual-wheel.js 已加行星绘制');
}

/* 校验 */
const c = (s2, re) => (s2.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['table', /<table\b/g, /<\/table>/g],
  ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g], ['th', /<th\b/g, /<\/th>/g], ['section', /<section\b/g, /<\/section>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
console.log(bad ? '❌ 标签不平衡' : '✅ 标签平衡');
console.log('index.html', h.length, '字节');
if (bad) process.exit(1);
