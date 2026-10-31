// 修 ① 七柱只进 4 根（胎元/命宫/身宫 是对象被 typeof string 过滤掉）⇒ 悬停越界抛异常
// 补 ② HUD：七柱（透干高亮）+ 12宫地支藏干（透干高亮）+ 紫微宫名 + 七政四余标签
import fs from 'node:fs';

/* ══════════ ① 修 fusion3d 的七柱提取 ══════════ */
let f = fs.readFileSync('web/fusion3d.js', 'utf8');

const OLD_EXTRA = `  const extra = [b.taiYuan, b.mingGong, b.shenGong].filter((x) => typeof x === 'string' && x.length >= 2);`;
const NEW_EXTRA = `  // ★ FIX：胎元/命宫/身宫 在 API 里可能是对象 {gan,zhi,ganzhi}，不能只收 string
  const _gz = (x) => {
    if (x == null) return null;
    if (typeof x === 'string') return x.length >= 2 ? x : null;
    if (typeof x === 'object') return x.ganzhi ?? (x.gan && x.zhi ? x.gan + x.zhi : null);
    return null;
  };
  const extra = [b.taiYuan, b.mingGong, b.shenGong].map(_gz).filter(Boolean);`;

if (f.includes(NEW_EXTRA)) {
  console.log('① 七柱提取已修过');
} else if (f.includes(OLD_EXTRA)) {
  f = f.replace(OLD_EXTRA, NEW_EXTRA);
  console.log('① 七柱提取已修（对象也能取干支）');
} else {
  console.error('❌ 未匹配七柱提取段');
  process.exit(1);
}

// 悬停循环与 tipText 都要防越界
const OLD_LOOP = `    if (d < bd) { bd = d; best = { kind: 'pillar', i, pillar: DATA.pillars[i] }; }`;
const NEW_LOOP = `    if (d < bd && DATA.pillars[i]) { bd = d; best = { kind: 'pillar', i, pillar: DATA.pillars[i] }; }`;
if (f.includes(OLD_LOOP)) { f = f.replace(OLD_LOOP, NEW_LOOP); console.log('   · 悬停循环已加越界保护'); }

const OLD_TIP = `  if (h.kind === 'pillar') {
    const gan = h.pillar[0], zhi = h.pillar[1];`;
const NEW_TIP = `  if (h.kind === 'pillar') {
    if (!h.pillar || h.pillar.length < 2) return '';
    const gan = h.pillar[0], zhi = h.pillar[1];`;
if (f.includes(OLD_TIP)) { f = f.replace(OLD_TIP, NEW_TIP); console.log('   · tipText 已加防御'); }

fs.writeFileSync('web/fusion3d.js', f, 'utf8');

