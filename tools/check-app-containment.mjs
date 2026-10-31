import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const app = h.indexOf('<div id="app"');
const appTagEnd = h.indexOf('>', app) + 1;
const re = /<div\b|<\/div>/g; re.lastIndex = appTagEnd;
let d = 1, m, appEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0) { appEnd = m.index; break; } }
const about = h.indexOf('data-page="about"');
const fusion = h.indexOf('data-page="fusion"');
const syn = h.indexOf('data-page="synastry"');
console.log('#app 开 @' + app + '  闭合 @' + appEnd);
console.log('about @' + about + '  fusion @' + fusion + '  synastry @' + syn);
for (const [n, p] of [['about', about], ['fusion', fusion], ['synastry', syn]]) {
  console.log(`  ${n.padEnd(9)} ${p > app && p < appEnd ? '✅ 在 #app 内' : '❌ 在 #app 外'}`);
}
