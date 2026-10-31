// 把前端「拒收 / 门槛未通过」的文案改成「分级照收 + 误差告知」
import fs from 'node:fs';

let js = fs.readFileSync('web/app.js', 'utf8');
const before = js;

// ① 渲染函数：bad 文案 → 分级展示
js = js.replace(
  "el('div', { class: 'ct-verdict bad' }, '未入库 · 质量门槛未通过')",
  "el('div', { class: 'ct-verdict ' + (R.tier === 'X' ? 'bad' : 'ok') }, R.tier === 'X' ? '无法使用 · 四柱不合法' : ('已入库 · 等级 ' + (R.tier ?? '?') + ' · ' + (R.label ?? '')))"
);

// ② 标题文案
js = js.replace("'缺什么（gate.blockers）'", "'误差告知（这些会让结果不够准，但数据已收下）'");
js = js.replace("'要补什么（whatToFix）'", "'建议补什么（补上后可升级）'");

// ③ 注释同步
js = js.replace(
  '故意不在前端做「矫正事件 <3」预拦截：让后端 qualityGate 判定并回 blockers，',
  '故意不在前端做「矫正事件 <3」预拦截：让后端 qualityAssess 判级并回 advisories（**照收**，不是拒收），'
);

if (js === before) console.log('⚠️ app.js 未匹配到可替换文案（可能工作流改过写法）');
else console.log('app.js 文案已更新');

// ④ 追加：分级徽章渲染（如果结果里有 tier，就显示权重与 impact）
if (!js.includes('TIER_BADGE')) {
  js += `

/* ══════════ 采集结果：分级徽章 + 误差告知（TIER_BADGE） ══════════ */
function renderTierBadge(R) {
  if (!R || !R.tier) return null;
  const tier = R.tier;
  const map = {
    A: { cls: 'ok', text: 'A 级 · 可直接参与校准' },
    B: { cls: 'warn', text: 'B 级 · 以 0.6 权重参与校准' },
    C: { cls: 'warn', text: 'C 级 · 仅结构参考，不参与校准' },
    X: { cls: 'bad', text: 'X 级 · 数据无法使用' },
  };
  const m = map[tier] ?? map.C;
  const box = el('div', { class: 'ct-tier' });
  box.append(el('div', { class: 'tags' },
    el('span', { class: 'tag ' + m.cls }, m.text),
    el('span', { class: 'tag' }, '质量分 ' + (R.qualityScore ?? '-')),
    el('span', { class: 'tag' }, '校准权重 ' + (R.calibrationWeight ?? '-'))));
  if (R.impact) box.append(el('p', { class: 'ct-line' }, clean(R.impact)));
  if (Array.isArray(R.advisories) && R.advisories.length) {
    box.append(el('div', { class: 'ct-blockers' },
      el('div', { class: 'ct-h' }, '误差告知（数据已收下，但这些会影响准确度）'),
      el('ul', null, R.advisories.map((a) => el('li', null, clean(a))))));
  }
  return box;
}
`;
  console.log('app.js 已追加 renderTierBadge');
}

fs.writeFileSync('web/app.js', js, 'utf8');

// ⑤ 反馈页顶部说明改写
let html = fs.readFileSync('web/index.html', 'utf8');
const oldNote = /<h2 class="page-title">数据反馈[\s\S]{0,400}?<\/p>/;
html = html.replace(
  /三条硬性门槛（由后端逐条判定，没过会告诉你缺什么）：/,
  '**数据一定会收下**，但会按完整程度分等级；等级决定它在校准时占多少权重，并逐条告诉你哪里可能有误差：'
);
html = html.replace(/<li><strong>出生时间已做生时矫正（未勾选一律不入库）<\/strong><\/li>/, '<li><strong>做生时矫正</strong>：没做也能提交，但时柱可能整柱错位 → 只作 C 级参考</li>');
html = html.replace(/<li>≥3 条带确切年份的矫正事件<\/li>/, '<li>≥3 条带确切年份的矫正事件（越多样越好）</li>');
html = html.replace(/<li>结局事件里≥1 条决定性大事件（婚姻 \/ 生育 \/ 重疾 \/ 丧亲 \/ 事业 \/ 迁移 \/ 学业 \/ 财务）<\/li>/, '<li>≥1 条决定性大事件（婚姻 / 生育 / 重疾 / 丧亲 / 事业 / 迁移 / 学业 / 财务）→ 有了才能参与"算得准不准"的校准</li>');
fs.writeFileSync('web/index.html', html, 'utf8');
console.log('index.html 反馈页说明已改');
