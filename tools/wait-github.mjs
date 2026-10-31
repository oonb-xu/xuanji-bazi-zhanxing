// 轮询 github.com 直到连上（最多 ~90s），连上就退出 0
const T = 'https://github.com/';
for (let i = 1; i <= 15; i++) {
  const t0 = Date.now();
  try {
    const r = await fetch(T, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`#${i} HTTP ${r.status} ${Date.now() - t0}ms ✅ 可以操作了`);
    process.exit(0);
  } catch (e) {
    console.log(`#${i} ${e.name} ${Date.now() - t0}ms`);
  }
  await new Promise(r => setTimeout(r, 4000));
}
console.log('90 秒内没连上');
process.exit(1);
