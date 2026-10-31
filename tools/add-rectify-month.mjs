// ① 矫正事件行加「可选月份」；未填则提示时间误差（±6 个月）
import fs from 'node:fs';
const P = 'web/app.js';
let t = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-month', t, 'utf8');

if (t.includes('rx-month')) { console.log('已改过'); process.exit(0); }

/* ── 在 year 输入后插入月份输入（type=month，可空） ── */
const oldRow = `  return el('div', { class: 'rx-ev' },
    el('input', {
      type: 'number', name: 'year', class: 'rx-year', placeholder: '年份',
      min: '1900', max: '2100', step: '1', 'aria-label': '事件年份',
    }),
    category,`;
const newRow = `  return el('div', { class: 'rx-ev' },
    el('input', {
      type: 'number', name: 'year', class: 'rx-year', placeholder: '年份',
      min: '1900', max: '2100', step: '1', 'aria-label': '事件年份',
    }),
    el('input', {
      type: 'month', name: 'month', class: 'rx-month',
      'aria-label': '事件月份（可选，填了更准）', title: '可选：填到月，矫正精度更高',
      oninput: () => {
        const row = document.querySelector('.rx-ev input.rx-month');
        const hint = document.querySelector('#rx-month-hint');
        if (!hint) return;
        const anyEmpty = [...document.querySelectorAll('#rx-events input.rx-month')].some((x) => !x.value);
        hint.style.color = anyEmpty ? '#ffc457' : 'rgba(160,200,225,.75)';
      },
    }),
    category,`;
if (!t.includes(oldRow)) { console.error('❌ 未匹配事件行代码'); process.exit(1); }
t = t.replace(oldRow, newRow);
console.log('✅ 事件行已加月份输入（可选）');

/* ── rectifyPayload 带上 month ── */
const oldPay = `        year:`,
const pi = t.indexOf(oldPay);
if (pi > 0) {
  console.log('  载荷附近片段: ' + JSON.stringify(t.slice(pi - 200, pi + 120).replace(/\s+/g, ' ')));
}

fs.writeFileSync(P, t, 'utf8');
console.log('app.js 已更新，共', t.length, '字节');
