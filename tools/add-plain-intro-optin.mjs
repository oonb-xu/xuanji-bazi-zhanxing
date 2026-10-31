// 关于页改造：
//  ① 白话引导提到最前（大部分人只想用，不想读论文）
//  ② 体系冲突节加「这是开源的，你可以基于这个模型跑」邀请
//  ③ 排盘表单加「是否愿意上交匿名信息」选项（默认不交）
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');
let changed = [];

/* ══════════ ① 白话引导 → 提到最前 ══════════ */
const PLAIN_MARK = 'sec-plain-start';
if (!html.includes(PLAIN_MARK)) {
  const PLAIN = `<div class="card" id="sec-plain-start" style="margin-bottom:18px;border-color:rgba(125,255,180,.34);background:rgba(125,255,180,.05)">
        <h2 style="margin-top:0;font-size:20px;color:#7dffb4">先看这里 · 只想用的人可以停在这一屏</h2>
        <div class="note" style="font-size:13.5px;line-height:2.1">
          <b>三步就能出结果：</b><br>
          <b class="gold">①</b> 填出生年月日 + 时辰 + 出生地　
          <b class="gold">②</b> 点「排盘」　
          <b class="gold">③</b> 看那张全屏融合盘（可点击每颗行星看详情）<br><br>
          <b style="color:#ffd58a">你需要知道的只有三件事：</b><br>
          · <b>数据不上传</b>——除非你自己勾选"愿意贡献"，否则全部只在你本机算。<br>
          · <b>时辰很重要</b>——不知道时辰，命宫、身宫、时柱都定不了；本页提供「生时矫正」帮你反推。<br>
          · <b>它不给你算命</b>——它把结构摆出来（力量、领域、心理轴、物质轴），
          判断留给你。<br><br>
          <span class="mut2">下面那些论文式的论证、冲突清单、实验记录，是给想追根问底的人看的。
          不感兴趣可以直接跳过——不影响你使用。</span>
        </div>
      </div>

      `;
  // 插在 about-toc 之前（即整页最前）
  const anchor = '<div class="card" id="about-toc"';
  if (html.includes(anchor)) {
    html = html.replace(anchor, PLAIN + anchor);
    changed.push('白话引导置顶');
  } else {
    // 退路：插在「这不是拼贴」之前
    const alt = '<h2 id="sec-not-collage">';
    if (html.includes(alt)) { html = html.replace(alt, PLAIN + alt); changed.push('白话引导置顶(退路)'); }
  }
}

/* 导航索引同步加一项（放到第 1 位） */
if (!html.includes('href="#sec-plain-start"')) {
  html = html.replace(
    '<a href="#sec-not-collage" class="toc-i"><b>1</b>',
    '<a href="#sec-plain-start" class="toc-i ok"><b>0</b><span>先看这里</span><i>只想用的人</i></a>\n          <a href="#sec-not-collage" class="toc-i"><b>1</b>'
  );
  changed.push('导航加「先看这里」');
}

/* ══════════ ② 开源邀请 ══════════ */
if (!html.includes('opensource-invite')) {
  const INVITE = `
        <div class="card" id="opensource-invite" style="margin-top:14px;border-color:rgba(94,241,255,.36);background:rgba(94,241,255,.05)">
          <div class="note" style="font-size:13px;line-height:2">
            <b style="color:#5ef1ff">如果你认为上面某一条有解 —— 这个项目是开源的，请直接在这个模型上跑。</b><br>
            以上每一条"做不到"，我们都附了<b>可复现的脚本与数据格式</b>。
            你可以：<br>
            · 用你自己的数据重跑（tools/ 下每个结论都对应一个可执行脚本）<br>
            · 直接改算法（核心模块在 src/cross/ 与 src/bazi/，全部有独立断言）<br>
            · 提出反例（能跑出不同结果的样本最有价值）<br><br>
            <span class="mut2">我们不认为这些边界是终点。它们是<b>当前版本在哪停下</b>的诚实记录——
            而记录本身就是为了被后来者推翻。</span>
          </div>
        </div>
`;
  const anchor = '三条不可让步的处理原则';
  if (html.includes(anchor)) {
    // 插在该段之后的 </div> 之前：找到「三条不可让步」所在的最后一个 </div>
    const i = html.indexOf(anchor);
    const closeIdx = html.indexOf('</div>', html.indexOf('宁可少说，不做虚假统一', i));
    if (closeIdx > 0) {
      html = html.slice(0, closeIdx + 6) + INVITE + html.slice(closeIdx + 6);
      changed.push('开源邀请');
    }
  }
}

