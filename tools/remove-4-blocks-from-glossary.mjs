// 从查表页移除 4 个已迁出的板块（静态卡 + renderStatic 调用）
import fs from 'node:fs';
const P = 'web/glossary.html';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak', t, 'utf8');
const before = t.length;

function divEnd(s, from) {
  const re = /<div\b|<\/div>/g; re.lastIndex = from;
  let d = 0, m;
  while ((m = re.exec(s))) { d += m[0] === '</div>' ? -1 : 1; if (d === 0 && m[0] === '</div>') return m.index + 6; }
  return -1;
}

/* ① 删除 4 张静态卡（它们是连续的） */
const firstKey = '各体系独有优势';
const lastKey = '四系统共同骨架';
const p1 = t.indexOf(firstKey);
const p2 = t.indexOf(lastKey);
if (p1 < 0 || p2 < 0) { console.error('❌ 找不到目标卡片'); process.exit(1); }
const cardStart = t.lastIndexOf('<div class="card">', p1);
const cardEnd = divEnd(t, t.lastIndexOf('<div class="card">', p2));
console.log('删除区间 [' + cardStart + '→' + cardEnd + ']  ' + (cardEnd - cardStart) + ' 字符');
console.log('区间开头:', JSON.stringify(t.slice(cardStart, cardStart + 70)));
console.log('区间结尾:', JSON.stringify(t.slice(cardEnd - 60, cardEnd)));
t = t.slice(0, cardStart) + t.slice(cardEnd);

/* ② 停掉 renderStatic 调用（容器已不存在，调用会抛错） */
let calls = 0;
t = t.replace(/\brenderStatic\(\)\s*;/g, (m) => { calls++; return '/* 4 板块已迁至关于页方法论之后，此处不再渲染 */'; });
console.log('已停用 renderStatic 调用:', calls, '处');

/* ③ 整个 renderStatic 函数体已无用，包进永不执行的块以免误用 */
const fi = t.indexOf('function renderStatic');
if (fi >= 0) {
  // 找到该函数的结束（用大括号配对）
  let i = t.indexOf('{', fi), d = 0, end = -1;
  for (; i < t.length; i++) {
    if (t[i] === '{') d++;
    else if (t[i] === '}') { d--; if (d === 0) { end = i + 1; break; } }
  }
  if (end > 0) {
    const body = t.slice(fi, end);
    t = t.slice(0, fi) + '/* 已迁出：各体系独有优势/庙旺差异/一图四层/四系统共同骨架 → index.html 关于页 */\n' + t.slice(end);
    console.log('已移除 renderStatic 函数体', body.length, '字符');
  }
}

fs.writeFileSync(P, t, 'utf8');
console.log('\n文件大小', before, '→', t.length, '（减少', before - t.length, '）');

/* ── 校验 ── */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['html', /<html\b/g, /<\/html>/g],
  ['style', /<style\b/g, /<\/style>/g], ['script', /<script\b/g, /<\/script>/g],
  ['table', /<table\b/g, /<\/table>/g]]) {
  const ok = c(t, o) === c(t, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(t, o)}/${c(t, cl)} ${ok ? '✅' : '❌'}`);
}
const stillHasContainers = ['id="adv"', 'id="coupling"', 'id="fusion"', 'id="skeleton"'].filter((k) => t.includes(k));
console.log('  残留容器 ' + (stillHasContainers.length ? '❌ ' + stillHasContainers.join(',') : '✅ 无'));
if (stillHasContainers.length) bad++;
const stillCalled = /renderStatic\(\)\s*;/.test(t);
console.log('  renderStatic 仍被调用 ' + (stillCalled ? '❌ 是' : '✅ 否'));
if (stillCalled) bad++;
/* 查表核心功能必须保留 */
const keep = ['renderEntries', '输入一个术语开始查', 'glossary-data.json', 'id="q"'];
const gone = keep.filter((k) => !t.includes(k));
console.log('  搜索功能完整 ' + (gone.length ? '❌ 丢 ' + gone.join(',') : '✅'));
if (gone.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
console.log('\n✅ 已写入 glossary.html');
