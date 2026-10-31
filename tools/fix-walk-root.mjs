import fs from 'node:fs';
const P = 'tools/privacy-audit.mjs';
let t = fs.readFileSync(P, 'utf8');
const A = "  walk2('');";
const B = '  walk2(ROOT);';
if (t.includes(A)) {
  t = t.replace(A, B);
  fs.writeFileSync(P, t, 'utf8');
  console.log('✅ walk 起点已修为 ROOT');
} else {
  console.log('未匹配。当前含 walk2 的行：');
  t.split('\n').forEach((l, i) => { if (l.includes('walk2(')) console.log('  ' + (i + 1) + ': ' + l.trim()); });
}
