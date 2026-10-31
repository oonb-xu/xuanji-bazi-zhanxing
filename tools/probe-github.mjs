// 探测 GitHub 各端点的连通性（浏览器超时时用）
const URLS = [
  'https://github.com',
  'https://api.github.com',
  'https://raw.githubusercontent.com',
  'https://codeload.github.com',
];
for (const u of URLS) {
  const t0 = Date.now();
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'probe' } });
    console.log(`${u.padEnd(40)} HTTP ${r.status}  ${Date.now() - t0}ms`);
  } catch (e) {
    console.log(`${u.padEnd(40)} ✗ ${(e.name || 'ERR')}  ${Date.now() - t0}ms`);
  }
}
