// 八字 · 《千里命稿》评断篇 saying → ground-truth 纯规则提取器
//
// 目标：只从 saying 原文做确定性抽取，产出
//   id / strongWeak / yongWx / xiSet / jiSet / method / raw [/ compare]
//
// 硬约束：
//   1) 不伪造日期：本语料只有四柱，直接走 compileBazi({ pillars }) 的纯组合入口
//      （engine.mjs 的 meta.source === 'ganzhi' 分支），绝不构造出生时间。
//   2) 取不到就 null：没有明文的强弱/用神/喜忌，不靠五行旺衰反推补值。
//   3) 纯规则：无随机、无 LLM、无网络；同一输入两次输出字节一致。
//   4) 分段：saying 以「；」分段，段首为 强弱/用神/喜忌 时只读该段；
//      没有段首的叙事体才回退到全文（但先按多命例标记切出本命范围）。
//
// 口径说明：原文是民国子平「格法/官格用印」口径，engine 是「扶抑」口径。
// compare 字段只做机械分类（一致 / 口径差 / 真分歧 / 不可比），不改写原文取值。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileBazi } from './engine.mjs';
import { GAN_WU_XING, ZHI_WU_XING, SHENG, KE } from './constants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

export const CORPUS_PATH = join(ROOT, 'data', 'bazi-corpus', 'paired', 'pillars-sayings.jsonl');
export const GROUNDTRUTH_PATH = join(ROOT, 'data', 'bazi-corpus', 'paired', 'groundtruth.jsonl');

export const WX_ORDER = ['木', '火', '土', '金', '水'];
export const STRONG_WEAK_ENUM = ['强', '弱', '中和', '从格'];
const WX_SET = new Set(WX_ORDER);
const GAN_SET = new Set('甲乙丙丁戊己庚辛壬癸');
const ZHI_SET = new Set('子丑寅卯辰巳午未申酉戌亥');
const PUNCT = new Set('。；，、：,;.');
const SEG_HEADERS = ['强弱', '用神', '喜忌'];

/* ───────────────────────── 基础工具 ───────────────────────── */

const uniqWx = (list) => WX_ORDER.filter((w) => list.includes(w));
const snippet = (text, idx, len = 12, pad = 8) => {
  const a = Math.max(0, idx - pad);
  const b = Math.min(text.length, idx + len + pad);
  return text.slice(a, b).replace(/\s+/g, '');
};

function relWx(dmWx) {
  const yin = Object.keys(SHENG).find((k) => SHENG[k] === dmWx);
  const shi = SHENG[dmWx];
  const cai = KE[dmWx];
  const guan = Object.keys(KE).find((k) => KE[k] === dmWx);
  return { yin, shi, cai, guan, bi: dmWx };
}

/** 十神 → 五行（按日主换算）；返回数组以支持「生扶/帮身」这种组合词 */
function resolveTenGod(term, dmWx) {
  const r = relWx(dmWx);
  if (/^(正印|偏印|印绶|枭神|枭|印|钱绶)$/.test(term)) return [r.yin];
  if (/^(正官|七杀|偏官|官星|官杀|杀|煞|官)$/.test(term)) return [r.guan];
  if (/^(正财|偏财|财星|财)$/.test(term)) return [r.cai];
  if (/^(食神|伤官|食伤|食|伤)$/.test(term)) return [r.shi];
  if (/^(比肩|劫财|比劫|比|劫)$/.test(term)) return [r.bi];
  if (/^(生扶|帮身|帮扶|助身)$/.test(term)) return [r.yin, r.bi];
  return [];
}

// 最长优先；单字放在最后，避免「七杀」被拆成「七」+「杀」
const TEN_GOD_TERMS = [
  '正印', '偏印', '印绶', '枭神', '正官', '七杀', '偏官', '官星', '官杀',
  '正财', '偏财', '财星', '食神', '伤官', '比肩', '劫财', '比劫',
  '生扶', '帮身', '帮扶', '助身', '钱绶',
  '枭', '印', '官', '杀', '煞', '财', '食', '伤', '劫',
];

// 格名专名（只在明确命中格名时用；bare 十神格名不当作 用神）
const SPECIAL_TERMS = [
  ['曲直仁寿', '木'], ['仁寿曲直', '木'], ['曲直', '木'],
  ['炎上', '火'], ['稼穑', '土'], ['从革', '金'], ['润下', '水'],
  ['化火', '火'], ['化木', '木'], ['化水', '水'], ['化金', '金'], ['化土', '土'],
];

/** 从 text[i] 起匹配一个五行 token；不匹配返回 null */
function matchToken(text, i, dmWx) {
  const ch = text[i];
  if (!ch) return null;
  // 天干 + 五行 / 天干 + 十神单字（丙火、戊土、丙杀、丁财）
  if (GAN_SET.has(ch) && i + 1 < text.length) {
    const nx = text[i + 1];
    if (WX_SET.has(nx)) return { wxs: [GAN_WU_XING[ch]], len: 2, kind: 'ganzhi', text: ch + nx };
    if ('杀煞官财印食伤劫比'.includes(nx)) return { wxs: [GAN_WU_XING[ch]], len: 2, kind: 'ganzhi', text: ch + nx };
  }
  // 地支 + 同五行 / 藏干或宫位指示 / 十神字（子印、亥中、寅内、酉金、申宫）
  if (ZHI_SET.has(ch) && i + 1 < text.length) {
    const nx = text[i + 1];
    if (nx === ZHI_WU_XING[ch]) return { wxs: [ZHI_WU_XING[ch]], len: 2, kind: 'zhi', text: ch + nx };
    if ('中内支宫位印财官杀煞食伤比劫神星'.includes(nx)) return { wxs: [ZHI_WU_XING[ch]], len: 2, kind: 'zhi', text: ch + nx };
  }
  // 五行单字
  if (WX_SET.has(ch)) return { wxs: [ch], len: 1, kind: 'wx', text: ch };
  // 十神 / 生扶 / 帮身
  for (const t of TEN_GOD_TERMS) {
    if (text.startsWith(t, i)) {
      const wxs = resolveTenGod(t, dmWx);
      if (wxs.length) return { wxs, len: t.length, kind: 'tenGod', text: t };
    }
  }
  // 格名专名
  for (const [t, wx] of SPECIAL_TERMS) {
    if (text.startsWith(t, i)) return { wxs: [wx], len: t.length, kind: 'special', text: t };
  }
  // 裸天干（庚运、丁之帝旺、壬癸未透）
  if (GAN_SET.has(ch)) return { wxs: [GAN_WU_XING[ch]], len: 1, kind: 'gan', text: ch };
  return null;
}

