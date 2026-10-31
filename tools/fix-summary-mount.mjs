// 彻底改法：① 把 Core 改回 renderSynastry ② 删掉包装器
// ③ 在 runForm 的 out.replaceChildren(render(...)) 之后，调用 maybeAddSynastrySummary(out, data)
//    这样不依赖任何跨作用域的函数名，也没有返回值约定问题。
import fs from 'node:fs';

let s = fs.readFileSync('web/app.js', 'utf8');

// ① Core 改回名字
s = s.replace('function renderSynastryCore(S) {', 'function renderSynastry(S) {');

// ② 删掉末尾的包装器块
const wrapRe = /\/\* ═+ 合盘渲染包装[\s\S]*?^\}\s*$/m;
if (wrapRe.test(s)) { s = s.replace(wrapRe, ''); console.log('② 已删除包装器'); }

// ③ 在 runForm 的填充处之后插入总览挂载
const OLD = 'out.replaceChildren(render(json.data, json));';
const NEW = `out.replaceChildren(render(json.data, json));
    maybeAddSynastrySummary(out, json.data);`;
if (s.includes(OLD)) {
  s = s.replace(OLD, NEW);
  console.log('③ 已在 replaceChildren 后插入 maybeAddSynastrySummary');
} else if (s.includes('maybeAddSynastrySummary(out, json.data)')) {
  console.log('③ 已存在挂载点');
} else {
  console.log('⚠️ 未找到 replaceChildren 行，跳过 ③');
}

// ④ 追加自足的挂载函数
if (!s.includes('function maybeAddSynastrySummary(')) {
  s += `

/* ══════════ 合盘总览挂载（自足；不依赖 render 的返回值约定） ══════════ */
function maybeAddSynastrySummary(host, data) {
  if (!host || !data || !data.summary) return;
  try {
    const sumBox = renderStructuralSummary(data.summary);
    if (sumBox) host.insertBefore(sumBox, host.firstChild);
    const expBox = renderExplain(data.explain);
    if (expBox) host.append(expBox);
  } catch (e) {
    // 总览失败不能影响主结果：只在控制台留痕
    console.warn('summary render failed:', e && e.message);
  }
}
`;
  console.log('④ 已追加 maybeAddSynastrySummary');
}

fs.writeFileSync('web/app.js', s, 'utf8');
console.log('完成');
