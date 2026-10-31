// ② 关于页「开源与数据」之前新增章节   ③ 导航插入第 11 项并重编号
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-develop', h, 'utf8');

/* ── ② 新章节 ── */
if (h.includes('id="sec-develop"')) { console.log('— 新章节已存在'); }
else {
  const CARD = `
      <div class="card" id="sec-develop">
        <h2>这种融合体系该怎么发展 <span class="sub">先对账，再融合</span></h2>

        <p class="note" style="margin:0 0 12px">
          这一节不谈技术，谈<b>为什么这件事一直没做成</b>，以及<b>如果要做成，顺序应该是什么</b>。
        </p>

        <h3 style="margin:16px 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">一、七政四余为什么会落寞失传</h3>
        <table class="holo-tb">
          <thead><tr><th style="width:20%">原因</th><th>具体机制</th></tr></thead>
          <tbody>
            <tr><td class="pn">门槛过高</td><td class="mut">要用到真实星历、宿度、岁差、四余（交点/远地点），每一步都要算；而子平术只需查表加减</td></tr>
            <tr><td class="pn">历学垄断</td><td class="mut">历代钦天监把历法与星占列为禁学，民间私习天文有罪（唐至明皆有禁令）</td></tr>
            <tr><td class="pn">术语壁垒</td><td class="mut">庙旺、喜忌、四余层层堆叠，外行<b>无法验证</b>，只能信或不信</td></tr>
            <tr><td class="pn">断语靠师承</td><td class="mut">结论无法机检，传承一断就彻底失传</td></tr>
            <tr><td class="pn">竞争劣势</td><td class="mut">子平术用<b>最少输入</b>给出<b>最直接的话</b>，传播成本极低</td></tr>
            <tr><td class="pn">西学东渐</td><td class="mut">清以后西方占星以"新式"面貌进入，七政四余夹在中西之间，<b>两边都不认它</b></td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0;color:#ffc457">
          ⇒ <b>它不是"因为不准"而消失，而是"成本太高、无法验证、无法普及"而消失。</b>
          这一点很重要：<b>失传不等于失效</b>，也可能只是输给了传播效率。
        </p>

        <h3 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">二、为什么融合总是艰难</h3>
        <table class="holo-tb">
          <thead><tr><th style="width:18%">层面</th><th>冲突来源</th></tr></thead>
          <tbody>
            <tr><td class="pn">输入</td><td class="mut">一个要求精确到分钟 + 经纬度，一个只要年月日时</td></tr>
            <tr><td class="pn">编码</td><td class="mut">几何编码 vs 计数编码（年柱、日柱）—— 两套不同性质的对象被当成同类</td></tr>
            <tr><td class="pn">权威</td><td class="mut">各有祖师、各有经典，方法论互不承认</td></tr>
            <tr><td class="pn">可检验性</td><td class="mut">断语模糊，<b>无法判定谁对</b>，于是只能比资历</td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0">
          <b>根本原因</b>：大家一直在<b>符号层</b>对话（十神 vs 宫位 vs 星曜），
          从来没有回到<b>几何层</b>做核对。符号层没有共同尺子，所以永远谈不拢。
        </p>

        <h3 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">三、两个体系的人，对彼此的偏见</h3>
        <table class="holo-tb">
          <thead><tr><th style="width:20%">偏见</th><th style="width:34%">表现</th><th>事实</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">中式看西学</td>
              <td class="mut">"占星只会说性格，算不了事"</td>
              <td class="mut">古典占星本有<b>事件预测</b>传统，只是现代心理占星把它弱化了</td>
            </tr>
            <tr>
              <td class="pn">西学看中式</td>
              <td class="mut">"八字是宿命论，不自由"</td>
              <td class="mut">十神是<b>关系</b>不是宿命；但它确实缺少"自由意志"这一层语言</td>
            </tr>
            <tr>
              <td class="pn">双方共同</td>
              <td class="mut">"对方是伪科学"</td>
              <td class="mut">双方都缺少<b>可复现的验证机制</b> —— 这是共同短板，不是一方的问题</td>
            </tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0">
          <b>有意思的是</b>：这两套体系<b>同源于巴比伦黄道十二宫</b>（见第二节）。
          吵得最凶的两家，其实是一个祖先 —— 偏见来自<b>中断的记忆</b>，不是来自本质差异。
        </p>

        <h3 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">四、融合艰难的底层原因：没有从最底层的天文数据做精确核算</h3>
        <p class="note" style="margin:0 0 10px">
          这是本文最核心的一个判断，也是这个项目<b>真正的起点</b>：
        </p>
        <ul class="note" style="margin:0 0 10px;padding-left:22px;line-height:2">
          <li>四套体系都在<b>符号层</b>互相翻译，<b>没人回到几何层对账</b>；</li>
          <li>八字的月支本来<b>严格绑定太阳黄经</b>（恒等），但没人去核算过；</li>
          <li>七政四余的宿度会随<b>岁差</b>漂移（约 50.29″/年），但没人标出来；</li>
          <li>60 甲子被当成"天意"，没人算过它和木土会合之间那 <b>0.423 年</b>的差。</li>
        </ul>
        <p class="note" style="margin:0 0 10px">
          所以这个项目做的第一件事<b>不是"融合"，而是"对账"</b>：
        </p>
        <table class="holo-tb">
          <thead><tr><th style="width:34%">对账项</th><th>实测结果</th></tr></thead>
          <tbody>
            <tr><td class="pn">月支 ↔ 太阳黄经</td><td><b style="color:#7dffb4">恒等 100%</b>（节气就是黄经 30° 刻度）</td></tr>
            <tr><td class="pn">时支 ↔ 太阳时角</td><td><b style="color:#ffc457">67.5%</b>（需均时差 + 真太阳时，边界附近差一位）</td></tr>
            <tr><td class="pn">60 甲子 ↔ 木土会合</td><td><b>3 次会合 = 59.58991 年</b>，极差仅 0.119 年（43 天）</td></tr>
            <tr><td class="pn">命宫 ↔ 上升点 ASC</td><td><b style="color:#7dffb4">结构对应</b>（命宫 = f(月支, 时支) ≈ ASC 的粗糙算法）</td></tr>
            <tr><td class="pn">年柱/日柱 ↔ 逆星历</td><td><b>可推但需转一道</b>：星位 → 绝对日期 → 历法锚点 → 干支</td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0;color:#ffc457">
          ⇒ <b>对完账之后，"融合"才不是比附，而是"在同一把尺子上量出来的结果"。</b>
        </p>

        <h3 style="margin:20px 0 8px;font-size:15px;font-weight:700;color:#5ef1ff">五、所以应该怎么发展：四步顺序不能颠倒</h3>
        <table class="holo-tb">
          <thead><tr><th style="width:14%">步骤</th><th>做法</th></tr></thead>
          <tbody>
            <tr><td class="pn">① 先对账</td><td class="mut">把每个量的物理锚点标清楚：<b>能算的算，不能算的明确标"计数"</b>，绝不假装差一点</td></tr>
            <tr><td class="pn">② 再分层</td><td class="mut">几何层 / 计数层 / 符号层，各层不越界 —— 不让符号层的结论去冒充几何层的证据</td></tr>
            <tr><td class="pn">③ 后验证</td><td class="mut">用<b>事件样本</b>（出生时间 + 事例）做统计检验，而不是靠祖师权威或个案神验</td></tr>
            <tr><td class="pn">④ 最后才解释</td><td class="mut">有了统计支撑，再谈"为什么" —— 否则解释只是事后编故事</td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:12px 0 0;font-size:13.5px;color:#9fe8ff">
          <b>一句话</b>：这个体系要发展，不是靠"更玄"，而是靠
          <b>更可算、更可验、更可复现</b>。
          七政四余当年输在"成本"上，那就把成本降到能算；八字赢在"可机算"上，那就把它的物理锚点补回去。
        </p>
        <p class="note" style="margin:10px 0 0;font-size:11.5px;color:rgba(160,200,225,.75)">
          说明：本节是<b>立场与判断</b>，不是已完成的证明。文中「对账」各项的实测数据可在
          <a href="#sec-59-58" style="color:#5ef1ff">59.58 假说</a> 与
          <a href="#sec-experiment" style="color:#5ef1ff">实验性板块</a> 中复核。
        </p>
      </div>
`;
  const si = h.indexOf('id="sec-credits"');
  if (si < 0) { console.error('❌ 找不到 sec-credits'); process.exit(1); }
  const cardStart = h.lastIndexOf('<div class="card"', si);
  if (cardStart < 0) { console.error('❌ 找不到 sec-credits 所在卡片'); process.exit(1); }
  h = h.slice(0, cardStart) + CARD.trim() + '\n\n      ' + h.slice(cardStart);
  console.log('✅ 已插入「这种融合体系该怎么发展」（在 开源与数据 卡片之前）');
}

