import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const probe = async () => {
  try {
    const r = await fetch('http://127.0.0.1:8788/api/health', { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
};

if (await probe()) { console.log('服务已在线'); process.exit(0); }

const child = spawn(process.execPath, ['server.mjs', '8788'], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'ignore',
});
child.unref();
console.log('已启动 server.mjs 8788，PID = ' + child.pid);

for (let i = 0; i < 12; i++) {
  await sleep(700);
  if (await probe()) { console.log('✅ 健康检查通过'); process.exit(0); }
}
console.log('⚠️ 12 秒内健康检查未通过');
process.exit(1);
