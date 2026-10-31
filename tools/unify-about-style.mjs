// 为「这是什么」块的 h3 加统一样式（与其他区块标题一致）
import fs from 'node:fs';
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.about-sec')) {
  css += `

/* ══════════ 关于页 ·「这是什么」区块标题（与全站区块标题统一）══════════ */
#sec-what-is-this .note{font-size:13px;line-height:2.05;color:rgba(205,225,240,.92)}
#sec-what-is-this .about-sec{
  font-size:13.5px;font-weight:700;color:#5ef1ff;letter-spacing:.04em;
  margin:17px 0 7px;padding-left:9px;border-left:2.5px solid rgba(94,241,255,.45);
}
#sec-what-is-this .about-sec:first-child{margin-top:0}
#sec-what-is-this p{margin:7px 0}
#sec-what-is-this ul{margin:7px 0 7px 18px}
#sec-what-is-this li{margin:4px 0}
#sec-what-is-this strong{color:#ffd58a;font-weight:700}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('✅ .about-sec 样式已加');
} else console.log('已有样式');

/* 校验 */
const h = fs.readFileSync('web/index.html', 'utf8');
const css2 = fs.readFileSync('web/style.css', 'utf8');
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['h3 用了 about-sec 类', h.includes('class="about-sec"')],
  ['块 id 存在', h.includes('id="sec-what-is-this"')],
  ['六段齐全', ['这是什么', '一句话', '三种办法', '出生时间', '哪些可以信', '最后']
    .every((x) => h.includes(x))],
  ['CSS .about-sec', css2.includes('#sec-what-is-this .about-sec')],
  ['旧块已删', !h.includes('id="sec-plain-start"')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