/**
 * 扫描 window 里的五行组（相邻五行字合并成一组，如「木火」）。
 * 干支 + 紧邻十神标签（甲木伤官 / 戊土劫财）视为同一组，只取干支五行。
 */
function scanGroups(text, dmWx) {
  const groups = [];
  let i = 0;
  let pending = null;
  while (i < text.length) {
    const t = matchToken(text, i, dmWx);
    if (!t) { i++; continue; }
    // 干支 + 紧邻十神标签：只取干支五行，跳过标签
    if ((t.kind === 'ganzhi' || t.kind === 'zhi') && i + t.len < text.length) {
      const nx = matchToken(text, i + t.len, dmWx);
      if (nx && nx.kind === 'tenGod') {
        const g = { wxs: t.wxs.slice(), start: i, end: i + t.len + nx.len, kind: t.kind };
        groups.push(g);
        pending = null;
        i = g.end;
        continue;
      }
    }
    const g = { wxs: t.wxs.slice(), start: i, end: i + t.len, kind: t.kind };
        // 地支 token 不参与相邻合并：寅内丙财 / 亥中甲木 的「支」是定位词，不是并列五行
    const mergeable = pending && pending.end === i &&
      (t.kind === 'wx' || t.kind === 'gan' || t.kind === 'ganzhi') &&
      (pending.kind === 'wx' || pending.kind === 'gan' || pending.kind === 'ganzhi');
    if (mergeable) {
      pending.wxs.push(...g.wxs);
      pending.end = g.end;
    } else {
      groups.push(g);
      pending = g;
    }
    i = g.end;
    if (t.kind === 'tenGod' || t.kind === 'special') pending = null;
  }
  return groups;
}

const NOISE_LEAD = new Set('最所可见逢遇得取用以重厚多旺盛之其此本的是为亦又却独自皆俱均都乃则而运行岁年月日时干支中内宫位星神上下左右前后量邻于坐乎'.split(''));
const isLocatorToken = (t) => t && t.kind === 'zhi' && '中内支宫位'.includes(t.text[1]);

/** 从一段文字开头取第一组五行；允许跳过少量修饰/动词 */
function firstGroupAfter(text, dmWx) {
  for (let i = 0; i < text.length && i <= 8; i++) {
    const ch = text[i];
    if (PUNCT.has(ch) || ch === ' ' || ch === '\n') return null;
    if (/[不非无未岂何难勿莫]/.test(ch)) return null;
    const t = matchToken(text, i, dmWx);
    if (t) {
      // 从 token 起点向后取连续的一组
      const groups = scanGroups(text.slice(i), dmWx);
      if (!groups.length) return t.wxs;
      // 寅内丙财 / 亥中甲木 / 申宫食神：跳过定位词，取它后面的实际五行
      if (isLocatorToken(t)) {
        const next = groups.slice(1).find((g) => g.kind !== 'zhi') ?? groups[1];
        if (next) return next.wxs;
      }
      return groups[0].wxs;
    }
    if (!NOISE_LEAD.has(ch)) return null;
  }
  return null;
}

/** 从一段文字末尾取最可信的一组五行：干支(3) > 十神(2) > 单五行/单天干(1)，同分取更靠后 */
function bestGroupBefore(text, dmWx) {
  const groups = scanGroups(text, dmWx);
  if (!groups.length) return null;
  let best = null;
  for (const g of groups) {
    const locator = g.kind === 'zhi' && '中内支宫位'.includes(text[g.start + 1] ?? '');
    const score = locator ? 1 : g.kind === 'ganzhi' || g.kind === 'zhi' ? 3 : g.kind === 'tenGod' ? 2 : 1;
    if (!best || score >= best.score) best = { wxs: g.wxs, score, start: g.start };
  }
  return best ? best.wxs : null;
}

/* ───────────────────────── 分段 / 本命范围 ───────────────────────── */

export function splitSaying(saying) {
  const rawSegments = String(saying).split('；').map((s) => s.trim()).filter(Boolean);
  const byHeader = { 强弱: [], 用神: [], 喜忌: [] };
  for (const seg of rawSegments) {
    const head = seg.slice(0, 2);
    if (SEG_HEADERS.includes(head)) byHeader[head].push(seg.slice(2).trim());
  }
  return { rawSegments, byHeader };
}

// 同一 saying 里出现「次男/另一女命/婿命/陈姓一命」等时，后文不是本行四柱的命例。
const OTHER_CHART_MARKERS = ['次生男造', '再次之男命', '现又有一命', '另一女命', '尝见有陈姓一命', '盖婿命为', '乃有人坚谓'];

/** 切出本行四柱对应的文本范围（尾部多命例一律丢弃） */
export function rowScope(saying) {
  let end = saying.length;
  for (const m of OTHER_CHART_MARKERS) {
    const i = saying.indexOf(m);
    if (i >= 0 && i < end) end = i;
  }
  return saying.slice(0, end);
}

/** 037 同 saying 讲两人（君 / 贵友）；强弱只取「君」那半，喜忌再用主语过滤。 */
function strongWeakScope(saying) {
  let s = rowScope(saying);
  const i = s.indexOf('贵友');
  if (i >= 0) s = s.slice(0, i);
  return s;
}

/* ───────────────────────── 身强弱 ───────────────────────── */

