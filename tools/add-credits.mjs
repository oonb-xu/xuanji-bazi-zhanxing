// 【任务】关于页：注明所有引用过的开源项目、数据集与素材
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');

const MARK = '开源项目与数据来源';
if (html.includes(MARK)) { console.log('已存在'); process.exit(0); }

const CARD = `<h2>开源项目与数据来源</h2>
      <div class="card" style="margin-bottom:16px">
        <div class="note" style="font-size:12.5px;line-height:1.9">
          本站在排盘与推算上**大量复用了开源实现**，在此逐一注明。凡标 <b style="color:#7dffb4">MIT</b> 的
          可按 MIT 条款使用；唯一例外是 <b style="color:#ffd58a">Apache-2.0</b>（大六壬库），
          其条款额外要求保留 NOTICE 与修改声明。<b>本项目未修改任何第三方的核心算法</b>，
          只在它们之上写适配层（如 \`ziwei/adapter.mjs\`）。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:14px"><b style="color:#5ef1ff">一、开源代码库（npm 依赖）</b></div>
        <table class="holo-tb" style="margin-top:6px">
          <thead><tr><th>项目</th><th>版本</th><th>许可</th><th>在本站的作用</th></tr></thead>
          <tbody>
            <tr><td class="pn"><a href="https://github.com/6tail/tyme4ts" style="color:#5ef1ff">tyme4ts</a></td><td class="mut2">—</td><td class="dg a">MIT</td><td class="mut2">干支历法、节气、农历转换（八字与六壬的时间基座）</td></tr>
            <tr><td class="pn"><a href="https://github.com/look-fate/liuren-ts-lib" style="color:#5ef1ff">liuren-ts-lib</a></td><td class="mut2">^3.1.0</td><td class="dg b">Apache-2.0</td><td class="mut2">大六壬排盘（三传四课）</td></tr>
            <tr><td class="pn"><a href="https://github.com/SylarLong/iztro" style="color:#5ef1ff">iztro</a></td><td class="mut2">^2.6.3</td><td class="dg a">MIT</td><td class="mut2">紫微斗数排盘（十二宫、十四主星、四化、五行局）</td></tr>
            <tr><td class="pn"><a href="https://github.com/cosinekitty/astronomy" style="color:#5ef1ff">astronomy-engine</a></td><td class="mut2">^2.1.19</td><td class="dg a">MIT</td><td class="mut2">行星位置、宫位、行运的天文计算</td></tr>
            <tr><td class="pn"><a href="https://github.com/openfate-ai/true-solar-time" style="color:#5ef1ff">@openfate/true-solar-time</a></td><td class="mut2">^4.0.2</td><td class="dg a">MIT</td><td class="mut2">真太阳时与均时差（EoT）换算</td></tr>
            <tr><td class="pn"><a href="https://github.com/adaltas/node-csv" style="color:#5ef1ff">csv-parse</a></td><td class="mut2">^7.0.3</td><td class="dg a">MIT</td><td class="mut2">公开数据集（CSV）的解析</td></tr>
            <tr><td class="pn"><a href="https://github.com/pillarjs/iconv-lite" style="color:#5ef1ff">iconv-lite</a></td><td class="mut2">^0.7.3</td><td class="dg a">MIT</td><td class="mut2">抓取中文古籍时的编码转换（GBK 等）</td></tr>
          </tbody>
        </table>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:16px"><b style="color:#5ef1ff">二、公开数据集</b></div>
        <table class="holo-tb" style="margin-top:6px">
          <thead><tr><th>来源</th><th>规模</th><th>许可</th><th>用途与限制</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">VedAstro<br><span class="mut2" style="font-size:10.5px">HuggingFace vedastro-org</span></td>
              <td class="mut2">15,807 盘<br>（AA 级 99.9%）</td>
              <td class="dg a">MIT</td>
              <td class="mut2">占星×婚姻事件对拍。<b>限制</b>：吠陀恒星黄道语境，本站为热带黄道</td>
            </tr>
            <tr>
              <td class="pn">Korean Public Figures with Saju<br><span class="mut2" style="font-size:10.5px">HuggingFace brandonrhie</span></td>
              <td class="mut2">39,494 人</td>
              <td class="mut2">见原仓库</td>
              <td class="mut2">三柱对拍（实测 98.68% 一致）。<b>限制</b>：仅日精度、<b>无时柱</b>，时柱与大运不得在此集上评估</td>
            </tr>
            <tr>
              <td class="pn"><a href="https://github.com/stevevandekolk/d3-celestial" style="color:#5ef1ff">d3-celestial</a><br><span class="mut2" style="font-size:10.5px">stars.6.json</span></td>
              <td class="mut2">921 颗亮星<br>（mag ≤ 4.5）</td>
              <td class="dg a">BSD-3</td>
              <td class="mut2">星空背景的真实恒星位置</td>
            </tr>
          </tbody>
        </table>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:16px"><b style="color:#5ef1ff">三、图像素材</b></div>
        <div class="note" style="font-size:12px;line-height:1.9;margin-top:4px">
          行星表面纹理（10 张，约 577 KB）来自 <b>Solar System Scope</b>
          （<a href="https://www.solarsystemscope.com/textures/" style="color:#5ef1ff">solarsystemscope.com/textures</a>），
          依 <b>CC BY 4.0</b> 使用。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:16px"><b style="color:#5ef1ff">四、古典文献与传统数据</b></div>
        <div class="note" style="font-size:12px;line-height:1.9;margin-top:4px">
          · <b>《大六壬断案》</b>（明清刻本，公共领域）—— 用于古典课例对拍三传，共结构化 65 例<br>
          · <b>《紫微斗数全书》</b>（公共领域）—— 十四主星庙旺表参考（本站表已标「待校」，各派有差异）<br>
          · <b>二十八宿距度</b> —— 清代黄道宿度通行值（传统历法数据，公共领域）<br>
          · <b>古典占星尊贵体系</b> —— 托勒密《四书》等公共领域古典文献
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.9;margin-top:16px"><b style="color:#5ef1ff">五、用户提供</b></div>
        <div class="note" style="font-size:12px;line-height:1.9;margin-top:4px">
          · <b>人类精标成对样本</b> —— 由本站在「反馈」页收集的<b>匿名命例</b>（不含姓名与联系方式），
          仅用于模型校准。详见上方隐私承诺。
        </div>

        <div class="note" style="font-size:12px;line-height:1.9;margin-top:16px;color:rgba(160,200,225,.75)">
          <b>完整的逐条登记</b>（含每个数据源「查证到什么、能不能用、限制在哪」）见项目内
          <code>data/SOURCES.md</code>。凡检索过但<b>未找到</b>的（Starlight、璇玑玉衡、linren-skill 等）也如实记录在案，
          未用不存在的来源充数。
        </div>
      </div>

      `;

