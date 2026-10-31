// 底层重写 about 页：每个板块先配平自身标签，再包一层干净 card ⇒ 天生不嵌套
import fs from 'node:fs';
const P = 'web/index.html';
const orig = fs.readFileSync(P, 'utf8');
fs.writeFileSync('web/index.html.pre-rewrite', orig, 'utf8');
console.log('基线备份 → web/index.html.pre-rewrite', orig.length);

const SEC_OPEN = '<section class="page" data-page="about">';
const so = orig.indexOf(SEC_OPEN);
if (so < 0) { console.error('❌ 找不到 about section'); process.exit(1); }

function matchSectionEnd(s, from) {
  const re = /<section\b|<\/section>/g; re.lastIndex = from;
  let d = 1, m;
  while ((m = re.exec(s))) { d += m[0] === '</section>' ? -1 : 1; if (d === 0) return m.index; }
  return -1;
}
const innerStart = so + SEC_OPEN.length;
const innerEnd = matchSectionEnd(orig, innerStart);
const inner = orig.slice(innerStart, innerEnd);
console.log('about inner:', inner.length, '字符');

const MARKS = [
  ['title', '<h2 class="page-title">'],
  ['notCollage', 'id="sec-not-collage"'],
  ['privacy', 'privacy-card'],
  ['method', 'id="sec-method"'],
  ['e5958', 'id="sec-59-58"'],
  ['conflict', 'id="sec-conflict"'],
  ['exp', 'id="sec-experiment"'],
  ['credits', 'id="sec-credits"'],
  ['howto', 'id="sec-howto"'],
  ['apiMain', '主流 API 怎么拿'],
  ['apiKey', 'Key 怎么用'],
  ['what', 'id="sec-what-is-this"'],
];
function tagStartOf(s, key) {
  const p = s.indexOf(key);
  if (p < 0) return -1;
  const lt = s.lastIndexOf('<', p);
  return lt >= 0 ? lt : p;
}
const marks = MARKS.map(([n, k]) => ({ name: n, pos: tagStartOf(inner, k) })).filter((x) => x.pos >= 0);
marks.sort((a, b) => a.pos - b.pos);
console.log('锚点:', marks.map((m) => m.name + '@' + m.pos).join(' '));
for (let i = 1; i < marks.length; i++) {
  if (marks[i].pos <= marks[i - 1].pos) { console.error('❌ 锚点重叠'); process.exit(1); }
}

const prefix = inner.slice(0, marks[0].pos);
const raw = {};
for (let i = 0; i < marks.length; i++) {
  const s = marks[i].pos;
  const e = i + 1 < marks.length ? marks[i + 1].pos : inner.length;
  raw[marks[i].name] = inner.slice(s, e);
}

const count = (s, re) => (s.match(re) || []).length;
const PAIRS = [['div', /<div\b/g, '</div>'], ['section', /<section\b/g, '</section>'],
  ['h2', /<h2\b/g, '</h2>'], ['h3', /<h3\b/g, '</h3>'], ['b', /<b\b/g, '</b>'],
  ['strong', /<strong>/g, '</strong>'], ['span', /<span\b/g, '</span>'], ['i', /<i\b/g, '</i>'],
  ['table', /<table\b/g, '</table>'], ['tr', /<tr\b/g, '</tr>'], ['td', /<td\b/g, '</td>'],
  ['th', /<th\b/g, '</th>'], ['li', /<li\b/g, '</li>'], ['p', /<p\b/g, '</p>']];

