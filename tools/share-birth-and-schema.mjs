// ④ 排盘 / 生时矫正 / 合盘 共享出生数据（填一次，三处通用）
// ⑤ 云端样本格式：时间 + 事件
import fs from 'node:fs';

/* ══════════ ④ 共享出生数据 ══════════ */
fs.writeFileSync('web/share-birth.js', `// 让 排盘 / 生时矫正 / 合盘 共享同一份出生数据：填一次，三处通用
// 存在 localStorage（仅本机），键名 xuanji:birth
(function () {
  var KEY = 'xuanji:birth';
  var FIELDS = ['at', 'gender', 'lng', 'lat', 'city'];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }
  function forms() {
    return Array.prototype.slice.call(document.querySelectorAll('#f-fusion, #f-synastry, #f-rectify, #f-bazi'));
  }
  /** 把已保存的值填进所有空字段 */
  function hydrate() {
    var d = read();
    forms().forEach(function (f) {
      FIELDS.forEach(function (n) {
        var el = f.querySelector('[name="' + n + '"]');
        if (el && !el.value && d[n] != null) el.value = d[n];
      });
    });
  }
  /** 任一表单改动 ⇒ 写入共享存储并同步到其它表单的同名字段 */
  function attach() {
    forms().forEach(function (f) {
      if (f.__shared) return;
      f.__shared = true;
      f.addEventListener('input', function (e) {
        var n = e.target && e.target.name;
        if (!n || FIELDS.indexOf(n) < 0) return;
        var d = read();
        d[n] = e.target.value;
        write(d);
        // 同步到其它表单
        forms().forEach(function (g) {
          if (g === f) return;
          var el = g.querySelector('[name="' + n + '"]');
          if (el && el.value !== e.target.value) el.value = e.target.value;
        });
      });
    });
  }
  function boot() { hydrate(); attach(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);
  // 切页后再补一次（表单可能是动态渲染）
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-go]');
    if (t) setTimeout(boot, 350);
  }, true);

  window.__birthShared = { read: read, write: write, hydrate: hydrate };
})();
`, 'utf8');
console.log('④ web/share-birth.js 已写入');

let html = fs.readFileSync('web/index.html', 'utf8');
if (!html.includes('/share-birth.js')) {
  html = html.replace('<script src="/report.js"></script>', '<script src="/report.js"></script>\n  <script src="/share-birth.js"></script>');
  fs.writeFileSync('web/index.html', html, 'utf8');
  console.log('   已引入');
}

/* ══════════ ⑤ 云端样本格式：时间 + 事件 ══════════ */
const SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'xuanji-sample',
  title: '玄机 · 云端样本（时间 + 事件）',
  description:
    '本项目所有云端样本统一为「时间 + 事件」两段式：出生时间给出盘，事件给出可检验的锚点。' +
    '不含姓名、联系方式、IP 等任何可识别个人的信息。',
  type: 'object',
  required: ['id', 'birth', 'events', 'consent'],
  properties: {
    id: { type: 'string', description: '匿名样本 ID（随机生成，不含任何个人信息）' },
    birth: {
      type: 'object',
      required: ['at', 'lng', 'lat'],
      properties: {
        at: { type: 'string', description: '出生时刻 YYYY-MM-DD HH:mm（本地民用时）' },
        tz: { type: 'number', description: '时区偏移（小时），缺省 8' },
        lng: { type: 'number' }, lat: { type: 'number' },
        gender: { type: 'string', enum: ['男', '女', '未填'] },
        // 时间精度直接决定可用范围
        timePrecision: {
          type: 'string',
          enum: ['exact', 'hour', 'period', 'day-only', 'unknown'],
          description: 'exact=精确到分｜hour=只到时辰｜period=只知道上/下午｜day-only=只知道日期｜unknown=不知',
        },
        rectified: { type: 'boolean', description: '是否经过生时矫正' },
        rectifiedWindow: {
          type: 'object',
          properties: { from: { type: 'string' }, to: { type: 'string' } },
          description: '矫正后的时间窗口（含端点）',
        },
      },
    },
    events: {
      type: 'array',
      description: '生平事件 —— 这是样本最有价值的部分：它给出可检验的锚点',
      items: {
        type: 'object',
        required: ['year', 'kind'],
        properties: {
          year: { type: 'number', description: '年份（必须）；精度到年即可' },
          month: { type: 'number', minimum: 1, maximum: 12 },
          day: { type: 'number', minimum: 1, maximum: 31 },
          kind: {
            type: 'string',
            enum: ['求学', '就业', '升迁', '创业', '婚姻', '生育', '离婚', '疾病', '亲丧',
              '迁移', '破财', '得财', '官非', '意外', '修行', '其他'],
          },
          note: { type: 'string', description: '一句话描述（可选，勿写可识别信息）' },
          certainty: { type: 'string', enum: ['确定', '大致', '存疑'] },
        },
      },
    },
    consent: {
      type: 'object',
      required: ['contribute', 'ts'],
      properties: {
        contribute: { type: 'boolean', description: '必须显式为 true 才允许云端留存' },
        ts: { type: 'string', description: '同意时间（ISO8601）' },
        scope: { type: 'string', description: '同意范围，如 "仅用于模型校准"' },
      },
    },
    meta: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['自行填写', '生时矫正流程', '合盘流程', '其他'] },
        version: { type: 'string' },
      },
    },
  },
};

fs.mkdirSync('data/schema', { recursive: true });
fs.writeFileSync('data/schema/cloud-sample.schema.json', JSON.stringify(SCHEMA, null, 2), 'utf8');
console.log('⑤ data/schema/cloud-sample.schema.json 已写入');

/* 示例 */
const EXAMPLE = {
  id: 'smp-2026-0001',
  birth: {
    at: '1990-03-15 12:00', tz: 8, lng: 116.407, lat: 39.904,
    gender: '男', timePrecision: 'exact', rectified: false,
  },
  events: [
    { year: 2008, kind: '求学', note: '离家入学', certainty: '确定' },
    { year: 2014, month: 7, kind: '就业', certainty: '确定' },
    { year: 2017, month: 5, kind: '婚姻', certainty: '确定' },
    { year: 2019, month: 11, kind: '迁移', note: '跨城', certainty: '大致' },
    { year: 2022, kind: '升迁', certainty: '存疑' },
  ],
  consent: { contribute: true, ts: '2026-10-29T10:00:00+08:00', scope: '仅用于模型校准' },
  meta: { source: '自行填写', version: '1.0' },
};
fs.writeFileSync('data/schema/cloud-sample.example.json', JSON.stringify(EXAMPLE, null, 2), 'utf8');
console.log('   示例已写入');

/* 校验 */
console.log('\n校验：');
let bad = 0;
for (const [k, v] of [
  ['share-birth.js 存在', fs.existsSync('web/share-birth.js')],
  ['已引入 share-birth', fs.readFileSync('web/index.html', 'utf8').includes('/share-birth.js')],
  ['样本 schema 存在', fs.existsSync('data/schema/cloud-sample.schema.json')],
  ['schema 含 birth+events', JSON.stringify(SCHEMA).includes('"events"') && JSON.stringify(SCHEMA).includes('"birth"')],
  ['示例含 consent', JSON.stringify(EXAMPLE).includes('contribute')],
]) { console.log(' ', v ? '✅' : '❌', k); if (!v) bad++; }
process.exit(bad ? 1 : 0);
