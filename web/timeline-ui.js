// 时序页渲染：四钟并排 + 换格标记 + 不互通补充
const API = '/api/timeline';
const q = (s, r = document) => r.querySelector(s);

const el = (tag, props, ...kids) => {
  const n = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) {
    if (k === null || k === undefined || k === false) continue;
    n.append(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return n;
};

function renderTimeline(D) {
  const root = el('div', { class: 'tl' });

  // ── 摘要 ──
  root.append(el('div', { class: 'card' },
    el('div', { class: 'kpis' },
      el('div', { class: 'kpi' }, el('div', { class: 'k' }, '范围'), el('div', { class: 'v' }, `${D.range.from}–${D.range.to}`)),
      el('div', { class: 'kpi' }, el('div', { class: 'k' }, '年数'), el('div', { class: 'v' }, String(D.range.count))),
      el('div', { class: 'kpi' }, el('div', { class: 'k' }, '大运换步'), el('div', { class: 'v' }, String(D.transitions.dayunChange.length))),
      el('div', { class: 'kpi' }, el('div', { class: 'k' }, '次运月换座'), el('div', { class: 'v' }, String(D.transitions.progMoonSign.length))),
      el('div', { class: 'kpi' }, el('div', { class: 'k' }, '行运土星换宫'), el('div', { class: 'v' }, String(D.transitions.transitSaturnHouse.length))),
    ),
    el('div', { class: 'note' }, D.clockNote),
  ));

  // ── 四钟并排表 ──
  const tbl = el('table', { class: 'tl-table' });
  tbl.append(el('thead', null, el('tr', null,
    ['年', '岁', '八字·大运', '八字·流年', '次运·月亮', '次运·太阳', '行运·土星', '行运·木星', '标记'].map((t) => el('th', null, t)))));
  const tb = el('tbody');
  const dyChg = new Set(D.transitions.dayunChange.map((x) => x.year));
  const pmChg = new Set(D.transitions.progMoonSign.map((x) => x.year));
  const tsChg = new Set(D.transitions.transitSaturnHouse.map((x) => x.year));

  for (const r of D.rows) {
    const marks = [];
    if (dyChg.has(r.year)) marks.push('大运');
    if (pmChg.has(r.year)) marks.push('次运');
    if (tsChg.has(r.year)) marks.push('土星');
    const tr = el('tr', { class: marks.length ? 'mark' : '' },
      el('td', null, String(r.year)),
      el('td', null, r.age + ''),
      el('td', { class: 'bazi' }, r.bazi.dayun ?? '—'),
      el('td', { class: 'bazi' }, r.bazi.liunian ?? '—'),
      el('td', { class: 'astro' }, r.astro.progression['月亮']?.sign ?? '—'),
      el('td', { class: 'astro' }, r.astro.progression['太阳']?.sign ?? '—'),
      el('td', { class: 'astro' }, (r.astro.transit['土星']?.sign ?? '—') + (r.astro.transit['土星']?.house ? `(${r.astro.transit['土星'].house}宫)` : '')),
      el('td', { class: 'astro' }, (r.astro.transit['木星']?.sign ?? '—') + (r.astro.transit['木星']?.house ? `(${r.astro.transit['木星'].house}宫)` : '')),
      el('td', { class: 'mk' }, marks.join(' · ') || ''),
    );
    tb.append(tr);
  }
  tbl.append(tb);
  root.append(el('div', { class: 'card' },
    el('h3', { class: 'tl-h' }, '四钟并排（同一行＝同一年）'),
    el('div', { class: 'tl-scroll' }, tbl),
    el('div', { class: 'note' }, '高亮行＝该年至少有一个钟换了格。四钟刻度不同，所以换格年份不会同步。'),
  ));

  // ── 互通 / 不互通 ──
  root.append(el('div', { class: 'card' },
    el('h3', { class: 'tl-h' }, '能对齐的（互通层）'),
    el('ul', { class: 'tl-list' },
      el('li', null, '共同轴：' + (D.alignment?.sharedAxis ?? '年份')),
      ...(D.alignment?.canAlign ?? []).map((x) => el('li', null, '✓ ' + x))),
    el('h3', { class: 'tl-h', style: 'margin-top:16px' }, '不能合并的（补充内容）'),
    el('div', { class: 'note' }, D.supplement?.note ?? ''),
    el('ul', { class: 'tl-list bad' }, ...(D.supplement?.nonAlignable ?? []).map((x) => el('li', null, x))),
  ));

  return root;
}

function initTimeline() {
  const form = q('#f-timeline');
  const out = q('#timeline-out');
  if (!form || !out) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {};
    for (const [k, v] of fd.entries()) body[k] = v;
    for (const k of ['lng', 'lat', 'fromYear', 'toYear']) if (body[k] !== undefined) body[k] = Number(body[k]);
    out.replaceChildren(el('div', { class: 'card empty' }, '计算中…'));
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? '失败');
      out.replaceChildren(renderTimeline(json.data));
    } catch (err) {
      out.replaceChildren(el('div', { class: 'card err', role: 'alert' }, '请求失败：' + err.message));
    }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTimeline);
else initTimeline();
