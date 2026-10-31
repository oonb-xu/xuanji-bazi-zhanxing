// 深度层面板：动态十神权重 / 合相双效应 / 八字印证 / 藏干透出 / 土星双角色 / 神煞心理印证
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

  /* ① 动态十神权重 —— 已并入全屏融合盘（盘上每颗行星下方直接显示 5 组权重条） */
  /*
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

  h += '<div class="holo-card wide"><div class="holo-h">动态十神权重 <span>已并入全屏融合盘</span></div>' +
    '<div class="holo-note">排盘后自动进入的全屏融合盘里，<b>每颗行星下方直接显示 5 组十神权重条</b>——' +
    '不再单独列一张表和盘割裂。点行星可看详情，ESC 退出全屏。</div></div>';

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