const anchor = '<h2>怎么用 · 需要接 API 吗</h2>';
if (html.includes(anchor)) {
  html = html.replace(anchor, CARD + anchor);
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('✅ 署名区已插入（API 段之前）');
} else {
  console.error('❌ 未找到锚点');
  process.exit(1);
}

/* 校验 */
const a = fs.readFileSync('web/index.html', 'utf8');
const must = ['tyme4ts', 'liuren-ts-lib', 'iztro', 'astronomy-engine', 'true-solar-time',
  'csv-parse', 'iconv-lite', 'VedAstro', 'Korean Public Figures', 'd3-celestial',
  'Solar System Scope', '大六壬断案', '紫微斗数全书', 'Apache-2.0', 'CC BY 4.0'];
console.log('\n校验：');
let bad = 0;
for (const k of must) { const v = a.includes(k); if (!v) bad++; console.log(' ', v ? '✅' : '❌', k); }
const bal = (a.match(/<div\b/g) || []).length === (a.match(/<\/div>/g) || []).length
  && (a.match(/<table\b/g) || []).length === (a.match(/<\/table>/g) || []).length
  && (a.match(/<tr\b/g) || []).length === (a.match(/<\/tr>/g) || []).length;
console.log(' ', bal ? '✅' : '❌', '标签开闭平衡');
process.exit(bad || !bal ? 1 : 0);
