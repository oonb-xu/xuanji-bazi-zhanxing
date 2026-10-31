// 阶段一 · 底层规则 · 大六壬推演编译器
// 严格实现用户规则表 Step 1–5；Step 4 的三传同时给出「本引擎推导」与「第三方库结果」，
// 一致则 confidence=high，不一致则落 agreement:false 并附差异（不静默覆盖）。
import { SolarTerm } from 'tyme4ts';
import { getLiuRenByDate, getLiuRenByYueJiang, PinyinToDiZhi } from 'liuren-ts-lib';
import {
  DI_ZHI, TIAN_JIANG, JIANG_ALIAS, ZHI_WU_XING, GAN_WU_XING, ZHI_YIN_YANG, GAN_YIN_YANG,
  SHENG, KE, GAN_JI_GONG, YUE_JIANG_BY_QI, ZHONG_QI_ORDER, GUI_REN_BY_GAN, BA_ZHUAN_RI, SPECIAL_KETI_RE,
  zhiIndex, mod12, zhiAt, wuXingRelation,
} from './constants.mjs';

/* ───────────── Step 0: 时间基座（统一模型 L0） ───────────── */

const p2 = (n) => String(n).padStart(2, '0');
export const fmtLocal = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** 由年月日时（本地时间）求时辰地支 */
export function shiChenOf(hour) {
  return zhiAt(Math.floor(((hour + 1) % 24) / 2));
}

/** 求管辖该时刻的「中气」（月将换将点） */
export function governingZhongQi(date) {
  const y = date.getFullYear();
  const day = y * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  let best = null;
  for (const yy of [y - 1, y, y + 1]) {
    for (const qi of ZHONG_QI_ORDER) {
      const idx = ZHONG_QI_ORDER.indexOf(qi); // 偶数项对应 SolarTerm 偶数索引
      const term = SolarTerm.fromIndex(yy, idx * 2);
      const d = term.getSolarDay();
      const td = d.getYear() * 10000 + d.getMonth() * 100 + d.getDay();
      if (td <= day && (!best || td > best.day)) best = { qi, day: td };
    }
  }
  if (!best) throw new Error('无法定位中气（时间超出可算区间）');
  return best.qi;
}

/** Step 1：中气 → 月将 */
export function yueJiangFromQi(qi) {
  const z = YUE_JIANG_BY_QI[qi];
  if (!z) throw new Error(`未定义的中气：${qi}`);
  return z;
}

/** Step 2：日干 → 贵人（昼夜取位） */
export function guiRenOf(riGan, dayNight) {
  const pair = GUI_REN_BY_GAN[riGan];
  if (!pair) throw new Error(`未定义的天干：${riGan}`);
  return { zhi: dayNight === '昼' ? pair[0] : pair[1], pair, dayNight };
}

/* ───────────── Step 3: 天地盘 ───────────── */

/** 天盘：月将加于占时之上，顺时针排布 → 返回 地盘支 → 天盘支 的映射 */
export function buildTianPan(yueJiang, shiChen) {
  const r = mod12(zhiIndex(shiChen) - zhiIndex(yueJiang)); // 旋转量
  const map = {};
  for (let i = 0; i < 12; i++) map[DI_ZHI[mod12(i + r)]] = DI_ZHI[i];
  // map[地盘] = 天盘，且 map[占时] === 月将
  if (map[shiChen] !== yueJiang) throw new Error('天地盘构造失败');
  return {
    map, rotation: r,
    /** 某地盘位之上的天盘神 */
    shangShen: (di) => map[di],
    /** 某天盘神之下的地盘位（上神的逆运算） */
    xiaShen: (tian) => zhiAt(zhiIndex(tian) + r),
  };
}

/* ───────────── 四课 ───────────── */

export function buildSiKe(riGan, riZhi, tianPan) {
  const ji = GAN_JI_GONG[riGan];
  const t = tianPan.map;
  const ke1 = { top: t[ji], bottom: riGan, bottomZhi: ji, di: ji, label: '干上神', wuxing: [GAN_WU_XING[riGan], ZHI_WU_XING[t[ji]]] };
  const ke2 = { top: t[ke1.top], bottom: ke1.top, bottomZhi: ke1.top, di: ke1.top, label: '干上神之上神', wuxing: [ZHI_WU_XING[ke1.top], ZHI_WU_XING[t[ke1.top]]] };
  const ke3 = { top: t[riZhi], bottom: riZhi, bottomZhi: riZhi, di: riZhi, label: '支上神', wuxing: [ZHI_WU_XING[riZhi], ZHI_WU_XING[t[riZhi]]] };
  const ke4 = { top: t[ke3.top], bottom: ke3.top, bottomZhi: ke3.top, di: ke3.top, label: '支上神之上神', wuxing: [ZHI_WU_XING[ke3.top], ZHI_WU_XING[t[ke3.top]]] };
  return [ke1, ke2, ke3, ke4];
}

