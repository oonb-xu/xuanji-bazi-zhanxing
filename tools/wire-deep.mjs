// 把「动态十神权重」与「神煞心理印证」接到融合页
import fs from 'node:fs';

/* ══════════ ① 服务端新增 /api/deep 路由（一次性输出两块新数据） ══════════ */
let srv = fs.readFileSync('server.mjs', 'utf8');
if (!srv.includes('api/deep')) {
  srv = srv.replace(
    "import { buildTimeline } from './src/cross/timeline.mjs';",
    "import { buildTimeline } from './src/cross/timeline.mjs';\nimport { dynamicWeights, crossValidate, analyzeConjunction } from './src/cross/dynamic-ten-god.mjs';\nimport { findShenSha, psychologicalProfile } from './src/bazi/shensha.mjs';\nimport { hiddenStemReveal, saturnDualRole } from './src/cross/hidden-stem.mjs';"
  );

  const FN = `
/** 深度学习层：动态十神权重 + 合相双效应 + 八字能量印证 + 神煞心理印证 + 藏干透出 + 土星双角色 */
function apiDeep(b) {
  const at = b?.at;
  if (!at) throw new Error('需要 at（出生时刻）');
  const birth = parseAtLocal(at, b.tz ?? 8);
  const bz = apiBazi(b);
  const natal = computeNatal({ at, lng: b.lng ?? 116.407, lat: b.lat ?? 39.904, tz: b.tz ?? 8 });
  const planets = Array.isArray(natal.planets)
    ? natal.planets
    : Object.entries(natal.planets || {}).map(([k, v]) => (v && typeof v === 'object' ? { name: v.name ?? k, ...v } : null)).filter(Boolean);

  const isDay = !!b.isDay;
  const sun = planets.find((p) => p.name === '太阳');

  // ① 动态权重
  const dyn = planets
    .map((p) => dynamicWeights(p, { aspects: natal.aspects, sunLon: sun?.lon, isDay }))
    .filter(Boolean);

  // ② 合相双效应
  const conjs = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const r = analyzeConjunction(planets[i], planets[j], 8);
      if (r) conjs.push(r);
    }
  }

  // ③ 八字能量印证
  const tenEn = (bz.bazi ?? bz).tenGods || null;
  const validate = tenEn ? crossValidate(dyn, tenEn) : null;

  // ④ 藏干透出 + 土星双角色
  const hidden = hiddenStemReveal(planets, natal.angles, isDay);
  const saturn = saturnDualRole(planets.find((p) => p.name === '土星'), isDay);

  // ⑤ 神煞 + 占星印证
  const shensha = findShenSha(bz.pillars);
  const psych = psychologicalProfile(shensha, planets);

  return {
    planets: dyn.map((d) => ({
      planet: d.planet, sign: d.sign, house: d.house,
      weights: d.weights, strength: d.strength,
      primary: d.primary, secondary: d.secondary,
      strengthMods: d.strengthMods, aspectMods: d.aspectMods,
    })),
    conjunctions: conjs,
    validate,
    hidden: {
      revealed: hidden.revealed.map((x) => ({ planet: x.planet, sign: x.sign, grade: x.grade, score: x.revealScore, why: x.why })),
      hiddenOnly: hidden.hiddenOnly.map((x) => ({ planet: x.planet, sign: x.sign, grade: x.grade, score: x.revealScore })),
    },
    saturn,
    shensha: psych.rows,
    profile: psych.profile,
    disclaimer: '本层全部为结构描述与内部一致性，不含吉凶判定；神煞与十神映射置信度 ≤0.6。',
  };
}

`;
  srv = srv.replace('const ROUTES = {', FN + 'const ROUTES = {');
  srv = srv.replace("'/api/timeline': apiTimeline,", "'/api/timeline': apiTimeline, '/api/deep': apiDeep,");
  fs.writeFileSync('server.mjs', srv, 'utf8');
  console.log('① /api/deep 路由已加');
} else console.log('① 已有');

