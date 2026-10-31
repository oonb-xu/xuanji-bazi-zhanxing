// 合盘页：在结果最上方插入「综合结构契合度」大百分比 + 三路分项 + 术语解释
import fs from 'node:fs';

let js = fs.readFileSync('web/app.js', 'utf8');
if (js.includes('renderStructuralSummary')) { console.log('已存在，跳过'); process.exit(0); }

// ① 在 renderSynastry 函数体开头插入 summary 渲染
const OLD = 'function renderSynastry(S) {';
const NEW = `function renderSynastry(S) {
  // ★ 最上方先放「综合结构契合度」总览（用户要求：一个能涵盖所有数据的百分比总结）
  const sumBox = renderStructuralSummary(S && S.summary);
  if (sumBox) S && S.__root && S.__root.append(sumBox);`;
if (!js.includes(OLD)) { console.error('未找到 renderSynastry'); process.exit(1); }

// ② 追加渲染函数
const FN = `

/* ══════════ 合盘：综合结构契合度总览（renderStructuralSummary） ══════════ */
function renderStructuralSummary(sum) {
  if (!sum || typeof sum.structuralFitPct !== 'number') return null;
  const pct = sum.structuralFitPct;
  const tone = pct >= 70 ? 'good' : pct >= 42 ? 'warn' : 'bad';
  const box = el('div', { class: 'card ss-card' });

  box.append(el('h3', { class: 'ss-title' }, '综合结构契合度'));
  box.append(el('div', { class: 'ss-hero' },
    el('div', { class: 'ss-pct ' + tone }, String(pct) + '%'),
    el('div', { class: 'ss-side' },
      el('div', { class: 'ss-band' }, sum.band ?? ''),
      el('div', { class: 'ss-m' }, '综合分 M = ' + (sum.mValue ?? '-')))));
  box.append(el('p', { class: 'ss-disc' }, clean(sum.disclaimer ?? '')));

  // 三路分项（横向条）
  if (Array.isArray(sum.components)) {
    const list = el('div', { class: 'ss-comps' });
    for (const c of sum.components) {
      const bar = el('div', { class: 'bar' },
        el('div', { class: 'ss-k' }, c.key),
        el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + Math.max(0, Math.min(100, c.pct ?? 0)) + '%' })),
        el('div', { class: 'n' }, (c.pct === null ? '—' : c.pct + '%')));
      list.append(bar);
      list.append(el('div', { class: 'ss-note' },
        (c.what ?? '') + '　' + (c.dir ?? '') + '　z=' + (c.z ?? '-') + '　权重 ' + (c.weight ?? '-')));
    }
    box.append(list);
  }

  // 否决说明
  if (sum.veto && sum.veto.multiplier !== 1) {
    box.append(el('div', { class: 'note' },
      '否决生效：' + (sum.veto.note ?? '') + '（总分再乘 ' + sum.veto.multiplier + '）'));
  }

  // 公式
  if (sum.formula) box.append(el('div', { class: 'note' }, '算法：' + clean(sum.formula)));

  // 术语解释（折叠）
  const det = el('details', { class: 'ss-explain' });
  det.append(el('summary', null, 'M、z 和百分比分别是什么意思？（点开看）'));
  if (sum.meaning) det.append(el('p', { class: 'ss-mean' }, clean(sum.meaning)));
  box.append(det);
  return box;
}

/** 把 explain 对象渲染成折叠区（由 renderSynastry 尾部调用） */
function renderExplain(explain) {
  if (!explain || !Object.keys(explain).length) return null;
  const det = el('details', { class: 'ss-explain card' });
  det.append(el('summary', null, '这些数字怎么读？（点开看）'));
  for (const [k, v] of Object.entries(explain)) {
    det.append(el('div', { class: 'ss-ex-item' },
      el('strong', null, k + '　'), clean(v)));
  }
  return det;
}
`;

js = js.replace(OLD, NEW);
js = js + FN;

// ③ 让 renderSynastry 能拿到 S.__root / 并在末尾追加 explain
//    runForm 调用 render(S)，S 就是 data；我们改为在 renderSynastry 内自建容器再插入 #synastry-out 顶部
js = js.replace(
  "const sumBox = renderStructuralSummary(S && S.summary);\n  if (sumBox) S && S.__root && S.__root.append(sumBox);",
  "const sumBox = renderStructuralSummary(S && S.summary);\n  if (sumBox) {\n    const host = document.querySelector('#synastry-out');\n    if (host) host.insertBefore(sumBox, host.firstChild);\n  }\n  const expBox = renderExplain(S && S.explain);\n  if (expBox) {\n    const host = document.querySelector('#synastry-out');\n    if (host) host.appendChild(expBox);\n  }"
);

fs.writeFileSync('web/app.js', js, 'utf8');
console.log('app.js: 已加 renderStructuralSummary / renderExplain 并挂到 renderSynastry');