/* ══════════ ③ 排盘表单：数据上交选项（默认不交）══════════ */
if (!html.includes('opt-contribute')) {
  const BOX = `
          <div class="opt-row opt-contribute" style="grid-column:1 / -1">
            <label class="opt-check">
              <input type="checkbox" id="opt-contribute" name="contribute" value="1">
              <span class="opt-box"></span>
              <span class="opt-txt">
                <b>我愿意贡献这次匿名数据</b>
                <i>默认<b style="color:#7dffb4">不勾选</b>＝完全不上传，只在本机计算。
                  勾选后仅上传<b>出生时间 + 事件记录</b>（不含姓名、联系方式、IP）。
                  用途：校准模型。可随时撤回。</i>
              </span>
            </label>
          </div>
`;
  // 插到融合表单的提交按钮之前
  const formIdx = html.indexOf('id="f-fusion"');
  if (formIdx > 0) {
    const btnIdx = html.indexOf('<button', html.indexOf('type="submit"', formIdx) - 200);
    // 更稳：找该 form 内的 </form> 前插入
    const endIdx = html.indexOf('</form>', formIdx);
    if (endIdx > 0) {
      html = html.slice(0, endIdx) + BOX + html.slice(endIdx);
      changed.push('数据上交选项');
    }
  }
}

fs.writeFileSync('web/index.html', html, 'utf8');
console.log('改动：', changed.length ? changed.join(' / ') : '无');

/* ══════════ ④ 样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.opt-check')) {
  css += `

/* ══════════ 可选：数据贡献勾选 ══════════ */
.opt-row{margin:14px 0 4px}
.opt-check{display:flex;gap:10px;align-items:flex-start;cursor:pointer;padding:11px 13px;border-radius:10px;
  background:rgba(8,18,30,.55);border:1px solid rgba(90,160,220,.22);transition:all .15s}
.opt-check:hover{border-color:rgba(94,241,255,.4)}
.opt-check input{position:absolute;opacity:0;width:0;height:0}
.opt-check .opt-box{flex:0 0 auto;width:17px;height:17px;margin-top:2px;border-radius:5px;
  border:1.5px solid rgba(120,180,220,.45);background:rgba(4,10,18,.8);position:relative;transition:all .15s}
.opt-check input:checked + .opt-box{background:#7dffb4;border-color:#7dffb4}
.opt-check input:checked + .opt-box::after{content:'';position:absolute;left:5px;top:1.5px;width:4px;height:9px;
  border:solid #04170c;border-width:0 2px 2px 0;transform:rotate(42deg)}
.opt-txt{font-size:12.5px;line-height:1.75;color:rgba(200,222,238,.9)}
.opt-txt b{color:#eaf7ff;font-size:13px;display:block;margin-bottom:2px}
.opt-txt i{font-style:normal;color:rgba(150,190,220,.78);font-size:11.5px;line-height:1.7}
.toc-i.ok{border-color:rgba(125,255,180,.4);background:rgba(125,255,180,.06)}
.toc-i.ok b{color:#7dffb4}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('样式已加');
}

/* 校验 */
const a = fs.readFileSync('web/index.html', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['白话引导存在', a.includes(PLAIN_MARK)],
  ['引导在 TOC 之前', a.indexOf(PLAIN_MARK) > 0 && a.indexOf(PLAIN_MARK) < a.indexOf('about-toc')],
  ['开源邀请', a.includes('opensource-invite')],
  ['含"开源"承诺', a.includes('这个项目是开源的')],
  ['数据上交选项', a.includes('opt-contribute')],
  ['默认不勾选', a.includes('value="1">') && !a.includes('id="opt-contribute" name="contribute" value="1" checked')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
const bal = (a.match(/<div\b/g) || []).length === (a.match(/<\/div>/g) || []).length;
console.log(' ', bal ? '✅' : '❌', 'div 平衡');
process.exit(bad || !bal ? 1 : 0);
