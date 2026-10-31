// 静态验证：前端语法 + 关键结构存在
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILES = ['fusion3d.js', 'gl-planets.js', 'dignity-panel.js', 'nav-guard.js', 'app.js', 'stage.js', 'timeline-ui.js', 'stars.js'];
let bad = 0;
for (const f of FILES) {
  try {
    execFileSync('node', ['--check', 'web/' + f], { stdio: 'pipe' });
    console.log('  ✅', f);
  } catch (e) {
    console.log('  ❌', f, String(e.stderr || e.message).split('\n')[0].slice(0, 80));
    bad++;
  }
}
console.log(bad ? `\n❌ ${bad} 个文件语法错误` : '\n✅ 8 个前端文件语法全通过');

const s = fs.readFileSync('web/fusion3d.js', 'utf8');
const CHECKS = [
  ['行星块防御式（单颗失败不影响整帧）', '__drawErr'],
  ['星群扇开算法', 'function spreadLongitudes'],
  ['扇开结果被使用', 'const DISP = spreadLongitudes'],
  ['真实位置刻度点', 'dinfo.trueLon'],
  ['命宫/身宫节点', 'DATA.aux'],
  ['WebGL 队列', 'glDrawQueue'],
  ['尊贵面板挂钩', '__renderDignity'],
  ['飞向行星', 'flyToPlanet'],
  ['相机注视点', 'cam.look'],
];
console.log('\n关键结构：');
let miss = 0;
for (const [label, key] of CHECKS) {
  const ok = s.includes(key);
  console.log(' ', ok ? '✅' : '❌', label);
  if (!ok) miss++;
}

// 检查 index.html 挂载
const h = fs.readFileSync('web/index.html', 'utf8');
console.log('\n页面挂载：');
for (const [label, key] of [
  ['融合盘容器', 'fusion-wheel-host'],
  ['尊贵面板容器', 'dignity-host'],
  ['全息脚本', '/dignity-panel.js'],
  ['WebGL 球体脚本', '/gl-planets.js'],
  ['导航护栏', '/nav-guard.js'],
  ['时序导航', 'data-go="timeline"'],
]) {
  const ok = h.includes(key);
  console.log(' ', ok ? '✅' : '❌', label);
  if (!ok) miss++;
}

const css = fs.readFileSync('web/style.css', 'utf8');
console.log('\n样式：');
for (const [label, key] of [['全息卡片', '.holo-card'], ['深空主题', 'DEEP SPACE THEME'], ['行星面板', '.planet-panel']]) {
  const ok = css.includes(key);
  console.log(' ', ok ? '✅' : '❌', label);
  if (!ok) miss++;
}

console.log(miss ? `\n总计 ${miss} 项缺失` : '\n✅ 全部结构齐备');
