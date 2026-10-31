// 把 stage 与 app 连接起来：
//   1) 页面加载时 mountStage（圆盘立即可转）
//   2) 每次排盘出结果后，把行星黄经注入圆盘（圆盘就显示这一张盘的真实施星）
//   3) 点「圆盘」按钮回到舞台
import fs from 'node:fs';

let js = fs.readFileSync('web/app.js', 'utf8');

/* ① 顶部加 import */
if (!js.includes("from '/stage.js'")) {
  js = js.replace(
    /^(\/\/[^\n]*\n)*/,
    (m) => m + "import { mountStage, setPlanets } from '/stage.js';\n"
  );
  console.log('① import 已加');
}

/* ② 挂载 + 行星注入 */
if (!js.includes('stageMounted')) {
  const BLOCK = `
/* ══════════ 中西合璧圆盘：挂载 + 行星注入 ══════════ */
let stageMounted = false;
function initStage() {
  const el = document.querySelector('#stage-hero');
  if (!el || stageMounted) return;
  mountStage(el);
  stageMounted = true;
}
function feedStage(natalData) {
  // natalData: apiNatal 的 planets（数组，含 name/lon）或 computeNatal 的对象
  if (!natalData) return;
  const list = Array.isArray(natalData)
    ? natalData
    : Object.entries(natalData).map(([name, v]) => ({ name, ...v }));
  try { setPlanets(list); } catch (e) { console.warn('stage feed failed', e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStage);
else initStage();
`;
  js += BLOCK;
  console.log('② 挂载与注入函数已加');
}

/* ③ 在 runForm 拿到结果后注入 */
const OLD = 'maybeAddSynastrySummary(out, json.data);';
if (js.includes(OLD) && !js.includes('feedStage(json.data)')) {
  js = js.replace(OLD, OLD + '\n    feedStage(json.data?.planets ?? json.data?.natal?.planets ?? json.data);');
  console.log('③ 结果回填圆盘已接入');
} else if (!js.includes(OLD)) {
  // 回退：在 replaceChildren(render(...)) 后注入
  if (js.includes('out.replaceChildren(render(json.data, json));')) {
    js = js.replace('out.replaceChildren(render(json.data, json));',
      'out.replaceChildren(render(json.data, json));\n    feedStage(json.data?.planets ?? json.data?.natal?.planets ?? json.data);');
    console.log('③ 已按回退路径接入');
  } else console.log('③ ⚠️ 未找到注入点');
}

/* ④ 「圆盘」按钮：回到舞台 */
if (!js.includes("data-go=\"stage\"")) {
  js += `
/* ══════════ 导航：圆盘 / 页面 ══════════ */
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-go]');
  if (!b) return;
  const go = b.dataset.go;
  if (go === 'stage') {
    const hero = document.querySelector('#stage-hero');
    if (hero) { hero.scrollIntoView({ behavior: 'smooth' }); }
  }
});
`;
  console.log('④ 圆盘导航已加');
}

fs.writeFileSync('web/app.js', js, 'utf8');
console.log('完成');
