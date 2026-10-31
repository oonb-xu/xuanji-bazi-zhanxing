// 行星点击 → 详情面板（本身意义 / 相位 / 八字代表）
import fs from 'node:fs';

/* ══════════ ① 行星意义表 + 面板渲染 + 点击 ══════════ */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (!s.includes('PLANET_MEANING')) {
  s = s.replace(
    "const PLANET_TG = {",
    `// 行星本身的意义（占星语汇）
const PLANET_MEANING = {
  太阳: { glyph: '☉', key: '自我 · 生命力 · 核心意志', long: '代表"我是谁"、生命的核心驱动力、以及一个人想成为的样子。也主父亲、权威、名声。' },
  月亮: { glyph: '☽', key: '情绪 · 直觉 · 安全感', long: '代表内在的情绪反应、习惯性的安全感来源、潜意识。也主母亲、家宅、身体节律。' },
  水星: { glyph: '☿', key: '思维 · 沟通 · 学习', long: '代表怎么想、怎么表达、怎么学。主语言、逻辑、交易、短途移动。' },
  金星: { glyph: '♀', key: '价值 · 情感 · 审美', long: '代表喜欢什么、怎么建立关系、审美取向。主爱情、金钱、艺术、愉悦。' },
  火星: { glyph: '♂', key: '行动 · 冲突 · 欲望', long: '代表怎么出手、怎么争、怎么生气。主竞争、勇气、驱动力、手术与外伤。' },
  木星: { glyph: '♃', key: '扩张 · 信念 · 机遇', long: '代表在哪里变大、相信什么、得到什么。主成长、教育、远行、运气。' },
  土星: { glyph: '♄', key: '限制 · 责任 · 结构', long: '代表在哪里受限、必须负责、被要求。主时间、纪律、权威、边界与代价。' },
  天王星: { glyph: '♅', key: '突变 · 革新 · 破格', long: '代表哪里会突然翻转、哪里不肯按规矩来。主意外、科技、觉醒、断裂。' },
  海王星: { glyph: '♆', key: '消融 · 想象 · 迷雾', long: '代表哪里边界模糊、哪里容易理想化或沉溺。主灵性、艺术、药物、欺骗。' },
  冥王星: { glyph: '♇', key: '转化 · 权力 · 深渊', long: '代表哪里必须彻底重构、哪里有控制与生死议题。主清算、深渊、重生。' },
  凯龙:   { glyph: '⚷', key: '创伤 · 疗愈', long: '代表伤口所在，也代表能治愈别人的地方。' },
};

// 十神组的八字语义
const TG_MEANING = {
  比劫: '同我者：自我、同辈、竞争、独立',
  印: '生我者：支持、学习、庇护、母系',
  食伤: '我生者：表达、创造、消耗、子女',
  财: '我克者：资源、欲望、掌控、配偶（男命）',
  官杀: '克我者：约束、责任、压力、权威、配偶（女命）',
};

const PLANET_TG = {`
  );
  console.log('① 行星意义表已加');
}

