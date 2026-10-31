// ① 导航去掉「矫正」 ② 融合/合盘内嵌「生时矫正」入口（弹层） ③ 合盘加「事例」采集并上交训练样本
import fs from 'node:fs';
const P = 'web/index.html';
let h = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak11', h, 'utf8');

/* ══════ ① 删除导航里的「矫正」按钮 ══════ */
const navBtn = '<button data-go="rectify"><span>⌛</span>矫正</button>';
if (!h.includes(navBtn)) { console.error('❌ 找不到矫正导航按钮'); process.exit(1); }
h = h.replace(navBtn, '');
console.log('✅ 导航已移除「矫正」（8 项：圆盘/融合/合盘/六壬/时序/关于/查表/反馈）');

/* ══════ ② 在融合页与合盘页插入「生时矫正」触发条 ══════ */
const TRIGGER = `
      <div class="rx-trigger">
        <button type="button" class="rx-open-btn" data-rx-open>⌛ 生时不确定？矫正一下</button>
        <span class="mut2">用 3 条以上人生事件反推出生时刻，结果可直接排盘</span>
      </div>`;

function insertAfterForm(pageId) {
  const key = 'id="' + pageId + '"';
  const fi = h.indexOf(key);
  if (fi < 0) throw new Error('找不到表单 ' + pageId);
  const fe = h.indexOf('</form>', fi);
  if (fe < 0) throw new Error('找不到 </form> ' + pageId);
  const at = fe + '</form>'.length;
  h = h.slice(0, at) + TRIGGER + h.slice(at);
}
insertAfterForm('f-fusion');
insertAfterForm('f-synastry');
console.log('✅ 融合页 / 合盘页 已插入矫正入口');

/* ══════ ③ 合盘页插入「事例」采集卡（放在 </form> 之后、结果容器之前） ══════ */
const SYN_CARD = `

      <div class="card" id="syn-events-card">
        <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;color:#5ef1ff;letter-spacing:.04em">
          你们之间发生过的事 <span class="mut2" style="font-weight:400;font-size:11.5px">可选 · 作为训练样本</span>
        </h3>
        <p class="note" style="margin:0 0 10px">
          吵架、分离、复合、异地、升职、生孩子、搬家、丧亲…… 写清<b>发生了什么</b>与<b>大概哪一年</b>。
          训练里真正有用的是「<b>出生时间 + 事例</b>」这一对，断语本身并不重要。
        </p>
        <div class="rx-events-head">
          <span>事例（越具体越有价值）</span>
          <button type="button" id="syn-add-ev" class="rx-add">＋ 加一条</button>
        </div>
        <div id="syn-events" class="rx-events"></div>
        <button type="button" id="syn-submit" class="rx-add" style="margin-top:12px">上交样本（出生时间 + 事例）</button>
        <div id="syn-sample-out" class="mut2" style="margin-top:8px;font-size:12px"></div>
      </div>`;

const synKey = 'id="f-synastry"';
const sf = h.indexOf(synKey);
const sfe = h.indexOf('</form>', sf) + '</form>'.length;
/* 跳过刚插入的 trigger，插到 trigger 之后 */
const trigAfter = h.indexOf('</div>', h.indexOf('rx-trigger', sfe)) + '</div>'.length;
h = h.slice(0, trigAfter) + SYN_CARD + h.slice(trigAfter);
console.log('✅ 合盘页已插入「事例」采集卡');

/* ══════ ④ 引入两个新脚本 ══════ */
const bodyEnd = h.lastIndexOf('</body>');
h = h.slice(0, bodyEnd)
  + '  <script src="/rectify-embed.js"></script>\n'
  + '  <script src="/synastry-events.js"></script>\n'
  + h.slice(bodyEnd);
console.log('✅ 已引入 rectify-embed.js / synastry-events.js');

fs.writeFileSync(P, h, 'utf8');
console.log('index.html 大小', h.length);

/* ══════ ⑤ 校验 ══════ */
const c = (s, re) => (s.match(re) || []).length;
let bad = 0;
console.log('\n=== 校验 ===');
for (const [n, o, cl] of [['div', /<div\b/g, /<\/div>/g], ['form', /<form\b/g, /<\/form>/g],
  ['section', /<section\b/g, /<\/section>/g], ['button', /<button\b/g, /<\/button>/g],
  ['h3', /<h3\b/g, /<\/h3>/g], ['p', /<p\b/g, /<\/p>/g], ['span', /<span\b/g, /<\/span>/g]]) {
  const ok = c(h, o) === c(h, cl);
  if (!ok) bad++;
  console.log(`  ${n.padEnd(8)} ${c(h, o)}/${c(h, cl)} ${ok ? '✅' : '❌'}`);
}
const chk = [
  ['导航无 rectify', !h.includes('data-go="rectify"')],
  ['融合页有入口', (h.match(/data-rx-open/g) || []).length === 2],
  ['合盘有事例卡', h.includes('id="syn-events"')],
  ['有上交按钮', h.includes('id="syn-submit"')],
  ['脚本已引用', h.includes('/rectify-embed.js') && h.includes('/synastry-events.js')],
];
for (const [n, ok] of chk) { if (!ok) bad++; console.log(`  ${ok ? '✅' : '❌'} ${n}`); }

if (bad) { console.error('\n❌ 校验未过，不写盘'); process.exit(1); }
console.log('\n✅ 全部通过');
