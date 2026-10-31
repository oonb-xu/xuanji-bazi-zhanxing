// 扫描深度，找到多余的那个 </div> 并删除（取第一个使深度 <0 的位置）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const re = /<div\b|<\/div>/g;
let d = 0, m, bad = -1;
while ((m = re.exec(h))) {
  d += m[0] === '</div>' ? -1 : 1;
  if (d < 0) { bad = m.index; break; }
}
if (bad < 0) {
  const c = (s, r) => (s.match(r) || []).length;
  console.log('  深度从未为负；div', c(h, /<div\b/g) + '/' + c(h, /<\/div>/g));
  process.exit(0);
}
console.log('多余 </div> 位置 @' + bad);
console.log('  上下文: ' + JSON.stringify(h.slice(bad - 130, bad + 30)));

fs.writeFileSync(P + '.bak21', h, 'utf8');
h = h.slice(0, bad) + h.slice(bad + 6);
fs.writeFileSync(P, h, 'utf8');

const c = (s, r) => (s.match(r) || []).length;
const ok = c(h, /<div\b/g) === c(h, /<\/div>/g);
console.log('删除后 div ' + c(h, /<div\b/g) + '/' + c(h, /<\/div>/g) + (ok ? ' ✅' : ' ❌'));

/* 复核：整体深度不得为负，且 #app 仍包住 6 个页面 */
let dd = 0, mm;
const r2 = /<div\b|<\/div>/g;
let neg = false;
while ((mm = r2.exec(h))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd < 0) { neg = true; break; } }
console.log('  全程无负深度: ' + (neg ? '❌' : '✅'));

const app = h.indexOf('<div id="app"');
const at = h.indexOf('>', app) + 1;
const r3 = /<div\b|<\/div>/g; r3.lastIndex = at;
let d3 = 1, m3, appEnd = -1;
while ((m3 = r3.exec(h))) { d3 += m3[0] === '</div>' ? -1 : 1; if (d3 === 0) { appEnd = m3.index; break; } }
const allIn = ['fusion', 'synastry', 'liuren', 'rectify', 'timeline'].every((k) => {
  const p = h.indexOf('data-page="' + k + '"');
  return p > app && p < appEnd;
});
console.log('  #app 包住其余页面: ' + (allIn ? '✅' : '❌'));
process.exit(ok && !neg && allIn ? 0 : 1);
