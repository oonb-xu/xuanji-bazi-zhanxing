// 系统隔离机检（决策三 · 安全底线）
//   断言：**确定性计算核心**（大六壬/八字/西占星盘）**绝不 import 跨系统实验模块**（src/cross/**、cli-*.mjs）
//   若此测试失败 ⇒ 跨系统实验已污染核心，必须立刻断开（用户 Level 0 要求）
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  x ' + m); } return c; };

/** 核心（确定性计算层）：绝不允许依赖跨系统实验 */
const CORE = [
  'src/daliuren.mjs', 'src/constants.mjs', 'src/render.mjs',
  'src/bazi/engine.mjs', 'src/bazi/relations.mjs', 'src/bazi/wuxing.mjs', 'src/bazi/render.mjs',
  'src/bazi/five-pillar.mjs', 'src/bazi/interpretive.mjs', 'src/bazi/qa.mjs',
  'src/western/natal.mjs', 'src/western/zodiac.mjs', 'src/western/truesolar.mjs',
  'src/western/timing-charts.mjs', 'src/western/backends.mjs',
];
/** 允许被核心引用的"共享底层"（无语义耦合的工具/常量） */
const ALLOW = new Set(['src/constants.mjs', 'src/western/zodiac.mjs', 'src/bazi/wuxing.mjs']);
/** 禁止出现在核心依赖里的模式 */
const FORBIDDEN = [/^\.\.\/cross\//, /^\.\/cross\//, /cross\//, /cli-/, /^\.\.\/vedastro\//, /^\.\/vedastro\//];

/** 抽取一个文件里的全部 import 说明符 */
export function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+(?:[\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);          // 动态 import
  for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);          // createRequire 形态
  return out;
}

console.log('[A] 核心模块不得依赖跨系统实验层');
{
  const missing = CORE.filter((f) => !existsSync(join(ROOT, f)));
  ok(missing.length === 0, `核心文件缺失：${missing.join(', ')}`);
  const bad = [];
  for (const f of CORE) {
    if (!existsSync(join(ROOT, f))) continue;
    for (const spec of importsOf(join(ROOT, f))) {
      if (FORBIDDEN.some((re) => re.test(spec))) bad.push(`${f} → ${spec}`);
    }
  }
  ok(bad.length === 0, `核心被跨系统模块污染：\n      ${bad.join('\n      ')}`);
  console.log(`  检查 ${CORE.length} 个核心文件，禁止模式 ${FORBIDDEN.length} 类 → 违规 ${bad.length} ✓`);
}

console.log('[B] 核心不得直接 import 实验用 CLI（cli-*.mjs）');
{
  const clis = readdirSync(ROOT).filter((f) => /^cli-.*\.mjs$/.test(f));
  ok(clis.length >= 4, `应存在多个 CLI（实得 ${clis.length}）`);
  // ★ 反例钉：`cli-resonance.mjs` 被 `src/cross/paired.mjs` 引用是**允许的**（都在实验层），
  //   但**核心**引用它则违规 —— 由 [A] 覆盖。这里额外确认 CLI 未被 src/ 下的核心引用。
  const srcDirs = ['src/bazi', 'src/western'];
  const bad = [];
  for (const d of srcDirs) {
    const dir = join(ROOT, d);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
      for (const spec of importsOf(join(dir, f))) {
        if (/cli-/.test(spec)) bad.push(`${d}/${f} → ${spec}`);
      }
    }
  }
  ok(bad.length === 0, `核心目录引用了 CLI：${bad.join('; ')}`);
  console.log(`  ${clis.length} 个 CLI 均未被 src/bazi、src/western 引用 ✓`);
}

console.log('[C] 强制标签与置信度上限（决策三）');
{
  const { STATUS, CONFIDENCE_CAP, validatePaired } = await import('../src/cross/paired.mjs');
  ok(STATUS === 'hypothesis_under_validation', `status 常量须为 hypothesis_under_validation，实得 ${STATUS}`);
  ok(CONFIDENCE_CAP === 0.6, `置信度上限须为 0.6，实得 ${CONFIDENCE_CAP}`);
  // 缺标签/上限的样本必须被拒
  const base = { sampleId: 'PAIR-9999', collector: 'self', collectedAt: '2026-10-08',
    birth: { date: '2000-01-01', time: '12:00', timePrecision: 'minute', place: 'A', lon: 100, lat: 30, tzOffsetHours: 8 },
    divination: { date: '2026-01-01', time: '10:00', tzOffsetHours: 8, place: 'A', lon: 100, lat: 30, category: '事业功名', question: '测试' },
    feedback: { outcome: '尚未发生', outcomeDate: null, reliability: 'medium' } };
  const e1 = validatePaired(base);
  ok(e1.some((x) => x.includes('status')), '缺 status 必须报错');
  ok(e1.some((x) => x.includes('confidenceCap')), '缺 confidenceCap 必须报错');
  const e2 = validatePaired({ ...base, status: STATUS, confidenceCap: CONFIDENCE_CAP });
  ok(e2.length === 0, `完整样本应通过，实得错误：${e2.join('；')}`);
  // 应验必须有应期
  const e3 = validatePaired({ ...base, status: STATUS, confidenceCap: CONFIDENCE_CAP, feedback: { outcome: '应验', outcomeDate: null, reliability: 'high' } });
  ok(e3.some((x) => x.includes('outcomeDate')), 'outcome=应验 缺应期必须报错');
  // 尚未发生不得有应期
  const e4 = validatePaired({ ...base, status: STATUS, confidenceCap: CONFIDENCE_CAP, feedback: { outcome: '尚未发生', outcomeDate: '2026-05', reliability: 'medium' } });
  ok(e4.some((x) => x.includes('尚未发生')), 'outcome=尚未发生 带应期必须报错');
  // 类别白名单
  const e5 = validatePaired({ ...base, status: STATUS, confidenceCap: CONFIDENCE_CAP, divination: { ...base.divination, category: '瞎猜' } });
  ok(e5.some((x) => x.includes('category')), '非法类别必须报错');
  console.log('  标签/上限强制 + 5 类校验规则 ✓');
}