/* ══════════ ② 重写 HUD ══════════ */
const HUD = `// 全屏融合盘 HUD：七柱（透干高亮）+ 12宫地支藏干（透干高亮）+ 紫微宫名 + 七政四余
// 设计要点：
//   · **不移动 DOM** —— 只给 .fw-card 加 .fw-full 类，靠 ResizeObserver 让 fit() 重算
//   · 宇宙幕布是 CSS 的 ::before/::after，总不透明度很低，不喧宾夺主
(function () {
  var host = null, lastData = null;

  /* ── 藏干表与五行（自带，避免依赖 fusion3d 内部变量）── */
  var CANG = {
    子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
    辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
  };
  var GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  /* 星座 → 月将地支（七政四余十二次） */
  var SIGN2ZHI = { 白羊: '戌', 金牛: '酉', 双子: '申', 巨蟹: '未', 狮子: '午', 处女: '巳',
    天秤: '辰', 天蝎: '卯', 射手: '寅', 摩羯: '丑', 水瓶: '子', 双鱼: '亥' };
  /* 紫微十二宫（逆序排在命宫之后） */
  var ZW_ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
  /* 七政 + 四余 */
  var QIZHENG = { 太阳: '日', 月亮: '月', 木星: '木', 火星: '火', 土星: '土', 金星: '金', 水星: '水' };
  var SIYU = { 北交点: '罗睺', 南交点: '计都' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]); }); }
  function gz(x) {
    if (x == null) return null;
    if (typeof x === 'string') return x.length >= 2 ? x : null;
    if (typeof x === 'object') return x.ganzhi || (x.gan && x.zhi ? x.gan + x.zhi : null);
    return null;
  }

  /** 取一盘的七柱 + 天干集合（用于判透干） */
  function extract(d) {
    var b = (d && d.bazi) || {};
    var four = b.pillars || (d && d.pillars) || [];
    if (!Array.isArray(four)) four = [];
    var extra = [gz(b.taiYuan), gz(b.mingGong), gz(b.shenGong)];
    var pillars = four.slice(0, 4).concat(extra.filter(Boolean));
    var gans = {};
    pillars.forEach(function (p) { if (p && p.length >= 2) gans[p[0]] = true; });
    // 四柱天干（透干判定只认四柱，不认派生柱）
    var fourGans = {};
    four.slice(0, 4).forEach(function (p) { if (p && p.length >= 2) fourGans[p[0]] = true; });
    return {
      pillars: pillars, four: four.slice(0, 4), extra: extra,
      gans: gans, fourGans: fourGans,
      dm: b.dayMaster || '', verdict: (b.strength && b.strength.verdict) || '',
      mingGong: gz(b.mingGong),
    };
  }

  /** 七柱块：胎命身用虚线边框；有藏干透出的柱高亮 */
  function pillarsHtml(x) {
    var names = ['年', '月', '日', '时', '胎元', '命宫', '身宫'];
    var h = '<div class="h-k">七柱 · 日主</div><div class="h-pillars">';
    x.pillars.forEach(function (p, i) {
      if (!p || p.length < 2) return;
      var zhi = p[1], cang = CANG[zhi] || [];
      // 该柱地支的藏干，有几个透到四柱天干
      var tou = cang.filter(function (g) { return x.fourGans[g]; });
      var isDerived = i >= 4;
      h += '<span class="h-pc' + (isDerived ? ' deriv' : '') + (tou.length ? ' tou' : '') + '" title="' +
        names[i] + ' ' + p + '｜藏干 ' + cang.join('') + (tou.length ? '｜透出 ' + tou.join('') : '｜纯藏') + '">' +
        '<i>' + names[i] + '</i>' + esc(p) + (tou.length ? '<em>透</em>' : '') + '</span>';
    });
    h += '</div>';
    if (x.dm) h += '<div class="h-line">日主 <b style="color:#ffc457">' + esc(x.dm) + '</b>' + (x.verdict ? ' · ' + esc(x.verdict) : '') + '</div>';
    return h;
  }

  /** 12 宫块：地支 + 藏干（透干高亮）+ 紫微宫名 */
  function housesHtml(x) {
    var startZhi = x.mingGong ? x.mingGong[1] : null;
    var i0 = startZhi ? ZHI.indexOf(startZhi) : -1;
    var h = '<div class="h-k">十二宫 · 地支 · 藏干</div><div class="h-houses">';
    for (var k = 0; k < 12; k++) {
      var zhi = ZHI[k];
      var cang = CANG[zhi] || [];
      // 紫微宫名：命宫起，逆序（子→亥）
      var zwName = '';
      if (i0 >= 0) {
        var off = ((i0 - k) % 12 + 12) % 12;   // 从命宫支逆数
        zwName = ZW_ORDER[off] || '';
      }
      var cangHtml = cang.map(function (g) {
        var isTou = !!x.fourGans[g];
        return '<em class="' + (isTou ? 'tou' : '') + '">' + g + '<sub>' + GAN_WX[g] + '</sub></em>';
      }).join('');
      var anyTou = cang.some(function (g) { return x.fourGans[g]; });
      h += '<span class="h-hc' + (anyTou ? ' tou' : '') + '" title="' + zhi + '｜' + (zwName || '—') + '｜藏干 ' + cang.join('') + '">' +
        '<i>' + zhi + '</i>' + (zwName ? '<s>' + zwName + '</s>' : '') + '<b>' + cangHtml + '</b></span>';
    }
    h += '</div>';
    return h;
  }

  /** 行星块：七政/四余标签 + 复主星 → 十神 */
  function planetsHtml(d) {
    var ps = (d.planets || []).filter(function (p) { return p && p.primary; });
    var nat = (d.natal && d.natal.planets) || d.planets || [];
    if (!Array.isArray(nat)) nat = Object.keys(nat).map(function (k) { return Object.assign({ name: k }, nat[k]); });
    var h = '<div class="h-k">七政四余 · 行星 · 十神</div>';
    if (ps.length) {
      ps.slice(0, 9).forEach(function (p) {
        var tag = QIZHENG[p.planet] || SIYU[p.planet] || '';
        h += '<div class="h-line"><b>' + esc(p.planet) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (p.house ? ' ' + p.house + '宫' : '') + '</span> ' +
          '<span class="h-tg">' + esc(p.primary.group) + ' ' + Math.round((p.primary.w || 0) * 100) + '%</span></div>';
      });
    } else {
      nat.slice(0, 9).forEach(function (p) {
        var tag = QIZHENG[p.name] || SIYU[p.name] || '';
        var zhi = SIGN2ZHI[p.sign] || '';
        h += '<div class="h-line"><b>' + esc(p.name) + '</b>' + (tag ? '<i class="h-qs">' + tag + '</i>' : '') +
          ' <span class="h-dim">' + esc(p.sign || '') + (zhi ? '·' + zhi : '') + (p.house ? ' ' + p.house + '宫' : '') + '</span></div>';
      });
    }
    return h;
  }

  function buildHud(d) {
    var x = extract(d);
    var parts = [];
    parts.push('<div class="fw-hud tl">' + pillarsHtml(x) + '</div>');
    parts.push('<div class="fw-hud tr">' + planetsHtml(d) + '</div>');
    parts.push('<div class="fw-hud bl">' + housesHtml(x) + '</div>');
    return parts.join('');
  }

  function ensureHost() {
    if (host) return host;
    host = document.querySelector('#fusion-wheel-host');
    if (!host) return null;
    if (!host.__fullInit) {
      host.__fullInit = true;
      var btn = document.createElement('button');
      btn.className = 'fw-close';
      btn.textContent = '✕';
      btn.title = '退出全屏（ESC）';
      btn.addEventListener('click', exit);
      host.appendChild(btn);
    }
    return host;
  }

  function clearHud(h) {
    Array.prototype.slice.call(h.querySelectorAll('.fw-hud')).forEach(function (n) { n.remove(); });
  }

  function enter(data) {
    var h = ensureHost();
    if (!h) return false;
    if (data) lastData = data;
    h.classList.add('fw-full');
    clearHud(h);
    if (lastData) h.insertAdjacentHTML('beforeend', buildHud(lastData));
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
    document.documentElement.style.overflow = 'hidden';
    return true;
  }

  function exit() {
    var h = ensureHost();
    if (!h) return;
    h.classList.remove('fw-full');
    clearHud(h);
    document.documentElement.style.overflow = '';
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && host && host.classList.contains('fw-full')) exit();
  });

  window.__fwFullscreen = enter;
  window.__fwFullscreenExit = exit;
  window.__fwFullscreenUpdate = function (data) {
    lastData = data;
    if (host && host.classList.contains('fw-full')) {
      clearHud(host);
      host.insertAdjacentHTML('beforeend', buildHud(data));
    }
  };
})();
`;
fs.writeFileSync('web/fw-fullscreen.js', HUD, 'utf8');
console.log('② HUD 已重写（七柱+透干高亮+12宫地支藏干+紫微宫名+七政四余）');

