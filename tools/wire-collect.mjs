// 把 /api/rectify、/api/contribute、/api/contrib-stats 接到 server.mjs
import fs from 'node:fs';

const p = 'server.mjs';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('apiRectify')) { console.log('已接入，跳过'); process.exit(0); }

// ① import
s = s.replace(
  "import { baziClock } from './src/western/truesolar.mjs';",
  "import { baziClock } from './src/western/truesolar.mjs';\n" +
  "import { rectify } from './src/rectify/rectify.mjs';\n" +
  "import { apiRectify, apiContribute, contribStats, DECISIVE_EVENTS, qualityGate } from './src/app/collect-endpoints.mjs';"
);

// ② 依赖注入包装
s = s.replace(
  "const ROUTES = {",
  "const DEPS = { rectify, compileBazi, ROOT: __dirname };\n" +
  "const ROUTES = {"
);
s = s.replace(
  "'/api/timecheck': apiTimecheck };",
  "'/api/timecheck': apiTimecheck,\n" +
  "  '/api/rectify': (b) => apiRectify(b, DEPS),\n" +
  "  '/api/contribute': (b) => apiContribute(b, DEPS),\n" +
  "  '/api/contrib-stats': () => ({ ok: true, ...contribStats(DEPS), decisiveCategories: Object.keys(DECISIVE_EVENTS) }),\n" +
  "};"
);

// ③ contrib-stats 是 GET，但当前路由只收 POST —— 在 /api/health 之后加一个 GET 分支
s = s.replace(
  "if (p === '/api/health')",
  "if (p === '/api/contrib-stats' && req.method === 'GET') {\n" +
  "    return send(res, 200, { ok: true, ...contribStats(DEPS), decisiveCategories: Object.keys(DECISIVE_EVENTS) });\n" +
  "  }\n" +
  "  if (p === '/api/health')"
);

fs.writeFileSync(p, s, 'utf8');
console.log('server.mjs 已接入 rectify / contribute / contrib-stats');
