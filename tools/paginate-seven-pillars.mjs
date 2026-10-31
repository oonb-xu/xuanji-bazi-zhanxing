// 七柱环分页：第 1 组 = 四柱（实线），第 2 组 = 胎元/命宫/身宫（虚线），都绕环均分
import fs from 'node:fs';
const P = 'web/dual-wheel.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-p7', t, 'utf8');

/* ① 状态变量 */
if (!t.includes('var PAGE7 = 0;')) {
  const a = '  var LAST = null;';
  if (!t.includes(a)) { console.error('❌ 找不到 LAST'); process.exit(1); }
  t = t.replace(a, a + '\n  var PAGE7 = 0;   /* 七柱分页：0=四柱 1=胎元/命宫/身宫 */');
  console.log('✅ 已加 PAGE7');
}

/* ② 替换 SEVEN-PILLARS 整段 */
const S7 = '    /* ── SEVEN-PILLARS：最外环 · 七柱（融合盘的核心，可点击） ── */';
const E7 = '    /* ── 接缝：ASC / MC 两条贯穿线 ── */';
const i7 = t.indexOf(S7), j7 = t.indexOf(E7);
if (i7 < 0 || j7 < 0 || j7 < i7) { console.error('❌ 七柱段落定位失败', i7, j7); process.exit(1); }

const NEW7 = `    /* ── SEVEN-PILLARS：最外环 · 七柱（分两组） ── */
    var pNames = ['年柱', '月柱', '日柱', '时柱'];
    var R0 = R1 + 24;
    if (Array.isArray(pillars) && pillars.length >= 4) {
      var ex = {};
      try { ex = d.bazi.extra || {}; } catch (e0) { ex = {}; }
      var groupA = pillars.slice(0, 4).map(function (gz, i) { return { label: pNames[i], gz: gz, dashed: false }; });
      var groupB = [['胎元', ex.taiYuan], ['命宫', ex.mingGong], ['身宫', ex.shenGong]]
        .filter(function (x) { return x[1]; })
        .map(function (x) { return { label: x[0], gz: x[1], dashed: true }; });

      var grp = (PAGE7 === 1 && groupB.length) ? groupB : groupA;
      var isB = (grp === groupB);

      s += '<circle cx="' + C + '" cy="' + C + '" r="' + R0 + '" fill="none" stroke="' +
        (isB ? 'rgba(255,196,87,.22)' : 'rgba(160,200,235,.18)') + '" stroke-dasharray="' +
        (isB ? '2 6' : '3 5') + '"/>';

      var n = grp.length;
      grp.forEach(function (it, i) {
        var ang = -90 + (360 / n) * i;          /* 均分绕环 */
        var pxx = C + R0 * Math.cos(ang * Math.PI / 180);
        var pyy = C + R0 * Math.sin(ang * Math.PI / 180);
        s += '<circle cx="' + pxx + '" cy="' + pyy + '" r="' + (isB ? 17 : 19) + '" fill="rgba(6,14,26,.94)" stroke="' +
          (isB ? 'rgba(255,196,87,.45)' : 'rgba(255,196,87,.6)') + '"' + (isB ? ' stroke-dasharray="3 3"' : '') + '/>';
        s += '<text x="' + pxx + '" y="' + (pyy + 5) + '" text-anchor="middle" font-size="' + (isB ? 14 : 16) +
          '" font-weight="700" fill="' + (isB ? '#ffe6a8' : '#ffe6a8') + '">' + esc(it.gz) + '</text>';
        /* 组名放圈外一点，避免压地支环 */
        var lx = C + (R0 + 22) * Math.cos(ang * Math.PI / 180);
        var ly = C + (R0 + 22) * Math.sin(ang * Math.PI / 180);
        s += '<text x="' + lx + '" y="' + (ly + 4) + '" text-anchor="middle" font-size="10.5" fill="' +
          (isB ? 'rgba(255,213,138,.9)' : 'rgba(170,205,232,.85)') + '">' + esc(it.label) + '</text>';
      });
    }

`;
t = t.slice(0, i7) + NEW7 + t.slice(j7);
console.log('✅ 七柱已改为绕环均分 + 双组');

/* ③ 分页条加七柱切换 */
const OLD_BAR = `      + '<button type="button" data-dw-page="next"' + (PAGE >= PAGE_MAX - 1 ? ' disabled' : '') + '>后六宫 ›</button>'
      + '</div>';`;
const NEW_BAR = `      + '<button type="button" data-dw-page="next"' + (PAGE >= PAGE_MAX - 1 ? ' disabled' : '') + '>后六宫 ›</button>'
      + '<i class="sep"></i>'
      + '<button type="button" data-dw-page7="0"' + (PAGE7 === 0 ? ' class="on"' : '') + '>四柱</button>'
      + '<button type="button" data-dw-page7="1"' + (PAGE7 === 1 ? ' class="on"' : '') + '>胎元·命宫·身宫</button>'
      + '</div>';`;
if (!t.includes(OLD_BAR)) { console.error('❌ 未匹配分页条'); process.exit(1); }
t = t.replace(OLD_BAR, NEW_BAR);
console.log('✅ 分页条已加七柱切换');

/* ④ 点击处理加 page7 */
const OLD_CLICK = `        var btn = ev.target.closest && ev.target.closest('[data-dw-page]');
        if (!btn) return;
        PAGE += (btn.getAttribute('data-dw-page') === 'next' ? 1 : -1);
        if (PAGE < 0) PAGE = 0;
        draw(window.__fwLastData || LAST);`;
const NEW_CLICK = `        var b7 = ev.target.closest && ev.target.closest('[data-dw-page7]');
        if (b7) {
          PAGE7 = Number(b7.getAttribute('data-dw-page7')) === 1 ? 1 : 0;
          draw(window.__fwLastData || LAST);
          return;
        }
        var btn = ev.target.closest && ev.target.closest('[data-dw-page]');
        if (!btn) return;
        PAGE += (btn.getAttribute('data-dw-page') === 'next' ? 1 : -1);
        if (PAGE < 0) PAGE = 0;
        draw(window.__fwLastData || LAST);`;
if (!t.includes(OLD_CLICK)) { console.error('❌ 未匹配点击处理'); process.exit(1); }
t = t.replace(OLD_CLICK, NEW_CLICK);
console.log('✅ 点击处理已支持七柱切换');

fs.writeFileSync(P, t, 'utf8');
console.log('dual-wheel.js', t.length, '字节');