const CONG_PATTERNS = [
  { re: /从强格|从旺格|专旺格/g, type: '强' },
  { re: /从弱格/g, type: '弱' },
  { re: /从杀格|从官格/g, type: '杀' },
  { re: /从财格/g, type: '财' },
  { re: /从儿格|从伤格|从食伤格/g, type: '儿' },
  { re: /弃命从[财杀儿伤官食]|弃命而从/g, type: 'follow' },
  { re: /曲直仁寿(?:之)?格|仁寿曲直(?:之)?格|曲直(?:之)?格/g, type: '木' },
  { re: /炎上格/g, type: '火' },
  { re: /稼穑格/g, type: '土' },
  { re: /从革格/g, type: '金' },
  { re: /润下格/g, type: '水' },
  { re: /(?:则|当|应)从[伤儿财杀官]/g, type: 'follow' },
  { re: /从格/g, type: 'generic' },
];

function congTypeToWx(type, text, idx, dmWx) {
  const r = relWx(dmWx);
  if (type === '强') return r.bi;
  if (type === '弱') return null;
  if (type === '杀') return r.guan;
  if (type === '财') return r.cai;
  if (type === '儿') return r.shi;
  if (WX_SET.has(type)) return type;
  if (type === 'follow') {
    const around = text.slice(Math.max(0, idx - 10), idx + 14);
    if (around.includes('财')) return r.cai;
    if (/[杀煞官]/.test(around)) return r.guan;
    if (/[伤儿食]/.test(around)) return r.shi;
    if (/[强旺]/.test(around)) return r.bi;
    return null;
  }
  if (type === 'generic') {
    const before = text.slice(Math.max(0, idx - 12), idx);
    if (before.includes('财')) return r.cai;
    if (/[杀煞官]/.test(before)) return r.guan;
    if (/[伤儿食]/.test(before)) return r.shi;
    return null;
  }
  return null;
}

function extractCong(text, dmWx) {
  const found = [];
  for (const { re, type } of CONG_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const idx = m.index;
      const len = m[0].length;
      const before = text.slice(Math.max(0, idx - 8), idx);
      const after = text.slice(idx + len, idx + len + 10);
      // 不用裸「未/无/非」：057「支全亥卯未。为曲直仁寿格」的「未」是地支，不是否定
      const negBefore = /(?:不能|不能作|不作|并非|非是|未可|未必|岂|何曾|难|谬|勉强|若|如|设|倘|或|佥谓|识者|咸谓|咸以|有以|或谓|传闻|不知|假)/.test(before);
      const negAfter = /(?:所大忌|所忌|大忌|不能|非|不真|不确|勉强|则又不真|以较勉强|谬)/.test(after);
      if (negBefore || negAfter) continue;
      // 去重：同一位置只保留信息量更大的匹配
      findDup: {
        for (const f of found) {
          if (Math.abs(f.idx - idx) < 4) break findDup;
        }
        found.push({ idx, len, type, text: m[0] });
      }
    }
  }
  // 「从格」泛称与具体从格同时命中时，优先具体
  const specific = found.filter((f) => f.type !== 'generic' && f.type !== 'follow');
  const list = specific.length ? specific : found;
  if (!list.length) return null;
  list.sort((a, b) => a.idx - b.idx);
  const best = list[list.length - 1];
  const yong = congTypeToWx(best.type, text, best.idx, dmWx);
  return { strongWeak: '从格', yongWx: yong, idx: best.idx, len: best.len, text: best.text };
}

/**
 * 身强弱：优先级 从格 > 明示中和 > 明示强弱 > 技术性描述。
 * 返回 { value, method, raw }，value ∈ 强/弱/中和/从格/null。
 */
function stripQuoteSentences(text) {
  const sents = String(text).split(/(?<=[。；])/);
  const out = [];
  let skip = false;
  for (const s of sents) {
    if (skip) { skip = false; continue; }
    if (/(?:云|所谓)[。：:]?$/.test(s.trim()) || /^(?:书云|有云|所谓|经云|古云|命书|诀云|诗云|喜忌篇云|滴天髓|穷通宝鉴)/.test(s.trim())) {
      skip = true;
      continue;
    }
    out.push(s);
  }
  return out.join('');
}

