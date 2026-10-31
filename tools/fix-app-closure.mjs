// 修「#app 提前闭合」：让 #app 包住所有页面（左边对齐的关键）
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak4', h, 'utf8');

const app = h.indexOf('<div id="app"');
const appTagEnd = h.indexOf('>', app) + 1;
const re = /<div\b|<\/div>/g; re.lastIndex = appTagEnd;
let d = 1, m, appEnd = -1;
while ((m = re.exec(h))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0) { appEnd = m.index; break; } }
console.log('#app 闭合位置 @' + appEnd);
console.log('闭合处上下文:', JSON.stringify(h.slice(appEnd - 160, appEnd + 80)));

/* 找 nav 位置（#app 真正应该结束的地方） */
const navPos = h.indexOf('<nav class="tabbar"');
console.log('nav @' + navPos);
console.log('nav 前上下文:', JSON.stringify(h.slice(navPos - 120, navPos + 30)));

if (appEnd < 0 || navPos < 0 || appEnd > navPos) { console.error('❌ 位置异常，中止'); process.exit(1); }

/* ① 删掉提前的 </div>（#app 的假闭合） */
let out = h.slice(0, appEnd) + h.slice(appEnd + 6);
/* ② 在 nav 之前补上真正的 </div> */
const nav2 = out.indexOf('<nav class="tabbar"');
out = out.slice(0, nav2) + '</div>\n\n  ' + out.slice(nav2);

/* 校验 */
const c = (s, r) => (s.match(r) || []).length;
const dO = c(out, /<div\b/g), dC = c(out, /<\/div>/g);
console.log(`\ndiv ${dO}/${dC} ${dO === dC ? '✅' : '❌'}`);

/* 重新检查包含关系 */
const a2 = out.indexOf('<div id="app"');
const a2e = out.indexOf('>', a2) + 1;
const r2 = /<div\b|<\/div>/g; r2.lastIndex = a2e;
let dd = 1, mm, a2End = -1;
while ((mm = r2.exec(out))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { a2End = mm.index; break; } }
console.log('#app 新闭合 @' + a2End);
let bad = 0;
for (const [n, key] of [['about', 'data-page="about"'], ['fusion', 'data-page="fusion"'],
  ['synastry', 'data-page="synastry"'], ['liuren', 'data-page="liuren"'],
  ['rectify', 'data-page="rectify"'], ['timeline', 'data-page="timeline"']]) {
  const p = out.indexOf(key);
  const ok = p > a2 && p < a2End;
  if (!ok) bad++;
  console.log(`  ${ok ? '✅' : '❌'} ${n.padEnd(9)} @${p}`);
}
console.log(`  nav ${out.indexOf('<nav class="tabbar"')} ${out.indexOf('<nav class="tabbar"') > a2End ? '✅ 在 #app 之后' : '❌'}`);

if (dO !== dC || bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入（#app 现在包住所有页面）');