/* ══════════ ③ 补 HUD 新样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.h-pc')) {
  css += `

/* ══════════ HUD：七柱 / 十二宫 / 七政四余 ══════════ */
.h-pillars{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.h-pc{position:relative;padding:4px 8px 5px;border-radius:7px;background:rgba(8,18,30,.72);
  border:1px solid rgba(120,180,220,.26);font-size:13px;font-weight:700;color:#eaf7ff;
  font-variant-numeric:tabular-nums;letter-spacing:.04em}
.h-pc i{display:block;font-style:normal;font-size:9px;font-weight:400;letter-spacing:.1em;
  color:rgba(140,185,215,.6);margin-bottom:1px}
.h-pc.deriv{border-style:dashed;border-color:rgba(160,140,220,.4)}     /* 胎命身=实验柱 */
.h-pc.tou{border-color:rgba(125,255,180,.6);background:rgba(125,255,180,.1);
  box-shadow:0 0 0 1px rgba(125,255,180,.18) inset}
.h-pc em{position:absolute;top:-7px;right:-5px;font-style:normal;font-size:8.5px;
  padding:0 4px;border-radius:999px;background:#7dffb4;color:#04170c;font-weight:800}

.h-houses{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;max-width:520px}
.h-hc{padding:3px 5px 4px;border-radius:6px;background:rgba(8,18,30,.62);
  border:1px solid rgba(110,165,205,.2);text-align:center;line-height:1.35}
.h-hc i{display:block;font-style:normal;font-size:12px;font-weight:700;color:#cfe8f8}
.h-hc s{display:block;text-decoration:none;font-size:8.5px;color:rgba(150,190,220,.55);letter-spacing:.05em}
.h-hc b{display:block;font-weight:400;font-size:9.5px;color:rgba(150,185,210,.72);margin-top:1px}
.h-hc b em{font-style:normal}
.h-hc b em.tou{color:#7dffb4;font-weight:800}
.h-hc b sub{font-size:7px;opacity:.55;margin-left:1px}
.h-hc.tou{border-color:rgba(125,255,180,.45);background:rgba(125,255,180,.06)}
.h-qs{display:inline-block;font-style:normal;font-size:9.5px;padding:0 4px;margin-left:3px;
  border-radius:4px;background:rgba(94,241,255,.14);border:1px solid rgba(94,241,255,.3);color:#5ef1ff}
.fw-card.fw-full .fw-hud.bl{ left:26px; right:auto; bottom:22px }
@media(max-width:760px){
  .h-houses{grid-template-columns:repeat(4,1fr);max-width:none}
  .h-pc{font-size:11.5px;padding:3px 6px 4px}
}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('③ HUD 新样式已加');
}

/* 校验 */
const f2 = fs.readFileSync('web/fusion3d.js', 'utf8');
const h2 = fs.readFileSync('web/fw-fullscreen.js', 'utf8');
const c2 = fs.readFileSync('web/style.css', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['七柱提取支持对象', f2.includes("x.ganzhi ?? (x.gan && x.zhi")],
  ['悬停越界保护', f2.includes('DATA.pillars[i]) { bd = d')],
  ['tipText 防御', f2.includes('if (!h.pillar || h.pillar.length < 2) return')],
  ['HUD 有七柱', h2.includes('function pillarsHtml')],
  ['HUD 有透干高亮', h2.includes(' tou')],
  ['HUD 有十二宫藏干', h2.includes('function housesHtml') && h2.includes('CANG')],
  ['HUD 有紫微宫名', h2.includes('ZW_ORDER')],
  ['HUD 有七政四余', h2.includes('QIZHENG') && h2.includes('SIYU')],
  ['CSS 有 .h-pc', c2.includes('.h-pc{')],
  ['CSS 有 .h-hc', c2.includes('.h-hc{')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
