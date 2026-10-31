// 关于页：① 顶部总览索引（整体更新）② 新增「体系冲突与不可通约」专节
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');
let changed = [];

/* ══════════ ① 顶部总览索引 ══════════ */
const IDX_MARK = 'about-toc';
if (!html.includes(IDX_MARK)) {
  const CARD = `<div class="card" id="about-toc" style="margin-bottom:18px">
        <div class="note" style="font-size:13px;line-height:1.95;margin-bottom:10px">
          <b style="color:#5ef1ff">本页导航</b>　<span class="mut2">按「先定位 → 再看证据 → 最后看做不到的地方」排列</span>
        </div>
        <div class="toc-grid">
          <a href="#sec-privacy" class="toc-i"><b>1</b><span>隐私与数据</span><i>只收匿名出生信息</i></a>
          <a href="#sec-not-collage" class="toc-i"><b>2</b><span>这不是拼贴</span><i>底层逻辑对应</i></a>
          <a href="#sec-method" class="toc-i"><b>3</b><span>融合路径论文</span><i>完整论证</i></a>
          <a href="#sec-conflict" class="toc-i warn"><b>4</b><span>体系冲突</span><i>做不到、对不上</i></a>
          <a href="#sec-experiment" class="toc-i"><b>5</b><span>实验性板块</span><i>60 甲子连续性</i></a>
          <a href="#sec-credits" class="toc-i"><b>6</b><span>开源与数据</span><i>逐条署名</i></a>
          <a href="#sec-howto" class="toc-i"><b>7</b><span>怎么用 · API</span><i>什么时候需要</i></a>
        </div>
      </div>

      `;
  // 插在关于页标题之后、隐私卡之前
  const anchor = 'data-page="about"';
  const at = html.indexOf(anchor);
  if (at > 0) {
    // 找该 section 内第一个 <h2 或第一个 <div class="card"
    const h2 = html.indexOf('<h2', at);
    const card = html.indexOf('<div class="card', at);
    const ins = Math.min(...[h2, card].filter((x) => x > 0));
    if (isFinite(ins) && ins > 0) {
      html = html.slice(0, ins) + CARD + html.slice(ins);
      changed.push('顶部总览索引');
    }
  }
}

/* ══════════ ② 给已有区块加锚点 ══════════ */
const ANCHORS = [
  ['<h2>隐私承诺', 'sec-privacy'],
  ['<h2>这不是拼贴', 'sec-not-collage'],
  ['<h2>方法论 · 融合路径论文', 'sec-method'],
  ['<h2>实验性板块', 'sec-experiment'],
  ['<h2>开源项目与数据来源', 'sec-credits'],
  ['<h2>怎么用 · 需要接 API 吗', 'sec-howto'],
];
for (const [needle, id] of ANCHORS) {
  if (html.includes(needle) && !html.includes(`id="${id}"`)) {
    html = html.replace(needle, `<h2 id="${id}">` + needle.slice(4));
    changed.push(id);
  }
}

