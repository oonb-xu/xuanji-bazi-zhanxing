// 补 scroll-margin-top：锚点跳转时标题不被顶部固定 header 盖住
import fs from 'node:fs';
const P = 'web/style.css';
let c = fs.readFileSync(P, 'utf8');
if (c.includes('/* TOC-JUMP-FIX */')) { console.log('已加过'); process.exit(0); }
c += `
/* TOC-JUMP-FIX —— 锚点跳转时给顶部固定 header 留出空间，标题不被盖住 */
#about section[id^="sec-"],
#about [id^="sec-"],
section.page[id^="sec-"],
[id^="sec-not-collage"],[id^="sec-howto"],[id^="sec-method"],
[id^="sec-adv"],[id^="sec-coupling"],[id^="sec-fusion-layers"],[id^="sec-skeleton"],
[id^="sec-59-58"],[id^="sec-conflict"],[id^="sec-experiment"],[id^="sec-credits"]{
  scroll-margin-top:74px;
}
`;
fs.writeFileSync(P, c, 'utf8');
console.log('✅ 已追加 TOC-JUMP-FIX，style.css', c.length, '字节');
