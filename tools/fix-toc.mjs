// 删掉指向不存在锚点的导航项（sec-privacy），并重编号
import fs from 'node:fs';
let h = fs.readFileSync('web/index.html', 'utf8');

const BAD = /<a href="#sec-privacy" class="toc-i">[\s\S]*?<\/a>\s*/;
if (BAD.test(h)) {
  h = h.replace(BAD, '');
  console.log('✅ 已删除 sec-privacy 导航项');
} else {
  console.log('未找到该导航项');
}

// 重编号 1..n
let n = 0;
h = h.replace(/(<a href="#sec-[\w-]+" class="toc-i[^"]*"><b>)(\d+)(<\/b>)/g, (m, a, _o, c) => {
  n++;
  return a + n + c;
});
console.log('重编号后共', n, '项');

fs.writeFileSync('web/index.html', h, 'utf8');

// 校验：所有 toc 链接都要有对应锚点
const links = Array.from(h.matchAll(/href="#(sec-[\w-]+)"/g)).map((m) => m[1]);
console.log('\n=== 导航链接 → 锚点 ===');
let bad = 0;
for (const l of [...new Set(links)]) {
  const ok = h.indexOf('id="' + l + '"') >= 0;
  if (!ok) bad++;
  console.log((ok ? '✅' : '❌'), l);
}
console.log(bad ? '\n❌ 仍有断链' : '\n✅ 全部可跳转');
process.exit(bad ? 1 : 0);