/* ══════════ ③ 体系冲突专节 ══════════ */
const CONFLICT_MARK = 'sec-conflict';
if (!html.includes(`id="${CONFLICT_MARK}"`)) {
  const CARD = `<h2 id="sec-conflict">体系冲突 · 话说不到一起去的地方</h2>
      <div class="card" style="margin-bottom:16px;border-color:rgba(255,154,138,.34);background:rgba(255,154,138,.04)">
        <div class="note" style="font-size:13px;line-height:2">
          <b style="color:#ff9a8a">这一节专门写"对不上"的地方。</b>不藏、不平均、不用一句话圆过去。
          每条都标明<b>性质</b>：是<b class="gold">精度不足</b>（可修）、
          <b class="gold">流派差异</b>（不合并只并排）、还是<b class="red">原理性不可通约</b>（不修，直接禁止对应）。
        </div>

        <table class="holo-tb" style="margin-top:14px">
          <thead><tr><th style="width:22%">冲突 / 不一致</th><th style="width:15%">性质</th><th style="width:33%">具体表现</th><th>本站的处理</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">心理 vs 物质判定相反</td>
              <td class="dg a">不同轴<br><span class="mut2" style="font-size:10.5px">不是冲突</span></td>
              <td class="mut2">月亮天蝎：占星「落」；太阴在亥：紫微「庙」</td>
              <td>两轴<b>不合并只并排</b>，输出「物质有靠，但心里不安」</td>
            </tr>
            <tr>
              <td class="pn">命宫 / 身宫口径分歧</td>
              <td class="dg b">流派差异</td>
              <td class="mut2">本地引擎：命宫戊寅 / 身宫丙戌；iztro：命宫乙酉 / 身宫酉（14/26法 vs 和法）</td>
              <td class="red">两套并排显示，<b>不取其一</b>；未判定谁对</td>
            </tr>
            <tr>
              <td class="pn">月将 vs 月建</td>
              <td class="dg b">约定不同</td>
              <td class="mut2">月建按<b>节气</b>换、月将按<b>中气</b>换，中点差半个月</td>
              <td class="red">明确写明<b>不存在固定偏移</b>，禁止按 ±n 宫硬算</td>
            </tr>
            <tr>
              <td class="pn">父母宫位置</td>
              <td class="dg b">体系差异</td>
              <td class="mut2">紫微父母宫在十二宫第 12 位；占星父母常看 4 / 10 宫</td>
              <td class="red"><b>并列呈现，不折算</b></td>
            </tr>
            <tr>
              <td class="pn">七政庙旺 vs 占星本质尊贵</td>
              <td class="dg b">同一轴<br><span class="mut2" style="font-size:10.5px">若相反才是真冲突</span></td>
              <td class="mut2">两者都是 f(星, 星座)，可直接比较</td>
              <td class="red">本条<b>才是真冲突</b>：并列不平均，标 <code>sameAxis</code></td>
            </tr>
            <tr>
              <td class="pn">时支只能推到 67.5%</td>
              <td class="dg b">精度不足</td>
              <td class="mut2">偏差集中在时辰边界（±1 位），缺均时差以外的残余误差</td>
              <td class="red">标 <code>measuredAccuracy: 0.675</code>，<b>不可替代真实出生时辰</b></td>
            </tr>
            <tr>
              <td class="pn">年柱 / 日柱不可从落位推出</td>
              <td class="dg b">原理性</td>
              <td class="mut2">60 甲子是"计数"，星盘里没有编码它的量</td>
              <td class="red">须外部锚点；<b>不声称可推</b>，也不假装差一点</td>
            </tr>
            <tr>
              <td class="pn">60 甲子连续性只是假设</td>
              <td class="dg b">史料问题</td>
              <td class="mut2">独立检验：前113→1965 跨 2077 年精确对上；汉太初历元差 1 位</td>
              <td class="red">承认<b>局部 1 天级调整</b>；对公元前日柱不作断言</td>
            </tr>
            <tr>
              <td class="pn">二十八宿</td>
              <td class="dg b">不可通约</td>
              <td class="mut2">赤道分度，与黄道十二宫是非线性关系；长短悬殊（井 31° vs 觜 2°）</td>
              <td class="red">只做<b>位置标注</b>，不折算成星座或宫位</td>
            </tr>
            <tr>
              <td class="pn">紫炁</td>
              <td class="dg b">不可通约</td>
              <td class="mut2">纯中国概念，西方占星无对应物</td>
              <td class="red">标为<b>不可通约</b>，<b>不强行换算</b></td>
            </tr>
            <tr>
              <td class="pn">神煞 ↔ 心理</td>
              <td class="dg b">内部一致性</td>
              <td class="mut2">只能算"收敛度"，不能证明该心理倾向必然显现</td>
              <td class="red">标为<b>内部一致性</b>，<b>不是外部验证</b></td>
            </tr>
          </tbody>
        </table>

        <div class="note" style="font-size:12.5px;line-height:2;margin-top:14px">
          <b style="color:#ffd58a">三条不可让步的处理原则：</b><br>
          <b>①</b> 能把性质说清的，一定标明（精度 / 流派 / 不可通约）——让人知道该不该信这一条；<br>
          <b>②</b> 同一轴上的相反结论<b>并列不平均</b>；不同轴上的相反结论<b>各自成立</b>，并给出完整读法句；<br>
          <b>③</b> 不可通约的，<b>禁止它去对应</b>——宁可少说，不做虚假统一。
        </div>
        <div class="note" style="font-size:12px;line-height:1.9;margin-top:10px;color:rgba(160,200,225,.72)">
          更完整的论证与边界讨论见 <a href="/paper.html" style="color:#5ef1ff">《论中西命理体系的融合路径》</a> 第八节。
        </div>
      </div>

      `;
  // 插在「实验性板块」之前
  const anchor = '<h2 id="sec-experiment">实验性板块';
  if (html.includes(anchor)) {
    html = html.replace(anchor, CARD + anchor);
    changed.push('体系冲突专节');
  } else {
    // 退路：插在开源署名之前
    const alt = '<h2 id="sec-credits">开源项目与数据来源';
    if (html.includes(alt)) { html = html.replace(alt, CARD + alt); changed.push('体系冲突专节(退路)'); }
  }
}

fs.writeFileSync('web/index.html', html, 'utf8');
console.log('改动：', changed.length ? changed.join(' / ') : '无');

/* ══════════ ④ 样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.toc-grid')) {
  css += `

/* ══════════ 关于页 · 总览索引 ══════════ */
.toc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px}
.toc-i{display:flex;align-items:baseline;gap:8px;padding:9px 11px;border-radius:9px;text-decoration:none;
  background:rgba(8,18,30,.6);border:1px solid rgba(90,160,220,.2);transition:all .15s}
.toc-i:hover{background:rgba(94,241,255,.1);border-color:rgba(94,241,255,.42);transform:translateY(-1px)}
.toc-i b{color:rgba(94,241,255,.85);font-size:12px;font-weight:800;min-width:12px}
.toc-i span{color:#dfeaf5;font-size:13px;font-weight:600}
.toc-i i{display:block;font-style:normal;font-size:10.5px;color:rgba(150,190,220,.6);margin-left:auto;text-align:right}
.toc-i.warn{border-color:rgba(255,154,138,.3);background:rgba(255,154,138,.05)}
.toc-i.warn b{color:#ff9a8a}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('样式已加');
}

/* 校验 */
const a = fs.readFileSync('web/index.html', 'utf8');
const must = ['about-toc', 'sec-conflict', 'sec-privacy', 'sec-not-collage', 'sec-method',
  'sec-experiment', 'sec-credits', 'sec-howto', '体系冲突 · 话说不到一起去的地方',
  '不可通约', '并列不平均', '禁止它去对应'];
console.log('\n校验：');
let bad = 0;
for (const k of must) { const v = a.includes(k); if (!v) bad++; console.log(' ', v ? '✅' : '❌', k); }
const bal = (a.match(/<div\b/g) || []).length === (a.match(/<\/div>/g) || []).length
  && (a.match(/<table\b/g) || []).length === (a.match(/<\/table>/g) || []).length
  && (a.match(/<tr\b/g) || []).length === (a.match(/<\/tr>/g) || []).length;
console.log(' ', bal ? '✅' : '❌', '标签开闭平衡');
process.exit(bad || !bal ? 1 : 0);
