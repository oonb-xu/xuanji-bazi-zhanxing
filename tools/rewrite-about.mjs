// 一次性补丁：重写「关于」页为通俗语言（去掉所有内部裁定编号与项目名）
import fs from 'node:fs';

const NEW_ABOUT = `    <!-- ④ 关于 -->
    <section class="page" data-page="about">
      <h2 class="page-title">关于 <span class="sub">怎么用 · 能信什么</span></h2>
      <div class="card prose">
        <h3>这是什么</h3>
        <p>把三样东西放在一起看：<strong>八字</strong>（出生年月日时排出的四组干支）、<strong>星盘</strong>（出生那一刻天上的行星位置）、<strong>六壬</strong>（按占问时刻起的课）。三种方法各有一套说法，这里不打架，而是<strong>并排算给你看</strong>，你自己对照。</p>

        <h3>怎么用</h3>
        <ul>
          <li><strong>融合</strong>：填一个人的出生时间和地点，同时出八字盘和星盘。</li>
          <li><strong>合盘</strong>：填两个人的，看两边互相"补"了什么、"耗"了什么。</li>
          <li><strong>六壬</strong>：填你心里想问那件事的时间，起一课看三传。</li>
        </ul>

        <h3>出生时间：这一点最要紧</h3>
        <p>你填的是<strong>钟表时间</strong>，但排盘要用的是<strong>当地真太阳时</strong>，两者能差一小时以上。本工具会<strong>自动换算</strong>，并把「换算前 / 换算后」的四柱都列出来——如果换了之后时柱变了，会<strong>红色提醒你</strong>。</p>
        <p>还有两件事，差几分钟就翻盘：</p>
        <ul>
          <li><strong>快到时辰交界</strong>（比如 16:58）——差 5 分钟时柱就换，整张盘一半都变了。</li>
          <li><strong>出生在星座交界</strong>——差 3 分钟上升星座就换，所有跟上升有关的说法全部作废。</li>
        </ul>
        <p>所以：<strong>出生时间不确定到分钟的，建议先做生时校正</strong>（用你人生中几件有确切日期的大事反推）。没做校正之前，请把结果当<strong>参考</strong>，不要当定论。</p>

        <h3>哪些能信，哪些别信</h3>
        <p><strong>能信的是"算得准不准"</strong>：四柱、干支、行星度数、宫位、三传，都是按规则算出来的，可以复算、可以查证。</p>
        <p><strong>不能全信的是"算得灵不灵"</strong>：</p>
        <ul>
          <li>合盘那个分数，衡量的是<strong>两张盘的结构像不像、补不补</strong>，<strong>不是</strong>你们能不能过一辈子。它没有用真实情侣的结局校准过。</li>
          <li>两个人怎么相处、愿不愿磨合、遇事怎么选——<strong>这些东西盘里没有</strong>，工具也不假装能算。</li>
          <li>八字和星盘的"五行"不是一个体系（一边木火土金水，一边火土风水），所以只<strong>并排展示，不硬凑成一个数</strong>。</li>
        </ul>

        <h3>隐私</h3>
        <p>本工具<strong>在你自己电脑上运行</strong>，所有计算都在本地完成：你填的生日、地点<strong>不会上传到任何服务器</strong>，没有统计也没有埋点。关掉页面，数据就没了。</p>

        <h3>最后一句</h3>
        <p>它是把传统命理的结构<strong>拆开来给你看</strong>的工具，不是算命先生。结论请你自己判断——尤其是那些会决定你人生走向的事。</p>
      </div>
    </section>
`;

const p = 'web/index.html';
let s = fs.readFileSync(p, 'utf8');
const startMarker = '    <!-- ④ 关于 -->';
const endMarker = '  </main>';
const i = s.indexOf(startMarker);
const j = s.indexOf(endMarker, i);
if (i < 0 || j < 0) { console.log('未找到关于页区间，未修改'); process.exit(1); }
s = s.slice(0, i) + NEW_ABOUT + '\n' + s.slice(j);
fs.writeFileSync(p, s, 'utf8');
console.log('关于页已重写为通俗语言');

// 检查是否还残留内部编号
const bad = (s.match(/R-[A-Z]\d+|status: hypothesis|基线 v2\.7|n=128/g) || []);
console.log('残留内部编号:', bad.length ? bad.join(',') : '无');
