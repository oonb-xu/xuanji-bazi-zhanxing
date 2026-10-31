// 扫描关于页里可能过时/自相矛盾的断言
import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');
const a0 = h.indexOf('data-page="about"');
const a1 = h.indexOf('data-page="fusion"', a0);
const seg = h.slice(a0, a1);
const txt = seg.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');

// 关键词 → 期望的最新表述
const RULES = [
  { key: '天空里不存在', bad: true, why: '旧断言：天空里不存在60（已被推翻）' },
  { key: '不可通约', bad: 'check', why: '需看是否把"60与行星周期不可通约"当结论' },
  { key: '人为计数', bad: 'check', why: '需看是否绝对化' },
  { key: '59.58', bad: 'know', why: '应出现在 59.58 板块' },
  { key: '原理上不可推', bad: 'check', why: '需确认理由是"计数"而非"不可通约"' },
  { key: '时支', bad: 'know', why: '应标 67.5%' },
  { key: '50%', bad: 'check', why: '旧的时支 50% 数字是否残留' },
  { key: '67.5', bad: 'know', why: '最新精度' },
  { key: '双轴', bad: 'know', why: '核心模型' },
  { key: '待校', bad: 'know', why: '紫微亮度表标注' },
  { key: '50% 可推', bad: true, why: '旧精度' },
  { key: '六壬', bad: 'know', why: '' },
  { key: 'I(A;B', bad: 'know', why: '边界公式' },
];

console.log('=== 关键词命中 ===');
for (const r of RULES) {
  const n = txt.split(r.key).length - 1;
  console.log(`  ${n > 0 ? '命中' : '--  '}  ${String(n).padStart(2)}×  「${r.key}」  ${r.why}`);
}

/* 抽出含关键争议词的完整句子 */
console.log('\n=== 需人工判断的句子 ===');
const sentences = txt.split(/[。；\n]/).map((s) => s.trim()).filter((s) => s.length > 8);
const HOT = ['不存在', '不可通约', '人为计数', '原理', '可推', '50%', '59.58', '60 '];
const seen = new Set();
for (const s of sentences) {
  if (HOT.some((k) => s.includes(k))) {
    const k = s.slice(0, 26);
    if (seen.has(k)) continue;
    seen.add(k);
    console.log('  · ' + s.slice(0, 150));
  }
}