/* ───────────── Step 4: 三传 ───────────── */

const sameYinYangAsGan = (zhi, riGan) => ZHI_YIN_YANG[zhi] === GAN_YIN_YANG[riGan];

/** 涉害深度：天盘神 s 临地盘 p，从 s 本家顺行至 p，沿途被地盘五行所克之次数 */
export function sheHaiDepth(s, p) {
  let n = 0;
  const from = zhiIndex(s);
  const steps = mod12(zhiIndex(p) - from);
  for (let i = 1; i <= steps; i++) {
    const d = zhiAt(from + i);
    if (KE[ZHI_WU_XING[d]] === ZHI_WU_XING[s]) n++; // 地盘克天盘
  }
  return n;
}

const isMeng = (z) => ['寅', '申', '巳', '亥'].includes(z); // 四孟
const isZhong = (z) => ['子', '午', '卯', '酉'].includes(z); // 四仲

/**
 * 按规则表优先级推导三传。
 * 返回 { chu, zhong, mo, method, chain, special, candidates }
 */
export function deriveSanChuan({ riGan, riZhi, tianPan, yueJiang, shiChen }) {
  const ke = buildSiKe(riGan, riZhi, tianPan);
  const t = tianPan.map;
  const special = [];
  if (tianPan.rotation === 0) special.push('伏吟');
  if (tianPan.rotation === 6) special.push('返吟');
  if (BA_ZHUAN_RI.includes(riGan + riZhi)) special.push('八专');
  /** 三刑相刑表（用于伏吟课中末传取刑）：自刑者映射自身，本引擎未做「自刑取冲」变例（已在 detail 标注） */
  const XING = { 子: '卯', 卯: '子', 寅: '巳', 巳: '申', 申: '寅', 丑: '戌', 戌: '未', 未: '丑', 辰: '辰', 午: '午', 酉: '酉', 亥: '亥' };

  const picks = (list, method) => {
    let cand = list;
    let m = method;
    if (cand.length > 1) {
      const byYy = cand.filter((c) => sameYinYangAsGan(c.top, riGan));
      if (byYy.length === 1) return { chu: byYy[0].top, method: '比用', detail: { pool: list.map(c => c.top) } };
      if (byYy.length > 1) { cand = byYy; m = '比用'; }
      else { m = '涉害'; }
    }
    if (cand.length > 1) {
      // 涉害：取受克最深者（按规则表简化口径；并列时取四孟、四仲）
      const scored = cand.map((c) => ({ ...c, depth: sheHaiDepth(c.top, c.di) }));
      const max = Math.max(...scored.map((s) => s.depth));
      let top = scored.filter((s) => s.depth === max);
      if (top.length > 1) { const g = top.filter((s) => isMeng(s.di)); if (g.length) top = g; }
      if (top.length > 1) { const g = top.filter((s) => isZhong(s.di)); if (g.length) top = g; }
      if (top.length > 1) { // 末级裁决：阳日取干上神，阴日取支上神
        const want = GAN_YIN_YANG[riGan] === '阳' ? ke[0].top : ke[2].top;
        const g = top.filter((s) => s.top === want);
        if (g.length) top = g;
      }
      return { chu: top[0].top, method: '涉害', detail: { scored } };
    }
    return { chu: cand[0].top, method: m, detail: { pool: list.map(c => c.top) } };
  };

  // 1) 下贼上（下克上）
  const xiaKeShang = ke.filter((c) => KE[c.wuxing[0]] === c.wuxing[1]);
  if (xiaKeShang.length) {
    const r = picks(xiaKeShang, '贼克·下贼上');
    return finish(r.chu, r.method, r.detail);
  }
  // 2) 上克下
  const shangKeXia = ke.filter((c) => KE[c.wuxing[1]] === c.wuxing[0]);
  if (shangKeXia.length) {
    const r = picks(shangKeXia, '贼克·上克下');
    return finish(r.chu, r.method, r.detail);
  }
  // 2.5) ★ 伏吟课（月将 = 占时 → 天地盘全同）：**有贼克仍取贼克**（上文已返回），
  //      无贼克时 —— **刚日（阳干）取干上神、柔日（阴干）取支上神**为初传，**中传取初传之刑、末传取中传之刑**。
  //      依据：《大六壬断案》实测可证 —— 丁巳日未将未时（柔日伏吟）原文三传「巳申寅」，
  //      支上神 = 巳，巳刑申、申刑寅，与刑链逐字吻合。裁定 R-L6。
  if (tianPan.rotation === 0) {
    const yang = GAN_YIN_YANG[riGan] === '阳';
    const ZI_XING = ['辰', '午', '酉', '亥'];
    const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
    const chu = yang ? ke[0].top : ke[2].top;
    // 自刑变例（R-L6 补）：若初传自刑 → 中传取**支上神**；若中传又自刑 → 末传取**中传之冲**。
    // 实测依据：壬午日子将子时（刚日伏吟）原文三传「亥午子」—— 初亥自刑→中取支上神午，午又自刑→末取冲子，逐字吻合。
    let zhong, mo, variant = '刑链';
    if (ZI_XING.includes(chu)) {
      zhong = ke[2].top; variant = '初传自刑→中取支上神';
      mo = ZI_XING.includes(zhong) ? CHONG[zhong] : (XING[zhong] ?? zhong);
      if (ZI_XING.includes(zhong)) variant += '；中传又自刑→末取冲';
    } else {
      zhong = XING[chu] ?? chu; mo = XING[zhong] ?? zhong;
    }
    return {
      chu, zhong, mo,
      method: `伏吟·${yang ? '刚日取干上神' : '柔日取支上神'}·${variant}`,
      chain: [chu, zhong, mo].map((z, i) => ({ pos: ['初传', '中传', '末传'][i], zhi: z, wuxing: ZHI_WU_XING[z] })),
      special: [...new Set([...special, '伏吟'])],
      specialKeti: '伏吟',
      detail: { rule: 'R-L6', 支上神: ke[2].top, 干上神: ke[0].top, variant },
    };
  }

  // 2.6) ★ 返吟课（月将与占时相冲 → 天地盘全冲）：**有克取克**（上方贼克路径已覆盖），
  //      无贼克时 —— **取驿马发用，中传取支上神，末传取干上神**。
  //      依据：《大六壬断案》实测可证 —— 丁未日午将子时（返吟）原文三传「巳丑丑」，
  //      未属亥卯未、驿马在巳 = 初传；支上神丑、干上神丑 = 中末传，逐字吻合。裁定 R-L7。
  if (tianPan.rotation === 6) {
    const MA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
    const ma = MA[riZhi];
    if (ma) {
      return {
        chu: ma, zhong: ke[2].top, mo: ke[0].top,
        method: '返吟·无克取驿马·中支上神·末干上神',
        chain: [ma, ke[2].top, ke[0].top].map((z, i) => ({ pos: ['初传', '中传', '末传'][i], zhi: z, wuxing: ZHI_WU_XING[z] })),
        special: [...new Set([...special, '返吟'])],
        specialKeti: '返吟',
        detail: { rule: 'R-L7', 驿马: ma, 支上神: ke[2].top, 干上神: ke[0].top },
      };
    }
  }

  // 3) 遥克：上神克日干 优先，其次 日干克上神；多者取与日干比者
  const ganWx = GAN_WU_XING[riGan];
  const tops = [...new Set(ke.map((c) => c.top))];
  let yao = tops.filter((z) => KE[ZHI_WU_XING[z]] === ganWx).map((z) => ({ top: z }));
  let yaoDir = '上神克日干';
  if (!yao.length) { yao = tops.filter((z) => KE[ganWx] === ZHI_WU_XING[z]).map((z) => ({ top: z })); yaoDir = '日干克上神'; }
  if (yao.length) {
    const byYy = yao.filter((c) => sameYinYangAsGan(c.top, riGan));
    const chosen = (byYy.length ? byYy : yao)[0];
    if (yao.length > 1 && ke[0].top === ke[2].top) special.push('别责(四课不全)');
    return finish(chosen.top, `遥克·${yaoDir}`, { pool: yao.map(y => y.top) });
  }
  // 4) 昴星
  if (ke[0].top === ke[2].top) special.push('别责(四课不全)');
  const yang = GAN_YIN_YANG[riGan] === '阳';
  const chu = yang ? t['酉'] : tianPan.xiaShen('酉');
  return finish(chu, `昴星·${yang ? '阳日取地盘酉上神' : '阴日取天盘酉下神'}`, { special: true });

  function finish(chu, method, detail = {}) {
    let zhong, mo;
    if (method.startsWith('昴星')) {
      const yang = GAN_YIN_YANG[riGan] === '阳';
      zhong = yang ? ke[2].top : ke[0].top;
      mo = yang ? ke[0].top : ke[2].top;
    } else {
      zhong = t[chu];
      mo = t[zhong];
    }
    return {
      chu, zhong, mo, method,
      chain: [chu, zhong, mo].map((z, i) => ({
        pos: ['初传', '中传', '末传'][i], zhi: z, wuxing: ZHI_WU_XING[z],
      })),
      special: [...new Set(special)],
      specialKeti: special.length ? special.join('+') : null,
      detail,
    };
  }
}

