// 导出术语查表数据（辅助定义必须在使用之前，避免 TDZ）
import fs from 'node:fs';
import { QIZHENG, SIYU, ZIWEI_STARS, SIHUA, ZHI_SIGN, HOUSE_DOMAIN, FOUR_SYSTEM_MAP } from '../src/cross/four-systems.mjs';
import { ADVANTAGES, COUPLING_TABLE, FUSION_LAYERS, BRIGHTNESS_LEVELS } from '../src/cross/system-advantages.mjs';
import { ZIWEI_BRIGHTNESS, ZHI12, XIU28, SIGN_TO_ZHI_YUEJIAN, DATA_STATUS } from '../src/cross/ziwei-brightness.mjs';
import { MULTI_MAP } from '../src/cross/dynamic-ten-god.mjs';
import { SHENSHA } from '../src/bazi/shensha.mjs';

/* ══════════ 辅助（先定义）══════════ */
const G5 = ['比劫', '印', '食伤', '财', '官杀'];

function topTg(m) {
  return G5.reduce((a, g) => ((m[g] || 0) > (m[a] || 0) ? g : a), G5[0]);
}
function tgLine(m) {
  return G5.filter((g) => m[g]).map((g) => `${g}${(m[g] * 100).toFixed(0)}%`).join('·');
}

const PLANET_PLAIN = {
  太阳: '你自己、你想成为的样子', 月亮: '你的情绪、你需要的安全感', 水星: '你怎么想、怎么说话',
  金星: '你喜欢什么、你的钱与情', 火星: '你怎么出手、怎么争', 木星: '你在哪变大、你信什么',
  土星: '你在哪受约束、你必须扛什么', 天王星: '你在哪反常、不肯按规矩来',
  海王星: '你在哪模糊、沉溺或升华', 冥王星: '你在哪被彻底改造', 凯龙: '你的旧伤口与修复方式',
};
const plainOfPlanet = (p) => PLANET_PLAIN[p] || '—';
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];

/* ══════════ 收集词条 ══════════ */
const entries = [];
const add = (e) => entries.push(e);

for (const [zh, v] of Object.entries(QIZHENG)) {
  add({ term: zh, system: '七政四余', kind: '七政', tg: MULTI_MAP[v.planet] ? topTg(MULTI_MAP[v.planet]) : '—', as: v.planet, plain: plainOfPlanet(v.planet), note: v.note });
}
for (const [zh, v] of Object.entries(SIYU)) {
  add({ term: zh, system: '七政四余', kind: '四余', tg: '—', as: v.calc, plain: v.note, note: '印度名：' + v.graha });
}
for (const [p, m] of Object.entries(MULTI_MAP)) {
  add({ term: p, system: '古典占星', kind: '行星', tg: topTg(m), as: p, plain: plainOfPlanet(p), note: '十神配比：' + tgLine(m) });
}
for (const [zh, v] of Object.entries(ZIWEI_STARS)) {
  add({ term: zh, system: '紫微斗数', kind: '主星', tg: v.tg, as: v.astro, plain: v.plain, note: '近占星：' + v.astro });
}
for (const [zh, v] of Object.entries(SIHUA)) {
  add({ term: zh, system: '紫微斗数', kind: '四化', tg: v.tg, as: zh, plain: v.plain, note: '' });
}
for (const s of SIGNS) {
  const yj = Object.entries(ZHI_SIGN.yuejiang).find(([, v]) => v === s);
  const mj = Object.entries(ZHI_SIGN.yuejian).find(([, v]) => v === s);
  add({
    term: s, system: '古典占星', kind: '星座', tg: '—',
    as: `${yj?.[0] ?? '?'}将 / ${mj?.[0] ?? '?'}建`,
    plain: '黄道 30° 段',
    note: `紫微宫支：${SIGN_TO_ZHI_YUEJIAN[s]}`,
  });
}
for (let h = 1; h <= 12; h++) {
  const d = HOUSE_DOMAIN[h];
  add({ term: `第${h}宫`, system: '古典占星', kind: '宫位', tg: '—', as: d.astro, plain: d.plain, note: `紫微：${d.ziwei}宫` });
  add({ term: d.ziwei, system: '紫微斗数', kind: '宫位', tg: '—', as: `第${h}宫`, plain: d.plain, note: `占星：${d.astro}` });
}
for (const x of XIU28) {
  add({ term: `${x.name}宿`, system: '七政四余', kind: '星宿', tg: '—', as: x.name, plain: `黄道宿度 ${x.deg}°`, note: '二十八宿之一' });
}
for (const [zh, v] of Object.entries(SHENSHA)) {
  add({ term: zh, system: '八字', kind: '神煞', tg: '—', as: v.axis, plain: (v.psych || []).join('、'), note: '占星签名：' + (v.astro?.note || '') });
}

/* ══════════ 写数据 ══════════ */
const payload = {
  generatedAt: new Date().toISOString(),
  dataStatus: DATA_STATUS,
  count: entries.length,
  entries,
  fourSystems: FOUR_SYSTEM_MAP,
  advantages: Object.entries(ADVANTAGES).map(([k, v]) => ({ system: k, ...v })),
  coupling: COUPLING_TABLE,
  fusion: FUSION_LAYERS,
  ziwei: { levels: BRIGHTNESS_LEVELS, zhi12: ZHI12, table: ZIWEI_BRIGHTNESS },
};
fs.writeFileSync('web/glossary-data.json', JSON.stringify(payload), 'utf8');
console.log(`① glossary-data.json：${entries.length} 条，${(JSON.stringify(payload).length / 1024).toFixed(1)} KB`);

const bySys = {};
for (const e of entries) bySys[e.system] = (bySys[e.system] || 0) + 1;
console.log('   分布：', Object.entries(bySys).map(([k, v]) => `${k}${v}`).join(' / '));

const dup = entries.map((e) => e.term).filter((t, i, a) => a.indexOf(t) !== i);
console.log(`   重复：${dup.length ? [...new Set(dup)].join(',') : '无'}`);
console.log(`   每套体系词条数 > 0：${Object.values(bySys).every((v) => v > 0)}`);
