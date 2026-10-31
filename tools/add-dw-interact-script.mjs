import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
if (h.includes('/dw-interact.js')) { console.log('— 已有引入'); process.exit(0); }
const b = h.lastIndexOf('</body>');
if (b < 0) { console.error('❌ 无 </body>'); process.exit(1); }
h = h.slice(0, b) + '  <script src="/dw-interact.js"></script>\n' + h.slice(b);
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已引入 dw-interact.js');

const c = (s, r) => (s.match(r) || []).length;
const bad = c(h, /<script\b/g) !== c(h, /<\/script>/g);
console.log('  script ' + c(h, /<script\b/g) + '/' + c(h, /<\/script>/g) + (bad ? ' ❌' : ' ✅'));
/* #app 仍包住页面 */
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
process.exit(bad || !allIn ? 1 : 0);