/* ───────────── Step 5: 十二天将 ───────────── */

export function buildTianJiang(guiRenZhi, tianPan) {
  const landPos = tianPan.xiaShen(guiRenZhi); // 贵人所落「地盘」位
  const forward = ['亥', '子', '丑', '寅', '卯', '辰'].includes(landPos);
  const map = {};
  for (let k = 0; k < 12; k++) {
    const pos = zhiAt(zhiIndex(landPos) + (forward ? k : -k));
    const jiang = TIAN_JIANG[k];
    map[pos] = jiang;                 // 地盘位 → 天将
  }
  return { landPos, forward, direction: forward ? '顺排' : '逆排', map };
}

/* ───────────── 编译主入口 ───────────── */

export function compile(input) {
  const { at, matter = null } = input;
  let riGan, riZhi, yueJiang, shiChen, dayNight, dateInfo;

  if (input.riGanZhi && input.shiChen && input.yueJiang) {
    ({ riGan, riZhi } = splitGanZhi(input.riGanZhi));
    yueJiang = input.yueJiang; shiChen = input.shiChen;
    dayNight = input.dayNight || (['卯', '辰', '巳', '午', '未', '申'].includes(shiChen) ? '昼' : '夜');
    dateInfo = { source: 'manual', bazi: null, shiChen, yueJiang };
  } else {
    const d = at instanceof Date ? at : new Date(at);
    if (Number.isNaN(d.getTime())) throw new Error(`无法解析时间：${at}`);
    const qi = governingZhongQi(d);
    yueJiang = yueJiangFromQi(qi);
    shiChen = shiChenOf(d.getHours());
    dayNight = ['卯', '辰', '巳', '午', '未', '申'].includes(shiChen) ? '昼' : '夜';
    const lib0 = getLiuRenByDate(d);
    const bz = lib0.dateInfo.bazi.split(/\s+/);
    ({ riGan, riZhi } = splitGanZhi(bz[2]));
    dateInfo = { source: 'date', iso: d.toISOString(), local: fmtLocal(d), bazi: lib0.dateInfo.bazi, zhongQi: qi, xun: lib0.dateInfo.xun, kong: lib0.dateInfo.kong };
  }

  const tianPan = buildTianPan(yueJiang, shiChen);
  const siKe = buildSiKe(riGan, riZhi, tianPan);
  const gui = guiRenOf(riGan, dayNight);
  const jiang = buildTianJiang(gui.zhi, tianPan);
  const sc = deriveSanChuan({ riGan, riZhi, tianPan, yueJiang, shiChen });

  // 与第三方库对拍
  const lib = input.riGanZhi
    ? getLiuRenByYueJiang(yueJiang, shiChen, input.riGanZhi)
    : getLiuRenByDate(new Date(input.at));
  const libChu = lib.sanChuan.chuChuan[0];
  const libZhong = lib.sanChuan.zhongChuan[0];
  const libMo = lib.sanChuan.moChuan[0];
  const libAgree = libChu === sc.chu && libZhong === sc.zhong && libMo === sc.mo;

  // 特殊课体（伏吟/返吟/别责/八专）规则表 Step 4.6 授权交专用规则：以库值为权威，保留本引擎推导备查
  const isSpecial = Boolean(sc.specialKeti) || SPECIAL_KETI_RE.test(lib.sanChuan.keTi ?? '');
  const useLib = isSpecial && !libAgree;
  const chuChuan = useLib ? libChu : sc.chu;
  const zhongChuan = useLib ? libZhong : sc.zhong;
  const moChuan = useLib ? libMo : sc.mo;

  const sanChuan = {
    chuChuan, zhongChuan, moChuan,
    method: useLib ? `特殊课体·交专用规则（${lib.sanChuan.keTi}）` : sc.method,
    specMethod: sc.method,
    chain: [chuChuan, zhongChuan, moChuan].map((z, i) => ({ pos: ['初传', '中传', '末传'][i], zhi: z, wuxing: ZHI_WU_XING[z] })),
    special: sc.specialKeti ? sc.specialKeti.split('+') : [],
    keTi: lib.sanChuan.keTi,
    agree: libAgree,
    authoritative: useLib ? 'lib' : 'spec',
    lib: { chuChuan: libChu, zhongChuan: libZhong, moChuan: libMo },
    spec: { chuChuan: sc.chu, zhongChuan: sc.zhong, moChuan: sc.mo },
    confidence: useLib ? 'low(特殊课体)' : libAgree ? 'high' : 'medium',
  };

  const tianJiangByDi = {};
  for (const z of DI_ZHI) tianJiangByDi[z] = jiang.map[z];

  return {
    model: 'meta-unified/phase1/daliuren',
    version: '1.0.0',
    layer: 'L0-L5',
    input: { at: dateInfo.iso ?? null, matter, raw: input },
    time: dateInfo,
    L0_time: { zhongQi: dateInfo.zhongQi ?? null, shiChen, dayNight },
    L1_frame: { yueJiang, sunSignFrame: yueJiang },
    L2_pan: {
      diPan: Object.fromEntries(DI_ZHI.map((z) => [z, z])),
      tianPan: tianPan.map,
      rotation: tianPan.rotation,
    },
    L3_relation: { siKe: siKe.map((k) => ({ top: k.top, bottom: k.bottom, rel: wuXingRelation(k.wuxing[0], k.wuxing[1]) })) },
    L4_guiRen: { riGan, guiRenZhi: gui.zhi, pair: gui.pair, landPos: jiang.landPos, direction: jiang.direction },
    L4_tianJiang: jiang.map,
    L5_sanChuan: sanChuan,
    tianJiangByDi,
    siKe,
    shenSha: lib.shenSha.map((s) => `${s.name}${s.value}`),
    dunGan: normalizePinyinMap(lib.dunGan),
  };
}

