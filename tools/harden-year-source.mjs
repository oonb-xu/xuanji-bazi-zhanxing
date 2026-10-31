// 加固 renderExpIntoHud 的年份来源：API 无 year 字段时，从表单 at / 其他字段兜底
import fs from 'node:fs';
const P = 'web/wizard.js';
let s = fs.readFileSync(P, 'utf8');

const OLD = `    var y = parseInt(String(d.bazi.year || (d.bazi.solar && d.bazi.solar.year) || '0'), 10);
    if (!y) { var m = String(d.bazi.solarDate || d.at || '').match(/^(\\d{4})/); y = m ? +m[1] : 0; }
    if (!y) return;`;

const NEW = `    // ★ 年份来源依次尝试：API 字段 → 盘上文字 → 表单输入，任一成功即可
    var y = 0, cands = [
      d.bazi.year, d.bazi.solar && d.bazi.solar.year, d.year,
      d.bazi.solarDate, d.bazi.at, d.at,
    ];
    for (var ci = 0; ci < cands.length && !y; ci++) {
      var v = cands[ci];
      if (v == null) continue;
      var mm = String(v).match(/(\\d{4})/);
      if (mm) y = +mm[1];
    }
    if (!y) {
      var inp = document.querySelector('#f-fusion [name="at"], #f-fusion input[name="at"]');
      if (inp && inp.value) { var m2 = String(inp.value).match(/(\\d{4})/); if (m2) y = +m2[1]; }
    }
    if (!y) {
      try {
        var sb = JSON.parse(localStorage.getItem('xuanji:birth') || '{}');
        var m3 = String(sb.at || '').match(/(\\d{4})/); if (m3) y = +m3[1];
      } catch (e) {}
    }
    if (!y) return;`;

if (s.includes(NEW)) {
  console.log('已修过');
} else if (s.includes(OLD)) {
  s = s.replace(OLD, NEW);
  fs.writeFileSync(P, s, 'utf8');
  console.log('✅ 年份兜底已加（API → 盘上文字 → 表单 → localStorage）');
} else {
  console.error('❌ 未匹配年份提取段');
  const i = s.indexOf('var y = parseInt');
  console.log('实际内容：', i > 0 ? JSON.stringify(s.slice(i - 40, i + 260)) : '未找到');
  process.exit(1);
}
