// 隐私清理：把 web/index.html 与 docs/APP.md 里的**真实生辰数据**替换为中性示例
// 真实数据（必须清除）：2007-12-25 17:30 / 104.06,30.67（成都）；2008-07-04 16:45 / 105.05,29.58（内江）；2008-04-16 10:30
// 替换为中性示例：1990-03-15 12:00 / 116.407,39.904（北京）；1992-08-20 12:00 / 121.474,31.230（上海）；1994-11-05 12:00
import fs from 'node:fs';

const MAP = [
  // 时间
  ['2007-12-25T17:30', '1990-03-15T12:00'],
  ['2007/12/25 17:30', '1990-03-15 12:00'],
  ['2008-07-04T16:45', '1992-08-20T12:00'],
  ['2008/07/04 16:45', '1992-08-20 12:00'],
  ['2008-04-16T10:30', '1994-11-05T12:00'],
  ['2008-04-16 10:30', '1994-11-05 12:00'],
  // 经纬度
  ['104.06', '116.407'],
  ['105.05', '121.474'],
  ['30.67', '39.904'],
  ['29.58', '31.230'],
  // 地名（文档里若出现）
  ['成都', '示例市A'],
  ['内江', '示例市B'],
];

const FILES = ['web/index.html', 'web/app.js', 'server.mjs', 'docs/APP.md'];
const HITS = [];
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [from, to] of MAP) s = s.split(from).join(to);
  if (s !== orig) {
    fs.writeFileSync(f, s, 'utf8');
    const n = MAP.reduce((a, [from]) => a + (orig.split(from).length - 1), 0);
    HITS.push(`${f}: 替换 ${n} 处`);
  }
}

// 复查：全仓（除 data/docs 历史留档、reports、test）不得再有真实数据
const REAL = /2007-12-25|2008-07-04|2008-04-16|104\.06|105\.05|30\.67|29\.58/;
const leftover = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'data', 'reports', 'docs', 'backups', '.npm-cache', '.tmp', '.venv', 'leph-qvutcfou', '.ephemeris'].includes(e.name)) continue;
    const p = d + '/' + e.name;
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(html|js|mjs|css|md|json)$/.test(e.name)) continue;
    if (/^(test|tools)\//.test(p.replace(/^\.\//, ''))) continue;
    try { if (REAL.test(fs.readFileSync(p, 'utf8'))) leftover.push(p); } catch {}
  }
}
walk('.');

console.log(HITS.length ? HITS.join('\n') : '无需替换');
console.log(leftover.length ? '⚠️ 仍有残留（运行时代码）:\n' + leftover.join('\n') : '✅ 运行时代码中已无真实生辰数据');
