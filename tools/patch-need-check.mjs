import fs from 'node:fs';
const P = 'tools/restore-about-order2.mjs';
let s = fs.readFileSync(P, 'utf8');
const OLD = "const NEED = ['这是什么', '想要精确度'";
const NEW = "const NEED = ['id=\"sec-what-is-this\"', '想要精确度'";
if (s.includes(NEW)) { console.log('已改过'); }
else if (s.includes(OLD)) { s = s.replace(OLD, NEW); fs.writeFileSync(P, s, 'utf8'); console.log('✅ 已改为 id 判定'); }
else { console.error('❌ 未匹配'); process.exit(1); }
