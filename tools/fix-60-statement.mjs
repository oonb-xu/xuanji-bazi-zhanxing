// 把「年柱日柱不可推」的旧说法改成与实验性板块一致的表述
// 旧：60 甲子是人为计数，而木土会合周期是 59.58 年 ≠ 60 年，天空里不存在"60"这个数。这是原理性边界，不是精度问题。
// 新：与 docs/42 §实验性 / 关于页 59.58 板块 一致 —— 60 确有天文依据，但它是「计数」而非可测几何量，须外部纪元锚点。
import fs from 'node:fs';

const NEW =
  '年柱、日柱无法从行星位置推出 —— 60 甲子里的「60」**确有天文近似依据**：' +
  '它是 LCM(12木, 30土)，也 ≈ 3 次木土会合（59.577 年）；且 6 个甲子日 = 360 天，' +
  '与回归年 365.2422 天咬合 98.56%。' +
  '但「60」在这套体系里**是计数，不是可测的几何量** —— ' +
  '星盘能给出所有角度，却给不出"这是第几个甲子"。' +
  '要从落位反推年柱/日柱，必须有一个**外部纪元锚点**（如 1984 = 甲子）。' +
  '这是原理性边界，不是精度问题。';

// 用于 HTML 的版本（** → <strong>）
const NEW_HTML = NEW.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

const FILES = [
  'docs/41-仅凭落位推七柱.md',
  'docs/42-融合路径论文.md',
  'web/index.html',
  'web/paper.html',
  'tools/add-core-declaration.mjs',
  'tools/add-paper-and-api-note.mjs',
];

let changed = 0;
for (const f of FILES) {
  if (!fs.existsSync(f)) { console.log('跳过（不存在）:', f); continue; }
  let s = fs.readFileSync(f, 'utf8');
  const isHtml = /\.html$/.test(f);
  const repl = isHtml ? NEW_HTML : NEW;

  let hit = 0;

  // ① 整句替换：从「年柱、日柱无法从行星位置推出」到「不是精度问题。」
  const reFull = /年柱[、，,]?\s*日柱无法从行星位置推出[\s\S]{0,400}?不是精度问题[。.]/;
  if (reFull.test(s)) {
    s = s.replace(reFull, repl);
    hit++;
  }

  // ② 兜底：分别替换两个断言片段（防止句子格式不一）
  if (!hit) {
    const before = s;
    s = s.replace(/60\s*甲子是人为计数/g, '「60」是计数（但它确有天文近似依据）');
    s = s.replace(/天空里不存在[""']?60[""']?这个数/g, '星盘里给不出"这是第几个甲子"');
    s = s.replace(/而木土会合周期是\s*59\.58\s*年\s*≠\s*60\s*年/g, '（木土会合 3 周期 = 59.577 年，与 60 有 0.423 年差）');
    if (s !== before) hit++;
  }

  if (hit) {
    // HTML 走安全闸
    if (isHtml) {
      const cnt = (str, re) => (str.match(re) || []).length;
      if (cnt(s, /<div\b/g) !== cnt(s, /<\/div>/g) || cnt(s, /<strong>/g) !== cnt(s, /<\/strong>/g)) {
        console.error('❌', f, '标签不平衡，跳过');
        continue;
      }
    }
    fs.writeFileSync(f, s, 'utf8');
    changed++;
    console.log('✅', f);
  } else {
    console.log('—  %s 未匹配到目标句', f);
  }
}

console.log('\n共改', changed, '个文件');

/* 验证：不应再有旧断言 */
console.log('\n=== 残留检查 ===');
for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const bad = [];
  if (s.includes('天空里不存在')) bad.push('天空里不存在');
  if (/60\s*甲子是人为计数/.test(s)) bad.push('60甲子是人为计数');
  console.log(' ', bad.length ? '❌ ' + f + ' → ' + bad.join(',') : '✅ ' + f);
}