console.log('[D] 模板与示例文件');
{
  const tpl = join(ROOT, 'data', 'samples', 'paired-template.schema.json');
  const ex = join(ROOT, 'data', 'samples', 'paired-example.json');
  ok(existsSync(tpl), '缺 JSON Schema 模板');
  ok(existsSync(ex), '缺示例文件');
  const s = JSON.parse(readFileSync(tpl, 'utf8'));
  ok(s.required?.includes('birth') && s.required?.includes('divination') && s.required?.includes('feedback'),
    'Schema 三大要素（出生/占问/反馈）必须都在 required 里');
  ok(s.properties?.status?.const === 'hypothesis_under_validation', 'Schema 须锁死 status 常量');
  ok(s.properties?.confidenceCap?.const === 0.6, 'Schema 须锁死 confidenceCap=0.6');
  ok(s.properties?.divination?.properties?.lon !== undefined, '占问地经度必填（真太阳时所需，R-T2）');
  const { validatePaired: v } = await import('../src/cross/paired.mjs');
  const errs = v(JSON.parse(readFileSync(ex, 'utf8')));
  ok(errs.length === 0, `示例文件应校验通过，实得：${errs.join('；')}`);
  console.log('  Schema 三要素齐备｜常量锁死｜示例校验通过 ✓');
}

console.log('[E] R-G2：八字排盘调用点必须经 baziClock 真太阳时');
{
  // 扫描所有含 compileBazi 调用的文件，检查同一文件内是否同时出现 baziClock
  //   ★ 判据：一个文件若调用 compileBazi，且其入参来自**民用时字符串字面量**（形如 'YYYY-MM-DD HH:MM'），
  //     则必须同时出现 baziClock / trueSolarTime —— 否则视为"民用时静默污染"
  const { readdirSync, readFileSync: rf } = await import('node:fs');
  const roots = [ROOT, join(ROOT, 'src'), join(ROOT, 'src', 'bazi'), join(ROOT, 'src', 'cross'), join(ROOT, 'src', 'western')];
  const files = [];
  for (const d of roots) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (f.endsWith('.mjs')) files.push(join(d, f));
  }
  const offenders = [];
  for (const f of [...new Set(files)]) {
    const src = rf(f, 'utf8');
    if (!/compileBazi\s*\(/.test(src)) continue;
    // ★ 例外必须**显式声明**（源码里写明 R-G2-EXEMPT 并给出理由），不允许默默放过
    if (/R-G2-EXEMPT/.test(src)) continue;
    const hasTrueSolar = /baziClock|trueSolarTime/.test(src);
    // 是否把"日期 时刻"字面量直接喂进去（民用时形态）
    const literalFeed = /compileBazi\(\s*\{\s*at:\s*[`'"][^`'"]*\d{1,2}:\d{2}/.test(src)
      || /at:\s*`\$\{[^}]*date[^}]*\}\s+\$\{[^}]*time[^}]*\}`/.test(src);
    if (literalFeed && !hasTrueSolar) offenders.push(relative(ROOT, f));
  }
  ok(offenders.length === 0, `以下文件直接以民用时调 compileBazi 且未走真太阳时：\n      ${offenders.join('\n      ')}`);
  // 正例：cli-groundtruth.mjs 必须同时出现 baziClock 与 compileBazi
  const gt = join(ROOT, 'cli-groundtruth.mjs');
  if (existsSync(gt)) {
    const s = rf(gt, 'utf8');
    ok(/baziClock/.test(s) && /compileBazi/.test(s), 'cli-groundtruth.mjs 须同时出现 baziClock 与 compileBazi（R-G2 落实）');
  }
  console.log(`  扫描 ${[...new Set(files)].length} 个文件｜民用时直喂违规 ${offenders.length} ✓`);
}

console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
