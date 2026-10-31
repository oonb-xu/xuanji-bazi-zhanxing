// 实验性板块扩充：万年历修正史 + 59.58 假说 + 影响面 + 何时提示用户
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');

const MARK = 'sec-59-58';
if (html.includes(MARK)) { console.log('已存在'); process.exit(0); }

const CARD = `<h2 id="sec-59-58">实验性假说 · 如果真实周期是 59.58 年</h2>
      <div class="card" style="margin-bottom:16px;border-color:rgba(180,140,255,.36);background:rgba(180,140,255,.04)">
        <div class="note" style="font-size:13px;line-height:2">
          <b style="color:#b48cff">这是一个假说，不是结论。</b>它问的是：
          如果八字的真实周期不是整数 60，而是 <b>3 次木土会合 = 59.577 年</b>，
          那么哪些柱会变、哪些不会、什么时候会开始不一致？
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:14px">
          <b style="color:#5ef1ff">① 问题的由来：节气一直在修，干支是冻结的</b><br>
          中国历史上改历极为频繁（汉太初历、三统历、大衍历、授时历、时宪历……），
          <b>每一次的核心目的都是修节气</b>——因为节气必须跟着真实太阳位置走。<br>
          但<b>干支纪年/纪日是一套冻结的 60 进位</b>，它不随历法一起修正。
          如果真实天文周期不是正好 60，那么这套冻结的刻度就会<b>越走越偏</b>。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:12px">
          <b style="color:#5ef1ff">② 偏差有多大（本站实算）</b>
        </div>
        <table class="holo-tb" style="margin-top:6px">
          <thead><tr><th>量</th><th>数值</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td class="pn">标准周期</td><td class="mut2">60.0000 年</td><td class="mut2">60 甲子</td></tr>
            <tr><td class="pn">木土会合</td><td class="mut2">19.8590 年</td><td class="mut2">synodic</td></tr>
            <tr><td class="pn">3× 会合</td><td class="dg b">59.5770 年</td><td class="mut2">假说中的"真周期"</td></tr>
            <tr><td class="pn">每周期差</td><td class="dg b">0.4230 年 = 155 天</td><td class="mut2">这就是"微分"</td></tr>
            <tr><td class="pn">每年相对推进差</td><td class="mut2">0.710%</td><td class="mut2">逐年累积</td></tr>
          </tbody>
        </table>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:14px">
          <b style="color:#5ef1ff">③ 影响面：只动 3 处，不动 5 处</b>
        </div>
        <table class="holo-tb" style="margin-top:6px">
          <thead><tr><th style="width:22%">柱 / 项</th><th style="width:26%">由什么决定</th><th>是否受 59.58 影响</th></tr></thead>
          <tbody>
            <tr><td class="pn">年柱</td><td class="mut2">60 甲子年循环</td><td class="dg b"><b>★ 受影响</b></td></tr>
            <tr><td class="pn">月干</td><td class="mut2">f(年干, 月支)</td><td class="dg b"><b>★ 连带受影响</b>（年干变则月干变）</td></tr>
            <tr><td class="pn">胎元</td><td class="mut2">月干+1、月支+3</td><td class="dg b"><b>★ 连带受影响</b></td></tr>
            <tr><td class="pn">月支</td><td class="mut2">节气（太阳黄经 30° 刻度）</td><td class="dg a">不变 —— 节气本就随天文修正</td></tr>
            <tr><td class="pn">日柱</td><td class="mut2">连续天数 mod 60</td><td class="dg a">不变 —— 与木土周期无关</td></tr>
            <tr><td class="pn">时柱</td><td class="mut2">日干 + 时支</td><td class="dg a">不变</td></tr>
            <tr><td class="pn">命宫 / 身宫</td><td class="mut2">f(月支, 时支)</td><td class="dg a">不变</td></tr>
          </tbody>
        </table>
        <div class="note" style="font-size:12px;line-height:1.9;margin-top:8px;color:rgba(160,200,225,.75)">
          ⇒ <b>七柱里只有三处会被这个假说改动</b>。这意味着即便假说成立，影响面也远小于"整盘作废"。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:14px">
          <b style="color:#5ef1ff">④ 什么时候才真的会不一致（实算 1800–2200）</b><br>
          本站以 <b>1984 = 甲子</b> 为共同锚点，逐年比较标准年柱与 59.577 版年柱：
        </div>
        <div class="holo-note" style="margin-top:6px;font-size:12.5px;line-height:2">
          · <b class="green">1984–2124 之间（约 150 年）：两者完全一致</b> —— 对现代出生的人，
            这个假说<b>不改变任何结果</b>。<br>
          · <b class="red">1800–1983</b> 与 <b class="red">2125 以后</b>：开始分歧，最大差 2 步。<br>
          · 全区间分歧年占比 <b>64.8%</b> —— 但这是因为扫描窗口大部分落在 1984 的两侧之外。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:14px">
          <b style="color:#5ef1ff">⑤ 用法的修正（这一条最容易做错）</b><br>
          不能"直接用日历年重算年柱"——因为<b>立春之前的日期，其八字年属于上一年</b>。
          正确做法是：<b>只取「同年数下标准索引与实验索引之差」，把这个差分施加到盘上真实的年柱上</b>。
          本站已按这个方式实现并自检（年柱不变 ⇒ 月干必然也不变）。
        </div>

        <div class="note" style="font-size:12.5px;line-height:1.95;margin-top:14px">
          <b style="color:#ffd58a">⑥ 何时会提示你使用实验性排盘</b><br>
          排盘页在以下情况会<b>显式提示</b>，而不是悄悄换算法：<br>
          · 出生年份落在 <b>1984±150 年之外</b>（此时两套年柱可能不同）<br>
          · 盘上实际年柱与实验年柱<b>不一致</b><br>
          · 届时给出<b>两套结果并排</b>（标准版 vs 你选择的实验版），<b>绝不替你选</b>。
        </div>

        <div class="note" style="font-size:12px;line-height:1.95;margin-top:14px;color:rgba(160,200,225,.75)">
          <b>这一步的意义</b>：把"历法冻结 vs 天文漂移"这个隐性问题，变成<b>可开关、可对比、可复现</b>的实验。
          无论假说最终成立与否，<b>能把它量化到"只动三处、只影响 ±150 年之外"，本身就是一条结论</b>。<br>
          复现：<code>node tools/verify-experimental-calendar.mjs</code>
        </div>
      </div>

      `;

