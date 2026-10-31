import fs from 'node:fs';
const files = ['web/index.html', 'web/index.html.bak2', 'web/index.html.bak3',
  'web/index.html.bak4', 'web/index.html.before-reorder'];
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(f, '不存在'); continue; }
  const h = fs.readFileSync(f, 'utf8');
  const a = h.indexOf('data-page="about"');
  const b = h.indexOf('data-page="fusion"');
  const seg = h.slice(a, b > 0 ? b : a + 40000);
  const hs = [...seg.matchAll(/<h2[^>]*>([^<]{0,22})/g)].map((m) => m[1].trim());
  console.log('\n=== ' + f + ' (' + h.length + ' 字节) ===');
  console.log('  前 4 个 h2: ' + hs.slice(0, 4).join(' | '));
  const app = h.indexOf('<div id="app"');
  const at = h.indexOf('>', app) + 1;
  const re = /<div\b|<\/div>/g; re.lastIndex = at;
  let d = 1, m, appEnd = -1;
  while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0) { appEnd = m.index; break; } }
  const fusionIn = h.indexOf('data-page="fusion"') < appEnd;
  console.log('  #app 闭合 @' + appEnd + '  fusion 在 #app 内: ' + (fusionIn ? '是' : '否'));
}
