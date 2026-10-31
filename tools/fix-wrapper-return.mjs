// 正确修法：render 必须**返回节点**（调用方是 out.replaceChildren(render(...))）
// 之前包装器丢弃了 core 的返回值，导致内容丢失/总览不显示
import fs from 'node:fs';

let s = fs.readFileSync('web/app.js', 'utf8');

const OLD_WRAP = /\/\* ══════════ 合盘渲染包装[\s\S]*?^\}\s*$/m;
const NEW_WRAP = `/* ══════════ 合盘渲染包装：core 返回节点，我们在其前面插入总览 ══════════ */
function renderSynastry(S) {
  const core = renderSynastryCore(S);           // 可能是 element / fragment / 数组
  const box = document.createElement('div');
  const sumBox = renderStructuralSummary(S && S.summary);
  if (sumBox) box.append(sumBox);
  if (Array.isArray(core)) box.append(...core.filter(Boolean));
  else if (core) box.append(core);
  const expBox = renderExplain(S && S.explain);
  if (expBox) box.append(expBox);
  return box;
}`;

if (OLD_WRAP.test(s)) {
  s = s.replace(OLD_WRAP, NEW_WRAP);
  console.log('已替换包装器为「返回节点」版');
} else {
  console.error('未找到旧包装器');
  process.exit(1);
}

fs.writeFileSync('web/app.js', s, 'utf8');