// 插在「实验性板块 · 60 甲子」之后（即体系冲突之前）
const anchor = '<h2 id="sec-conflict">';
if (html.includes(anchor)) {
  html = html.replace(anchor, CARD + anchor);
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('✅ 59.58 假说板块已插入（体系冲突之前）');
} else {
  console.error('❌ 未找到锚点');
  process.exit(1);
}

/* 导航加一项 */
if (!html.includes('href="#sec-59-58"')) {
  html = html.replace(
    '<a href="#sec-conflict" class="toc-i warn">',
    '<a href="#sec-59-58" class="toc-i warn"><b>4</b><span>59.58 假说</span><i>历法冻结与漂移</i></a>\n          <a href="#sec-conflict" class="toc-i warn">'
  );
  // 重编号
  let n = 0;
  html = html.replace(/(<a href="#sec-[\w-]+" class="toc-i[^"]*"><b>)(\d+)(<\/b>)/g, (m, a, _o, c) => { n++; return a + n + c; });
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('   导航已加并重编号（共 ' + n + ' 项）');
}

/* 校验 */
const a = fs.readFileSync('web/index.html', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['59.58 板块', a.includes(MARK)],
  ['含 59.5770', a.includes('59.5770')],
  ['含 155 天', a.includes('155 天')],
  ['含影响面三变五不变', a.includes('只动 3 处')],
  ['含 1984±150 窗口', a.includes('1984–2124')],
  ['含立春陷阱', a.includes('立春之前的日期')],
  ['含实验性排盘提示', a.includes('实验性排盘')],
  ['导航含 59.58', a.includes('href="#sec-59-58"')],
  ['div 平衡', (a.match(/<div\b/g) || []).length === (a.match(/<\/div>/g) || []).length],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
