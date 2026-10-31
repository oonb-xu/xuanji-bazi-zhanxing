// 新增前端「时序」页：把四钟按年份并排（互通层对齐 / 不互通层并排补充）
import fs from 'node:fs';

let html = fs.readFileSync('web/index.html', 'utf8');
if (html.includes('data-page="timeline"')) { console.log('已存在'); process.exit(0); }

/* ① 页面 HTML */
const PAGE = `    <!-- ⑦ 时序（四钟对齐） -->
    <section class="page" data-page="timeline">
      <h2 class="page-title">时序 <span class="sub">大运 · 流年 × 次运 · 行运</span></h2>
      <div class="form card" id="f-timeline-card">
        <form id="f-timeline">
          <div class="grid2">
            <label>出生时间<input type="text" name="at" value="2000-01-01 12:00" required></label>
            <label>性别<select name="gender"><option>男</option><option>女</option></select></label>
            <label>经度<input type="number" name="lng" step="0.001" value="116.407"></label>
            <label>纬度<input type="number" name="lat" step="0.001" value="39.904"></label>
            <label>起始年<input type="number" name="fromYear" value="1990"></label>
            <label>结束年<input type="number" name="toYear" value="2050"></label>
          </div>
          <button type="submit">生成时序</button>
        </form>
        <div class="note" style="margin-top:10px">四钟刻度不同：大运 10 年/步｜流年 1 年｜次运 1 天=1 年（象征推进）｜行运 实时。只能按年份对齐，不能互相换算。</div>
      </div>
      <div id="timeline-out"></div>
    </section>

`;
html = html.replace('  </main>', PAGE + '  </main>');

/* ② 导航按钮 */
if (!html.includes('data-go="timeline"')) {
  html = html.replace('<button type="button" data-go="rectify"',
    '<button type="button" data-go="timeline" title="四钟时序"><i class="ic">⏱</i><span>时序</span></button>\n    <button type="button" data-go="rectify"');
}

/* ③ 引入脚本 */
if (!html.includes('/timeline-ui.js')) {
  html = html.replace('<script type="module" src="/app.js"></script>',
    '<script type="module" src="/timeline-ui.js"></script>\n  <script type="module" src="/app.js"></script>');
}
fs.writeFileSync('web/index.html', html, 'utf8');
console.log('① 页面与导航已加');
