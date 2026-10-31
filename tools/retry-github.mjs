// GitHub 网页端点连试 6 次，看能否撞上可用连接
const TARGETS = ['https://github.com', 'https://github.com/new'];
for (let i = 1; i <= 6; i++) {
  for (const u of TARGETS) {
    const t0 = Date.now();
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' });
      console.log(`#${i} ${u.padEnd(24)} HTTP ${r.status}  ${Date.now() - t0}ms  ✅`);
    } catch (e) {
      console.log(`#${i} ${u.padEnd(24)} ✗ ${e.name}  ${Date.now() - t0}ms`);
    }
  }
  await new Promise(r => setTimeout(r, 3000));
}
