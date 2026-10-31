// 关于页：新增「实验性板块 · 60 甲子连续性的独立检验」
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');

const MARK = '实验性板块 · 60 甲子到底连不连续';
if (html.includes(MARK)) { console.log('已存在'); process.exit(0); }

const CARD = `<h2>实验性板块 · 60 甲子到底连不连续</h2>
      <div class="card" style="margin-bottom:16px;border-color:rgba(255,154,138,.3);background:rgba(255,154,138,.035)">
        <div class="note" style="font-size:13px;line-height:2">
          <b style="color:#ff9a8a">本节是实验，不是结论。</b>它检验一个流传的质疑：
          「60 甲子循环在历史上从未连续，现代排盘的日柱是错的」。<br>
          我们不复述该说法，而是<b>用精确儒略日独立重算</b>，看它在算术上站不站得住。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:14px"><b style="color:#5ef1ff">① 方法（学自该质疑方，值得学的部分）</b></div>
        <div class="note" style="font-size:12px;line-height:1.95;margin-top:4px">
          · 只用<b>史料原创干支</b>做锚（《史记·封禅书》、Wechsler 1985 唐礼制、《元史》），不靠现代反推<br>
          · 算两锚之间<b>精确天数差</b>，<code>mod 60</code>，与记载干支对账<br>
          · <b style="color:#7dffb4">其最有价值的一点：从现代往前反推古历是循环论证</b> ——
          反推必然"强迫"古日拟合 60 循环，因此永远对得上，不能用它证明连续性<br>
          · <b style="color:#ff9a8a">其方法的一处弱点（本站修正）</b>：用「年数 × 365.2422」算天数会引入近似误差；
          跨闰日必须直接算<b>儒略日（JDN）之差</b>，它按定义就是整数天。本站已用 JDN 重算，
          并用 2000-01-01 = JDN 2451545、1582-10-15 = JDN 2299161 自检通过。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:14px"><b style="color:#5ef1ff">② 本站实测结果</b></div>
        <table class="holo-tb" style="margin-top:6px">
          <thead><tr><th>锚点对</th><th>精确天数差</th><th>mod 60</th><th>预测</th><th>史料</th><th>判定</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">前113-12-24（辛巳）<br>→ 1965-01-10</td>
              <td class="mut2">758,263 天</td>
              <td class="mut2">43</td>
              <td class="pn">甲子</td>
              <td class="mut2">甲子</td>
              <td class="dg a">✅ 对上</td>
            </tr>
            <tr>
              <td class="pn">前113-12-24（辛巳）<br>→ 前105-12-24</td>
              <td class="mut2">2,922 天</td>
              <td class="mut2">42</td>
              <td class="pn">癸亥</td>
              <td class="mut2">甲子</td>
              <td class="dg b">❌ 差 1 位</td>
            </tr>
            <tr>
              <td class="pn">前105-12-24（记甲子）<br>→ 1965-01-10</td>
              <td class="mut2">755,341 天</td>
              <td class="mut2">1</td>
              <td class="pn">乙丑</td>
              <td class="mut2">甲子</td>
              <td class="dg b">❌ 差 1 位</td>
            </tr>
          </tbody>
        </table>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:12px">
          <b style="color:#7dffb4">⇒ 结论一（支持该质疑方的具体指控）：</b>
          前 113 → 1965 这条两千年长链<b>精确自洽</b>；而<b>汉太初历元（前105-12-24）恰好差 1 位</b>。
          这与「汉武帝把该是癸亥的一天定为甲子」的指控<b>在算术上吻合</b>。
        </div>
        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:8px">
          <b style="color:#ff9a8a">⇒ 结论二（不支持其大结论）：</b>
          但其总标题「60 循环从不连续、现代日柱错 ≥3 位」<b>不成立</b>——
          因为跨越 2077 年的 前113→1965 链条是<b>对得上</b>的。可见是<b>局部 1 天级的人为调整</b>，
          而非长期断裂。
        </div>
        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:8px">
          <b style="color:#ffd58a">⇒ 结论三（本引擎的处境）：</b>
          本引擎的日柱是<b>从现代纪元连续反推</b>得到——这正是被批评的方法。
          实测：1965-01-10 引擎给甲子 ✅（与史料一致）；但公元前年份 tyme4ts 不支持，
          引擎给出的是无意义值。<b>因此本站对公元前的日柱不作任何断言。</b>
        </div>

        <div class="note" style="font-size:12px;line-height:1.95;margin-top:14px;color:rgba(160,200,225,.75)">
          <b>对主流学术的对照</b>：Adam Smith (2010) 指出 60 循环的连续性<b>只是"被假设"</b>；
          中文学界唯一的怀疑仅见李学勤 (1957) p.122；并称"没发现任何重置的文本痕迹，此疑问很少被提出"。
          ⇒ <b>连续性确实是假设而非证明</b>，这一点本站接受；但"已被证明断裂"同样缺乏证据。<br>
          <b>本节的定位</b>：把"假设"变成"可检验的命题"，并给出可复现的算术结果。
          相关质疑方为 Prof. Dr. Ong Hean-Tatt（马来西亚 GUI Management Centre，非北京大学），
          我们借其方法、修正其算术、核对其结论，<b>不采信其关于"八字系伪造自紫微斗数"的附带主张</b>。
        </div>

        <div class="note" style="font-size:11.5px;line-height:1.9;margin-top:10px;color:rgba(140,180,210,.6)">
          复现：<code>node tools/experiment-jiazi-continuity.mjs</code>
        </div>
      </div>

      `;

const anchor = '<h2>开源项目与数据来源</h2>';
if (html.includes(anchor)) {
  html = html.replace(anchor, CARD + anchor);
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('✅ 实验性板块已插入（开源署名之前）');
} else {
  console.error('❌ 未找到锚点');
  process.exit(1);
}

/* 校验 */
const a = fs.readFileSync('web/index.html', 'utf8');
const checks = [
  ['含标题', a.includes(MARK)],
  ['含 758,263 天', a.includes('758,263')],
  ['含「差 1 位」', a.includes('差 1 位')],
  ['含不支持其大结论', a.includes('不成立')],
  ['含非北京大学标注', a.includes('非北京大学')],
  ['div 平衡', (a.match(/<div\b/g) || []).length === (a.match(/<\/div>/g) || []).length],
  ['table 平衡', (a.match(/<table\b/g) || []).length === (a.match(/<\/table>/g) || []).length],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
