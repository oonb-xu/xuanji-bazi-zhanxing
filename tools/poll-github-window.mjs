// 长轮询：等 github.com 网页端出现可用窗口（最多 ~4 分钟）
const T = 'https://github.com/oonb-xu/xuanji-minglironghe';
const timeout = Number(process.argv[2] || 240) * 1000;
const t0 = Date.now();
let n = 0, ok = 0;
while (Date.now() - t0 < timeout) {
  n++;
  try {
    const r = await fetch(T, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    ok++;
    console.log(`#${n} HTTP ${r.status}  ${Date.now() - t0}ms  ✅ 窗口来了`);
    process.exit(0);
  } catch { /* keep polling */ }
  await new Promise(r => setTimeout(r, 3500));
}
console.log(`轮询 ${n} 次（${(timeout / 1000).toFixed(0)}s）仍不通`);
process.exit(1);
