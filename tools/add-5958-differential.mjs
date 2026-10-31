// 把「结论订正 + 微分论证 + 超辰 + 物候滞后 + 逐月触发窗口」写进关于页 59.58 板块
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak14', h, 'utf8');

if (h.includes('id="d5958-diff"')) { console.log('已写入过'); process.exit(0); }

const CONTENT = `
        <!-- ═══ A. 结论订正 ═══ -->
        <h3 class="about-sec" id="d5958-limit">A. 先订正一句话：我说过「现代排盘不受影响」——这话有前提</h3>
        <p class="note" style="margin:0 0 10px">
          那个结论<b>只在「按历法计数、以近世锚点重同步」的前提下成立</b>（例如以 1984 = 甲子锚定）。
          因为 <b>60 甲子是一台计数器</b>（<code>ℤ/60ℤ</code>），只要锚点确定，它永远准确——
          它<b>不需要</b>和天文对上。
        </p>
        <p class="note" style="margin:0 0 10px">
          但如果要求<b>「从历元起天文连续」</b>，结论就反过来了。以汉太初历元（前 104 年）为锚外推：
          <br>· 至今天数 <b>2,129 年</b>
          <br>· 累计偏移 <b>15.01 年</b> ⇒ <b>年柱要错 15 位</b>
          <br>· 若以 1984 = 甲子锚定，至今 41 年只偏 <b>105.6 天</b>（约 3.5 个月）
        </p>
        <table class="holo-tb" style="margin-top:10px">
          <thead><tr><th style="width:26%">锚点选择</th><th>至今累计偏移</th><th>影响</th></tr></thead>
          <tbody>
            <tr><td class="pn">1984 = 甲子（通行做法）</td><td>105.6 天（≈3.5 个月）</td><td class="mut">年柱不变；只在立春附近 ±3.5 个月有争议</td></tr>
            <tr><td class="pn">汉太初历元 前 104 年</td><td><b style="color:#ff9a8a">15.01 年</b></td><td class="mut">年柱错 <b>15 位</b>，月干随之整列变化</td></tr>
            <tr><td class="pn">不设锚点、纯天文外推</td><td>随时间线性增长</td><td class="mut">每 142 年错 1 年，<b>无法自洽</b></td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0;color:#ffc457">
          ⇒ 所以「从万年历最开始推」这件事，<b>恰恰是天文上无法验证的那一步</b>：它是一次<b>计数约定的选择</b>，
          不是可测的量。订正后的准确说法是：<b>在计数约定下现代排盘无漂移；在「天文连续」假设下现代排盘早已错位。</b>
        </p>

        <!-- ═══ B. 微分论证 ═══ -->
        <h3 class="about-sec" id="d5958-diff">B. 本质是微分问题：误差是一阶线性项，不是周期项</h3>
        <p class="note" style="margin:0 0 8px">设日历周期 <code>T_c = 60</code>（整数定义在 ℤ 上），天文周期</p>
        <p class="note" style="margin:0 0 8px;padding-left:14px;border-left:2px solid rgba(94,241,255,.35)">
          <code>T_a = 3 / (1/11.862 − 1/29.457) = 59.576971…</code> 年
        </p>
        <p class="note" style="margin:0 0 8px">两者相位函数与相位差：</p>
        <p class="note" style="margin:0 0 8px;padding-left:14px;border-left:2px solid rgba(94,241,255,.35)">
          <code>Φ_c(t) = t/T_c mod 1</code>，<code>Φ_a(t) = t/T_a mod 1</code><br>
          <code>ΔΦ(t) = t·(1/T_a − 1/T_c) = t·k</code>，<b>k = 1.183425×10⁻⁴ /年</b>
        </p>
        <p class="note" style="margin:0 0 8px">
          <b>关键结论</b>：<code>ΔΦ(t)</code> 是 <b>t 的一次函数</b>——这叫<b>久期项（secular term）</b>，不是周期项。
          它的一阶导数是常数：
        </p>
        <p class="note" style="margin:0 0 8px;padding-left:14px;border-left:2px solid rgba(94,241,255,.35)">
          <code>dε/dt = k·T_a = 7.050×10⁻³</code>（无量纲，恒定）<br>
          ⇒ <b>二阶项为 0</b>；误差<b>单调累积、永不回头</b>
        </p>
        <p class="note" style="margin:0 0 10px">
          <b>推论（这才是本质）</b>：既然 <code>dε/dt ≡ 常数</code>，那么<b>任何"周期性修补"都不可能消除它</b>——
          只能用<b>离散重锚（reset）</b>把它归零。这正是古代历法「超辰」在干的事（见 D 节）。
          八字缺的，就是这一步 reset。
        </p>
        <table class="holo-tb">
          <thead><tr><th>需要累计到的偏移</th><th>所需时间</th><th>换算</th></tr></thead>
          <tbody>
            <tr><td class="pn">1 个月</td><td><b>11.8 年</b></td><td class="mut">≈ 0.2 个甲子周期</td></tr>
            <tr><td class="pn">半年</td><td>70.9 年</td><td class="mut">≈ 1.2 个甲子周期</td></tr>
            <tr><td class="pn">1 年（年柱错 1 位）</td><td><b>141.8 年</b></td><td class="mut">≈ 2.4 个甲子周期</td></tr>
            <tr><td class="pn">10 年</td><td>1,418 年</td><td class="mut">≈ 24 个周期</td></tr>
            <tr><td class="pn">整个 60 年周期</td><td>8,510 年</td><td class="mut">≈ 142 个周期</td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:8px 0 0">
          相对速率：<code>k·T_a = 0.705%/周期</code>（每 60 年漂 <b>0.423029 年 = 154.51 天</b>）。
        </p>

        <!-- ═══ C. 第二个更快的漂移：6 甲子日 ═══ -->
        <h3 class="about-sec" id="d5958-jiazi-day">C. 还有个更快的漂移：「6 个甲子日 = 360 天」</h3>
        <p class="note" style="margin:0 0 8px">
          360 天 vs 回归年 365.2422 天 ⇒ <b>每年亏 5.2422 天</b>，咬合率 <b>98.56%</b>。
          看着只差 1.44%，但它是<b>另一个一阶线性项</b>，而且比年柱那个快得多：
        </p>
        <table class="holo-tb">
          <thead><tr><th>累计</th><th>所需时间</th></tr></thead>
          <tbody>
            <tr><td>亏满 1 个月（30.4 天）</td><td><b>5.8 年</b></td></tr>
            <tr><td>亏满 1 个甲子日周期（60 天）</td><td><b>11.4 年</b></td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:8px 0 0;color:#ffc457">
          ⇒ 「6 甲子日 ≈ 一年」只能当<b>近似</b>。若真把它当历法用，<b>11 年就整周期错位</b>。
          这也是为什么日柱必须靠<b>连续日计数 + 历法锚点</b>，而不能靠天文推出（与「年柱日柱不可由行位推出」是同一件事）。
        </p>

        <!-- ═══ D. 古人怎么修的：岁星超辰 ═══ -->
        <h3 class="about-sec" id="d5958-chaochen">D. 古人早就发现并修过：岁星「超辰」 —— 而八字没有这一步</h3>
        <p class="note" style="margin:0 0 8px">
          古籍原文：「<b>岁星右行于天，一岁移一辰，十二岁一小周，千七百二十八年一大周</b>」
          （<a href="https://www.shidianguji.com/character/%E5%B2%81" style="color:#5ef1ff">《识典古籍·岁》</a>）。
        </p>
        <p class="note" style="margin:0 0 10px">
          注意 <b>1728 = 12 × 144</b>：这就是「<b>144 年超一辰</b>」的结构——
          岁星纪年名义上 12 年走一辰（12 次），但真实周期短一点，跑满一段时间就会<b>多走一辰</b>，
          于是历法必须<b>跳过一辰</b>来复位。这个动作叫 <b>超辰（超次）</b>。
        </p>
        <table class="holo-tb">
          <thead><tr><th>口径</th><th>隐含岁星周期</th><th>超一辰间隔</th></tr></thead>
          <tbody>
            <tr><td class="pn">三统历古法</td><td>12 / (1 + 1/144) = <b>11.9172 年</b></td><td><b>144 年</b></td></tr>
            <tr><td class="pn">现代真值</td><td>11.862 年</td><td><b>86 年</b></td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0">
          这和 59.58 是<b>同一种病</b>：<b>整数周期 ≠ 实际周期</b>，误差是一阶线性的，只能靠离散重锚修。
          古人在<b>岁星纪年</b>上做了这件事（超辰），在 <b>甲子纪年</b>上没做——
          因为甲子从一开始就被当作<b>纯计数</b>，不承担天文对位。<b>这是设计选择，不是疏漏。</b>
        </p>

        <!-- ═══ E. 物候与冷暖：月建比实际季节早整整一个月 ═══ -->
        <h3 class="about-sec" id="d5958-phenology">E. 冷暖与物候：月建的名义季节，比实际物候早整整一个月建</h3>
        <p class="note" style="margin:0 0 10px">
          八字讲「冷暖」，靠的是<b>月建</b>；月建严格绑定<b>太阳黄经</b>（节气）。但气温对太阳有<b>热惯性滞后</b>：
        </p>
        <table class="holo-tb">
          <thead><tr><th>极值</th><th>天文时刻（节气）</th><th>实际最值</th><th>滞后</th></tr></thead>
          <tbody>
            <tr><td class="pn">最冷</td><td>冬至 12-21（子月始）</td><td>大寒 01-20（丑月中）</td><td><b>30 天</b></td></tr>
            <tr><td class="pn">最热</td><td>夏至 06-21（午月始）</td><td>大暑 07-22（未月中）</td><td><b>31 天</b></td></tr>
            <tr><td class="pn">一个中气间隔</td><td colspan="2">365.2422 / 12 = 30.44 天</td><td class="mut">基准</td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 10px">
          ⇒ <b>热滞后 = 31 / 30.44 = 1.02 个月建</b>。<b>整整一个月建</b>。
          也就是说：<b>以月建论冷暖，名义上永远比实际物候早一个月</b>。逐月对照：
        </p>
        <table class="holo-tb">
          <thead><tr><th>月建</th><th>节气起</th><th>名义</th><th>实际物候</th></tr></thead>
          <tbody>
            <tr><td class="pn">寅</td><td class="mut">立春 02-04</td><td>春季始</td><td class="mut">仍在严寒，回暖初期</td></tr>
            <tr><td class="pn">卯</td><td class="mut">惊蛰 03-06</td><td>仲春</td><td class="mut">真正回暖</td></tr>
            <tr><td class="pn">辰</td><td class="mut">清明 04-05</td><td>季春</td><td class="mut">暖而湿</td></tr>
            <tr><td class="pn">巳</td><td class="mut">立夏 05-06</td><td>夏季始</td><td class="mut">实际仍偏春</td></tr>
            <tr><td class="pn">午</td><td class="mut">芒种 06-06</td><td>仲夏</td><td class="mut">初夏</td></tr>
            <tr><td class="pn">未</td><td class="mut">小暑 07-07</td><td>季夏</td><td class="mut"><b>热极在此</b></td></tr>
            <tr><td class="pn">申</td><td class="mut">立秋 08-08</td><td>秋季始</td><td class="mut">实际仍热</td></tr>
            <tr><td class="pn">酉</td><td class="mut">白露 09-08</td><td>仲秋</td><td class="mut">转凉</td></tr>
            <tr><td class="pn">戌</td><td class="mut">寒露 10-08</td><td>季秋</td><td class="mut">干凉</td></tr>
            <tr><td class="pn">亥</td><td class="mut">立冬 11-07</td><td>冬季始</td><td class="mut">凉而不寒</td></tr>
            <tr><td class="pn">子</td><td class="mut">大雪 12-07</td><td>仲冬</td><td class="mut">寒但未极</td></tr>
            <tr><td class="pn">丑</td><td class="mut">小寒 01-06</td><td>季冬</td><td class="mut"><b>冷极在此</b></td></tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0">
          <b>历史叠加</b>：小冰期（约 1300–1850，其中蒙德极小期 1645–1715 最冷）让春季再推迟 1–2 周，
          物候与月建的错位在那些年份更大。<b>所以「某人八字喜火但生在小冰期」这类判断，
          按节气算的冷暖会系统性地偏「暖」。</b>
        </p>

        <!-- ═══ F. 什么时候引发误差：精确到月 ═══ -->
        <h3 class="about-sec" id="d5958-when">F. 什么时候会真的引发误差 —— 精确到月</h3>
        <table class="holo-tb">
          <thead><tr><th style="width:22%">情形</th><th>误差性质</th><th>触发时间（精确）</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">① 把 60 年当<b>天文周期</b>用</td>
              <td>一阶线性，单调</td>
              <td><b>11.8 年</b>累计到 1 个月；<b>141.8 年</b>错 1 整年（年柱错 1 位）；<b>8,510 年</b>整周期</td>
            </tr>
            <tr>
              <td class="pn">② 以<b>月建论冷暖</b></td>
              <td>系统偏差（非随机）</td>
              <td><b>每一个盘都错 1.02 个月建</b>——冷极在丑、热极在未，而名义上分别记在子、午</td>
            </tr>
            <tr>
              <td class="pn">③ 把「6 甲子日 = 360 天」当历法</td>
              <td>一阶线性，更快</td>
              <td><b>5.8 年</b>错 1 个月；<b>11.4 年</b>错 1 个整周期（60 天）</td>
            </tr>
            <tr>
              <td class="pn">④ 岁星纪年不超辰</td>
              <td>一阶线性</td>
              <td>古法口径 <b>144 年</b>必须跳一辰；现代真值下 <b>86 年</b>就该跳</td>
            </tr>
            <tr>
              <td class="pn">⑤ 小冰期出生者</td>
              <td>气候偏移（有界）</td>
              <td>LIA 约 1300–1850 年区间内，物候再偏 <b>1–2 周</b>；蒙德极小期 1645–1715 最强</td>
            </tr>
          </tbody>
        </table>
        <p class="note" style="margin:10px 0 0;color:#ffc457">
          <b>一句话总括</b>：①②③④ 都是<b>同一个数学对象</b>——「整数周期 vs 实数周期」的<b>一阶线性误差</b>
          （<code>dε/dt = const ≠ 0</code>）。它能被<b>离散重锚</b>归零，不能被测度修正消除。
          古代历法用「超辰」做了重锚；八字把 60 甲子当纯计数，<b>主动放弃了天文对位</b>，
          于是既没错、也没修——<b>这正是它可机算的前提，也是它不能反过来证伪天文的原因</b>。
        </p>
`;

