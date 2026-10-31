// 纹理文件改 ASCII 名（避免 URL 编码问题），同步更新引用
import fs from 'node:fs';
import path from 'node:path';

const RENAME = {
  '太阳.jpg': 'sun.jpg', '月亮.jpg': 'moon.jpg', '水星.jpg': 'mercury.jpg',
  '金星.jpg': 'venus.jpg', '火星.jpg': 'mars.jpg', '木星.jpg': 'jupiter.jpg',
  '土星.jpg': 'saturn.jpg', '土星环.png': 'saturn-ring.png',
  '天王星.jpg': 'uranus.jpg', '海王星.jpg': 'neptune.jpg',
};

const dir = 'web/textures';
let n = 0;
for (const [from, to] of Object.entries(RENAME)) {
  const a = path.join(dir, from), b = path.join(dir, to);
  if (fs.existsSync(a)) { fs.renameSync(a, b); n++; }
}
console.log('① 重命名', n, '个纹理文件');
console.log('   现有:', fs.readdirSync(dir).join(' '));

// ② 更新 fusion3d.js 里的引用
let s = fs.readFileSync('web/fusion3d.js', 'utf8');
for (const [from, to] of Object.entries(RENAME)) {
  s = s.split('/textures/' + from).join('/textures/' + to);
}
fs.writeFileSync('web/fusion3d.js', s, 'utf8');
console.log('② fusion3d.js 引用已更新');

// ③ 展示新的映射
const m = s.match(/const PLANET_TEX = \{[\s\S]*?\};/);
if (m) console.log('③ 当前映射:\n' + m[0].split('\n').slice(0, 6).join('\n'));