/* ══════════ ② 前端面板 ══════════ */
fs.writeFileSync('web/deep-panel.js', `// 深度层面板：动态十神权重 / 合相双效应 / 八字印证 / 藏干透出 / 土星双角色 / 神煞心理印证
const G = ['比劫', '印', '食伤', '财', '官杀'];

function bars(w) {
  return '<div class="dw-bars">' + G.map(function (g) {
    const v = (w[g] || 0) * 100;
    return '<div class="dw-row"><span class="dw-g">' + g + '</span>' +
      '<span class="dw-t"><i style="width:' + v.toFixed(1) + '%"></i></span>' +
      '<span class="dw-v">' + v.toFixed(1) + '%</span></div>';
  }).join('') + '</div>';
}

function render(d) {
  var h = '';

  /* ① 动态十神权重 */
  h += '<div class="holo-card wide"><div class="holo-h">动态十神权重 <span>同一颗星，状态不同则配比不同</span></div>';
  h += '<div class="dw-grid">';
  (d.planets || []).forEach(function (p) {
    h += '<div class="dw-item">';
    h += '<div class="dw-head"><b>' + p.planet + '</b> <span class="mut">' + p.sign + ' 第' + (p.house || '?') + '宫</span>' +
      '<span class="dw-st">强度 ' + p.strength.toFixed(2) + '</span></div>';
    h += bars(p.weights);
    var mods = (p.strengthMods || []).map(function (m) { return m.k + '×' + m.f; }).join(' ');
    var amods = (p.aspectMods || []).map(function (m) { return m.k + m.dir + '×' + m.f; }).join(' ');
    if (mods) h += '<div class="dw-mod">强度修正：' + mods + '</div>';
    if (amods) h += '<div class="dw-mod dir">配比修正：' + amods + '</div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div class="holo-note">强度 = 尊贵×宫位×灼伤×得时×合相（统一作用，不改变组内配比）；配比 = 基础映射 + 硬/和谐相位（方向性）。<br>所以「入庙的木星」是更强的木星，不是不同的木星。</div></div>';

  /* ② 合相双效应 */
  if ((d.conjunctions || []).length) {
    h += '<div class="holo-card wide"><div class="holo-h">合相：两个效应必须分开 <span>放大 ≠ 生</span></div>';
    h += '<table class="holo-tb"><thead><tr><th>合相</th><th>orb</th><th>可见度放大</th><th>单向输能（这才是「生」）</th><th>八字类比</th></tr></thead><tbody>';
    d.conjunctions.forEach(function (c) {
      h += '<tr><td class="pn">' + c.pair[0] + ' × ' + c.pair[1] + '</td><td>' + c.orb + '°</td>' +
        '<td class="dg a">×' + c.emphasis.k + '</td>' +
        '<td class="dg ' + (c.transfer ? 'a' : 'n') + '">' + (c.transfer ? c.transfer.from + '→' + c.transfer.to + ' ' + c.transfer.amount : '—') + '</td>' +
        '<td class="mut2">' + c.baziAnalog + '</td></tr>';
    });
    h += '</tbody></table><div class="holo-note">合相 = 同度共处 ⇒ 可见度叠加（不是生）；当尊贵差悬殊时出现单向补给，这一段才近似「印」。</div></div>';
  }

  /* ③ 八字能量印证 */
  if (d.validate) {
    h += '<div class="holo-card wide"><div class="holo-h">八字能量印证 <span>占星侧权重 vs 八字侧同组能量</span></div>';
    h += '<div class="cv-cos">余弦相似度 <b>' + d.validate.cosine + '</b> → <b>' + d.validate.verdict + '</b></div>';
    h += '<table class="holo-tb"><thead><tr><th>十神组</th><th>占星侧</th><th>八字侧</th><th>差值</th><th>判定</th></tr></thead><tbody>';
    d.validate.rows.forEach(function (r) {
      h += '<tr><td class="pn">' + r.group + '</td><td>' + (r.astro * 100).toFixed(1) + '%</td><td>' + (r.bazi * 100).toFixed(1) + '%</td>' +
        '<td class="' + (Math.abs(r.delta) > 0.08 ? 'dg b' : 'dg a') + '">' + (r.delta > 0 ? '+' : '') + (r.delta * 100).toFixed(1) + 'pt</td>' +
        '<td class="mut2">' + r.agree + '</td></tr>';
    });
    h += '</tbody></table><div class="holo-note">' + d.validate.note + '</div></div>';
  }

  /* ④ 土星双角色 */
  if (d.saturn) {
    h += '<div class="holo-card"><div class="holo-h">土星的双重角色 <span>边界：保护你=印，压迫你=官杀</span></div>';
    h += '<div class="sat-dual"><div class="sd-side"><div class="sd-n">' + (d.saturn.groups['印'] * 100).toFixed(0) + '%</div><div class="sd-k">印（承载）</div></div>';
    h += '<div class="sd-mid">评分 ' + d.saturn.score + '</div>';
    h += '<div class="sd-side"><div class="sd-n">' + ((d.saturn.groups['官杀'] || 0) * 100).toFixed(0) + '%</div><div class="sd-k">官杀（压迫）</div></div></div>';
    h += '<div class="holo-note">' + (d.saturn.why || []).join('<br>') + '</div></div>';
  }

  /* ⑤ 藏干透出 */
  if (d.hidden) {
    h += '<div class="holo-card"><div class="holo-h">藏干透出 <span>区间内行星=藏干，角宫/合轴/得时=透出</span></div>';
    h += '<div class="hs-row"><b>透出</b>' + (d.hidden.revealed || []).map(function (x) {
      return '<span class="hs-tag a">' + x.planet + '（' + x.grade + '·' + x.score + '）</span>';
    }).join('') + '</div>';
    h += '<div class="hs-row"><b>纯藏</b>' + (d.hidden.hiddenOnly || []).map(function (x) {
      return '<span class="hs-tag">' + x.planet + '（' + x.grade + '·' + x.score + '）</span>';
    }).join('') + '</div>';
    h += '<div class="holo-note">本气=入庙 / 中气=曜升 / 余气=无尊贵；透出阈值 2 分。</div></div>';
  }

  /* ⑥ 神煞心理印证 */
  if ((d.shensha || []).length) {
    h += '<div class="holo-card wide"><div class="holo-h">神煞 · 心理维度 · 占星印证 <span>内部一致性，不是外部验证</span></div>';
    h += '<table class="holo-tb"><thead><tr><th>神煞</th><th>落点</th><th>心理倾向</th><th>心理轴</th><th>占星签名</th><th>收敛</th></tr></thead><tbody>';
    d.shensha.forEach(function (r) {
      h += '<tr><td class="pn">' + r.name + '</td>' +
        '<td class="mut">' + (r.hit || []).map(function (x) { return x.at + x.zhi; }).join('·') + '</td>' +
        '<td class="mut2">' + (r.psych || []).join(' / ') + '</td>' +
        '<td class="mut2">' + r.axis + '</td>' +
        '<td class="mut2">' + r.astroWanted + '</td>' +
        '<td class="dg ' + (r.converge >= 0.66 ? 'a' : r.converge >= 0.34 ? 'n' : 'b') + '">' + (r.converge * 100).toFixed(0) + '%</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div class="holo-note">心理画像：<b>' + d.profile + '</b><br>' + d.disclaimer + '</div></div>';
  }

  return h;
}

window.__renderDeep = function (data) {
  var host = document.querySelector('#deep-host');
  if (!host) return;
  host.innerHTML = render(data || {});
};
`,'utf8');
console.log('② deep-panel.js 已写入');

