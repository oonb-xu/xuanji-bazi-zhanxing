import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', '.git', '.venv', '.tmp', '.npm-cache', '.ephemeris', 'dist', 'reports', 'web-lab']);
const hits = { anon: [], city: [], birth: [] };

function walk(dir) {
  let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (!/\.(md|json|jsonl|mjs|js|html|txt|yml)$/i.test(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative('.', p);
    if (/\.bak/.test(rel)) continue;
    let t; try { t = fs.readFileSync(p, 'utf8'); } catch { continue; }
    const L = t.split('\n');
    L.forEach((l, i) => {
      if (l.includes('（已匿名）')) hits.anon.push(rel + ':' + (i + 1) + '  ' + l.trim().slice(0, 90));
      if (/某市/.test(l)) hits.city.push(rel + ':' + (i + 1) + '  ' + l.trim().slice(0, 90));
      if (/\b(19|20)\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(l) && /出生|birth|排盘/.test(l)) {
        hits.birth.push(rel + ':' + (i + 1) + '  ' + l.trim().slice(0, 90));
      }
    });
  }
}
walk('.');

const show = (k, title, max) => {
  console.log('\n=== ' + title + ' (' + hits[k].length + ') ===');
  hits[k].slice(0, max).forEach(x => console.log('  ' + x));
  if (hits[k].length > max) console.log('  … 还有 ' + (hits[k].length - max) + ' 条');
};
show('anon', '残留「（已匿名）」', 10);
show('city', '「某市」出现位置', 10);
show('birth', '出生时刻 + 出生语境的同行', 12);

/* 视频幕数 */
const v = fs.readFileSync('web/video-intro.html', 'utf8');
console.log('\n=== 宣传视频 ===');
console.log('  分幕数: ' + (v.match(/class="scene/g) || []).length);
console.log('  总时长: ' + [...v.matchAll(/data-dur="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0) / 1000 + ' 秒');
console.log('  人物名残留: ' + (['张雪峰', '雷军', '马云'].filter(n => v.includes(n)).join(',') || '无 ✅'));

/* GitHub 标准文件清单 */
const REQ = ['README.md', 'LICENSE', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'PRIVACY.md',
  'CHANGELOG.md', '.gitignore', '.editorconfig',
  '.github/workflows/ci.yml', '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/data_correction.yml'];
console.log('\n=== GitHub 标准文件 ===');
for (const f of REQ) console.log('  ' + (fs.existsSync(f) ? '✅' : '❌') + ' ' + f);
