import fs from 'node:fs';
const h = fs.readFileSync('web/index.html', 'utf8');

function formOf(id) {
  const i = h.indexOf('id="' + id + '"');
  const s = h.lastIndexOf('<form', i);
  const e = h.indexOf('</form>', i) + 7;
  return h.slice(s, e);
}

for (const id of ['f-fusion', 'f-synastry']) {
  const f = formOf(id);
  console.log('\n=== ' + id + ' （' + f.length + ' 字符）===');
  const labels = [...f.matchAll(/<label[^>]*>([\s\S]{0,90}?)<\/label>/g)].map((m) => m[1].replace(/\s+/g, ' ').trim().slice(0, 70));
  labels.forEach((l, i) => console.log('  L' + (i + 1) + ': ' + l));
  console.log('  classes:', [...new Set([...f.matchAll(/class="([^"]+)"/g)].map((m) => m[1]))].join(' | '));
  console.log('  fieldset:', (f.match(/<fieldset/g) || []).length, ' grid2:', (f.match(/class="grid2/g) || []).length);
  const submit = f.match(/<button[^>]*type="submit"[^>]*>([^<]*)</);
  console.log('  submit:', submit ? submit[1] : '(无)');
}