export function extractStrongWeak(rawText, dmWx) {
  // 古籍引文里的「日干旺甚无依」不是本命判断（030 的喜忌篇引文）
  const text = stripQuoteSentences(rawText);
  const cands = [];
  const add = (value, score, idx, len, label) => cands.push({ value, score, idx, len, label });

  // 0) 从格（单独的否定/归属判断）
  const cong = extractCong(text, dmWx);
  if (cong) add('从格', 100 + (/(?:应作|断为|为.*格|乃.*格)/.test(text.slice(Math.max(0, cong.idx - 8), cong.idx)) ? 5 : 0), cong.idx, cong.len, `从格:${cong.text}`);

  // 1) 明示中和
  for (const m of text.matchAll(/得中和之妙|乃得中和|中和|不强不弱|弱而不弱/g)) {
    add('中和', 95, m.index, m[0].length, m[0]);
  }
  for (const m of text.matchAll(/(?:身主|身|日主|日元|日干)(?:并|亦|却|尚|并|毫)?不(?:为|以)?弱(?:论)?/g)) {
    // 「身主不弱 / 身不为弱 / 不以弱论」：不是弱，但也没到明示强 → 中和
    add('中和', 85, m.index, m[0].length, m[0]);
  }
  for (const m of text.matchAll(/不以弱论/g)) add('中和', 85, m.index, m[0].length, m[0]);
  for (const m of text.matchAll(/两行相停|两行成象|身财两停/g)) add('中和', 80, m.index, m[0].length, m[0]);

  // 2) 明示强（必须锚定 身/日主/日元/日干/身主，避免「财官过强」误判）
  const strongRes = [
    /(?:身|日主|日元|日干|身主)(?:太|甚|极|过|颇|较|很|固|本|则|为|高|既|已|甚为|极为|太过|已是|既得)?(?:强|旺|健|壮|盛|重)(?:有馀|有余|无依)?/g,
    /(?:身|日主|日元|日干|身主)(?:太|甚|极|过|颇|较|高|既)?(?:强|旺|健|壮|盛)/g,
    /日主健甚|身健|身杀两强/g,
    /(?:转|专|化)弱为强/g,
    /以身强论|断为身强|作身强论/g,
  ];
  for (const re of strongRes) {
    for (const m of text.matchAll(re)) {
      // 只在同一小句内看否定/泛论，避免「用神无力。终以…」里的「无」误伤
      const before = text.slice(Math.max(0, m.index - 8), m.index).split(/[。；，]/).pop();
      if (/(?:非|不|未|岂|何|难|微论|无论|不论)/.test(before)) continue;
      add('强', 90, m.index, m[0].length, m[0]);
    }
  }

  // 3) 明示弱
  const weakRes = [
    /(?:身|日主|日元|日干|身主)(?:较|甚|太|极|过|颇|本|固|又|仍|亦|已|则|更)?(?:弱|轻|衰|柔|薄)/g,
    /(?:杀|财|印|官)重身轻/g,
    /(?:财多|财旺|财重).{0,1}身弱/g,
    /身不任财|日主无根|身从死地/g,
    /(?:丙干|日主|日元|日干|身主)?以弱论/g,
    /本当以弱论|应作身弱|应以身弱|弱不堪言|弱中有气|弱而有助/g,
    /寒弱之(?:木|火|土|金|水)/g,
    /(?:秋|春|夏|冬)?([木火土金水])薄弱/g,
    /本身力量太轻|虽曰衰弱|仍嫌柔弱|又兼柔弱/g,
    /弱主(?:得助)?/g,
    /身主.{0,8}一无可恃/g,
    /印重身轻/g,
  ];
  for (const re of weakRes) {
    for (const m of text.matchAll(re)) {
      const before = text.slice(Math.max(0, m.index - 8), m.index).split(/[。；，]/).pop();
      if (/(?:不|非|无|未|岂|何|难|微论|无论|不论)/.test(before)) continue;
      if (/非至弱|尚非至弱/.test(text.slice(Math.max(0, m.index - 3), m.index + m[0].length + 3))) continue;
      const score = /以弱论|弱不堪言|应作身弱|应以身弱/.test(m[0]) ? 92 : 90;
      add('弱', score, m.index, m[0].length, m[0]);
    }
  }

  // 4) 技术性描述（只在没有明示判断时兜底）
  for (const m of text.matchAll(/([甲乙丙丁戊己庚辛壬癸])[金木水火土]?得禄旺/g)) {
    if (GAN_WU_XING[m[1]] === dmWx) add('强', 80, m.index, m[0].length, m[0]);
  }
  for (const m of text.matchAll(/(?:日主|日元|日干|身主|[甲乙丙丁戊己庚辛壬癸]日).{0,12}(?:秉|得).{0,4}旺气/g)) {
    add('强', 78, m.index, m[0].length, m[0]);
  }
  for (const m of text.matchAll(/(?:八字|全局|满盘)([木火土金水])得其[六七]/g)) {
    if (m[1] === dmWx) add('强', 85, m.index, m[0].length, m[0]);
  }
  if (dmWx === '火') {
    for (const m of text.matchAll(/火炎太甚|气焰势足|生火已嫌过多/g)) add('强', 75, m.index, m[0].length, m[0]);
  }

  if (!cands.length) return { value: null, method: '无明文', raw: null };
  // 分数优先；同分取更靠后（原文结论通常在后面）
  cands.sort((a, b) => (b.score - a.score) || (b.idx - a.idx));
  const best = cands[0];
  return { value: best.value, method: `${best.label}@〈${snippet(text, best.idx, best.len)}〉`, raw: snippet(text, best.idx, best.len) };
}

/* ───────────────────────── 用神五行 ───────────────────────── */

function isAttributed(text, idx) {
  const before = text.slice(Math.max(0, idx - 40), idx);
  const lastAttr = Math.max(
    before.lastIndexOf('咸谓'), before.lastIndexOf('识者'), before.lastIndexOf('或谓'),
    before.lastIndexOf('或曰'), before.lastIndexOf('有以'), before.lastIndexOf('佥谓'),
    before.lastIndexOf('客有'), before.lastIndexOf('传闻'),
  );
  if (lastAttr < 0) return false;
  const lastAuthor = Math.max(
    before.lastIndexOf('余曰'), before.lastIndexOf('余谓'), before.lastIndexOf('窃以'),
    before.lastIndexOf('愚见'), before.lastIndexOf('余按'), before.lastIndexOf('余断'),
    before.lastIndexOf('余视'), before.lastIndexOf('殊不知'),
  );
  return lastAuthor < lastAttr;
}

/**
 * 用神：只认明示「用/取…为用/用神/得用/化神/从格」，不把 bare 格名当用神。
 */
