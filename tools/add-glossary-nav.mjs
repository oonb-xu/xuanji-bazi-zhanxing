// 把「术语查表」入口加到主页（用 <a href> 不用 data-go，避免与 nav-guard 冲突）
import fs from 'node:fs';
let html = fs.readFileSync('web/index.html', 'utf8');
let changed = [];

/* ① 侧边导航加一项（放在「关于」之后） */
if (!html.includes('/glossary.html')) {
  // 找到关于页的 tab 按钮
  const re = /(<button[^>]*data-go="about"[^>]*>[\s\S]{0,120}?<\/button>)/;
  const m = html.match(re);
  if (m) {
    const link = '\n        <a class="tab" href="/glossary.html" title="术语查表 · 四系统白话对照"><span class="tab-ic">🔍</span><span>查表</span></a>';
    html = html.replace(m[1], m[1] + link);
    changed.push('侧边导航');
  } else {
    // 退路：插在 tabbar 结束前
    const i = html.indexOf('</nav>');
    if (i > 0) {
      html = html.slice(0, i) + '<a class="tab" href="/glossary.html" title="术语查表"><span class="tab-ic">🔍</span><span>查表</span></a>\n      ' + html.slice(i);
      changed.push('侧边导航(退路)');
    }
  }
}

/* ② 关于页也放一个明显的入口卡片 */
if (!html.includes('术语查表 · 四系统白话对照')) {
  const anchor = '<h2>怎么用 · 需要接 API 吗</h2>';
  const card = `<h2>查术语</h2>
      <div class="card" style="margin-bottom:16px">
        <div class="note" style="font-size:13px;line-height:2">
          看不懂「罗睺」「化忌」「觜宿」「天梁」？打开 <a href="/glossary.html" style="color:#5ef1ff"><b>术语查表</b></a>，
          输入任意星宿 / 神煞 / 主星 / 行星名，会告诉你：
          <b>属于哪套体系 → 对应哪个十神 → 白话是什么意思</b>。<br>
          同一个词可能跨体系（例如「太阳」既是紫微主星也是占星行星），会一并列出。
        </div>
      </div>

      `;
  if (html.includes(anchor)) {
    html = html.replace(anchor, card + anchor);
    changed.push('关于页入口卡');
  }
}

fs.writeFileSync('web/index.html', html, 'utf8');
console.log('改动：', changed.length ? changed.join(' / ') : '无（已存在）');

/* 校验 */
const after = fs.readFileSync('web/index.html', 'utf8');
const checks = [
  ['含 glossary.html 链接', after.includes('/glossary.html')],
  ['含查表入口卡', after.includes('术语查表 · 四系统白话对照')],
  ['div 开闭平衡', (after.match(/<div\b/g) || []).length === (after.match(/<\/div>/g) || []).length],
  ['script 配对', (after.match(/<script\b/g) || []).length === (after.match(/<\/script>/g) || []).length],
];
console.log('\n校验：');
let bad = 0;
for (const [k, v] of checks) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
