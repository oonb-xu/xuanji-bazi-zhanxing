// 修 rebuild-about.mjs：剥外层 card 开标签时，把 id / 锚点保留到新外壳
import fs from 'node:fs';
const P = 'tools/rebuild-about.mjs';
let s = fs.readFileSync(P, 'utf8');

const OLD = `  let s = seg.trim();
  // 剥掉开头的外层 card 开标签
  const mOpen = s.match(/^<div\\s+class="card[^"]*"[^>]*>\\s*/);
  if (mOpen) s = s.slice(mOpen[0].length);`;

const NEW = `  let s = seg.trim();
  // 剥掉开头的外层 card 开标签，但保留其中的 id（锚点必须留在新外壳上）
  let keepId = '';
  const mOpen = s.match(/^<div\\s+class="card[^"]*"[^>]*>\\s*/);
  if (mOpen) {
    const idm = mOpen[0].match(/\\bid="([^"]+)"/);
    if (idm) keepId = ' id="' + idm[1] + '"';
    s = s.slice(mOpen[0].length);
  }`;

if (!s.includes(OLD)) { console.error('❌ 未匹配到待改片段'); process.exit(1); }
s = s.replace(OLD, NEW);

// 包裹时带上 id
const OLD2 = `  return '<div class="card">\\n        ' + s.trim() + '\\n      </div>';`;
const NEW2 = `  return '<div class="card"' + keepId + '>\\n        ' + s.trim() + '\\n      </div>';`;
if (!s.includes(OLD2)) { console.error('❌ 未匹配到包裹行'); process.exit(1); }
s = s.replace(OLD2, NEW2);

fs.writeFileSync(P, s, 'utf8');
console.log('✅ 已打补丁：保留 id 到新外壳');
