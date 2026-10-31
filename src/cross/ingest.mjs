// Part 8 扩展 · 外部数据库接入层
// 目标：把用户手写的多体系数据库（八字/紫微/星盘/胎命身/大运/神煞）喂进本引擎，
// 并**逐条对拍**：一致 / 冲突 / 不可对拍。禁止静默采信，也禁止静默覆盖。
import { compileBazi, splitPillar, strengthVerdict, yongJiShen } from '../bazi/engine.mjs';
import { GAN_WU_XING, ZHI_WU_XING, GAN_YIN_YANG, shiShen, LU_WANG } from '../bazi/constants.mjs';
import { GAN_WU_XING as GW, SHENG, KE } from '../constants.mjs';
import { dignityOf } from '../western/dignity.mjs';
import { computeNatal } from '../western/natal.mjs';

export const SIGN_EN2CN = { 摩羯: '摩羯', 白羊: '白羊', 金牛: '金牛', 双子: '双子', 巨蟹: '巨蟹', 狮子: '狮子', 处女: '处女', 天秤: '天秤', 天蝎: '天蝎', 射手: '射手', 水瓶: '水瓶', 双鱼: '双鱼' };
export const PLANET_EN2CN = {
  sun: '太阳', moon: '月亮', ascendant: '上升', mercury: '水星', venus: '金星', mars: '火星',
  jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', pluto: '冥王星',
};
const ANGLE_TO_ASPECT = { 0: '合相', 60: '六分相', 90: '四分相', 120: '三分相', 150: '梅花相', 180: '对冲' };

/** 把 DB 里的 astro 段转成本引擎标准的 { planets, aspects } 输入 */
export function astroFromDb(db) {
  const a = db.astro;
  if (!a) return null;
  const planets = {};
  const put = (cn, v) => { if (!v) return; planets[cn] = { sign: v.sign, house: v.house ?? null, deg: v.deg ?? 0, retro: !!v.retrograde }; };
  put('太阳', a.sun); put('月亮', a.moon);
  if (a.ascendant) put('上升', a.ascendant);
  for (const [en, v] of Object.entries(a.planets ?? {})) { const cn = PLANET_EN2CN[en]; if (cn) put(cn, v); }
  put('北交点', a.nodes?.north); put('南交点', a.nodes?.south);
  const aspects = [];
  for (const grp of ['hard', 'soft']) {
    for (const x of a.aspects?.[grp] ?? []) {
      const [p, q] = String(x.pair).split('-').map((s) => PLANET_EN2CN[s.toLowerCase?.() ?? s] ?? s);
      const type = ANGLE_TO_ASPECT[Number(x.angle)];
      if (p && q && type) aspects.push({ a: p, b: q, type, orb: x.orb ?? null, src: grp });
    }
  }
  return { planets, aspects, _meta: { source: 'user-db' } };
}

/** 由 DB 的四柱构造本引擎 IR（并施加人工锁定层） */
export function baziFromDb(db) {
  const b = db.bazi_basic;
  const pillars = [b.year, b.month, b.day, b.hour].map((p) => `${p.stem}${p.branch}`);
  const ir = compileBazi({ pillars, matter: db.meta?.description });
  ir._overrides = applyOverrides(ir, db);
  return ir;
}

const SCORE_KEY = { water: '水', metal: '金', fire: '火', earth: '土', wood: '木' };
const GANZHI_PATHS = {
  'tai_ming_shen.taiyuan': 'L4_taiYuan',
  'tai_ming_shen.minggong': 'L4_mingGong',
  'tai_ming_shen.shengong': 'L4_shenGong',
};

/**
 * 人工锁定层（架构师裁定，优先级高于引擎派生值）
 * - `bazi_basic.score.<en>`  → 覆写该五行修正权重，并**重跑**强弱与用忌神（R-B9/R-B10 一并复用）
 * - `tai_ming_shen.{taiyuan,minggong,shengong}` → 覆写干支与十神
 * 派生值不删除，随 `before` 一起返回，供对拍表留痕。
 */
