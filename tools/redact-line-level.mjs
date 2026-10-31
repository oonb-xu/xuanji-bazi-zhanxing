import fs from 'node:fs';

const FIX = [
  /* 案例001 是真实案例 ⇒ 城市与经度去掉 */
  ['docs/11-星盘反推八字-生时校正.md',
    '**数值证明**（案例001，成都 104.06E，2007-12-25 17:30）：',
    '**数值证明**（案例001，出生地已脱敏，时刻已脱敏）：'],
  /* docs/32：A/B 是当年的表单默认占位盘（表单默认值已改为 2000-01-01），城市改为某市并标注合成 */
  ['docs/32-十神行星条件映射.md',
    '| **A（北京 1990-03-15 12:00）** |',
    '| **A（合成盘 · 某市 1990-03-15 12:00）** |'],
  ['docs/32-十神行星条件映射.md',
    '| **B（上海 1992-08-20 12:00）** |',
    '| **B（合成盘 · 某市 1992-08-20 12:00）** |'],
];

let ok = 0;
for (const [f, a, b] of FIX) {
  if (!fs.existsSync(f)) { console.log('⚠️ 缺 ' + f); continue; }
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes(a)) { console.log('⚠️ 未匹配：' + f + ' :: ' + a.slice(0, 40)); continue; }
  t = t.split(a).join(b);
  fs.writeFileSync(f, t, 'utf8');
  ok++;
}
console.log('✅ 行级脱敏 ' + ok + '/' + FIX.length + ' 处');

/* docs/32 说明改用"合成盘"措辞 */
{
  const f = 'docs/32-十神行星条件映射.md';
  let t = fs.readFileSync(f, 'utf8');
  if (!t.includes('本表 A/B 为合成盘')) {
    const firstTable = t.indexOf('| **A（合成盘');
    if (firstTable > 0) {
      t = t.slice(0, firstTable) +
        '> 说明：下表 A / B 为**合成占位盘**（原为表单默认值），城市与人物均不对应真实个体。\n\n' +
        t.slice(firstTable);
      fs.writeFileSync(f, t, 'utf8');
      console.log('✅ docs/32 已加「合成占位盘」说明');
    }
  }
}

/* data/cross/permutation.json 的 IDCARD 是长数字误判 → 白名单 */
{
  let a = fs.readFileSync('.privacy-allowlist', 'utf8');
  if (!a.includes('data/cross/')) {
    a = a.trimEnd() + '\n\n# ── 排列检验输出中的长数字串被误判为身份证号（非个人数据）──\ndata/cross/*.json\n';
    fs.writeFileSync('.privacy-allowlist', a, 'utf8');
    console.log('✅ 白名单已加 data/cross/*.json（长数字误判说明）');
  }
}