export function extractYongWx(text, dmWx) {
  const cands = [];
  const add = (wxs, score, idx, len, label) => {
    const wx = uniqWx(Array.isArray(wxs) ? wxs : [wxs]);
    if (!wx.length) return;
    cands.push({ wx: wx[0], score, idx, len, label, all: wx });
  };
  const r = relWx(dmWx);
  const before = (idx, n = 10) => text.slice(Math.max(0, idx - n), idx);
  const after = (idx, n = 14) => text.slice(idx, idx + n);
  const penalty = (idx) => {
    const b = before(idx, 12);
    let p = 0;
    if (/或|若|如|设|倘|识者|咸谓|咸以|有以|或谓/.test(b) && !/不如|不若/.test(b)) p -= 40;
    if (/不如|不若/.test(b)) p += 20;
    if (isAttributed(text, idx)) p -= 60;
    return p;
  };
  const authorBonus = (idx) => {
    const b = text.slice(0, idx);
    const lastAuthor = Math.max(b.lastIndexOf('余曰'), b.lastIndexOf('余谓'), b.lastIndexOf('窃以'), b.lastIndexOf('愚见'), b.lastIndexOf('余断'));
    return lastAuthor >= 0 ? 10 : 0;
  };

  // A) X为用 / X以为用 / X为用神 / X是用
  for (const m of text.matchAll(/(?:以为用|为用神|为用|是用)/g)) {
    const idx = m.index;
    const b = before(idx, 16);
    const wxs = bestGroupBefore(b, dmWx);
    if (!wxs) continue;
    // 「非用己土以为用」「不能从…为用」：否定候选；「不如…为用」保留
    if (/(?:不能|非|未曾|未|无|岂|难)/.test(b) && !/不如/.test(b)) continue;
    add(wxs, 100 + penalty(idx) + authorBonus(idx), idx, m[0].length, snippet(text, idx, m[0].length));
  }

  // B) X用神（丙火用神 / 己土用神）；跳过「日主用神喜神」这种并列
  for (const m of text.matchAll(/用神/g)) {
    const idx = m.index;
    const b = before(idx, 10);
    if (/日主$/.test(b) || /喜$/.test(text.slice(idx + 2, idx + 4))) continue;
    // 「木之损伤用神」不是 X用神；「戊土虚脱。用神无力」句号后无 X 则跳过；
    // 但「…丙火。丙火用神」的句号后仍有 X，取句号后的尾巴
    const tail = b.split(/[。；，]/).pop();
    if (!tail.trim() || /(?:损伤|损|伤|克|制|破|坏|害|夺)$/.test(tail)) continue;
    const wxs = bestGroupBefore(tail, dmWx);
    if (!wxs) continue;
    add(wxs, 95 + penalty(idx), idx, m[0].length, snippet(text, idx, m[0].length));
  }

  // C) 用神…X（用神应即归诸戊土劫财）
  for (const m of text.matchAll(/用神/g)) {
    const idx = m.index;
    const a = after(idx + 2, 16);
    const wxs = firstGroupAfter(a, dmWx);
    if (!wxs) continue;
    add(wxs, 90 + penalty(idx), idx, m[0].length, snippet(text, idx, m[0].length));
  }

  // D) 用X（用印 / 用杀 / 用财 / 用食 / 用官 / 用劫 / 用偏印…）；排除用事/用神/用情/用武…
  for (const m of text.matchAll(/用(?!事|神|情|武|法|力|心|意|之|于|於|为|作|人|才|处|途|运|得|不)([^。；，]{0,10})/g)) {
    const idx = m.index;
    const a = m[1];
    // 「非用己土」「不用…」是否定；「不得不」是强调，放行
    if (/(?:非|不)$/.test(before(idx, 1)) && !/不得不$/.test(before(idx, 3))) continue;
    const wxs = firstGroupAfter(a, dmWx);
    if (!wxs) continue;
    let score = 80 + penalty(idx) + authorBonus(idx);
    if (/^[兼又亦]/.test(a.trim()) || /[兼又亦]$/.test(before(idx, 2))) score -= 20; // 「兼用杀印」是次要
    add(wxs, score, idx, m[0].length, snippet(text, idx, m[0].length));
  }

  // L) 取X用Y：
  //    「取食用煞印」Y 是煞+印两个辅神 → 用神取 X（食）
  //    「取伤官用财」Y 是单一财 → 用神取 Y（财），X 只是格
  for (const m of text.matchAll(/取([^。；，]{0,6})用([^。；，]{0,6})/g)) {
    if (!m[1].trim()) continue;
    const wxs = bestGroupBefore(m[1], dmWx);
    if (!wxs) continue;
    const yGroups = scanGroups(m[2], dmWx);
    const primary = yGroups.length >= 2 || /(?:煞|杀).{0,2}印|印.{0,2}(?:煞|杀)/.test(m[2]);
    add(wxs, (primary ? 95 : 60) + penalty(m.index) + authorBonus(m.index), m.index, m[0].length, snippet(text, m.index, m[0].length));
  }

  // E) X得用（财星得用）
  for (const m of text.matchAll(/([^。；，]{0,10})得用/g)) {
    const idx = m.index;
    // 「财之得用与否」是泛论，不是本命用神
    if (/^与否/.test(text.slice(idx + m[0].length, idx + m[0].length + 2))) continue;
    const wxs = bestGroupBefore(m[1], dmWx);
    if (!wxs) continue;
    add(wxs, 85 + penalty(idx), idx, m[0].length, snippet(text, idx, m[0].length));
  }

  // F) 所谓用神…舍此莫属（先排除前文候选后的最终定论）
  if (text.includes('舍此莫属')) {
    const idx = text.indexOf('所谓用神');
    if (idx >= 0) {
      const wxs = bestGroupBefore(text.slice(Math.max(0, idx - 40), idx), dmWx);
      if (wxs) add(wxs, 110, idx, 4, snippet(text, idx, 4));
    }
  }

  // G) 从格（从财/从杀/从儿/从伤/曲直…）
  const cong = extractCong(text, dmWx);
  if (cong && cong.yongWx) {
    add([cong.yongWx], 70, cong.idx, cong.len, `从格:${cong.text}`);
  }

  // H) 化神（化火成格 / 纯粹化火之格）
  for (const m of text.matchAll(/化([木火土金水])(?:成格|之格|格)/g)) {
    add([m[1]], 65, m.index, m[0].length, m[0]);
  }

  // I) 透印以解 / 印绶化杀 / 钱绶化杀（OCR）
  for (const m of text.matchAll(/(?:透|用|取)?(?:印绶|钱绶|偏印|正印|印)(?:来|以)?(?:解|化杀|化官|制伤|引化)/g)) {
    if (!m[0].includes('印') && !m[0].includes('绶')) continue;
    // 「乏印绶以制伤」「无印为病」是缺印，不是明示用印
    if (/(?:乏|无|缺|少|不见|没有)/.test(text.slice(Math.max(0, m.index - 8), m.index))) continue;
    add([r.yin], 70, m.index, m[0].length, m[0]);
  }

  // J) 身强/身旺/旺者宜泄 → 食伤
  for (const m of text.matchAll(/(?:身强|身旺|旺者|日元强旺|日主强旺)[^。；]{0,6}宜(?:泄|克|耗)/g)) {
    add([r.shi], 60, m.index, m[0].length, m[0]);
  }

  // K) 取用为妙：前文有「喜X」时，用神取该 X
  if (text.includes('取用为妙')) {
    for (const m of text.matchAll(/喜[^。；]{0,8}/g)) {
      const wxs = firstGroupAfter(m[0].slice(1), dmWx);
      if (wxs) { add(wxs, 55, m.index, m[0].length, `${m[0]}→取用为妙`); break; }
    }
  }

  if (!cands.length) return { value: null, method: '无明文用神', raw: null };
  cands.sort((a, b) => (b.score - a.score) || (b.idx - a.idx));
  const best = cands[0];
  return { value: best.wx, method: `${best.label}@〈${best.all.join('')}〉`, raw: best.label };
}

