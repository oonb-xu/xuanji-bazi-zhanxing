// 把「对应关系补充块」接入服务端输出（/api/fusion 与 /api/synastry）
// 只作补充：独立字段 supplement，不改动任何主结论
import fs from 'node:fs';

let s = fs.readFileSync('server.mjs', 'utf8');
if (s.includes('correspondence-registry')) { console.log('已接入，跳过'); process.exit(0); }

// ① 加 import
s = s.replace(
  "import { apiRectify, apiContribute, contribStats, DECISIVE_EVENTS, qualityAssess } from './src/app/collect-endpoints.mjs';",
  "import { apiRectify, apiContribute, contribStats, DECISIVE_EVENTS, qualityAssess } from './src/app/collect-endpoints.mjs';\nimport { buildSupplement, registrySummary } from './src/cross/correspondence-registry.mjs';"
);

// ② fusion 输出里加 supplement（找 caveats 之前的返回）
const FUSION_ANCHOR = `  caveats: [`;
if (!s.includes(FUSION_ANCHOR)) { console.error('未找到 fusion 的 caveats 锚点'); process.exit(1); }

// 在 fusion 的 return 对象里、caveats 之前插入 supplement
s = s.replace(FUSION_ANCHOR, `  // ★ 对应关系补充块（置信度分级；低置信已被丢弃，不改动主结论）
  supplement: (() => {
    try { return buildSupplement(bazi, natal); } catch (e) { return { items: [], count: 0, display: '补充块不可用：' + e.message }; }
  })(),
  caveats: [`, 1);

fs.writeFileSync('server.mjs', s, 'utf8');
console.log('server.mjs：/api/fusion 已加 supplement');
console.log('（synastry 稍后按同样方式接入）');
