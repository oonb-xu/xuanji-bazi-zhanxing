// 诊断：dump 关于页尾部结构（看清"最下面的内容"到底是什么）
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
const seg = h.slice(a0, a1);
console.log('关于页长度:', seg.length, '字符');

// 所有 h2 / h3 及其位置（相对 seg）
const heads = [...seg.matchAll(/<(h2|h3)([^>]*)>([\s\S]{0,60}?)<\/\1>/g)].map((m) => ({
  lvl: m[1], attr: m[2].trim(), text: m[3].replace(/<[^>]+>/g, '').trim().slice(0, 40), pos: m.index,
}));
console.log('\n=== 全部标题（按位置）===');
heads.forEach((x, i) => console.log(`  ${i + 1}. @${x.pos} <${x.lvl}${x.attr ? ' ' + x.attr : ''}> ${x.text}`));

// 尾部 3 个标题之后的内容，转纯文本
const last = heads.slice(-3);
console.log('\n=== 尾部三段（纯文本前 700 字）===');
for (const x of last) {
  const end = seg.length;
  const sub = seg.slice(x.pos, Math.min(end, x.pos + 2500));
  const txt = sub.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`\n--- @${x.pos} ${x.text} ---`);
  console.log(txt.slice(0, 700));
}

// 最末尾 800 字符原样
console.log('\n=== 最末尾 800 字符（原样）===');
console.log(JSON.stringify(seg.slice(-800)));
