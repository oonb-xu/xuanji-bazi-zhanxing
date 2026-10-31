// 补「时序」导航按钮（锚点用实际存在的 <button data-go="rectify">）
import fs from 'node:fs';

let h = fs.readFileSync('web/index.html', 'utf8');
if (h.includes('data-go="timeline"')) { console.log('已在，跳过'); process.exit(0); }

const ANCHOR = '<button data-go="rectify">';
if (!h.includes(ANCHOR)) { console.error('❌ 锚点未找到'); process.exit(1); }

const BTN = '<button data-go="timeline"><span>⏱</span>时序</button>\n    ';
h = h.replace(ANCHOR, BTN + ANCHOR);
fs.writeFileSync('web/index.html', h, 'utf8');
console.log('✅ 时序按钮已插入');

// 校验
const after = fs.readFileSync('web/index.html', 'utf8');
const goes = [...after.matchAll(/data-go="([^"]+)"/g)].map((m) => m[1]);
const pages = [...after.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]);
console.log('导航:', goes.join(' / '));
console.log('页面:', pages.join(' / '));
const orphan = goes.filter((g) => g !== 'stage' && !pages.includes(g));
console.log(orphan.length ? '⚠️ 无对应页面的导航: ' + orphan.join(',') : '✅ 每个导航都有对应页面');