/* 插到 59.58 卡片的最后一个 </div> 之前 */
const i = h.indexOf('id="sec-59-58"');
const s = h.lastIndexOf('<div class="card"', i);
const re = /<div\b|<\/div>/g; re.lastIndex = s;
let d = 0, m, e = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { e = m.index + 6; break; } }
if (e < 0) { console.error('❌ 59.58 卡片未闭合'); process.exit(1); }

const insertAt = e - 6;   // 最后一个 </div> 之前
const out = h.slice(0, insertAt) + CONTENT + h.slice(insertAt);

/* 校验 */
const c = (str, rx) => (str.match(rx) || []).length;
let bad = 0;
console.log('=== 标签校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['h3', /<h3\b/g, /<\/h3>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g],
  ['td', /<td\b/g, /<\/td>/g], ['th', /<th\b/g, /<\/th>/g],
  ['p', /<p\b/g, /<\/p>/g], ['code', /<code\b/g, /<\/code>/g], ['b', /<b\b/g, /<\/b>/g],
  ['section', /<section\b/g, /<\/section>/g]]) {
  const ok = c(out, o) === c(out, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(8)} ${c(out, o)}/${c(out, cl)} ${ok ? '✅' : '❌'}`);
}

/* 内容齐全 */
const NEED = ['d5958-limit', 'd5958-diff', 'd5958-jiazi-day', 'd5958-chaochen', 'd5958-phenology', 'd5958-when',
  '15.01', '141.8', '8,510', '0.705', '144 年', '11.9172', '86 年', '1.02', '5.8 年', '8,510'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('\n内容 ' + (lost.length ? '❌ 缺 ' + lost.join(',') : `✅ ${NEED.length} 项齐全`));
if (lost.length) bad++;

/* #app 包含关系 */
const app = out.indexOf('<div id="app"');
const at = out.indexOf('>', app) + 1;
const r2 = /<div\b|<\/div>/g; r2.lastIndex = at;
let dd = 1, mm, appEnd = -1;
while ((mm = r2.exec(out))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { appEnd = mm.index; break; } }
const okAll = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => { const p = out.indexOf('data-page="' + k + '"'); return p > app && p < appEnd; });
console.log('  #app 包含其余页面 ' + (okAll ? '✅' : '❌'));
if (!okAll) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入，index.html', out.length, '字节');
