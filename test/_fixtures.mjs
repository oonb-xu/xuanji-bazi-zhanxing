// 测试基准盘的出生时间已从公开仓库移除，改为本地私有文件。
// 若 test/fixtures.local.json 不存在，本套测试直接跳过（exit 0）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(here, 'fixtures.local.json');

if (!fs.existsSync(p)) {
  console.log('⚠ 缺少 test/fixtures.local.json（真实出生时间已移出公开仓库），跳过本套测试');
  process.exit(0);
}

export const F = JSON.parse(fs.readFileSync(p, 'utf8'));