/** 库的十二宫映射以拼音为键，统一转为地支键 */
/**
 * ★ 由古籍课例的 (日干支, 月将, 占时) **直算课式** —— R-L1
 * 为什么需要：古籍年份多不可考（邵彦和为北宋人，戊申年有多个候选），
 * 而三传完全由「日干支 + 月将 + 占时」三项决定 → 对拍不必知道年份。
 * 本函数**只是把已有的第 2/3/4/5 步组合起来**，不改任何算法。
 */
export function compileFromGanZhi({ dayGz, yueJiang, zhanShi, dayNight = '昼' }) {
  const { riGan, riZhi } = splitGanZhi(dayGz);
  const tianPan = buildTianPan(yueJiang, zhanShi);
  const siKe = buildSiKe(riGan, riZhi, tianPan);
  const sanChuan = deriveSanChuan({ riGan, riZhi, tianPan, yueJiang, shiChen: zhanShi });
  const guiRen = guiRenOf(riGan, dayNight);
  const tianJiang = buildTianJiang(guiRen, tianPan);
  return { dayGz, riGan, riZhi, yueJiang, zhanShi, dayNight, tianPan, siKe, sanChuan, guiRen, tianJiang };
}

export function normalizePinyinMap(m) {  const out = {};
  for (const [k, v] of Object.entries(m)) {
    const z = PinyinToDiZhi[k] ?? k;
    out[z] = JIANG_ALIAS[v] ?? v;
  }
  return out;
}

export function splitGanZhi(gz) {  if (!gz || gz.length < 2) throw new Error(`非法干支：${gz}`);
  const riGan = gz[0];
  const riZhi = gz[1];
  if (!GAN_WU_XING[riGan]) throw new Error(`非法天干：${riGan}`);
  if (zhiIndex(riZhi) < 0) throw new Error(`非法地支：${riZhi}`);
  return { riGan, riZhi };
}

export { DI_ZHI, TIAN_JIANG, ZHI_WU_XING, SHENG, KE, wuXingRelation };
