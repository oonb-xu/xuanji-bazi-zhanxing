// 【定位声明】关于页：本系统不是"把两个体系的输出拉在一起"，而是"用底层逻辑对应的系统"
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');

const MARK = '这不是拼贴，是底层逻辑对应';
if (html.includes(MARK)) { console.log('已存在'); process.exit(0); }

const CARD = `<h2>这不是拼贴，是底层逻辑对应</h2>
      <div class="card" style="margin-bottom:16px;border-color:rgba(94,241,255,.34);background:rgba(94,241,255,.045)">
        <div class="note" style="font-size:13.5px;line-height:2.05">
          <b style="color:#7dffb4;font-size:15px">本系统不是把两套体系的输出结果拉在一起做对照。</b><br>
          它做的是：<b style="color:#5ef1ff">先找到两个体系在底层真正对应的那个量，再在那个量上建立映射。</b>
        </div>
        <div class="note" style="font-size:12.5px;line-height:2;margin-top:12px">
          <b>两者的区别是根本性的：</b><br>
          <span style="color:#ff9a8a">✗ 结果拼贴</span>：占星说「土星入庙」⇒ 好；八字说「官杀重」⇒ 压力大。
          两句并列摆着，靠人去找感觉。这种对照<b>没有可检验的基础</b>，换一个人能给出相反的解读。<br>
          <span style="color:#7dffb4">✓ 底层对应</span>：先证明「月支」与「太阳黄经」是<b>同一个事实的两种命名</b>
          （节气就是太阳黄经的 30° 刻度，立春 315° = 建寅）—— 这是恒等式，不是比喻。
          映射建立在恒等式上，才能被机器检验、被别人复现。
        </div>
        <div class="note" style="font-size:12.5px;line-height:2;margin-top:12px">
          <b style="color:#ffd58a">本系统已经找到的底层对应（可机检）：</b>
        </div>
        <table class="holo-tb" style="margin-top:8px">
          <thead><tr><th>底层对应</th><th>为什么是"同一个量"</th><th>实测</th></tr></thead>
          <tbody>
            <tr><td class="pn">月支 ⇔ 太阳黄经</td><td class="mut2">节气就是太阳黄经的 30° 刻度，两者是同一事实的两种命名</td><td class="dg a">100%</td></tr>
            <tr><td class="pn">时支 ⇔ 太阳时角</td><td class="mut2">时辰是时角的 2 小时分块；均时差由太阳黄经反算</td><td class="dg n">67.5%</td></tr>
            <tr><td class="pn">七政 ⇔ 七曜</td><td class="mut2">同源体系（均出自巴比伦黄道十二宫），名异实同</td><td class="dg a">严格</td></tr>
            <tr><td class="pn">罗睺/计都/月孛 ⇔ 北南交点/月亮远地点</td><td class="mut2">同一轨道要素的两个名字</td><td class="dg a">严格</td></tr>
            <tr><td class="pn">十二宫 ⇔ 生活领域</td><td class="mut2">占星与紫微的宫位功能一一对齐</td><td class="dg n">结构</td></tr>
          </tbody>
        </table>
        <div class="note" style="font-size:12.5px;line-height:2;margin-top:12px">
          <b style="color:#ffd58a">以及明确承认做不到的：</b><br>
          · <b>年柱、日柱无法从行星位置推出 —— 60 甲子里的「60」**确有天文近似依据**：它是 LCM(12木, 30土)，也 ≈ 3 次木土会合（59.577 年）；且 6 个甲子日 = 360 天，与回归年 365.2422 天咬合 98.56%。但「60」在这套体系里**是计数，不是可测的几何量** —— 星盘能给出所有角度，却给不出"这是第几个甲子"。要从落位反推年柱/日柱，必须有一个**外部纪元锚点**（如 1984 = 甲子）。这是原理性边界，不是精度问题。<br>
          · 两套体系的心理/物质庙旺<b>不在同一根轴上</b>（占星 f(星,星座)=心理；紫微 f(星,宫位)=物质），
          所以它们给出相反结论时<b>不是矛盾</b>，而是各测各的。<br>
          <b>凡是不能对应的，本系统不允许它去对应。</b>
        </div>
        <div class="note" style="font-size:12px;line-height:1.9;margin-top:12px;color:rgba(160,200,225,.75)">
          更完整的论证见 <a href="/paper.html" style="color:#5ef1ff">《论中西命理体系的融合路径》</a>。
        </div>
      </div>

      `;

// 插在隐私承诺卡片之后、「怎么用 · 需要接 API 吗」之前
const anchor = '<h2>方法论 · 融合路径论文</h2>';
if (html.includes(anchor)) {
  html = html.replace(anchor, CARD + anchor);
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('✅ 定位声明已插入（论文入口之前）');
} else {
  // 退路：插在 API 段之前
  const alt = '<h2>怎么用 · 需要接 API 吗</h2>';
  if (html.includes(alt)) {
    html = html.replace(alt, CARD + alt);
    fs.writeFileSync('web/index.html', html, 'utf8');
    console.log('✅ 定位声明已插入（API 段之前·退路）');
  } else {
    console.error('❌ 未找到插入锚点');
    process.exit(1);
  }
}

/* 校验 */
const after = fs.readFileSync('web/index.html', 'utf8');
for (const [k, v] of [
  ['含声明标题', after.includes(MARK)],
  ['含"不是把两套体系的输出结果拉在一起"', after.includes('不是把两套体系的输出结果拉在一起')],
  ['含 100% 恒等', after.includes('100%')],
  ['含原理性边界', after.includes('原理性边界')],
  ['div 开闭平衡', (after.match(/<div\b/g) || []).length === (after.match(/<\/div>/g) || []).length],
  ['table 开闭平衡', (after.match(/<table\b/g) || []).length === (after.match(/<\/table>/g) || []).length],
]) console.log(' ', v ? '✅' : '❌', k);
