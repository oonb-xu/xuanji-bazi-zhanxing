// 用 Edge headless 逐幕渲染 1920x1080 PNG
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.cwd();
const OUT = path.join(ROOT, '.tmp', 'frames');
fs.mkdirSync(OUT, { recursive: true });

const scenes = JSON.parse(fs.readFileSync('.tmp/scenes.json', 'utf8'));
const fileUrl = 'file:///' + path.join(ROOT, 'web', 'video-intro.html').replace(/\\/g, '/');

let ok = 0;
for (let i = 0; i < scenes.length; i++) {
  const out = path.join(OUT, `s${String(i + 1).padStart(2, '0')}.png`);
  const url = `${fileUrl}?scene=${i}&rec=1`;
  const r = spawnSync(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1920,1080', '--virtual-time-budget=3000',
    `--screenshot=${out}`, url,
  ], { encoding: 'utf8', timeout: 60000 });

  if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
    ok++;
    console.log(`  ✓ s${String(i + 1).padStart(2, '0')}.png  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  ${scenes[i].eyebrow.slice(0, 18)}`);
  } else {
    console.log(`  ✗ 第 ${i + 1} 幕失败：${(r.stderr || '').split('\n').slice(-2).join(' ').slice(0, 120)}`);
  }
}
console.log(`\n渲染完成 ${ok}/${scenes.length}`);
process.exit(ok === scenes.length ? 0 : 1);
