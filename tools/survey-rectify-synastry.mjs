import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');

function sectionOf(page) {
  const key = 'data-page="' + page + '"';
  const i = h.indexOf(key);
  if (i < 0) return null;
  const s = h.lastIndexOf('<section', i);
  const re = /<section\b|<\/section>/g; re.lastIndex = s;
  let d = 0, m, e = -1;
  while ((m = re.exec(h))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0 && m[0] === '</section>') { e = m.index + 10; break; } }
  return { s, e, len: e - s };
}
console.log('=== 各 section 体积 ===');
for (const p of ['fusion', 'synastry', 'rectify', 'contribute', 'about', 'liuren', 'timeline']) {
  const r = sectionOf(p);
  console.log('  ' + p.padEnd(11) + (r ? '[' + r.s + '→' + r.e + '] ' + r.len + ' 字符' : '(无)'));
}

console.log('\n=== 矫正页里的表单/字段 ===');
const r = sectionOf('rectify');
if (r) {
  const seg = h.slice(r.s, r.e);
  const ids = [...seg.matchAll(/id="([^"]+)"/g)].map((x) => x[1]);
  const names = [...seg.matchAll(/name="([^"]+)"/g)].map((x) => x[1]);
  const fns = [...seg.matchAll(/onclick="([^"]{0,40})/g)].map((x) => x[1]);
  console.log('  id:', ids.join(', ').slice(0, 300));
  console.log('  name:', names.join(', ').slice(0, 200));
  console.log('  onclick:', fns.slice(0, 6).join(' | '));
}

console.log('\n=== 合盘页表单字段 ===');
const s2 = sectionOf('synastry');
if (s2) {
  const seg = h.slice(s2.s, s2.e);
  const names = [...seg.matchAll(/name="([^"]+)"/g)].map((x) => x[1]);
  console.log('  name:', [...new Set(names)].join(', '));
  const ids = [...seg.matchAll(/id="([^"]+)"/g)].map((x) => x[1]);
  console.log('  id:', [...new Set(ids)].join(', ').slice(0, 260));
}

console.log('\n=== 导航按钮 ===');
for (const m of h.matchAll(/<button class="tab"[^>]*data-go="([^"]+)"[^>]*>([\s\S]{0,60}?)<\/button>/g)) {
  console.log('  ' + m[1].padEnd(11) + m[2].replace(/<[^>]*>/g, '').trim().slice(0, 8));
}

console.log('\n=== index.html 引用的脚本 ===');
for (const m of h.matchAll(/<script[^>]*src="([^"]+)"/g)) console.log('  ' + m[1]);
