const body = { at: '1990-05-20T10:30', gender: '女', lng: 116.4, lat: 39.9, tz: 8 };

async function probe(url) {
  const r = await fetch('http://127.0.0.1:8788' + url, {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
  });
  const j = await r.json();
  const d = j.data ?? j;
  console.log('\n===== ' + url + ' =====');
  if (!j.ok) { console.log('  ❌', j.error); return null; }
  console.log('  顶层键:', Object.keys(d).join(','));
  return d;
}

const fus = await probe('/api/fusion');
if (fus) {
  /* 找 ASC / 宫位 / 紫微 相关字段 */
  const dump = (obj, path = '', depth = 0) => {
    if (depth > 2 || !obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? path + '.' + k : k;
      const low = k.toLowerCase();
      if (/asc|rising|mc\b|house|宫|ziwei|紫微|cusp|ang|旋转|anchor/.test(low) || /asc|rising|house|cusp|ziwei/i.test(k)) {
        const t = Array.isArray(v) ? 'array[' + v.length + ']' : (v && typeof v === 'object' ? 'obj{' + Object.keys(v).slice(0, 8).join(',') + '}' : JSON.stringify(v)?.slice(0, 80));
        console.log('  ' + p.padEnd(34) + t);
        if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) dump(v, p, depth + 1);
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
          console.log('      [0] =', JSON.stringify(v[0]).slice(0, 160));
        }
      }
      if (v && typeof v === 'object' && depth < 1) dump(v, p, depth + 1);
    }
  };
  dump(fus);
}

const nat = await probe('/api/natal');
if (nat) {
  console.log('  asc 字段:', JSON.stringify(nat.asc ?? nat.ascendant ?? nat.angles ?? '（无）').slice(0, 200));
  console.log('  houses:', Array.isArray(nat.houses) ? nat.houses.length + ' 个，[0]=' + JSON.stringify(nat.houses[0]).slice(0, 120) : typeof nat.houses);
  console.log('  ziwei 顶层:', nat.ziwei ? JSON.stringify(nat.ziwei).slice(0, 260) : '（无）');
}
