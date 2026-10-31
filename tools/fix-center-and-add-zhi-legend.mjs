// ① 圆心：日主 → 地心（观测者）；日主只作为「关系原点」在 HUD 里出现
// ② 融合盘下补「十二地支 · 藏干 · 宫位」对照卡（并说明宫↔支是动态的）
import fs from 'node:fs';

/* ── ①-a fusion3d.js ── */
{
  const P = 'web/fusion3d.js';
  let t = fs.readFileSync(P, 'utf8');
  fs.writeFileSync(P + '.bak-dm', t, 'utf8');
  const OLD = "/* ── 中心：日主 + 太极 ── */";
  const NEW = "/* ── 中心：地心（观测者）+ 太极 ── 日主不在这里：它是十神的关系原点，天球上无位置 ── */";
  if (t.includes(OLD)) { t = t.replace(OLD, NEW); console.log('✅ fusion3d：注释已改'); }
  const OLD2 = "txt(`日主 ${DATA.dm}`, c0.x, c0.y - rr - 12, {";
  const NEW2 = "txt(`⊙ 地心`, c0.x, c0.y - rr - 12, {";
  if (t.includes(OLD2)) { t = t.replace(OLD2, NEW2); console.log('✅ fusion3d：圆心标签 → ⊙ 地心'); }
  else console.log('⚠️ fusion3d：圆心标签未匹配');
  fs.writeFileSync(P, t, 'utf8');
}

/* ── ①-b fusion-wheel.js ── */
{
  const P = 'web/fusion-wheel.js';
  let t = fs.readFileSync(P, 'utf8');
  fs.writeFileSync(P + '.bak-dm', t, 'utf8');
  const OLD = "`日主 ${DATA.dm}`";
  const NEW = "'⊙ 地心'";
  if (t.includes(OLD)) { t = t.replace(OLD, NEW); console.log('✅ fusion-wheel：圆心标签 → ⊙ 地心'); }
  else console.log('⚠️ fusion-wheel：未匹配');
  const OLD3 = "// ─── ④ 中心：日主 + 太极 ───";
  const NEW3 = "// ─── ④ 中心：地心（观测者）+ 太极 —— 日主不画在圆心（它是关系原点，不是空间中心） ───";
  if (t.includes(OLD3)) { t = t.replace(OLD3, NEW3); console.log('✅ fusion-wheel：注释已改'); }
  fs.writeFileSync(P, t, 'utf8');
}

/* ── ② 在融合盘卡片下补对照卡 ── */
const HP = 'web/index.html';
let h = fs.readFileSync(HP, 'utf8');
if (h.includes('id="zhi-cang-legend"')) { console.log('— 对照卡已存在'); }
else {
  const ZHI = [
    ['子', '癸', '1 自我/身体（示例：子宫随 ASC 变）'],
    ['丑', '己 癸 辛', ''],
    ['寅', '甲 丙 戊', ''],
    ['卯', '乙', ''],
    ['辰', '戊 乙 癸', ''],
    ['巳', '丙 戊 庚', ''],
    ['午', '丁 己', ''],
    ['未', '己 丁 乙', ''],
    ['申', '庚 壬 戊', ''],
    ['酉', '辛', ''],
    ['戌', '戊 辛 丁', ''],
    ['亥', '壬 甲', ''],
  ];
  const rows = ZHI.map(([z, cg]) => `            <tr><td class="pn">${z}</td><td>${cg}</td></tr>`).join('\n');
  const CARD = `
      <div class="card" id="zhi-cang-legend" style="margin-top:14px">
        <h3 style="margin:0 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">十二地支 · 藏干 · 与宫位的关系</h3>
        <div class="note" style="margin:0 0 10px">
          <b style="color:#ffc457">藏干是固定查表</b>：地支一确定，藏干就固定，<b>没有任何天文自由度</b>。
          所以「行星落在哪一宫」本身推不出藏干——必须先知道该宫对应的<b>地支</b>。
        </div>
        <table class="holo-tb">
          <thead><tr><th style="width:22%">地支</th><th>藏干（本气 / 中气 / 余气）</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
        <div class="note" style="margin:12px 0 0">
          <b style="color:#5ef1ff">宫位 ↔ 地支 是动态的</b>（这是两套坐标系的分界）：
        </div>
        <table class="holo-tb" style="margin-top:8px">
          <thead><tr><th style="width:24%">坐标环</th><th>锚定于</th><th>是否随人变</th></tr></thead>
          <tbody>
            <tr><td class="pn">外层：黄道 / 十二次 / 十二地支</td><td class="mut">天球黄经（绝对）</td><td><b style="color:#7dffb4">静态</b>——寅永远是 315°–345°（立春→惊蛰）</td></tr>
            <tr><td class="pn">内层：十二宫</td><td class="mut">上升点 ASC（相对观测者）</td><td><b style="color:#ff9a8a">动态</b>——宫 1 起于该盘 ASC，因人因时因纬度而变</td></tr>
            <tr><td class="pn">紫微斗数（对偶写法）</td><td class="mut">地支固定排在圆周</td><td>地支<b>静态</b>、宫名<b>动态</b>（随命宫转）——与上表恰好互为正反</td></tr>
          </tbody>
        </table>
        <div class="note" style="margin:10px 0 0;color:#ffc457">
          ⇒ 所以不存在一张「宫 1 = 子、宫 2 = 丑」的固定表。<b>宫位是外环星座盘与内环宫位盘两种坐标系</b>：
          外层绝对、内层相对；两者之间的旋转量，就是<b>上升点</b>。
        </div>
      </div>
`;
  /* 插到融合页 #fusion-wheel-host 之后 */
  const wh = h.indexOf('id="fusion-wheel-host"');
  if (wh < 0) { console.error('❌ 找不到 fusion-wheel-host'); process.exit(1); }
  const ws = h.lastIndexOf('<section', wh);
  const closeIdx = h.indexOf('</section>', wh);
  if (closeIdx < 0) { console.error('❌ 找不到融合页 </section>'); process.exit(1); }
  h = h.slice(0, closeIdx) + CARD + '    ' + h.slice(closeIdx);
  fs.writeFileSync(HP, h, 'utf8');
  console.log('✅ 已插入「十二地支 · 藏干 · 宫位关系」对照卡');
}

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['table', /<table\b/g, /<\/table>/g],
  ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g], ['th', /<th\b/g, /<\/th>/g],
  ['section', /<section\b/g, /<\/section>/g], ['h3', /<h3\b/g, /<\/h3>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
console.log(bad ? '\n❌ 标签不平衡' : '\n✅ 标签全部平衡');
console.log('index.html', h.length, '字节');
if (bad) process.exit(1);
