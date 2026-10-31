// 宣传视频：在末幕之后追加「新探索」分幕（逆向复现 / 三层 / 大周期 / 双环 / 发展论 / 自我推翻 / 收束）
import fs from 'node:fs';
const P = 'web/video-intro.html';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-scenes', t, 'utf8');

if (t.includes('逆向复现 · 我们换了问法')) { console.log('— 新分幕已存在'); process.exit(0); }

const SCENES = `
  <!-- ══════════ 以下为「新探索」分幕（2026-10 增补）══════════ -->

  <!-- ⑥ 逆向复现方法论 -->
  <section class="scene" data-dur="10500">
    <div class="eyebrow">新方法论 · 七政四余逆向复现</div>
    <h2>不再问「怎么对应」，<br>而是问「各自<b class="gold">丢掉了哪一环</b>」</h2>
    <p class="mut" style="margin-top:14px">四套体系里，只有<b class="cyan">七政四余</b>保持「天体位置 → 宫次宿度 → 人事」的<b>全程可追溯</b>。
      它是唯一"每一环都还有物理对应物"的体系 —— 所以拿它当骨架，反推其余三套在哪一步截断。</p>
    <table>
      <thead><tr><th style="width:22%">体系</th><th style="width:32%">保留的天文量</th><th>切断后换成了什么</th></tr></thead>
      <tbody>
        <tr><td class="pn">七政四余</td><td>七政 + 四余的宿度与黄经</td><td><b class="green">全链保留</b> ⇒ 骨架</td></tr>
        <tr><td class="pn">古典占星</td><td>黄经 → 星座 / 宫位</td><td>人事侧换成 <b>心理轴</b>，宫位变「领域标签」</td></tr>
        <tr><td class="pn">八字</td><td>太阳黄经（月支）、时角（时支）</td><td><b>年柱日柱换成纯计数</b>，与天体脱钩</td></tr>
        <tr><td class="pn">紫微斗数</td><td>无（只用农历月日时）</td><td>全链 <b>符号化</b>，只留「地支↔星↔宫」排布</td></tr>
      </tbody>
    </table>
    <p class="mut" style="margin-top:12px">这不是高下，是<b>不同的编码选择</b>：八字用计数换<b class="cyan">可机算</b>，
      紫微用符号化换<b class="cyan">强结构</b>，占星用心理轴换<b class="cyan">细腻</b> —— 代价是同一个：某一环的物理可追溯性被切断。</p>
  </section>

  <!-- ⑦ 三层结构 -->
  <section class="scene" data-dur="9500">
    <div class="eyebrow">装配结果</div>
    <h2>三个层次，<b class="cyan">各管各的</b></h2>
    <table style="margin-top:22px">
      <thead><tr><th style="width:16%">层</th><th>内容</th><th style="width:26%">能否由星盘反推</th></tr></thead>
      <tbody>
        <tr class="hl"><td class="pn">① 几何层</td><td>黄经 → <b>月支</b>（恒等 100%）· 时角 → <b>时支</b>（67.5%）· ASC → 命宫/身宫</td><td><b class="green">可反推</b></td></tr>
        <tr><td class="pn">② 计数层</td><td><b>年柱、日柱</b>（含日主）</td><td><b class="gold">可推，但须转一道</b></td></tr>
        <tr><td class="pn">③ 符号层</td><td>藏干、十神、神煞、紫微宫名</td><td><b class="cyan">查表即得</b></td></tr>
      </tbody>
    </table>
    <p class="lead" style="margin-top:26px">所以「能不能用行星宫位反推八字」<br>这个问题，<b class="gold">本身就该拆成三问</b>。</p>
    <p class="mut" style="margin-top:12px">几何层能、计数层能但要经「逆星历 → 绝对日期 → 历法锚点」、符号层不用推。</p>
  </section>

  <!-- ⑧ 大周期精确模型 -->
  <section class="scene" data-dur="10000">
    <div class="eyebrow">实测 · 误差不是线性漂移</div>
    <h2>它是<b class="cyan">周期性的</b>，<br>所以<b class="green">几百年窗口就够用</b></h2>
    <p class="mut" style="margin-top:14px">用 astronomy-engine 实扫 <b>1702–2298 年（596 年）全部 31 次木土会合</b>，不假设、不外推。</p>
    <div class="row">
      <div class="card warn"><div class="t">单次会合间隔</div><div class="b">19.8653 年，极差 <b class="red">1.3776</b></div>
        <div class="s">抖得厉害 —— 拿单次会合当"60 年刻度"不可靠</div></div>
      <div class="card ok"><div class="t">3 次会合跨度</div><div class="b">59.58991 年，极差 <b class="green">0.119</b> 年</div>
        <div class="s">43 天 —— 三次一组几乎是常数</div></div>
      <div class="card"><div class="t">间隔自相关</div><div class="b">滞后 3 次会合，<b class="cyan">r = 0.992</b></div>
        <div class="s">强周期结构，周期 ≈ 60 年</div></div>
    </div>
    <p class="mut" style="margin-top:20px">与 60 的差稳定在 <b class="gold">−0.454 ~ −0.366 年</b>（约 −5 个月）；
      会合点每 60 年沿黄道挪约 10°，绕行一周约 <b>2145 年</b>。</p>
    <div class="q">误差 = <b>≈60 年为节拍的振荡</b> ⊕ <b>≈2145 年的慢绕行</b>，<br>不是单调线性漂移。</div>
  </section>

  <!-- ⑨ 双环对照 -->
  <section class="scene" data-dur="9500">
    <div class="eyebrow">看得见的接缝</div>
    <h2>外环不动，内环在转 ——<br>旋转量就是<b class="cyan">上升点</b></h2>
    <div class="row" style="margin-top:6px">
      <div class="card"><div class="t">外环 · 黄道</div><div class="b">十二地支 + 藏干</div>
        <div class="s">锚定<b>天球黄经</b>，<b class="green">静态</b><br>寅永远是 315°–345°（立春→惊蛰）</div></div>
      <div class="card"><div class="t">内环 · 宫位</div><div class="b">十二宫 + 紫微宫名</div>
        <div class="s">锚定<b>上升点 ASC</b>，<b class="gold">动态</b><br>宫 1 起于你这张盘的 ASC</div></div>
      <div class="card"><div class="t">接缝</div><div class="b">ASC / MC 两条线</div>
        <div class="s">两环之间的<b>旋转量</b><br>就是两套坐标系的差</div></div>
    </div>
    <p class="mut" style="margin-top:22px">
      紫微斗数是这套关系的<b>对偶写法</b>：地支固定排在圆周（静态）、宫名随命宫转（动态）—— 与占星恰好互为正反。
      <br>所以<b>不存在</b>「宫 1 = 子、宫 2 = 丑」这种固定表。
    </p>
    <p class="mut" style="margin-top:10px">环上的每个词 —— 地支、藏干、宫号、紫微宫名、行星 —— <b class="cyan">都能点开看详情</b>。</p>
  </section>

  <!-- ⑩ 发展论 -->
  <section class="scene" data-dur="10500">
    <div class="eyebrow">为什么这件事一直没做成</div>
    <h2>七政四余不是"因为不准"而消失，<br>是<b class="gold">因为成本太高</b></h2>
    <table style="margin-top:16px">
      <thead><tr><th style="width:22%">原因</th><th>机制</th></tr></thead>
      <tbody>
        <tr><td class="pn">门槛过高</td><td>要算真实星历、宿度、岁差、四余；而子平术只需查表加减</td></tr>
        <tr><td class="pn">历学垄断</td><td>历代钦天监把历法星占列为禁学，民间私习天文有罪</td></tr>
        <tr><td class="pn">术语壁垒</td><td>外行<b>无法验证</b>，只能信或不信</td></tr>
        <tr><td class="pn">断语靠师承</td><td>结论无法机检，传承一断就彻底失传</td></tr>
      </tbody>
    </table>
    <p class="mut" style="margin-top:12px">而融合之所以艰难，是因为大家一直在<b>符号层</b>对话（十神 vs 宫位 vs 星曜），
      <b>从来没有回到几何层核对</b>。符号层没有共同尺子，所以永远谈不拢。</p>
    <div class="q">融合的底层原因，是<b>没有从最底层的天文数据做精确核算</b>。<br>
      所以这个项目做的第一件事不是"融合"，而是<b>对账</b>。</div>
  </section>

  <!-- ⑪ 自我推翻 -->
  <section class="scene" data-dur="8500">
    <div class="eyebrow">一处自我推翻</div>
    <h2>我们改掉了自己<b class="red">之前的一个结论</b></h2>
    <div class="row" style="margin-top:8px">
      <div class="card warn"><div class="t">旧说法</div><div class="b">年柱日柱<b>原理上不可推</b></div>
        <div class="s">"60 是计数，星盘给不出这是第几个甲子"</div></div>
      <div class="card ok"><div class="t">新说法</div><div class="b">可推，但要<b>转一道</b></div>
        <div class="s">星位 →（逆星历）→ 绝对日期 →（历法锚点）→ 干支</div></div>
    </div>
    <p class="mut" style="margin-top:22px">
      为什么会错：我们把「<b>不能直接由几何得出</b>」错说成了「<b>不能推</b>」。
      大周期模型能反推时间 ⇒ 就能定出日期 ⇒ 干支由历法锚点唯一确定 —— 两句话不可能同时成立。
    </p>
    <p class="lead" style="margin-top:18px">不能直接由几何得出，<b class="gold">≠</b> 不能推。</p>
  </section>

  <!-- ⑫ 收束 -->
  <section class="scene" data-dur="9000">
    <div class="eyebrow">所以</div>
    <h2>这个体系要发展，<br>不是靠"更玄"，而是靠<br><b class="cyan">更可算 · 更可验 · 更可复现</b></h2>
    <div class="row" style="margin-top:26px">
      <div class="card"><div class="t">① 先对账</div><div class="b">能算的算，不能算的标"计数"</div><div class="s">绝不假装差一点</div></div>
      <div class="card"><div class="t">② 再分层</div><div class="b">几何 / 计数 / 符号</div><div class="s">各层不越界</div></div>
      <div class="card"><div class="t">③ 后验证</div><div class="b">事件样本做统计检验</div><div class="s">不靠祖师权威</div></div>
      <div class="card"><div class="t">④ 最后才解释</div><div class="b">有支撑再谈"为什么"</div><div class="s">否则只是事后编故事</div></div>
    </div>
    <p class="mut" style="margin-top:26px">
      全部代码与论证已开源于 <b class="cyan">Apache-2.0</b>：可商用、可闭源，须保留版权与许可声明。<br>
      只收匿名出生时间 + 事例，<b class="green">不收任何身份信息，也绝不收 API Key</b>。
    </p>
    <p class="mut" style="margin-top:12px">复现入口：<code>node server.mjs 8788 --open</code> · 回归 39 套 · 数据来源逐条登记于 <code>data/SOURCES.md</code></p>
  </section>
`;

/* 插到最后一个 </section> 之后 */
const last = t.lastIndexOf('</section>');
if (last < 0) { console.error('❌ 找不到 </section>'); process.exit(1); }
const at = last + '</section>'.length;
t = t.slice(0, at) + '\n' + SCENES + t.slice(at);
fs.writeFileSync(P, t, 'utf8');

const n = (t.match(/class="scene/g) || []).length;
console.log('✅ 已追加 7 个新分幕，现在共 ' + n + ' 幕（原 10 幕）');

/* 标签校验 */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
for (const [k, o, cl] of [['section', /<section\b/g, /<\/section>/g], ['table', /<table\b/g, /<\/table>/g],
  ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g], ['th', /<th\b/g, /<\/th>/g],
  ['div', /<div\b/g, /<\/div>/g], ['p', /<p\b/g, /<\/p>/g], ['b', /<b\b/g, /<\/b>/g]]) {
  const ok = c(t, o) === c(t, cl);
  if (!ok) { bad++; console.log('  ❌ ' + k + ' ' + c(t, o) + '/' + c(t, cl)); }
}
console.log(bad ? '❌ 标签不平衡' : '✅ 标签平衡');
console.log('文件 ' + t.length + ' 字节');
process.exit(bad ? 1 : 0);
