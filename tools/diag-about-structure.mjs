// 结构骨架：关于页每个标题在第几层、是否在 card 内
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
const seg = h.slice(a0, a1);

// 逐 token 走，记录 depth 与最近的 card class
const re = /<div\b([^>]*)>|<\/div>|<(h2|h3)([^>]*)>([^<]{0,40})/g;
let depth = 0;
const stack = [];
let m;
console.log('=== 关于页结构骨架 ===');
while ((m = re.exec(seg))) {
  if (m[0].startsWith('</div>')) {
    stack.pop();
    depth--;
  } else if (m[0].startsWith('<div')) {
    depth++;
    const cls = (m[1].match(/class="([^"]*)"/) || [, ''])[1];
    stack.push(cls || '(无class)');
  } else if (m[2]) {
    const lvl = m[2], attr = (m[4] !== undefined ? m[5] === undefined ? m[4] : '' : '');
    const txt = (m[4] || '').trim() || (m[5] || '').trim() || m[4] || '';
    const cls = (m[3].match(/class="([^"]*)"/) || [, ''])[1];
    const idm = (m[3].match(/id="([^"]*)"/) || [, ''])[1];
    const inCard = stack.lastIndexOf('card') >= 0 || stack.some((c) => /card/.test(c));
    console.log(`  depth=${depth} ${lvl} ${idm ? '#' + idm : ''} ${cls ? '.' + cls : ''} 「${(txt || '').slice(0, 28)}」  card内=${inCard ? 'Y' : 'N'}  栈=${stack.slice(-2).join('>')}`);
  }
}
console.log('\n最终 depth:', depth, depth === 0 ? '✅' : '❌');
