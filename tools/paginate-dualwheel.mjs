// 双环图内环分页：一次 6 宫，两行大字号（宫号·地支·紫微名 / 领域）
import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-page', t, 'utf8');

/* ① 声明 PAGE / PER_PAGE */
if (!t.includes('var PER_PAGE = 6;')) {
  const anchor = "  var DOM = ['自我/身体'";
  const i = t.indexOf(anchor);
  if (i < 0) { console.error('❌ 找不到 DOM 数组'); process.exit(1); }
  const eol = t.indexOf('\n', i) + 1;
  t = t.slice(0, eol) + "  var PAGE = 0, PER_PAGE = 6;   /* 内环分页：一次 6 宫 */\n" + t.slice(eol);
  console.log('✅ 已声明 PAGE / PER_PAGE');
}

/* ② 内环改成 6 宫一页、两行大字号 */
const START = "    /* ── 内环：十二宫（动态，锚定 ASC）+ 紫微宫名 ── */";
const END = "    /* ── SEVEN-PILLARS：最外环 · 七柱（融合盘的核心，可点击） ── */";
const si = t.indexOf(START), ei = t.indexOf(END);
if (si < 0 || ei < 0 || ei < si) { console.error('❌ 内环段落定位失败', si, ei); process.exit(1); }

const NEW = `    /* ── 内环：十二宫（动态，锚定 ASC）+ 紫微宫名 —— 分页，一次 6 宫 ── */
    var ming = ziweiMing(pillars);
    var all = [];
    for (var h = 0; h < 12; h++) {
      var c0 = Number(cusps[h]), c1 = Number(cusps[(h + 1) % 12]);
      var span = ((c1 - c0) % 360 + 360) % 360;
      if (span <= 0) span = 30;
      all.push({ i: h, c0: c0, span: span });
    }
    all.sort(function (a, b) { return a.c0 - b.c0; });
    var PAGE_MAX = Math.ceil(all.length / PER_PAGE);
    if (PAGE >= PAGE_MAX) PAGE = 0;

    all.slice(PAGE * PER_PAGE, PAGE * PER_PAGE + PER_PAGE).forEach(function (it) {
      var h = it.i, c0 = it.c0, span = it.span, g1 = c0 + span, mh = c0 + span / 2;
      s += '<path d="M' + pt(c0, R3) + ' A' + R3 + ',' + R3 + ' 0 0 1 ' + pt(g1, R3) +
        ' L' + pt(g1, R4) + ' A' + R4 + ',' + R4 + ' 0 0 0 ' + pt(c0, R4) + ' Z" ' +
        'fill="' + (h % 2 ? 'rgba(255,196,87,.06)' : 'rgba(255,196,87,.12)') + '" stroke="rgba(255,196,87,.22)"/>';
      var zi = null;
      if (ming != null) {
        var seq = ((zhiStart(ming) - c0) % 360 + 360) % 360;
        zi = Math.round(seq / 30) % 12;
      }
      /* 第一行：宫号 · 地支 · 紫微宫名 */
      s += '<text x="' + x(mh, R3 - 30) + '" y="' + (y(mh, R3 - 30) + 6) +
        '" text-anchor="middle" font-size="20" font-weight="700" fill="#ffe6a8">' + (h + 1) +
        ' <tspan font-size="15" fill="#9fe8ff">' + zhiOfLon(c0) + '</tspan>' +
        (zi != null ? ' <tspan font-size="15" fill="' + (zi === 0 ? '#ff9a8a' : 'rgba(255,213,138,.95)') + '">' + esc(ZW[zi]) + '</tspan>' : '') +
        '</text>';
      /* 第二行：领域 */
      s += '<text x="' + x(mh, R3 - 54) + '" y="' + (y(mh, R3 - 54) + 4) +
        '" text-anchor="middle" font-size="12.5" fill="rgba(190,222,245,.92)">' + esc(DOM[h]) + '</text>';
    });

    var bar = '<div class="fw-ring-page">'
      + '<button type="button" data-dw-page="prev"' + (PAGE === 0 ? ' disabled' : '') + '>‹ 前六宫</button>'
      + '<span>第 ' + (PAGE + 1) + ' / ' + PAGE_MAX + ' 页 · 内环分页</span>'
      + '<button type="button" data-dw-page="next"' + (PAGE >= PAGE_MAX - 1 ? ' disabled' : '') + '>后六宫 ›</button>'
      + '</div>';

`;
t = t.slice(0, si) + NEW + t.slice(ei);
console.log('✅ 内环已改为 6 宫/页、两行大字号');

/* ③ 输出分页条 + 绑定按钮 */
const OLD_OUT = '    host.innerHTML = legend + s;';
const NEW_OUT = `    host.innerHTML = bar + legend + s;
    if (!host.__pageBound) {
      host.__pageBound = true;
      host.addEventListener('click', function (ev) {
        var btn = ev.target.closest && ev.target.closest('[data-dw-page]');
        if (!btn) return;
        PAGE += (btn.getAttribute('data-dw-page') === 'next' ? 1 : -1);
        if (PAGE < 0) PAGE = 0;
        draw();
      });
    }`;
if (!t.includes(OLD_OUT)) { console.error('❌ 未匹配 host.innerHTML 输出行'); process.exit(1); }
t = t.replace(OLD_OUT, NEW_OUT);
console.log('✅ 已插入分页条与按钮绑定');

fs.writeFileSync(P, t, 'utf8');
console.log('dual-wheel.js', t.length, '字节');
