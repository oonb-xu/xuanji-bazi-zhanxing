// 在「融合」页标题后插入融合盘容器（用真正匹配的锚点）
import fs from 'node:fs';

const HOST = [
  '      <section class="fw-card" id="fusion-wheel-host">',
  '        <canvas></canvas>',
  '        <div class="fw-tip"></div>',
  '        <div class="fw-title">融合盘 <span>四柱（金）· 星盘（青）· 恒等连线</span></div>',
  '        <div class="fw-ctrl">',
  '          <button type="button" data-fw="spin" class="on">自转</button>',
  '          <button type="button" data-fw="pillars" class="on">四柱</button>',
  '          <button type="button" data-fw="planets" class="on">行星</button>',
  '          <button type="button" data-fw="aspects" class="on">相位</button>',
  '          <button type="button" data-fw="houses" class="on">宫位</button>',
  '          <button type="button" data-fw="link" class="on">恒等线</button>',
  '          <button type="button" data-fw="flat">平视</button>',
  '          <button type="button" data-fw="top">俯视</button>',
  '          <button type="button" data-fw="reset">复位</button>',
  '        </div>',
  '        <div class="fw-hint">拖动旋转 · 滚轮缩放 · 悬停看中西对照</div>',
  '      </section>',
].join('\n');

let h = fs.readFileSync('web/index.html', 'utf8');
if (h.includes('fusion-wheel-host')) { console.log('已存在，跳过'); process.exit(0); }

const ANCHOR = '<h2 class="page-title">八字 × 占星 <span class="sub">同盘并列</span></h2>';
if (!h.includes(ANCHOR)) {
  console.error('❌ 锚点未找到，当前 fusion 标题行：');
  const m = h.match(/<h2 class="page-title">[^<]*<span class="sub">[^<]*<\/span><\/h2>/g);
  console.error(m ? m.join('\n') : '(无)');
  process.exit(1);
}
h = h.replace(ANCHOR, ANCHOR + '\n' + HOST);
fs.writeFileSync('web/index.html', h, 'utf8');
console.log('✅ 融合盘容器已插入');