/* ── ③ 导航 ── */
if (!h.includes('href="#sec-develop"')) {
  const OLD11 = '<a href="#sec-credits" class="toc-i"><b>11</b><span>开源与数据</span><i>逐条署名</i></a>';
  const OLD12 = '<a href="#sec-license" class="toc-i"><b>12</b><span>开源许可</span><i>Apache-2.0</i></a>';
  if (!h.includes(OLD11) || !h.includes(OLD12)) { console.error('❌ 导航项未匹配'); process.exit(1); }
  const NEW = '<a href="#sec-develop" class="toc-i"><b>11</b><span>这种融合体系怎么发展</span><i>先对账，再融合</i></a>'
    + '<a href="#sec-credits" class="toc-i"><b>12</b><span>开源与数据</span><i>逐条署名</i></a>'
    + '<a href="#sec-license" class="toc-i"><b>13</b><span>开源许可</span><i>Apache-2.0</i></a>';
  h = h.replace(OLD11 + OLD12, NEW);
  console.log('✅ 导航：新增第 11 项，原 11/12 → 12/13');
}

fs.writeFileSync(P, h, 'utf8');

/* 校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g],
  ['th', /<th\b/g, /<\/th>/g], ['p', /<p\b/g, /<\/p>/g], ['ul', /<ul\b/g, /<\/ul>/g], ['li', /<li\b/g, /<\/li>/g], ['a', /<a\b/g, /<\/a>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
const app = h.indexOf('<div id="app"');
const at = h.indexOf('>', app) + 1;
const r3 = /<div\b|<\/div>/g; r3.lastIndex = at;
let d3 = 1, m3, appEnd = -1;
while ((m3 = r3.exec(h))) { d3 += m3[0] === '</div>' ? -1 : 1; if (d3 === 0) { appEnd = m3.index; break; } }
const inApp = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline', 'about'].every((k) => {
  const p = h.indexOf('data-page="' + k + '"'); return p > app && p < appEnd;
});
if (!inApp) { bad++; console.log('  ❌ #app 未包住全部页面'); }
const tu = h.indexOf('id="about-toc"');
const toc = h.slice(tu, tu + 5000);
const tocN = (toc.match(/class="toc-i"/g) || []).length;
console.log((bad ? '❌ ' : '✅ ') + '标签平衡 · #app 完整 · 导航 ' + tocN + ' 项 · ' + h.length + ' 字节');
process.exit(bad ? 1 : 0);
