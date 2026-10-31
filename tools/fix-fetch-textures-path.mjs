// 把 fetch-textures.mjs 里写死的本机 Python 路径改为可配置（避免泄漏用户名）
import fs from 'node:fs';
const P = 'tools/fetch-textures.mjs';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-privacy', t, 'utf8');

const OLD = "const PY = 'C:\\\\Users\\\\yk610\\\\.dsh\\\\dsh-runtimes\\\\dsh-primary-runtime\\\\dependencies\\\\python\\\\python.exe';";
if (!t.includes(OLD)) {
  console.error('❌ 未匹配 PY 常量');
  process.exit(1);
}
const NEW = "const PY = process.env.XUANJI_PYTHON || 'python';   // 可用环境变量 XUANJI_PYTHON 指定解释器（不写死本机路径）";
t = t.replace(OLD, NEW);
fs.writeFileSync(P, t, 'utf8');
console.log('✅ fetch-textures.mjs：本机 Python 绝对路径 → 环境变量/可执行名');
