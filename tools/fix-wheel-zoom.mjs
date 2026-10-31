// 修：三处 canvas wheel 处理器无条件 preventDefault，把浏览器 Ctrl+滚轮 缩放也拦掉了
// 修法：Ctrl 按下时直接返回，交还给浏览器缩放
import fs from 'node:fs';
const targets = ['stage.js', 'fusion-wheel.js', 'fusion3d.js'];
let done = 0;

for (const f of targets) {
  const p = 'web/' + f;
  if (!fs.existsSync(p)) { console.log('跳过（不存在）', f); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const before = s;

  // 匹配两种写法：addEventListener('wheel', (e) => { e.preventDefault();  与  function (e) { e.preventDefault();
  s = s.replace(
    /(addEventListener\(\s*['"]wheel['"]\s*,\s*(?:\(e\)|function\s*\(e\))\s*=>?\s*\{\s*)e\.preventDefault\(\)/g,
    '$1if (e.ctrlKey || e.metaKey) return; e.preventDefault()'
  );

  if (s !== before) { fs.writeFileSync(p, s, 'utf8'); done++; console.log('✅ 已修', f); }
  else {
    // 退路：按行找 wheel 与 preventDefault 同段
    const lines = s.split('\n');
    let hit = false;
    for (let i = 0; i < lines.length; i++) {
      if (/addEventListener\(\s*['"]wheel['"]/.test(lines[i]) && /preventDefault/.test(lines[i]) && !/ctrlKey/.test(lines[i])) {
        lines[i] = lines[i].replace(/e\.preventDefault\(\)/, "if (e.ctrlKey || e.metaKey) return; e.preventDefault()");
        hit = true;
      }
    }
    if (hit) { fs.writeFileSync(p, lines.join('\n'), 'utf8'); done++; console.log('✅ 已修（退路）', f); }
    else console.log('—  未匹配', f);
  }
}

/* 校验 */
console.log('\n=== 校验 ===');
for (const f of targets) {
  const p = 'web/' + f;
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, 'utf8');
  const hasWheel = /addEventListener\(\s*['"]wheel['"]/.test(s);
  const hasGuard = s.includes('e.ctrlKey || e.metaKey');
  console.log(`  ${f.padEnd(16)} wheel监听=${hasWheel ? 'Y' : 'N'}  Ctrl放行=${hasGuard ? '✅' : '❌'}`);
}
console.log('\n共修', done, '个文件');