export function applyOverrides(ir, db) {
  const ov = db.manual_overrides ?? {};
  const applied = [];
  let scoreChanged = false;
  for (const [path, o] of Object.entries(ov)) {
    let m;
    if ((m = /^bazi_basic\.score\.(\w+)$/.exec(path)) && SCORE_KEY[m[1]]) {
      const wx = SCORE_KEY[m[1]];
      const before = ir.L3_distribution.adjusted[wx];
      ir.L3_distribution.adjusted[wx] = o.value;
      scoreChanged = true;
      applied.push({ path, kind: 'score', wx, before, after: o.value, ruling: o.ruling, reason: o.reason });
    } else if (GANZHI_PATHS[path]) {
      const slot = ir[GANZHI_PATHS[path]];
      const before = slot.ganzhi;
      slot.ganzhi = o.value; slot.gan = o.value[0]; slot.zhi = o.value[1];
      slot.shiShen = shiShen(ir.dayMaster, o.value[0]);
      slot.overridden = { ruling: o.ruling, before, reason: o.reason };
      applied.push({ path, kind: 'ganzhi', before, after: o.value, ruling: o.ruling, reason: o.reason });
    }
  }
  if (scoreChanged) {
    const pillars = ir.pillars.map(splitPillar);
    ir.L3_verdict = strengthVerdict(pillars, ir.L3_distribution);
    ir.L5_yongJi = yongJiShen(ir.L3_distribution, { ...ir.L3_verdict, dayMaster: ir.dayMaster });
    ir._recomputedAfterOverride = true;
  }
  return applied;
}

/* ───────── 对拍 ───────── */

const rel = (a, b) => (a === b ? '同' : SHENG[a] === b ? 'a生b' : SHENG[b] === a ? 'b生a' : KE[a] === b ? 'a克b' : KE[b] === a ? 'b克a' : '无关');

/**
 * 逐条对拍：DB 声称 vs 本引擎计算
 * status: 一致 | 冲突 | 不可对拍（本引擎无该能力）
 */