/* ───────────────────────── 喜忌 ───────────────────────── */

const POS_CUES = ['最喜', '所喜', '喜见', '喜逢', '喜', '最宜', '相宜', '最利', '最贵', '宜'];
const NEG_CUES = ['最忌', '大忌', '忌见', '忌走', '忌逢', '忌', '不宜', '不利', '非所喜', '非喜', '不喜', '不为喜', '恶', '病于', '畏', '泛滥', '憎'];
const POS_SET = new Set(POS_CUES);

const isQuoteSentence = (s) => /^(?:书云|有云|所谓|经云|古云|命书|诀云|诗云|云[：:])/.test(s.trim());
const isHypothetical = (s) => /^(?:若|如|设|倘|或|假|使|假如|设使|若使)/.test(s.trim());
const isAttributedSentence = (s) => /^(?:咸谓|识者|或谓|或曰|客有|传闻|佥谓|有以|前论)/.test(s.trim());

function stripQuoted(text) {
  return text.replace(/“[^”]*”/g, '').replace(/「[^」]*」/g, '');
}

/** 喜忌：只认明示 喜/忌/宜/不宜/不利/病/畏 + 五行/干支/十神 token；不把运程泛语当喜忌。 */
export function extractXiJi(text, dmWx, strongWeak = null) {
  const clean = stripQuoted(text);
  const xi = [];
  const ji = [];
  const xiEv = [];
  const jiEv = [];
  const explicitNone = /(?:固无|无所谓|难论|无从|不辨|不论|无).{0,2}喜忌|喜忌.{0,2}(?:无|难)/.test(clean);
  const addXi = (wxs, ev) => { for (const w of wxs) if (WX_SET.has(w) && !xi.includes(w)) { xi.push(w); xiEv.push(ev); } };
  const addJi = (wxs, ev) => { for (const w of wxs) if (WX_SET.has(w) && !ji.includes(w)) { ji.push(w); jiEv.push(ev); } };
  const ctx = (cue, sentence, idx, len) => {
    const left = sentence.slice(Math.max(0, idx - 6), idx);
    const right = sentence.slice(idx, idx + len + 8);
    return `${cue}〈${(left + right).replace(/\s+/g, '')}〉`;
  };

  const sentences = clean.split(/(?<=[。；])/).filter((s) => s.trim());
  let cursor = 0;
  let hypoCarry = 0;
  for (let si = 0; si < sentences.length; si++) {
    const sentence = sentences[si];
    const offset = clean.indexOf(sentence, cursor);
    if (offset >= 0) cursor = offset + sentence.length;
    if (hypoCarry > 0) { hypoCarry--; continue; }
    if (isQuoteSentence(sentence) || isAttributedSentence(sentence)) continue;
    if (isHypothetical(sentence)) { hypoCarry = 2; continue; }
    if (/微论|无论|不论|不拘/.test(sentence) && /身(?:强|弱)/.test(sentence)) continue;

    // 找出本句所有 cue（最长优先，已消费区间不再重复匹配）
    const used = [];
    const hits = [];
    const allCues = [...NEG_CUES, ...POS_CUES].sort((a, b) => b.length - a.length);
    for (const cue of allCues) {
      let from = 0;
      while (true) {
        const idx = sentence.indexOf(cue, from);
        if (idx < 0) break;
        from = idx + cue.length;
        if (used.some(([a, b]) => idx >= a && idx < b)) continue;
        used.push([idx, idx + cue.length]);
        hits.push({ cue, idx, polarity: POS_SET.has(cue) ? 'pos' : 'neg' });
      }
    }
    hits.sort((a, b) => a.idx - b.idx);

    for (const h of hits) {
      const { cue, idx } = h;
      const pre = sentence.slice(Math.max(0, idx - 4), idx);
      const postChar = sentence[idx + cue.length] ?? '';
      const a = sentence.slice(idx + cue.length, idx + cue.length + 18);
      const b = sentence.slice(Math.max(0, idx - 12), idx);

      // 名词性「喜神/喜忌/忌神」不是喜忌 cue
      if (cue === '喜' && (postChar === '神' || postChar === '忌')) continue;
      if (cue === '忌' && postChar === '神') continue;
      if (cue === '宜' && /不$/.test(pre)) continue;
      if (cue === '利' && /不$/.test(pre)) continue;

      // 主语过滤：贵友/婿/另一女命/次男/陈姓/其友 等不是本行四柱
      if (/贵友|婿|另一女命|次生男|再次|陈姓|现又有一命|其友|彼/.test(sentence.slice(Math.max(0, idx - 14), idx))) continue;
      if (isAttributed(clean, (offset >= 0 ? offset : 0) + idx)) continue;
      // 「水…然亦非所喜」跨句指代不明，宁可不取
      if (cue === '非所喜' && /[，。；]/.test(b)) continue;
      // 「见官本忌…故反吉」：本忌被原文反转，计入喜而非忌（102）
      if (h.polarity === 'neg' && /本忌/.test(sentence) && /反吉/.test(sentences.slice(si, si + 3).join(''))) {
        const wxs = firstGroupAfter(a, dmWx) || bestGroupBefore(b, dmWx);
        if (wxs) { addXi(wxs, `${ctx('本忌', sentence, sentence.indexOf('本忌'), 2)}→反吉`); continue; }
      }

      let polarity = h.polarity;
      // 不喜/非喜/不为喜 已在 NEG 表；不畏/不忌/不为忌 是「否定负面」→ 丢弃
      if (polarity === 'neg' && /^(?:忌|畏|恶)$/.test(cue) && /(?:不为|不|非|无|未|岂|何|难)$/.test(pre)) continue;
      if (polarity === 'neg' && cue === '畏' && /不为$/.test(pre)) continue;
      // 否定正面（不喜/非喜）→ 负面
      if (polarity === 'pos' && /(?:不|非|无|未|岂|何|难)$/.test(pre)) polarity = 'neg';
      // 「之忌」「破财之忌」不向前找元素
      if (polarity === 'neg' && cue === '忌' && /之$/.test(pre) && /破/.test(b)) continue;

      if (polarity === 'pos') {
        // 反语：喜X未透/不见/绝/无 → 忌X
        const absence = /(?:未透|不透|不见|未露|绝|无)/.exec(a);
        if (absence && absence.index <= 6) {
          const preAbs = a.slice(0, absence.index);
          const postAbs = a.slice(absence.index + absence[0].length, absence.index + absence[0].length + 6);
          const w1 = bestGroupBefore(preAbs, dmWx);
          const w2 = firstGroupAfter(postAbs, dmWx);
          const w = w1 || w2;
          if (w) { addJi(w, `${ctx(cue, sentence, idx, cue.length)}${absence[0]}→反语`); continue; }
        }
        // 喜X未透：X 在 absence 词前（壬癸未透）
        const absence2 = /^([^。；，]{0,8}?)(?:未透|不透|不见|未露|绝|无)/.exec(a);
        if (absence2) {
          const w = bestGroupBefore(absence2[1], dmWx);
          if (w) { addJi(w, `${ctx(cue, sentence, idx, cue.length)}${absence2[2]}→反语`); continue; }
        }

        let wxs = firstGroupAfter(a, dmWx);
        let fromNext = false;
        let nextEv = '';
        // 「最可喜者。月干甲木」「行运最利。食伤」：本句句尾无元素，下一短句开头才是
        const nextSentence = sentences[si + 1];
        const nextOk = nextSentence && nextSentence.length <= 14 &&
          !/^(?:遇|逢|见|若|则|而|但|然|惟|独|或)/.test(nextSentence) &&
          !/(?:喜|忌|利|畏|病|不|憎)/.test(nextSentence);
        if (!wxs && nextOk && (!a.trim() || /^[者。\s]/.test(a))) {
          const nw = firstGroupAfter(nextSentence, dmWx);
          if (nw) { wxs = nw; fromNext = true; nextEv = nextSentence.trim(); }
        }
        // 只有「相宜/最利」这类后置判断才回头看；且只看本小句（避免「官星宜露」跨句抓土）
        if (!wxs && (cue === '相宜' || cue === '最利')) {
          wxs = bestGroupBefore(b.split(/[。；，]/).pop(), dmWx);
        }
        // 「身旺印绶亦宜」：句尾的「亦宜」是对前一个十神的补充判断
        if (!wxs && cue === '宜' && /亦$/.test(sentence.slice(Math.max(0, idx - 1), idx))) {
          wxs = bestGroupBefore(b.split(/[。；，]/).pop(), dmWx);
        }
        if (!wxs) continue;
        // 中和命局不把「帮身/生扶」当喜（051：喜帮身…而非中和八字所宜）
        const helper = wxs.includes(relWx(dmWx).yin) && wxs.includes(dmWx);
        if (helper && (strongWeak === '中和' || /非.{0,6}所宜/.test(sentence))) continue;
        addXi(wxs, fromNext ? `${ctx(cue, sentence, idx, cue.length)}→${nextEv}` : ctx(cue, sentence, idx, cue.length));

        // 并列下一句：喜木之泄秀。火之欣发。仅在本句 cue 后没有负面 cue 时延伸
        if (!fromNext && !hits.some((x) => x.polarity === 'neg' && x.idx > idx) && nextOk) {
          const nw = firstGroupAfter(nextSentence, dmWx);
          if (nw) addXi(nw, `${ctx(cue, sentence, idx, cue.length)}→${nextSentence.trim()}`);
        }
      } else {
        // 忌走火入土：capture 直到句末，收集全部
        if (cue === '忌走') {
          const cap = a.split(/[。；]/)[0];
          const gs = scanGroups(cap, dmWx);
          if (gs.length) { addJi(gs.flatMap((g) => g.wxs), ctx('忌走', sentence, idx, 2)); continue; }
        }
        // 「喜润得恶燥」的「恶」修饰的是燥湿，不是五行；不从「戊为阳土」回头抓土
        if (cue === '恶' && /^[燥寒热湿风]/.test(a)) continue;
        let wxs = firstGroupAfter(a, dmWx);
        if (!wxs && cue !== '之忌' && !/破/.test(b)) wxs = bestGroupBefore(b, dmWx);
        // 「火炎太甚。自不为喜」：短句里 12 字窗口不够，扩到全句前 20 字
        if (!wxs && ['不为喜', '非喜', '不喜', '恶', '憎', '泛滥'].includes(cue)) {
          const abs = (offset >= 0 ? offset : 0) + idx;
          wxs = bestGroupBefore(clean.slice(Math.max(0, abs - 20), abs), dmWx);
        }
        if (!wxs) continue;
        addJi(wxs, ctx(cue, sentence, idx, cue.length));
      }
    }
  }

  // 冲突消解：同一五行同时进喜/忌时，保留喜并记录（本语料预计不出现）
  const conflicts = xi.filter((w) => ji.includes(w));
  if (conflicts.length) {
    for (const w of conflicts) {
      const k = ji.indexOf(w); if (k >= 0) ji.splice(k, 1);
    }
  }

  const fin = (arr, evs, name) => {
    if (arr.length) return { value: uniqWx(arr), method: `${name}=[${uniqWx(arr).join(',')}]@${[...new Set(evs)].slice(0, 3).join('|')}` };
    if (explicitNone) return { value: [], method: `${name}=[]@明示无喜忌` };
    return { value: null, method: `${name}=null@无明文` };
  };
  const fx = fin(xi, xiEv, 'xiSet');
  const fj = fin(ji, jiEv, 'jiSet');
  return { xiSet: fx.value, jiSet: fj.value, method: `${fx.method}; ${fj.method}`, raw: null };
}

