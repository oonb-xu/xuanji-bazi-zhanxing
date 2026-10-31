// 庙旺陷落列表 + 相位↔刑冲对应（全息悬浮）
const SIGN = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];

// 古典尊贵（标准表）
const DIGNITY = {
  太阳: { dom: ['狮子'], exa: ['白羊'], det: ['水瓶'], fal: ['天秤'] },
  月亮: { dom: ['巨蟹'], exa: ['金牛'], det: ['摩羯'], fal: ['天蝎'] },
  水星: { dom: ['双子','处女'], exa: ['处女'], det: ['射手','双鱼'], fal: ['双鱼'] },
  金星: { dom: ['金牛','天秤'], exa: ['双鱼'], det: ['天蝎','白羊'], fal: ['处女'] },
  火星: { dom: ['白羊','天蝎'], exa: ['摩羯'], det: ['天秤','金牛'], fal: ['巨蟹'] },
  木星: { dom: ['射手','双鱼'], exa: ['巨蟹'], det: ['双子','处女'], fal: ['摩羯'] },
  土星: { dom: ['摩羯','水瓶'], exa: ['天秤'], det: ['巨蟹','狮子'], fal: ['白羊'] },
};

// 相位 ↔ 八字刑冲
const ASPECT_MAP = [
  ['合相 0°',   '合 / 会',  '同气相聚，力量叠加'],
  ['对冲 180°', '冲',       '正面对抗，克方胜'],
  ['四分相 90°','刑',       '摩擦、拉扯、内耗'],
  ['三分相 120°','三合（半合）', '顺势相生'],
  ['六分相 60°','六合',      '温和助力'],
  ['梅花相 150°','（无直接对应）', '八字无此角，作补充'],
];

// ★ 偶然尊贵（古典占星）：用现有数据可算的项
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

function dignityOf(name, sign) {
  const d = DIGNITY[name];
  if (!d) return { level: '—', cls: 'x' };
  if (d.dom.includes(sign)) return { level: '庙', cls: 'a' };
  if (d.exa.includes(sign)) return { level: '旺', cls: 'a' };
  if (d.det.includes(sign)) return { level: '陷', cls: 'b' };
  if (d.fal.includes(sign)) return { level: '落', cls: 'b' };
  return { level: '平', cls: 'n' };
}

function render(data) {
  const planets = (data?.natal?.planets ?? []).filter((p) =>
    typeof p?.lon === 'number' && DIGNITY[p.name]);
  const allPlanets = data?.natal?.planets ?? [];
  const sun = allPlanets.find((x) => x.name === '太阳');
  const moon = allPlanets.find((x) => x.name === '月亮');
  const rows = planets.map((p) => {
    const d = dignityOf(p.name, p.sign);
    const acc = accidentalDignity(p, sun, moon);
    const sign = acc.score > 0 ? 'a' : acc.score < 0 ? 'b' : 'n';
    const accTxt = acc.items.map(([k, v]) => v ? `${k}${v > 0 ? '+' : ''}${v}` : k).join(' · ');
    return `<tr><td class="pn">${p.name}</td><td>${p.sign} ${p.deg}°</td>
      <td class="dg ${d.cls}">${d.level}</td>
      <td class="dg ${sign}">${acc.score > 0 ? '+' : ''}${acc.score}</td>
      <td class="mut2">${accTxt}</td></tr>`;
  }).join('');

  return `
  <div class="holo-card">
    <div class="holo-h">尊贵状态 <span>庙 · 旺 · 陷 · 落</span></div>
    <table class="holo-tb"><thead><tr><th>行星</th><th>星座</th><th>本质尊贵</th><th>偶然<br>评分</th><th>偶然尊贵明细</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="mut">排盘后显示</td></tr>'}</tbody></table>
    <div class="holo-note">
      <b>本质尊贵</b>（星座决定）：庙=入庙 +5 ｜ 旺=曜升 +4 ｜ 陷=入陷 −4 ｜ 落=落陷 −5 ｜ 平=无<br>
      <b>偶然尊贵</b>（位置与状态决定）：角宫 +3 / 续宫 +1 / 果宫 −2 ｜ 顺行 +2 / 逆行 −2 ｜
      日光灼伤 −5 / 光束下 −4 ｜ 月亮增光 +2 / 减光 −2
    </div>
  </div>
  <div class="holo-card">
    <div class="holo-h">相位 ⇄ 刑冲 <span>两套体系的对抗语言</span></div>
    <table class="holo-tb"><thead><tr><th>西方相位</th><th>八字</th><th>含义</th></tr></thead>
    <tbody>${ASPECT_MAP.map(([a, b, c]) => `<tr><td class="pn">${a}</td><td class="dg a">${b}</td><td class="mut2">${c}</td></tr>`).join('')}</tbody></table>
    <div class="holo-note">仅作**结构对照**，不是等价替换；置信度中低（经验类 0.2–0.4）</div>
  </div>`;
}

window.__renderDignity = function (data) {
  const host = document.querySelector('#dignity-host');
  if (!host) return;
  host.innerHTML = render(data);
};
