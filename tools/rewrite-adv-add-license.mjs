// ① 重写「各体系独有优势」→ 改成「在链的哪一段最强」
// ② 关于页最底部加 Apache-2.0 许可声明卡
// ③ 本页导航加第 12 项「许可协议」
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-adv-license', h, 'utf8');

/* ── ① 重写 #adv 内容 ── */
const ADV = `<div id="adv">
          <p class="note" style="margin:0 0 10px">
            换了问法之后，「各体系独有优势」这个问题应该重新提：
            <b>与其问"它有什么优点"，不如问"在整条链的哪一段，它是唯一还站得住的"</b>。
            因为每套体系都只在自己<b>保留最完整</b>的那一段最强 —— 别的段落它并不比别人强。
          </p>
          <table class="holo-tb">
            <thead><tr><th style="width:16%">体系</th><th style="width:20%">最强的一段</th><th>具体能力</th></tr></thead>
            <tbody>
              <tr>
                <td class="pn">七政四余</td>
                <td class="mut"><b>天文层</b><br>宿度 → 宫次</td>
                <td class="mut">星曜的<b>实际位置</b>与庙旺、四余（罗睺/计都/月孛/紫气）—— 唯一能对上<b>恒星宿度</b>的体系</td>
              </tr>
              <tr>
                <td class="pn">古典占星</td>
                <td class="mut"><b>几何层 → 心理侧</b></td>
                <td class="mut">星座 + 宫位<b>双维度</b>刻画、相位几何、本质尊贵 —— 「黄经 → 星座/宫位」这一段它最完整</td>
              </tr>
              <tr>
                <td class="pn">八字</td>
                <td class="mut"><b>计数层 → 力量侧</b></td>
                <td class="mut"><b>十神的相对性</b>（同一个字，换个日主就换意义）、身强弱与扶抑、大运流年的<b>时序</b> —— 计数层是它独有的</td>
              </tr>
              <tr>
                <td class="pn">紫微斗数</td>
                <td class="mut"><b>符号层 → 结构侧</b></td>
                <td class="mut">十二宫<b>强结构</b>、四化（禄权科忌）、星曜组合与亮度 —— 全链符号化换来的结构密度最高</td>
              </tr>
            </tbody>
          </table>

          <div class="note" style="margin:14px 0 0">
            <b style="color:#5ef1ff">逐条展开（只看它在那一段为什么不可替代）</b>
          </div>

          <div style="margin-top:10px">
            <div class="pn" style="font-size:14px;margin-bottom:4px">七政四余 · 天文层</div>
            <div class="mut" style="margin:0 0 4px 12px">· <b>宿度为锚</b>：唯一直接落在二十八宿上的体系，岁差可单独记账</div>
            <div class="mut" style="margin:0 0 10px 12px">· <b>四余独有</b>：罗睺/计都（交点）、月孛（远地点）、紫气 —— 占星没有对应物</div>
          </div>

          <div>
            <div class="pn" style="font-size:14px;margin-bottom:4px">古典占星 · 几何层（心理侧）</div>
            <div class="mut" style="margin:0 0 4px 12px">· <b>双维度</b>：同一颗星在不同星座 / 不同宫位，意义不同，且两轴独立</div>
            <div class="mut" style="margin:0 0 10px 12px">· <b>相位几何</b>：角距是纯几何量，不依赖历法，故最稳定</div>
          </div>

          <div>
            <div class="pn" style="font-size:14px;margin-bottom:4px">八字 · 计数层（力量侧）</div>
            <div class="mut" style="margin:0 0 4px 12px">· <b>相对性</b>：十神是"关系"而不是"东西"，这是别的体系结构上给不出的</div>
            <div class="mut" style="margin:0 0 4px 12px">· <b>可机算</b>：计数层不依赖天文，纯查表 + 算术即可复现 ⇒ 可批量验证</div>
            <div class="mut" style="margin:0 0 10px 12px">· <b>时序强</b>：大运/流年给了明确的时间刻度</div>
          </div>

          <div>
            <div class="pn" style="font-size:14px;margin-bottom:4px">紫微斗数 · 符号层（结构侧）</div>
            <div class="mut" style="margin:0 0 4px 12px">· <b>宫位结构化</b>：十二宫各司其职，领域划分最细</div>
            <div class="mut" style="margin:0 0 4px 12px">· <b>四化</b>：禄权科忌给了一种"同星不同作用"的机制</div>
            <div class="mut" style="margin:0 0 10px 12px">· <b>代价</b>：天文输入为零，所以它能说"哪里"，说不了"多强"</div>
          </div>

          <div class="note" style="margin:14px 0 0;color:#ffc457">
            ⇒ <b>融合的准确表述</b>：不是"四套都拿来用"，而是
            <b>让每套体系只在自己保留最完整的那一段说话，其余段落让它闭嘴</b>。
            这也就是上一节「逆向复现」第四步（按链重装）在功能层的落地。
          </div>
        </div>`;

const advI = h.indexOf('id="adv"');
if (advI < 0) { console.error('❌ 找不到 #adv'); process.exit(1); }
const advStart = h.lastIndexOf('<div', advI);
const re = /<div\b|<\/div>/g; re.lastIndex = advStart;
let d = 0, m, advEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { advEnd = m.index + 6; break; } }
h = h.slice(0, advStart) + ADV + h.slice(advEnd);
console.log('✅ 已重写 #adv（新框架：在链的哪一段最强）');

