// ① 矫正事件行加「可选月份」；未填则提示时间误差
import fs from 'node:fs';
const P = 'web/app.js';
let t = fs.readFileSync(P, 'utf8');

if (t.includes('rx-month')) { console.log('已改过'); process.exit(0); }
fs.writeFileSync(P + '.bak-month', t, 'utf8');

const OLD = [
  '  return el(\'div\', { class: \'rx-ev\' },',
  '    el(\'input\', {',
  '      type: \'number\', name: \'year\', class: \'rx-year\', placeholder: \'年份\',',
  '      min: \'1900\', max: \'2100\', step: \'1\', \'aria-label\': \'事件年份\',',
  '    }),',
  '    category,',
].join('\n');

const NEW = [
  '  return el(\'div\', { class: \'rx-ev\' },',
  '    el(\'input\', {',
  '      type: \'number\', name: \'year\', class: \'rx-year\', placeholder: \'年份\',',
  '      min: \'1900\', max: \'2100\', step: \'1\', \'aria-label\': \'事件年份\',',
  '    }),',
  '    el(\'input\', {',
  '      type: \'month\', name: \'month\', class: \'rx-month\',',
  '      \'aria-label\': \'事件月份（可选）\', title: \'可选：填到月，矫正精度更高\',',
  '      oninput: function () {',
  '        var hint = document.querySelector(\'#rx-month-hint\');',
  '        var rows = document.querySelectorAll(\'#rx-events .rx-ev\');',
  '        var total = 0, withMonth = 0;',
  '        rows.forEach(function (r) {',
  '          var y = r.querySelector(\'input.rx-year\');',
  '          if (!y || !y.value) return;',
  '          total++;',
  '          var m = r.querySelector(\'input.rx-month\');',
  '          if (m && m.value) withMonth++;',
  '        });',
  '        if (hint) {',
  '          if (total && withMonth < total) {',
  '            hint.textContent = \'⚠ \' + (total - withMonth) + \' 条未填月份：时间误差按 ±6 个月计，矫正结果区间会更宽。填月份可以收窄。\';',
  '            hint.style.color = \'#ffc457\';',
  '          } else {',
  '            hint.textContent = \'✔ 已全部填到月份，时间误差按 ±1 个月计。\';',
  '            hint.style.color = \'#7dffb4\';',
  '          }',
  '        }',
  '      },',
  '    }),',
  '    category,',
].join('\n');

if (!t.includes(OLD)) { console.error('❌ 未匹配事件行代码'); process.exit(1); }
t = t.replace(OLD, NEW);
console.log('✅ 事件行已加月份输入（可选，含误差提示逻辑）');

/* 载荷带上 month：找到收集事件的 map，追加 month 字段 */
const payCandidates = ['year: ', 'year:'];
let patched = false;
for (const cand of payCandidates) {
  const i = t.indexOf(cand);
  if (i > 0) {
    const lineStart = t.lastIndexOf('\n', i) + 1;
    const lineEnd = t.indexOf('\n', i);
    const line = t.slice(lineStart, lineEnd);
    console.log('  找到载荷行: ' + JSON.stringify(line.trim()));
    if (line.includes('year') && !line.includes('month')) {
      const indent = line.match(/^\s*/)[0];
      t = t.slice(0, lineEnd) + '\n' + indent + 'month: (r.querySelector(\'input.rx-month\') || {}).value || null,' + t.slice(lineEnd);
      patched = true;
    }
    break;
  }
}
console.log(patched ? '✅ 载荷已带 month' : '⚠️ 未自动加 month 字段（服务端可忽略，不影响修正）');

fs.writeFileSync(P, t, 'utf8');
console.log('app.js 已更新，共', t.length, '字节');