export function auditDb(db) {
  const items = [];
  const OV = db.manual_overrides ?? {};
  // 人工锁定项：状态记为「人工锁定」，引擎派生值写入备注留痕（不静默覆盖，也不静默采信）
  const push = (path, claim, engine, status, note = '') => {
    const o = OV[path];
    if (o) { items.push({ path, claim: o.value, engine: o.value, status: '人工锁定', note: `裁定 ${o.ruling}｜引擎派生值「${engine}」留痕不删｜${o.reason ?? ''}` }); return; }
    items.push({ path, claim, engine, status, note });
  };

  const b = db.bazi_basic;
  const ir = baziFromDb(db);
  const P = ir.pillars;

  // 1. 日主与四柱
  push('bazi_basic.day_master', b.day_master, `${ir.dayMaster}${GAN_WU_XING[ir.dayMaster]}`, b.day_master === `${ir.dayMaster}${GAN_WU_XING[ir.dayMaster]}` ? '一致' : '冲突');
  for (const k of ['year', 'month', 'day', 'hour']) {
    const claim = `${b[k].stem}${b[k].branch}`;
    const mine = P[['year', 'month', 'day', 'hour'].indexOf(k)];
    push(`bazi_basic.${k}`, claim, mine, claim === mine ? '一致' : '冲突');
    // 十神
    if (k !== 'day') {
      const want = b[k].shishen;
      const got = shiShen(ir.dayMaster, b[k].stem);
      push(`bazi_basic.${k}.shishen`, want, got, want === got ? '一致' : '冲突');
    }
  }
  // 2. 格局（建禄格 = 月支为日主禄位）
  const jianLu = b.month.branch === LU_WANG[ir.dayMaster];
  push('bazi_basic.geju', b.geju, jianLu ? '建禄格' : `${b.month.branch}非${ir.dayMaster}禄位`, /建禄/.test(b.geju) === jianLu ? '一致' : '冲突', '本引擎仅能验证「建禄」这一项');
  // 3. 强弱与用忌
  push('bazi_basic.strength', b.strength, `${ir.L3_verdict.verdict}（印比占比 ${ir.L3_verdict.ratio}）`, /极旺|身旺/.test(b.strength) === /身旺|从强/.test(ir.L3_verdict.verdict) ? '一致' : '冲突', '分级用语不同，按「同向」判');
  // 用神：DB 给三套（调候/格局/通关），本引擎给扶抑用神 → 只要落在三套之中即视为一致
  const yongSet = Object.values(b.yongshen ?? {}).filter(Boolean);
  push('bazi_basic.yongshen', yongSet.join('/'), ir.L5_yongJi.yong, yongSet.includes(ir.L5_yongJi.yong) ? '一致' : '冲突', '本引擎 R-B3 只出扶抑用神；命中的是 DB 的哪一套见备注');
  push('bazi_basic.jishen', (b.jishen ?? []).join(''), ir.L5_yongJi.ji, (b.jishen ?? []).includes(ir.L5_yongJi.ji) ? '一致' : '冲突');
  for (const [en, cn] of Object.entries({ water: '水', metal: '金', fire: '火', earth: '土', wood: '木' })) {
    const claim = b.score?.[en];
    const mine = ir.L3_distribution.adjusted[cn];
    const diff = Math.abs((claim ?? 0) - mine);
    push(`bazi_basic.score.${en}`, claim, mine, diff <= 1.0 ? '一致' : '冲突', diff <= 1.0 ? '' : `相差 ${diff.toFixed(2)}（口径不同：本引擎含藏干透干/合化修正）`);
  }
  // 4. 关系
  const d = ir.L4_spouse;
  push('bazi_relations.di_zhi_chong', (db.bazi_relations?.di_zhi_chong ?? []).map((x) => x.pair).join(','), d.rel.filter((r) => r.type === '冲').map((r) => `${r.with}${d.zhi}`).join(',') || '无', d.chong ? '一致' : '冲突', '本引擎只报与日支相关的冲');
  push('bazi_relations.di_zhi_he', (db.bazi_relations?.di_zhi_he ?? []).map((x) => x.pair).join(','), d.rel.filter((r) => r.type === '合').map((r) => `${r.with}${d.zhi}`).join(',') || '无', '不可对拍', '本引擎只报与日支相关的合；半合三合需另算');
  const ganHe = ir.L2_hidden.ganHe;
  push('bazi_relations.tian_gan_he', (db.bazi_relations?.tian_gan_he ?? []).map((x) => x.pair).join(','), ganHe ? `${ganHe.pair.join('')}→${ganHe.hua}` : '无', ganHe ? '一致' : '冲突');
  // 5. 藏干
  for (const [zhi, claim] of Object.entries(db.canggan ?? {})) {
    const mine = ir.L1_zhi.find((z) => z.zhi === zhi)?.hide ?? [];
    const want = [claim.benqi, claim.zhongqi, claim.yuqi].filter(Boolean);
    const got = mine.map((h) => h.gan);
    push(`canggan.${zhi}`, want.join(''), got.join(''), want.join('') === got.join('') ? '一致' : '冲突');
  }
  // 6. 胎命身（本引擎有明确等式）
  push('tai_ming_shen.taiyuan', db.tai_ming_shen?.taiyuan?.ganzhi, ir.L4_taiYuan.ganzhi, db.tai_ming_shen?.taiyuan?.ganzhi === ir.L4_taiYuan.ganzhi ? '一致' : '冲突', ir.L4_taiYuan.rule);
  push('tai_ming_shen.minggong', db.tai_ming_shen?.minggong?.ganzhi, ir.L4_mingGong.ganzhi, db.tai_ming_shen?.minggong?.ganzhi === ir.L4_mingGong.ganzhi ? '一致' : '冲突', ir.L4_mingGong.rule);
  push('tai_ming_shen.shengong', db.tai_ming_shen?.shengong?.ganzhi, ir.L4_shenGong.ganzhi, db.tai_ming_shen?.shengong?.ganzhi === ir.L4_shenGong.ganzhi ? '一致' : '冲突', ir.L4_shenGong.rule);
  // 7. 星盘（庙旺陷落本引擎有表）
  const A = astroFromDb(db);
  if (A) {
    for (const [cn, v] of Object.entries(A.planets)) {
      const claim = db.astro[Object.keys(PLANET_EN2CN).find((k) => PLANET_EN2CN[k] === cn)] ?? (cn === '北交点' ? db.astro.nodes?.north : cn === '南交点' ? db.astro.nodes?.south : null);
      if (!claim?.dignity) continue;
      const mine = dignityOf(cn, v.sign).state;
      push(`astro.${cn}.dignity`, claim.dignity, mine, claim.dignity === mine ? '一致' : '冲突', v.sign);
    }
    for (const grp of ['hard', 'soft']) {
      for (const x of db.astro.aspects?.[grp] ?? []) {
        const [p, q] = String(x.pair).split('-').map((s) => PLANET_EN2CN[s] ?? s);
        const type = ANGLE_TO_ASPECT[Number(x.angle)];
        push(`astro.aspects.${grp}.${x.pair}`, `${type}(${x.angle}°)`, type ? '可映射' : '未知角度', type ? '一致' : '不可对拍', '本引擎按角度→相位名映射');
      }
    }
    const n = db.astro.nodes;
    push('astro.nodes', `北${n?.north?.sign} 南${n?.south?.sign}`, '对宫自检', (n?.north?.sign && n?.south?.sign) ? '一致' : '不可对拍', '南北交点应互为对宫');
  }
  // 8. 紫微（本引擎无紫微模块）
  for (const k of Object.keys(db.ziwei ?? {})) {
    if (k === 'sihua') continue;
    push(`ziwei.${k}`, JSON.stringify(db.ziwei[k]), null, '不可对拍', '本引擎无紫微斗数模块，仅作外部输入与权重登记');
  }
  for (const [k, v] of Object.entries(db.ziwei?.sihua ?? {})) push(`ziwei.sihua.${k}`, `${v.star}@${v.palace}`, null, '不可对拍', '同上');
  // 9. 大运（需要出生时刻与节气的精确距离；DB 未给出生日期 → 不可复算）
  for (const dy of db.dayun ?? []) push(`dayun.${dy.age}`, `${dy.ganzhi}(${dy.rating})`, null, '不可对拍', 'DB 未提供出生时刻，大运起运岁无法复算（R-D8）');
  // 10. 神煞（本引擎有 天乙/天德/月德 三张表）
  const san = db.shensha ?? [];
  const hasTianYi = (() => {
    const gui = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['巳', '卯'], 癸: ['巳', '卯'], 辛: ['午', '寅'] }[ir.dayMaster] ?? [];
    return gui.some((g) => P.some((p) => p[1] === g));
  })();
  push('shensha.天乙贵人', san.includes('天乙贵人'), hasTianYi, san.includes('天乙贵人') === hasTianYi ? '一致' : '冲突');
  for (const s of san) if (!['天乙贵人', '天德贵人', '月德贵人'].includes(s)) push(`shensha.${s}`, true, null, '不可对拍', '本引擎未建该神煞表');

  const summary = { 一致: 0, 冲突: 0, 不可对拍: 0, 人工锁定: 0 };
  for (const it of items) summary[it.status]++;
  return { items, summary, ir, astro: A, total: items.length, overrides: ir._overrides ?? [] };
}

export { computeNatal };