/* ── ② 关于页最底部加许可卡 ── */
if (!h.includes('id="sec-license"')) {
  const LICENSE = `
      <div class="card" id="sec-license">
        <h2>开源许可 <span class="sub">Apache License 2.0</span></h2>
        <p class="note" style="margin:0 0 10px">
          本模型（含引擎、前端、文档与数据整理）以
          <b style="color:#5ef1ff">Apache License 2.0</b> 发布。
          这是一个<b>宽松型</b>许可 —— 允许商用，也允许闭源分发，但要求保留署名。
        </p>
        <table class="holo-tb">
          <thead><tr><th style="width:16%">类别</th><th>内容</th></tr></thead>
          <tbody>
            <tr>
              <td class="pn">允许</td>
              <td class="mut">商业使用 · 修改 · 分发 · 私人使用 · <b>专利授权</b>（贡献者不得事后以专利起诉使用者）</td>
            </tr>
            <tr>
              <td class="pn">要求</td>
              <td class="mut">
                ① 保留<b>版权声明</b>与<b>许可声明</b>；<br>
                ② 若修改了文件，须<b>在改动文件中注明</b>已修改；<br>
                ③ 分发时须<b>附上许可证副本</b>（LICENSE 文件）；<br>
                ④ 若原项目带 <b>NOTICE</b> 文件，分发时须一并保留其内容。
              </td>
            </tr>
            <tr>
              <td class="pn">不授予</td>
              <td class="mut">
                ① <b>商标权</b>（不得使用原作者名称/标识做背书）；<br>
                ② 任何形式的<b>担保</b>——软件按"现状"提供，作者不承担使用后果。
              </td>
            </tr>
          </tbody>
        </table>
        <div class="note" style="margin:12px 0 0">
          <b style="color:#ffc457">一句话读懂</b>：<b>你可以拿去做任何事（包括卖钱、闭源），
          只要保留版权与许可声明、改过的文件标一下、附上许可证、不拿作者名字做宣传、并接受"没有保修"。</b>
        </div>
        <div class="note" style="margin:10px 0 0;font-size:11.5px">
          许可证全文：<a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener" style="color:#5ef1ff">apache.org/licenses/LICENSE-2.0</a>
          · 第三方依赖各自遵循其原许可（见「开源与数据」一节中的逐条署名）
        </div>
      </div>
`;
  /* 找 about section 的闭合 */
  const aboutI = h.indexOf('data-page="about"');
  if (aboutI < 0) { console.error('❌ 找不到 about 页'); process.exit(1); }
  const secStart = h.lastIndexOf('<section', aboutI);
  const re2 = /<section\b|<\/section>/g; re2.lastIndex = secStart;
  let d2 = 0, m2, secEnd = -1;
  while ((m2 = re2.exec(h))) { d2 += m2[0] === '</section>' ? -1 : 1; if (d2 === 0 && m2[0] === '</section>') { secEnd = m2.index; break; } }
  if (secEnd < 0) { console.error('❌ about section 未闭合'); process.exit(1); }
  h = h.slice(0, secEnd) + LICENSE + '    ' + h.slice(secEnd);
  console.log('✅ 已加 Apache-2.0 许可卡（关于页最底部）');
}

/* ── ③ 本页导航加第 12 项 ── */
if (!h.includes('href="#sec-license"')) {
  const last = '<a href="#sec-credits" class="toc-i"><b>11</b><span>开源与数据</span><i>逐条署名</i></a>';
  const add = last + '<a href="#sec-license" class="toc-i"><b>12</b><span>开源许可</span><i>Apache-2.0</i></a>';
  if (!h.includes(last)) { console.error('❌ 找不到第 11 项'); process.exit(1); }
  h = h.replace(last, add);
  console.log('✅ 导航已加第 12 项「开源许可 · Apache-2.0」');
}

fs.writeFileSync(P, h, 'utf8');

/* 校验 */
const c = (s, r) => (s.match(r) || []).length;
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g],
  ['th', /<th\b/g, /<\/th>/g], ['p', /<p\b/g, /<\/p>/g], ['a', /<a\b/g, /<\/a>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) { bad++; console.log(`  ❌ ${n} ${c(h, o)}/${c(h, cl)}`); }
}
/* about 仍被 #app 包住 */
const app = h.indexOf('<div id="app"');
const at = h.indexOf('>', app) + 1;
const r3 = /<div\b|<\/div>/g; r3.lastIndex = at;
let d3 = 1, m3, appEnd = -1;
while ((m3 = r3.exec(h))) { d3 += m3[0] === '</div>' ? -1 : 1; if (d3 === 0) { appEnd = m3.index; break; } }
const inApp = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline', 'about'].every((k) => {
  const p = h.indexOf('data-page="' + k + '"'); return p > app && p < appEnd;
});
if (!inApp) { bad++; console.log('  ❌ #app 未包住全部页面'); }
console.log((bad ? '❌ ' : '✅ ') + '标签平衡 · #app 包住全部页面 · ' + h.length + ' 字节');
process.exit(bad ? 1 : 0);