/* ───────────────────────── 记录组装 ───────────────────────── */

const VERDICT_MAP = {
  身旺: '强', 身弱: '弱', 中和偏旺: '中和', 中和偏弱: '中和', 从强格: '从格', 从弱格: '从格',
};

function compareRecord(rec, engine) {
  const ev = engine.L3_verdict.verdict;
  const engSw = VERDICT_MAP[ev] ?? null;
  const engYong = engine.L5_yongJi.yong ?? null;
  const engJi = engine.L5_yongJi.ji ?? null;
  let swCmp = '不可比';
  if (rec.strongWeak != null && engSw != null) swCmp = rec.strongWeak === engSw ? '一致' : '分歧';
  let yongCmp = '不可比';
  if (rec.yongWx != null && engYong != null) {
    if (rec.yongWx === engYong) yongCmp = '一致';
    else if ((rec.jiSet ?? []).includes(engYong) || (rec.jiSet ?? []).includes(rec.yongWx)) yongCmp = '真分歧';
    else yongCmp = '口径差';
  }
  const reason = `引擎 ${ev}/${engYong ?? '?'}忌${engJi ?? '?'}；原文 ${rec.strongWeak ?? 'null'}/${rec.yongWx ?? 'null'}`;
  return { strongWeak: swCmp, yongWx: yongCmp, reason };
}