/* ══════════ ③ 挂到页面 ══════════ */
let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('id="deep-host"')) {
  html = html.replace('<div id="dignity-host" class="holo-row"></div>',
    '<div id="dignity-host" class="holo-row"></div>\n      <div id="deep-host" class="holo-row"></div>');
  console.log('③ deep-host 容器已加');
}
if (!html.includes('/deep-panel.js')) {
  html = html.replace('<script type="module" src="/dignity-panel.js"></script>',
    '<script type="module" src="/dignity-panel.js"></script>\n  <script type="module" src="/deep-panel.js"></script>');
  console.log('④ deep-panel.js 已引入');
}
fs.writeFileSync('web/index.html', html, 'utf8');

/* ══════════ ④ 样式 ══════════ */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.dw-bar')) {
  css += `

/* ══════════ 深度层：动态权重 / 合相 / 印证 / 神煞 ══════════ */
.holo-card.wide{grid-column:1 / -1}
.dw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.dw-item{padding:10px 12px;border-radius:10px;background:rgba(8,16,28,.55);border:1px solid rgba(90,160,220,.16)}
.dw-head{font-size:12.5px;margin-bottom:7px;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.dw-head b{color:#eaf7ff}
.dw-head .mut{color:rgba(160,195,220,.6);font-size:11px}
.dw-st{margin-left:auto;font-size:11px;color:#7ee8ff;font-variant-numeric:tabular-nums}
.dw-bars{display:flex;flex-direction:column;gap:3px}
.dw-row{display:grid;grid-template-columns:34px 1fr 48px;gap:7px;align-items:center;font-size:10.5px}
.dw-g{color:rgba(190,218,240,.8)}
.dw-t{height:5px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
.dw-t i{display:block;height:100%;background:linear-gradient(90deg,#5ef1ff,#ffc457);border-radius:3px}
.dw-v{text-align:right;color:rgba(160,205,230,.8);font-variant-numeric:tabular-nums}
.dw-mod{margin-top:6px;font-size:10px;color:rgba(140,180,210,.6);line-height:1.6}
.dw-mod.dir{color:rgba(255,196,87,.75)}
.cv-cos{font-size:13px;color:rgba(190,218,240,.85);margin-bottom:10px}
.cv-cos b{color:#7dffb4;font-size:16px;font-variant-numeric:tabular-nums}
.sat-dual{display:flex;align-items:center;gap:14px;margin:6px 0 10px}
.sd-side{flex:1;text-align:center;padding:10px;border-radius:9px;background:rgba(8,16,28,.55)}
.sd-n{font-size:24px;font-weight:800;color:#7dffb4;font-variant-numeric:tabular-nums}
.sd-side:last-child .sd-n{color:#ffb0a0}
.sd-k{font-size:11px;color:rgba(160,200,225,.7);margin-top:3px}
.sd-mid{flex:0 0 auto;font-size:11.5px;color:rgba(255,196,87,.85)}
.hs-row{margin-bottom:7px;font-size:11.5px;color:rgba(180,212,236,.8);line-height:2}
.hs-row b{color:#7ee8ff;margin-right:8px}
.hs-tag{display:inline-block;padding:1px 8px;margin:2px 5px 2px 0;border-radius:999px;font-size:10.5px;
  background:rgba(255,255,255,.06);border:1px solid rgba(120,180,220,.22);color:rgba(180,212,236,.8)}
.hs-tag.a{background:rgba(125,255,180,.12);border-color:rgba(125,255,180,.35);color:#7dffb4}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('⑤ 样式已加');
}
