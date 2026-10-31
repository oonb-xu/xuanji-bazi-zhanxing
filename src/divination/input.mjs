// Divination_Input —— 占课接口（与命盘本体数据库解耦）
//
// 架构裁定 ARCH-3：
//   · `bazi_meta_db.json` = **本体论**（静态出厂设置）：四柱/十神/藏干/胎命身/星盘/紫微…
//   · `Divination_Input`  = **问占**（动态、每次一问）：占时、月将、事由
// 命盘分析**不得**强跑六壬；六壬只在用户触发占课时，用当时传入的占时单独起课（月将加时）。
// 本接口不写回命盘 DB。

export const INTERFACE = 'Divination_Input';
export const VERSION = '1.0';

/** 起课方式 */
export const METHODS = ['da-liu-ren'];

/**
 * 校验并归一化一份占课输入
 * 中文键与英文键均接受；返回可直接喂给 compile()（src/daliuren.mjs）的入参。
 *
 * 必填：`askedAt`（问占时刻，本地时间字符串）**或** `riGanZhi` + `shiChen`（古法直接给）
 * 选填：`tz`（默认 +8）、`question`、`yueJiang`（给了就 manual，不给就按节气 auto）
 */
export function validateDivinationInput(x) {
  const errors = [];
  const pick = (...keys) => { for (const k of keys) if (x?.[k] !== undefined && x[k] !== null && x[k] !== '') return x[k]; return undefined; };

  const method = pick('method', '术式') ?? 'da-liu-ren';
  if (!METHODS.includes(method)) errors.push(`method 不支持：${method}（可选 ${METHODS.join('/')}）`);

  const askedAt = pick('askedAt', '占时时刻', 'at');
  const riGanZhi = pick('riGanZhi', '日干支', 'rizhi');
  const shiChen = pick('shiChen', '占时', '时辰');
  const yueJiang = pick('yueJiang', '月将');
  const tz = pick('tz', '时区') ?? 8;
  const question = pick('question', '事由', 'matter') ?? null;

  if (!askedAt && !(riGanZhi && shiChen)) {
    errors.push('必须提供 askedAt（问占时刻）或同时提供 riGanZhi + shiChen（古法直给）');
  }
  if (riGanZhi && !/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(riGanZhi)) errors.push(`riGanZhi 非法：${riGanZhi}`);
  if (shiChen && !'子丑寅卯辰巳午未申酉戌亥'.includes(shiChen)) errors.push(`shiChen 非法：${shiChen}`);
  if (yueJiang && !'子丑寅卯辰巳午未申酉戌亥'.includes(yueJiang)) errors.push(`yueJiang 非法：${yueJiang}`);
  if (askedAt && Number.isNaN(new Date(String(askedAt).replace(' ', 'T')).getTime())) errors.push(`askedAt 无法解析：${askedAt}`);

  if (errors.length) return { ok: false, errors };

  const mode = yueJiang ? 'manual' : 'auto';
  const input = riGanZhi && shiChen && !!yueJiang
    ? { riGanZhi, shiChen, yueJiang, matter: question }
    : { at: askedAt, matter: question, ...(riGanZhi ? { riGanZhi } : {}) };
  return {
    ok: true,
    interface: INTERFACE, version: VERSION, method,
    yueJiangMode: mode,
    normalized: input,
    meta: { askedAt, tz, question, note: x?.note ?? null },
    warning: mode === 'auto' ? '月将按节气自动推（需 askedAt）；若为古法复原盘请显式给 yueJiang' : null,
  };
}

/** 展开接口说明（供 docs 与 CLI --schema 用） */
export function describeInterface() {
  return {
    interface: INTERFACE, version: VERSION,
    required: ['askedAt 或 (riGanZhi + shiChen)'],
    optional: ['tz（默认 +8）', 'question/事由', 'yueJiang（给了即 manual）', 'note'],
    fields: {
      askedAt: '问占时刻，本地时间 "YYYY-MM-DD HH:mm"',
      riGanZhi: '日干支（古法直给，可省）',
      shiChen: '占时地支（古法直给，可省）',
      yueJiang: '月将地支；不填则按中气自动推',
      question: '所问之事',
      tz: '时区偏移小时，默认 8',
    },
    decoupledFrom: 'bazi_meta_db.json（本体论）——本接口只在问占瞬间生成，不写回命盘数据库',
  };
}
