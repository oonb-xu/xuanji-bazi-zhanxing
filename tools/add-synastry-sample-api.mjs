// 新增 /api/synastry-sample：接收「两人出生时间 + 事例」作为训练样本，追加写入 JSONL
import fs from 'node:fs';
const P = 'server.mjs';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-syn', t, 'utf8');

if (t.includes('apiSynastrySample')) { console.log('已存在，跳过'); process.exit(0); }

const FN = `
/** 【训练样本】合盘事例：两人的出生时间 + 具体发生过的事（吵架/复合/异地/生孩子…）
 *  只存匿名出生信息与事件，不存姓名/联系方式。追加写入 data/samples/synastry.jsonl */
function apiSynastrySample(body) {
  const person = (p, tag) => {
    if (!p || typeof p !== 'object') throw new Error(tag + ' 缺少出生信息');
    const at = String(p.at || '').trim();
    if (!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/.test(at)) throw new Error(tag + ' 出生时间格式应为 YYYY-MM-DDTHH:mm');
    const lng = Number(p.lng), lat = Number(p.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error(tag + ' 经纬度无效');
    return { at, gender: p.gender === '男' || p.gender === '女' ? p.gender : null, lng, lat };
  };

  const a = person(body.a, 'A');
  const b = person(body.b, 'B');

  const raw = Array.isArray(body.events) ? body.events : [];
  const events = raw
    .map((e) => ({
      type: String(e && e.type || '').trim().slice(0, 24),
      date: String(e && e.date || '').trim().slice(0, 7),   // YYYY-MM
      note: e && e.note ? String(e.note).trim().slice(0, 200) : null,
    }))
    .filter((e) => e.type);
  if (!events.length) throw new Error('至少填 1 条事例');

  const rec = {
    v: 1,
    savedAt: new Date().toISOString(),
    kind: 'synastry-event-sample',
    a, b,
    events,
    consent: body.consent === true,
    source: 'web:synastry',
  };

  fs.mkdirSync('data/samples', { recursive: true });
  fs.appendFileSync('data/samples/synastry.jsonl', JSON.stringify(rec) + '\\n', 'utf8');

  let total = 0;
  try { total = fs.readFileSync('data/samples/synastry.jsonl', 'utf8').split('\\n').filter(Boolean).length; } catch (e) {}

  return {
    ok: true,
    saved: true,
    events: events.length,
    total,
    note: '样本已保存。训练用的核心是「出生时间 + 事例」，事件越具体越有价值。',
  };
}

`;

const anchor = 'const ROUTES = {';
const ai = t.indexOf(anchor);
if (ai < 0) { console.error('❌ 找不到 ROUTES'); process.exit(1); }
t = t.slice(0, ai) + FN + t.slice(ai);

/* 注册路由 */
const routeAnchor = "'/api/contribute': (b) => apiContribute(b, DEPS),";
const ri = t.indexOf(routeAnchor);
if (ri < 0) { console.error('❌ 找不到 contribute 路由行'); process.exit(1); }
t = t.slice(0, ri + routeAnchor.length) + " '/api/synastry-sample': apiSynastrySample," + t.slice(ri + routeAnchor.length);

fs.writeFileSync(P, t, 'utf8');
console.log('✅ server.mjs 已加 /api/synastry-sample，共', t.length, '字节');
