import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
const OLD = '<b>8</b><span>60 甲子连续性</span><i>实验性板块</i>';
const NEW = '<b>8</b><span>60 甲子连续性</span><i>实测与结论</i>';
if (!h.includes(OLD)) { console.error('未匹配'); process.exit(1); }
h = h.replace(OLD, NEW);
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 第8项副标题改为「实测与结论」');

const ti = h.indexOf('id="about-toc"');
const ts = h.lastIndexOf('<div', ti);
const re = /<div\b|<\/div>/g; re.lastIndex = ts;
let d = 0, m, te = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') { te = m.index + 6; break; } }
const toc = h.slice(ts, te);
for (const it of toc.matchAll(/<b>(\d+)<\/b><span>([^<]*)<\/span><i>([^<]*)<\/i>/g)) {
  console.log(`  ${it[1].padStart(2)}. ${it[2]} · ${it[3]}`);
}
