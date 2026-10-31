// 修复：把落在 card 外面的区块重新包进 <div class="card">
// 判据：关于页内 depth=0 的 h2（及其后到下一个 depth=0 h2 之前的内容）若不在 card 内 ⇒ 包裹
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');

const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
let seg = h.slice(a0, a1);

/** 计算每个 h2 的 depth 与是否在 card 内 */
function scanHeads(html) {
  const re = /<div\b([^>]*)>|<\/div>|<(h2)([^>]*)>([^<]{0,50})/g;
  let depth = 0;
  const stack = [];
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</div>')) { stack.pop(); depth--; }
    else if (m[0].startsWith('<div')) { depth++; stack.push((m[1].match(/class="([^"]*)"/) || [, ''])[1]); }
    else if (m[2] === 'h2') {
      const id = (m[3].match(/id="([^"]*)"/) || [, ''])[1];
      const txt = (m[5] || '').trim();
      const inCard = stack.some((c) => /\bcard\b/.test(c));
      out.push({ pos: m.index, depth, inCard, id, txt });
    }
  }
  return out;
}

const before = scanHeads(seg);
console.log('=== 修复前 ===');
before.forEach((x) => console.log(`  ${x.inCard ? 'card✅' : '裸 ❌'} depth=${x.depth} ${x.id || ''} ${x.txt.slice(0, 26)}`));

/* 找出需要包裹的 h2（depth=0 且不在 card 内） */
const need = before.filter((x) => x.depth === 0 && !x.inCard);
console.log('\n需要包裹:', need.length, '个 →', need.map((x) => x.txt.slice(0, 12)).join(' | '));

if (!need.length) { console.log('无需修复'); process.exit(0); }

/* 从后往前处理，避免位置偏移 */
const allHeads = before;  // 所有 h2 的位置
for (let k = need.length - 1; k >= 0; k--) {
  const target = need[k];
  // 该区块结束 = 下一个 depth=0 的 h2 位置，或 seg 末尾（但要保留 </section>）
  const later = allHeads.filter((x) => x.pos > target.pos && x.depth === 0);
  let endPos;
  if (later.length) endPos = later[0].pos;
  else {
    const tail = seg.slice(target.pos).match(/<\/div>\s*<\/section>\s*$/);
    endPos = seg.length - (tail ? tail[0].length : 0);
  }
  let chunk = seg.slice(target.pos, endPos).trim();
  if (!chunk) continue;
  if (/^<div class="card/.test(chunk)) continue;   // 已经是卡
  const wrapped = '<div class="card">\n        ' + chunk + '\n      </div>\n\n      ';
  seg = seg.slice(0, target.pos) + wrapped + seg.slice(endPos);
  console.log(`  已包裹: ${target.txt.slice(0, 20)} (${chunk.length} 字符)`);
}

h = h.slice(0, a0) + seg + h.slice(a1);

/* 安全闸 */
const c = (re) => (h.match(re) || []).length;
const d = [c(/<div\b/g), c(/<\/div>/g)];
console.log(`\n写盘前: div ${d[0]}/${d[1]} ${d[0] === d[1] ? '✅' : '❌'}`);
if (d[0] !== d[1]) { console.error('❌ 不平衡，拒绝写盘'); process.exit(1); }
fs.writeFileSync(P, h, 'utf8');
console.log('✅ 已写入');

/* 修复后复检 */
const seg2 = h.slice(h.indexOf('data-page="about"'), h.indexOf('data-page="fusion"'));
const after = scanHeads(seg2);
console.log('\n=== 修复后 ===');
after.forEach((x) => console.log(`  ${x.inCard ? 'card✅' : '裸 ❌'} depth=${x.depth} ${x.id || ''} ${x.txt.slice(0, 26)}`));
const stillBare = after.filter((x) => x.depth === 0 && !x.inCard);
console.log('\n仍裸露:', stillBare.length, stillBare.length ? '❌' : '✅');
process.exit(stillBare.length ? 1 : 0);