function normalize(name, seg) {
  let s = seg.trim();
  // 剥掉开头的外层 card 开标签，但保留其中的 id（锚点必须留在新外壳上）
  let keepId = '';
  const mOpen = s.match(/^<div\s+class="card[^"]*"[^>]*>\s*/);
  if (mOpen) {
    const idm = mOpen[0].match(/\bid="([^"]+)"/);
    if (idm) keepId = ' id="' + idm[1] + '"';
    s = s.slice(mOpen[0].length);
  }

  // 逐类配平：多闭合的削尾部，缺闭合的补到尾部
  for (const [n, openRe, closeTag] of PAIRS) {
    let d = count(s, openRe) - count(s, new RegExp(closeTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    while (d < 0) {
      const idx = s.lastIndexOf(closeTag);
      if (idx < 0) break;
      s = s.slice(0, idx) + s.slice(idx + closeTag.length);
      d++;
    }
    if (d > 0) s = s + closeTag.repeat(d);
  }
  return '<div class="card"' + keepId + '>\n        ' + s.trim() + '\n      </div>';
}

const norm = {};
for (const [k, v] of Object.entries(raw)) {
  norm[k] = normalize(k, v);
  const dl = count(norm[k], /<div\b/g) - count(norm[k], /<\/div>/g);
  console.log(`  ${k.padEnd(11)} → divΔ=${dl}  ${norm[k].length} 字符`);
}

const TARGET = ['title', 'privacy', 'what', 'howto', 'apiMain', 'apiKey',
  'notCollage', 'method', 'e5958', 'conflict', 'exp', 'credits'];
const miss = TARGET.filter((k) => !norm[k]);
if (miss.length) { console.error('❌ 缺块:', miss.join(','), '有:', Object.keys(norm).join(',')); process.exit(1); }

const newInner = '\n\n      ' + prefix.trim() + '\n\n      ' + TARGET.map((k) => norm[k]).join('\n\n      ') + '\n\n    ';
const out = orig.slice(0, innerStart) + newInner + orig.slice(innerEnd);

const c = (s, re) => (s.match(re) || []).length;
console.log('\n=== 校验 ===');
let bad = 0;
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['section', /<section\b/g, /<\/section>/g],
  ['h2', /<h2\b/g, /<\/h2>/g], ['h3', /<h3\b/g, /<\/h3>/g], ['b', /<b\b/g, /<\/b>/g],
  ['strong', /<strong>/g, /<\/strong>/g], ['span', /<span\b/g, /<\/span>/g], ['i', /<i\b/g, /<\/i>/g],
  ['table', /<table\b/g, /<\/table>/g], ['tr', /<tr\b/g, /<\/tr>/g], ['td', /<td\b/g, /<\/td>/g],
  ['th', /<th\b/g, /<\/th>/g], ['li', /<li\b/g, /<\/li>/g], ['p', /<p\b/g, /<\/p>/g]]) {
  const ok = c(out, o) === c(out, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(7)} ${c(out, o)}/${c(out, cl)} ${ok ? '✅' : '❌'}`);
}

const app = out.indexOf('<div id="app"');
const at = out.indexOf('>', app) + 1;
const re2 = /<div\b|<\/div>/g; re2.lastIndex = at;
let dd = 1, mm, appEnd = -1;
while ((mm = re2.exec(out))) { dd += mm[0] === '</div>' ? -1 : 1; if (dd === 0) { appEnd = mm.index; break; } }
console.log('\n#app 闭合 @' + appEnd);
for (const [n, k] of [['about', 'data-page="about"'], ['fusion', 'data-page="fusion"'], ['synastry', 'data-page="synastry"'],
  ['liuren', 'data-page="liuren"'], ['rectify', 'data-page="rectify"'], ['timeline', 'data-page="timeline"']]) {
  const p = out.indexOf(k);
  const ok = p > app && p < appEnd;
  if (!ok) bad++;
  console.log(`  ${ok ? '✅' : '❌'} ${n}`);
}

const NEED = ['id="sec-what-is-this"', '想要精确度', 'id="sec-howto"', 'Key 怎么用', 'id="sec-not-collage"',
  'id="sec-method"', 'id="sec-59-58"', 'id="sec-conflict"', 'id="sec-experiment"', 'id="sec-credits"',
  '隐私承诺', '主流 API', '这是什么', '最后', 'tyme4ts', 'VedAstro'];
const lost = NEED.filter((k) => !out.includes(k));
console.log('  内容 ' + (lost.length ? '❌ 丢:' + lost.join(',') : `✅ ${NEED.length} 项齐全`));
if (lost.length) bad++;

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
fs.writeFileSync(P, out, 'utf8');
console.log('\n✅ 已写入（about 页已重写）');
const s2 = out.indexOf(SEC_OPEN);
const e2 = matchSectionEnd(out, s2 + SEC_OPEN.length);
const in2 = out.slice(s2 + SEC_OPEN.length, e2);
[...in2.matchAll(/<(h2|h3)[^>]*>([^<]{0,26})/g)].forEach((x, i) => console.log('  ' + String(i + 1).padStart(2) + '. ' + x[1] + ' ' + x[2].trim()));
