// 修正：总览必须在 renderSynastry 渲染完成**之后**插入
// 做法：原函数改名 renderSynastryCore，新增 renderSynastry 包装：先调 core，再把总览 prepend 到容器首部。
import fs from 'node:fs';

let s = fs.readFileSync('web/app.js', 'utf8');

// ① 去掉上次插在函数开头的两段（它们会被后续填充覆盖，且可能已报错）
const badHead = `function renderSynastry(S) {
  // ★ 最上方先放「综合结构契合度」总览（用户要求：一个能涵盖所有数据的百分比总结）
  const sumBox = renderStructuralSummary(S && S.summary);
  if (sumBox) {
    const host = document.querySelector('#synastry-out');
    if (host) host.insertBefore(sumBox, host.firstChild);
  }
  const expBox = renderExplain(S && S.explain);
  if (expBox) {
    const host = document.querySelector('#synastry-out');
    if (host) host.appendChild(expBox);
  }`;
if (s.includes(badHead)) {
  s = s.replace(badHead, 'function renderSynastryCore(S) {');
  console.log('① 已拆出 renderSynastryCore');
} else if (s.includes('function renderSynastryCore(S)')) {
  console.log('① 已存在 Core');
} else {
  // 回退：若开头没匹配到，就直接把 renderSynastry 改名
  s = s.replace('function renderSynastry(S) {', 'function renderSynastryCore(S) {');
  console.log('① 回退改名成功');
}

// ② 追加包装器（放文件末尾，函数声明会提升）
if (!s.includes('function renderSynastry(S) {')) {
  s += `

/* ══════════ 合盘渲染包装：先渲染原内容，再把总览插到最前面 ══════════ */
function renderSynastry(S) {
  renderSynastryCore(S);
  const host = document.querySelector('#synastry-out');
  if (!host) return;
  const sumBox = renderStructuralSummary(S && S.summary);
  if (sumBox) host.insertBefore(sumBox, host.firstChild);
  const expBox = renderExplain(S && S.explain);
  if (expBox) host.appendChild(expBox);
}
`;
  console.log('② 已追加 renderSynastry 包装器');
} else {
  console.log('② 包装器已存在');
}

fs.writeFileSync('web/app.js', s, 'utf8');
console.log('完成');
