import fs from 'node:fs';
const t = fs.readFileSync('web/video-intro.html', 'utf8');

/* 切出全部 scene */
const parts = t.split(/<section class="scene[^"]*"[^>]*>/).slice(1);
const out = [];
parts.forEach((seg, i) => {
  const body = seg.split('</section>')[0];
  const dur = (body.match(/data-dur="(\d+)"/) || [])[1] || (t.split(/<section class="scene[^"]*"/)[i + 1] || '').match(/data-dur="(\d+)"/)?.[1];
  const eyebrow = (body.match(/<div class="eyebrow">([\s\S]*?)<\/div>/) || [])[1] || '';
  const h = (body.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/) || [])[1] || '';
  const clean = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  out.push({ n: i + 1, eyebrow: clean(eyebrow), title: clean(h) });
});

/* data-dur 按出现顺序对齐 */
const durs = [...t.matchAll(/data-dur="(\d+)"/g)].map(m => Number(m[1]));
out.forEach((o, i) => { o.dur = durs[i] || 7000; });

console.log('共 ' + out.length + ' 幕：');
for (const o of out) {
  console.log('  ' + String(o.n).padStart(2) + '. [' + (o.dur / 1000) + 's] ' + o.eyebrow + ' ｜ ' + o.title.slice(0, 46));
}
fs.writeFileSync('.tmp/scenes.json', JSON.stringify(out, null, 2), 'utf8');