/* ② 渲染面板函数（插在 mountFusion3D 之前） */
if (!s.includes('function showPlanetPanel')) {
  s = s.replace(
    "export function mountFusion3D(el, data) {",
    `/** 弹出行星详情面板 */
function showPlanetPanel(host, pl) {
  if (!host || !pl) return;
  let panel = host.querySelector('.planet-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'planet-panel';
    host.appendChild(panel);
  }
  const m = PLANET_MEANING[pl.name] ?? { glyph: '', key: '—', long: '' };
  const tg = PLANET_TG[pl.name] ?? '—';
  const tgDesc = TG_MEANING[tg] ?? '';
  const dom = pl.house ? ({ 1: '自我/身体', 2: '资源/价值', 3: '沟通/近亲', 4: '家庭/根基', 5: '创造/子女', 6: '工作/健康', 7: '关系/合作', 8: '共享/危机', 9: '远行/信念', 10: '事业/名声', 11: '群体/愿景', 12: '隐退/内在' }[pl.house]) : '—';
  const mans = pl.house ? (ANGULAR.has(pl.house) ? '角宫（强）' : SUCCEDENT.has(pl.house) ? '续宫（中）' : '果宫（弱）') : '—';

  // 相位
  const asps = (DATA.aspects ?? []).filter((a) => a.a === pl.name || a.b === pl.name);
  const aspRows = asps.map((a) => {
    const other = a.a === pl.name ? a.b : a.a;
    const hard = a.type === '对冲' || a.type === '四分相';
    return \`<div class="pp-asp"><span class="\${hard ? 'bad' : 'ok'}">\${a.type}</span><span class="nm">\${other}</span><span class="orb">\${a.orb}°</span></div>\`;
  }).join('');

  // 尊贵
  const dign = pl.dignity ?? null;

  panel.innerHTML = \`
    <button class="pp-close" type="button" aria-label="关闭">✕</button>
    <div class="pp-head">
      <div class="pp-glyph">\${m.glyph || ''}</div>
      <div>
        <div class="pp-name">\${pl.name}</div>
        <div class="pp-sub">\${pl.sign} \${pl.deg}°　第\${pl.house ?? '?'}宫（\${mans}）</div>
      </div>
    </div>
    <div class="pp-sec"><div class="pp-h">本身的意义</div>
      <div class="pp-key">\${m.key}</div>
      <div class="pp-long">\${m.long}</div>
    </div>
    <div class="pp-sec"><div class="pp-h">在八字中的代表</div>
      <div class="pp-kv"><b>\${tg}</b><span>\${tgDesc}</span></div>
      <div class="pp-note">落宫领域：<b>\${dom}</b>　·　宫位档：\${mans}</div>
    </div>
    <div class="pp-sec"><div class="pp-h">与其他行星的相位（\${asps.length}）</div>
      <div class="pp-asps">\${aspRows || '<div class="pp-none">无相位</div>'}</div>
    </div>
  \`;
  panel.classList.add('open');
  panel.querySelector('.pp-close').addEventListener('click', () => panel.classList.remove('open'));
}

export function mountFusion3D(el, data) {`
  );
  console.log('② 行星面板函数已加');
}

/* ③ 点击处理：区分拖拽与点击 */
s = s.replace(
  "  cv.addEventListener('pointerdown', (e) => {\n    drag = true; lastX = e.clientX; lastY = e.clientY;",
  `  cv.addEventListener('pointerdown', (e) => {
    drag = true; lastX = e.clientX; lastY = e.clientY;
    downX = e.clientX; downY = e.clientY; moved = 0;`
);
s = s.replace(
  "  cv.addEventListener('pointerup', (e) => { drag = false; try { cv.releasePointerCapture(e.pointerId); } catch { } cv.style.cursor = 'grab'; });",
  `  cv.addEventListener('pointerup', (e) => {
    drag = false;
    try { cv.releasePointerCapture(e.pointerId); } catch { }
    cv.style.cursor = 'grab';
    // ★ 位移很小 ⇒ 视为点击 ⇒ 打开行星面板
    if (moved < 6 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
      const r = cv.getBoundingClientRect();
      const h = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (h?.kind === 'planet') showPlanetPanel(el, h.pl);
      else { const p = el.querySelector('.planet-panel'); if (p) p.classList.remove('open'); }
    }
  });`
);
s = s.replace(
  "      cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + (e.clientY - lastY) * 0.006));",
  "      cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + (e.clientY - lastY) * 0.006));\n      moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);"
);
s = s.replace(
  "let hover = null, drag = false, lastX = 0, lastY = 0, flyT = 0;",
  "let hover = null, drag = false, lastX = 0, lastY = 0, flyT = 0;\nlet downX = 0, downY = 0, moved = 0;"
);

/* ④ DATA 里带上 aspects */
s = s.replace(
    "    cusps: data.natal?.cusps ?? data.cusps ?? [],\n    sunLon: sun?.lon ?? null,",
    "    cusps: data.natal?.cusps ?? data.cusps ?? [],\n    aspects: data.natal?.aspects ?? data.aspects ?? [],\n    sunLon: sun?.lon ?? null,"
);

fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('③④ 点击与相位数据已接');
