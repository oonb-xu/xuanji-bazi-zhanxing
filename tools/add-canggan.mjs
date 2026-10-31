// 四柱加入「地支藏气」并重排版：
//  1. 内置藏干表（本气/中气/余气）+ 十神计算
//  2. pillarsEl 在每个地支下渲染藏气（带五行与十神）
//  3. 新增 .cang 样式，卡片加高、层次更清
import fs from 'node:fs';

let js = fs.readFileSync('web/app.js', 'utf8');
if (js.includes('CANG_TABLE')) { console.log('藏气已存在，跳过'); process.exit(0); }

/* ① 在 pillarsEl 之前插入藏干表与十神函数 */
const OLD_MARK = '/** 四柱小部件（renderBazi 与 renderSynastry 共用） */';
const INJECT = `/** 地支藏干（本气 / 中气 / 余气），顺序即权重 */
const CANG_TABLE = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const CANG_LV = ['本气', '中气', '余气'];
const _GANWX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const _YANG = new Set(['甲', '丙', '戊', '庚', '壬']);

/** 十神（相对日干；带阴阳才能分出食神/伤官、正官/七杀） */
function _tenGod(gan, dmGan) {
  const wa = _GANWX[gan], wd = _GANWX[dmGan];
  if (!wa || !wd) return null;
  const same = _YANG.has(gan) === _YANG.has(dmGan);
  const S = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // 生
  const K = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };   // 克
  if (wa === wd) return same ? '比肩' : '劫财';
  if (S[wa] === wd) return same ? '偏印' : '正印';
  if (S[wd] === wa) return same ? '食神' : '伤官';
  if (K[wd] === wa) return same ? '偏财' : '正财';
  return same ? '七杀' : '正官';
}

/** 四柱小部件（renderBazi 与 renderSynastry 共用） */`;

js = js.replace(OLD_MARK, INJECT);

/* ② 改造 pillarsEl：在地支下方渲染藏气 */
const OLD_PILLARS = `      box.append(el('div', { class: 'gz' + (gwx ? ' wx-' + gwx : '') }, s));
      box.append(el('div', { class: 'wx' },
        \`\${gwx ? gan + gwx : gan + '(五行未知)'} · \${zwx ? zhi + zwx : zhi + '(五行未知)'}\`));`;

const NEW_PILLARS = `      box.append(el('div', { class: 'gz' + (gwx ? ' wx-' + gwx : '') }, s));
      box.append(el('div', { class: 'wx' },
        \`\${gwx ? gan + gwx : gan + '(五行未知)'} · \${zwx ? zhi + zwx : zhi + '(五行未知)'}\`));
      // ★ 地支藏气：本气/中气/余气，各带五行与十神
      const cangList = CANG_TABLE[zhi];
      if (cangList && cangList.length) {
        const dmGan = Array.isArray(pillars) && typeof pillars[2] === 'string' ? pillars[2][0] : null;
        const cangBox = el('div', { class: 'cang' });
        cangBox.append(el('div', { class: 'cang-h' }, '藏气'));
        cangList.forEach((cg, ci) => {
          const cwx = _GANWX[cg] ?? null;
          const tg = dmGan ? _tenGod(cg, dmGan) : null;
          cangBox.append(el('div', { class: 'cang-i' },
            el('span', { class: 'cang-g' + (cwx ? ' wx-' + cwx : '') }, cg),
            el('span', { class: 'cang-wx' }, cwx ?? '?'),
            tg ? el('span', { class: 'cang-tg' }, tg) : null,
            el('span', { class: 'cang-lv' }, CANG_LV[ci] ?? '')));
        });
        box.append(cangBox);
      }`;

if (!js.includes(OLD_PILLARS)) {
  console.error('未匹配 pillarsEl 内部片段（可能格式不同），未修改渲染');
  process.exit(1);
}
js = js.replace(OLD_PILLARS, NEW_PILLARS);

fs.writeFileSync('web/app.js', js, 'utf8');
console.log('app.js：藏干表 + pillarsEl 藏气渲染 已注入');

/* ③ 样式：卡片加高 + 藏气行 */
let css = fs.readFileSync('web/style.css', 'utf8');
if (!css.includes('.cang-h')) {
  css += `

/* ══════════ 四柱：地支藏气（重排版） ══════════ */
.pil{padding:10px 8px 9px;display:flex;flex-direction:column;gap:3px}
.pil .p{font-size:10px;letter-spacing:.5px}
.pil .gz{font-size:24px;letter-spacing:2px;line-height:1.15}
.pil .wx{font-size:11px;color:var(--dim);margin-bottom:2px}
.cang{margin-top:5px;padding-top:6px;border-top:1px dashed var(--line);text-align:left}
.cang-h{font-size:9px;color:var(--faint);letter-spacing:1px;margin-bottom:3px}
.cang-i{display:grid;grid-template-columns:auto auto 1fr auto;gap:4px;align-items:center;font-size:10px;line-height:1.5}
.cang-g{font-weight:600;font-size:12px}
.cang-wx{color:var(--faint)}
.cang-tg{color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cang-lv{color:var(--faint);font-size:9px;opacity:.75}
@media(max-width:560px){.cang-i{font-size:9px}.pil .gz{font-size:20px}}
`;
  fs.writeFileSync('web/style.css', css, 'utf8');
  console.log('style.css：藏气样式已加');
} else console.log('样式已存在');
