// ① 命宫/身宫 融入行星（挂在黄道环上，连到 太阳/月亮）
// ② 庙旺陷落列表 + 相位↔刑冲对应（悬浮全息面板）
// ③ 全息质感（CSS）
import fs from 'node:fs';

/* ══════════ ① fusion3d.js：命宫/身宫 节点 ══════════ */
let s = fs.readFileSync('web/fusion3d.js', 'utf8');

if (!s.includes('drawAuxNodes')) {
  s = s.replace(
    "  /* ── 把排好序的球体送给 WebGL（远到近） ── */",
    `  /* ── ★ 命宫 / 身宫 融入行星：挂在黄道环上，连到 月亮 / 太阳 ── */
  if (DATA.aux) {
    try {
      for (const aux of DATA.aux) {
        const cA = toCam(mul(eclToVec(aux.lon), PLANET_RING_R * 0.93));
        const cL = toCam(mul(eclToVec(aux.linkLon), PLANET_RING_R));
        if (cA.z <= 0.02 || cL.z <= 0.02) continue;
        const A = toScreen(cA), Lp = toScreen(cL);

        // 连线
        ctx.save();
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(Lp.x, Lp.y);
        ctx.strokeStyle = aux.color; ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 4]); ctx.shadowColor = aux.color; ctx.shadowBlur = 6;
        ctx.stroke(); ctx.restore();

        // 节点（菱形）
        ctx.save();
        ctx.translate(A.x, A.y); ctx.rotate(PI / 4);
        ctx.fillStyle = 'rgba(6,14,24,0.9)';
        ctx.strokeStyle = aux.color; ctx.lineWidth = 1.3;
        ctx.shadowColor = aux.color; ctx.shadowBlur = 8;
        ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();

        // 标签
        txt(aux.label, A.x, A.y - 13, { color: aux.color, size: 9, bold: true, glow: 6 });
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ── 把排好序的球体送给 WebGL（远到近） ── */`
  );

  /* 计算 aux（命宫/身宫）：挂到月亮/太阳的黄经上，略偏移 */
  s = s.replace(
    "    aspects: data.natal?.aspects ?? data.aspects ?? [],\n    sunLon: sun?.lon ?? null,",
    `    aspects: data.natal?.aspects ?? data.aspects ?? [],
    sunLon: sun?.lon ?? null,
    aux: (() => {
      const arr = [];
      const moon = (Array.isArray(planets) ? planets : Object.values(planets)).find((p) => p?.name === '月亮');
      const sun2 = (Array.isArray(planets) ? planets : Object.values(planets)).find((p) => p?.name === '太阳');
      // 命宫 ↔ 月亮（-14° 挂靠），身宫 ↔ 太阳（+14° 挂靠）
      if (moon && typeof moon.lon === 'number') {
        arr.push({ label: '命宫 ' + (b.mingGong || ''), lon: moon.lon - 14, linkLon: moon.lon, color: 'rgba(180,150,255,0.85)' });
      }
      if (sun2 && typeof sun2.lon === 'number') {
        arr.push({ label: '身宫 ' + (b.shenGong || ''), lon: sun2.lon + 14, linkLon: sun2.lon, color: 'rgba(255,170,90,0.85)' });
      }
      return arr;
    })(),`
  );
  fs.writeFileSync('web/fusion3d.js', s, 'utf8');
  console.log('① 命宫/身宫 已融入行星层');
} else console.log('① 已存在');

/* ══════════ ② 庙旺陷落 + 相位↔刑冲 面板 ══════════ */
fs.writeFileSync('web/dignity-panel.js', `// 庙旺陷落列表 + 相位↔刑冲对应（全息悬浮）
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
  const rows = planets.map((p) => {
    const d = dignityOf(p.name, p.sign);
    return \`<tr><td class="pn">\${p.name}</td><td>\${p.sign} \${p.deg}°</td>
      <td class="dg \${d.cls}">\${d.level}</td><td class="hm">第\${p.house ?? '?'}宫</td></tr>\`;
  }).join('');

  return \`
  <div class="holo-card">
    <div class="holo-h">尊贵状态 <span>庙 · 旺 · 陷 · 落</span></div>
    <table class="holo-tb"><thead><tr><th>行星</th><th>星座</th><th>尊贵</th><th>宫位</th></tr></thead>
    <tbody>\${rows || '<tr><td colspan="4" class="mut">排盘后显示</td></tr>'}</tbody></table>
    <div class="holo-note">庙=入庙(强) 旺=曜升(强) 陷=入陷(弱) 落=落陷(弱) 平=无尊贵</div>
  </div>
  <div class="holo-card">
    <div class="holo-h">相位 ⇄ 刑冲 <span>两套体系的对抗语言</span></div>
    <table class="holo-tb"><thead><tr><th>西方相位</th><th>八字</th><th>含义</th></tr></thead>
    <tbody>\${ASPECT_MAP.map(([a, b, c]) => \`<tr><td class="pn">\${a}</td><td class="dg a">\${b}</td><td class="mut2">\${c}</td></tr>\`).join('')}</tbody></table>
    <div class="holo-note">仅作**结构对照**，不是等价替换；置信度中低（经验类 0.2–0.4）</div>
  </div>\`;
}

window.__renderDignity = function (data) {
  const host = document.querySelector('#dignity-host');
  if (!host) return;
  host.innerHTML = render(data);
};
`,'utf8');
console.log('② dignity-panel.js 已写入');