export function extractRecord(row) {
  const saying = row.saying;
  const scope = rowScope(saying);
  const segments = splitSaying(saying);
  const pillars = String(row.pillars).trim().split(/\s+/);
  if (pillars.length !== 4) throw new Error(`${row.id}: 需要 4 柱，实得 ${pillars.length}`);
  const engine = compileBazi({ pillars });
  const dmWx = GAN_WU_XING[pillars[2][0]];

  // 分段：有段首只读该段；没有段首才回退到本命范围全文
  const segText = (head) => (segments.byHeader[head].length ? segments.byHeader[head].join('。') : null);
  const strongText = segText('强弱') ?? strongWeakScope(saying);
  const yongText = segText('用神') ?? scope;
  const xijiText = segText('喜忌') ?? scope;

  // 多命例/双人同 saying：method 里登记「本命范围」，不把别造的论断算进来
  const cutMarkers = OTHER_CHART_MARKERS.filter((m) => saying.includes(m));
  const strongCut = strongWeakScope(saying) !== scope;
  const scopeLabel = cutMarkers.length ? '本命范围' : '全文';
  const strongScopeLabel = strongCut ? '本命范围' : scopeLabel;
  const scopeNote = (cutMarkers.length || strongCut)
    ? `scope=cut(${[...cutMarkers, ...(strongCut ? ['贵友'] : [])].join('|')})`
    : '';

  const sw = extractStrongWeak(strongText, dmWx);
  const yong = extractYongWx(yongText, dmWx);
  const xj = extractXiJi(xijiText, dmWx, sw.value);

  const method = [
    `strongWeak=${sw.value ?? 'null'}@${segments.byHeader['强弱'].length ? '段〈强弱〉' : strongScopeLabel}${sw.raw ? '〈' + sw.raw + '〉' : ''}`,
    `yongWx=${yong.value ?? 'null'}@${segments.byHeader['用神'].length ? '段〈用神〉' : scopeLabel}${yong.raw ? '〈' + String(yong.raw).slice(0, 40) + '〉' : ''}`,
    xj.method,
    scopeNote,
  ].filter(Boolean).join('; ');

  const rec = {
    id: row.id,
    strongWeak: sw.value,
    yongWx: yong.value,
    xiSet: xj.xiSet,
    jiSet: xj.jiSet,
    method,
    raw: saying,
    compare: compareRecord({ strongWeak: sw.value, yongWx: yong.value, xiSet: xj.xiSet, jiSet: xj.jiSet }, engine),
  };
  return rec;
}

export function readCorpus() {
  return readFileSync(CORPUS_PATH, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
}

export function extractAll(rows = readCorpus()) {
  return rows.map(extractRecord);
}

export function buildGroundtruthText(rows = readCorpus()) {
  const recs = extractAll(rows);
  return recs.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function main() {
  const text = buildGroundtruthText();
  writeFileSync(GROUNDTRUTH_PATH, text, 'utf8');
  const lines = text.trim().split('\n');
  const counts = { strongWeak: 0, yongWx: 0, xiSet: 0, jiSet: 0 };
  for (const line of lines) {
    const r = JSON.parse(line);
    if (r.strongWeak != null) counts.strongWeak++;
    if (r.yongWx != null) counts.yongWx++;
    if (r.xiSet != null) counts.xiSet++;
    if (r.jiSet != null) counts.jiSet++;
  }
  console.log(`已写入 ${lines.length} 行 → ${GROUNDTRUTH_PATH}`);
  console.log(`非 null 覆盖：strongWeak ${counts.strongWeak}/108；yongWx ${counts.yongWx}/108；xiSet ${counts.xiSet}/108；jiSet ${counts.jiSet}/108`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
