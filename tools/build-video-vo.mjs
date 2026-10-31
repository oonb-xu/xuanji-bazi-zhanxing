// 按旁白时长卡点合片：PNG 序列 + 逐幕 WAV → 1920x1080 H.264 MP4
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BIN = JSON.parse(fs.readFileSync('.tmp/ffmpeg-path.json', 'utf8'));
const FF = BIN.ffmpeg, FP = BIN.ffprobe;
const FRAMES = path.join(ROOT, '.tmp', 'frames');
const VO = path.join(ROOT, '.tmp', 'vo');
const WORK = path.join(ROOT, '.tmp', 'build');
fs.mkdirSync(WORK, { recursive: true });

const scenes = JSON.parse(fs.readFileSync('.tmp/scenes.json', 'utf8'));

/* ── 1. 量旁白时长 ── */
function dur(file) {
  const r = spawnSync(FP, ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
  return parseFloat((r.stdout || '0').trim()) || 0;
}

console.log('① 旁白时长');
const rows = [];
for (const s of scenes) {
  const vo = path.join(VO, `vo-${String(s.n).padStart(2, '0')}.wav`);
  const vd = dur(vo);
  if (!fs.existsSync(vo) || vd <= 0) { console.error('  ✗ 缺旁白 ' + vo); process.exit(1); }
  /* 卡点：整幕 = 旁白 + 1.0s 呼吸；不短于 4.5s */
  const seg = Math.max(vd + 1.0, 4.5);
  rows.push({ ...s, vo, voDur: vd, segDur: seg });
  console.log(`  ${String(s.n).padStart(2)}  旁白 ${vd.toFixed(2)}s → 整幕 ${seg.toFixed(2)}s   ${s.eyebrow.slice(0, 16)}`);
}
const total = rows.reduce((a, r) => a + r.segDur, 0);
console.log(`  合计 ${total.toFixed(2)}s（原设计 ${(scenes.reduce((a, s) => a + s.dur, 0) / 1000).toFixed(0)}s）\n`);

/* ── 2. 视频：图片序列 ── */
console.log('② 渲染画面');
const vlist = path.join(WORK, 'video-list.txt');
let vt = '';
for (const r of rows) vt += `file '${path.join(FRAMES, 's' + String(r.n).padStart(2, '0') + '.png').replace(/\\/g, '/')}'\nduration ${r.segDur.toFixed(3)}\n`;
/* concat 要求最后一张重复一次 */
vt += `file '${path.join(FRAMES, 's17.png').replace(/\\/g, '/')}'\n`;
fs.writeFileSync(vlist, vt, 'utf8');

const vRaw = path.join(WORK, 'video-raw.mp4');
const fadeOut = Math.max(0, total - 1.2).toFixed(2);
let r = spawnSync(FF, ['-y', '-f', 'concat', '-safe', '0', '-i', vlist,
  '-vf', `fps=30,format=yuv420p,fade=t=in:st=0:d=0.8,fade=t=out:st=${fadeOut}:d=1.2`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', vRaw,
], { encoding: 'utf8', timeout: 900000 });
if (!fs.existsSync(vRaw) || fs.statSync(vRaw).size < 100000) {
  console.error('  ✗ 画面渲染失败\n' + (r.stderr || '').split('\n').slice(-6).join('\n'));
  process.exit(1);
}
console.log(`  ✓ video-raw.mp4  ${(fs.statSync(vRaw).size / 1048576).toFixed(1)} MB\n`);

/* ── 3. 音频：逐幕补静音后拼接 ── */
console.log('③ 拼接旁白');
const alist = path.join(WORK, 'audio-list.txt');
let at = '';
for (const rr of rows) {
  const seg = path.join(WORK, `a${String(rr.n).padStart(2, '0')}.wav`);
  const sr = spawnSync(FF, ['-y', '-i', rr.vo,
    '-af', `apad,atrim=0:${rr.segDur.toFixed(3)},aresample=44100`,
    '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', seg,
  ], { encoding: 'utf8', timeout: 60000 });
  if (!fs.existsSync(seg)) { console.error('  ✗ 音频段失败 ' + rr.n + '\n' + (sr.stderr || '').slice(-300)); process.exit(1); }
  at += `file '${seg.replace(/\\/g, '/')}'\n`;
}
fs.writeFileSync(alist, at, 'utf8');

const aRaw = path.join(WORK, 'audio.wav');
r = spawnSync(FF, ['-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', aRaw], { encoding: 'utf8', timeout: 120000 });
if (!fs.existsSync(aRaw)) { console.error('  ✗ 音频拼接失败\n' + (r.stderr || '').slice(-400)); process.exit(1); }
console.log(`  ✓ audio.wav  ${dur(aRaw).toFixed(2)}s  ${(fs.statSync(aRaw).size / 1048576).toFixed(1)} MB\n`);

/* ── 4. 合成 ── */
console.log('④ 合成 MP4');
const OUT = path.join(ROOT, '玄机·宣传片-配音版.mp4');
r = spawnSync(FF, ['-y', '-i', vRaw, '-i', aRaw,
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT,
], { encoding: 'utf8', timeout: 300000 });
if (!fs.existsSync(OUT)) { console.error('  ✗ 合成失败\n' + (r.stderr || '').slice(-400)); process.exit(1); }

const size = fs.statSync(OUT).size;
console.log('\n✅ 完成：' + OUT);
console.log('   时长 ' + dur(OUT).toFixed(2) + 's · 大小 ' + (size / 1048576).toFixed(1) + ' MB');
fs.writeFileSync('.tmp/video-result.json', JSON.stringify({ out: OUT, dur: dur(OUT), size, rows: rows.map(x => ({ n: x.n, voDur: +x.voDur.toFixed(2), segDur: +x.segDur.toFixed(2) })) }, null, 2), 'utf8');
