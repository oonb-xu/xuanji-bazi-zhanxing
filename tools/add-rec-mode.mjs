// 给 video-intro.html 加「逐幕定格模式」：?scene=N&rec=1 → 只显示第 N 幕、隐藏控件
import fs from 'node:fs';
const P = 'web/video-intro.html';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-rec', t, 'utf8');

if (t.includes('__REC_MODE__')) { console.log('— 已支持定格模式'); process.exit(0); }

/* 在 </script> 前（即现有 IIFE 之后）追加定格逻辑 */
const anchor = '  show(0); tick();\n})();';
if (!t.includes(anchor)) {
  console.error('❌ 找不到 IIFE 结尾锚点');
  process.exit(1);
}

const PATCH = `  show(0); tick();

  /* ══ __REC_MODE__ 逐幕定格（供离线渲染视频用）══
     用法：video-intro.html?scene=3&rec=1  → 只显示第 4 幕，隐藏进度条与控件
     不带参数时行为完全不变。 */
  (function recMode(){
    var q = new URLSearchParams(location.search);
    if (q.get('rec') !== '1') return;
    var n = parseInt(q.get('scene') || '0', 10);
    paused = true;
    clearTimeout(t);
    var b = document.getElementById('bar');
    if (b) b.style.display = 'none';
    var c = document.getElementById('ctrl');
    if (c) c.style.display = 'none';
    var ix = document.getElementById('idx');
    if (ix) ix.style.display = 'none';
    show(n);
    /* 定格模式下不让自动前进 */
    paused = true;
    var _next = next;
    next = function(){};
  })();
})();`;

t = t.replace(anchor, PATCH);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ video-intro.html 已支持 ?scene=N&rec=1 定格模式');

/* 校验 */
const n = (t.match(/class="scene/g) || []).length;
console.log('   分幕数: ' + n);
const durs = [...t.matchAll(/data-dur="(\d+)"/g)].map(m => Number(m[1]));
console.log('   总时长: ' + (durs.reduce((a, b) => a + b, 0) / 1000) + ' 秒');
fs.writeFileSync('.tmp/durs.json', JSON.stringify(durs), 'utf8');
console.log('   逐幕时长已写入 .tmp/durs.json');
