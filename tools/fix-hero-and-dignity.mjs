// ① nav-guard：切页时隐藏 hero（否则首屏占满视口，切页看不出变化）
import fs from 'node:fs';

let nav = fs.readFileSync('web/nav-guard.js', 'utf8');
if (!nav.includes('hideHero')) {
  nav = nav.replace(
    `  function switchPage(go) {
    if (go === 'stage') {
      const hero = document.querySelector('#stage-hero');
      if (hero) hero.scrollIntoView({ behavior: 'smooth' });
      return true;
    }`,
    `  function hideHero(hide) {
    var hero = document.querySelector('#stage-hero');
    if (!hero) return;
    hero.style.display = hide ? 'none' : '';
    // 让顶栏固定（hero 隐藏后页面就能贴顶）
    var main = document.querySelector('#main');
    if (main) main.style.paddingTop = hide ? '0' : '';
  }

  function switchPage(go) {
    if (go === 'stage') {
      hideHero(false);
      var h = document.querySelector('#stage-hero');
      if (h) h.scrollIntoView({ behavior: 'smooth' });
      document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
      document.querySelectorAll('.tabbar button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.go === 'stage');
      });
      return true;
    }
    hideHero(true);`
  );
  if (!nav.includes('hideHero(true)')) { console.error('❌ 替换失败'); process.exit(1); }
  fs.writeFileSync('web/nav-guard.js', nav, 'utf8');
  console.log('① nav-guard 已修：切页时隐藏 hero');
} else console.log('① 已修');

/* ② dignity-panel：加入偶然尊贵 */
let dp = fs.readFileSync('web/dignity-panel.js', 'utf8');
if (!dp.includes('accidentalDignity')) {
  dp = dp.replace(
    "function dignityOf(name, sign) {",
    `// ★ 偶然尊贵（古典占星）：用现有数据可算的项
//   宫位档 / 顺逆行 / 日光灼伤·光束下 / 东出西入 / 月相增损
function accidentalDignity(p, sun, moon) {
  const out = [];
  let score = 0;

  // 1) 宫位档
  const h = p.house;
  if (h === 1 || h === 4 || h === 7 || h === 10) { out.push(['角宫(强)', +3]); score += 3; }
  else if (h === 2 || h === 5 || h === 8 || h === 11) { out.push(['续宫(中)', +1]); score += 1; }
  else if (h) { out.push(['果宫(弱)', -2]); score -= 2; }

  // 2) 顺行 / 逆行
  if (p.retro === true) { out.push(['逆行', -2]); score -= 2; }
  else if (p.retro === false) { out.push(['顺行', +2]); score += 2; }

  // 3) 与太阳的距角：灼伤 / 光束下 / 东出西入
  if (sun && typeof p.lon === 'number') {
    let d = (p.lon - sun.lon + 360) % 360;
    const sep = d > 180 ? 360 - d : d;
    if (p.name !== '太阳') {
      if (sep < 8.5) { out.push(['日光灼伤(' + sep.toFixed(1) + '°)', -5]); score -= 5; }
      else if (sep < 17) { out.push(['在日光束下(' + sep.toFixed(1) + '°)', -4]); score -= 4; }
    }
    out.push([d < 180 ? '东出(先于日)' : '西入(后于日)', 0]);
  }

  // 4) 月相：月亮离角
  if (moon && sun && p.name === '月亮') {
    const e = (moon.lon - sun.lon + 360) % 360;
    if (e < 180) { out.push(['增光(渐盈)', +2]); score += 2; }
    else { out.push(['减光(渐亏)', -2]); score -= 2; }
  }

  return { items: out, score };
}

function dignityOf(name, sign) {`
  );

  // 渲染时把偶然尊贵也列出
  dp = dp.replace(
    `  const rows = planets.map((p) => {
    const d = dignityOf(p.name, p.sign);
    return \`<tr><td class="pn">\${p.name}</td><td>\${p.sign} \${p.deg}°</td>
      <td class="dg \${d.cls}">\${d.level}</td><td class="hm">第\${p.house ?? '?'}宫</td></tr>\`;
  }).join('');`,
    `  const allPlanets = data?.natal?.planets ?? [];
  const sun = allPlanets.find((x) => x.name === '太阳');
  const moon = allPlanets.find((x) => x.name === '月亮');
  const rows = planets.map((p) => {
    const d = dignityOf(p.name, p.sign);
    const acc = accidentalDignity(p, sun, moon);
    const sign = acc.score > 0 ? 'a' : acc.score < 0 ? 'b' : 'n';
    const accTxt = acc.items.map(([k, v]) => v ? \`\${k}\${v > 0 ? '+' : ''}\${v}\` : k).join(' · ');
    return \`<tr><td class="pn">\${p.name}</td><td>\${p.sign} \${p.deg}°</td>
      <td class="dg \${d.cls}">\${d.level}</td>
      <td class="dg \${sign}">\${acc.score > 0 ? '+' : ''}\${acc.score}</td>
      <td class="mut2">\${accTxt}</td></tr>\`;
  }).join('');`
  );

  dp = dp.replace(
    `<table class="holo-tb"><thead><tr><th>行星</th><th>星座</th><th>尊贵</th><th>宫位</th></tr></thead>
    <tbody>\${rows || '<tr><td colspan="4" class="mut">排盘后显示</td></tr>'}</tbody></table>
    <div class="holo-note">庙=入庙(强) 旺=曜升(强) 陷=入陷(弱) 落=落陷(弱) 平=无尊贵</div>`,
    `<table class="holo-tb"><thead><tr><th>行星</th><th>星座</th><th>本质尊贵</th><th>偶然<br>评分</th><th>偶然尊贵明细</th></tr></thead>
    <tbody>\${rows || '<tr><td colspan="5" class="mut">排盘后显示</td></tr>'}</tbody></table>
    <div class="holo-note">
      <b>本质尊贵</b>（星座决定）：庙=入庙 +5 ｜ 旺=曜升 +4 ｜ 陷=入陷 −4 ｜ 落=落陷 −5 ｜ 平=无<br>
      <b>偶然尊贵</b>（位置与状态决定）：角宫 +3 / 续宫 +1 / 果宫 −2 ｜ 顺行 +2 / 逆行 −2 ｜
      日光灼伤 −5 / 光束下 −4 ｜ 月亮增光 +2 / 减光 −2
    </div>`
  );

  fs.writeFileSync('web/dignity-panel.js', dp, 'utf8');
  console.log('② 偶然尊贵已加入');
} else console.log('② 已有');
